import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useUIStore } from '../../store/ui'
import Icon from '../ui/Icon'
import { announceProfileUpdated } from './completionApi'

const DOCUMENTS = [
	{ value: 'aadhaar', label: 'Aadhaar Card', icon: 'user', pattern: /^\d{12}$/, hint: '12-digit Aadhaar number', back: true },
	{ value: 'pan', label: 'PAN Card', icon: 'file', pattern: /^[A-Z]{5}[0-9]{4}[A-Z]$/, hint: 'PAN, e.g. ABCDE1234F', back: false },
]

const inputClass = 'h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-ink-900 focus:outline-none'

function Field({ label, children, hint }) {
	return (
		<label className="block">
			<span className="mb-1.5 block text-[13px] font-medium text-ink-700">{label}</span>
			{children}
			{hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
		</label>
	)
}

function FilePick({ label, file, onChange, accept = 'image/*,.pdf' }) {
	return (
		<label className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3 transition-colors ${file ? 'border-ink-900 bg-ink-50' : 'border-ink-300 hover:bg-ink-50'}`}>
			<Icon name={file ? 'checkCircle' : 'upload'} size={18} className={file ? 'text-ink-900' : 'text-ink-500'} />
			<span className="min-w-0 flex-1">
				<span className="block text-sm font-medium text-ink-900">{label}</span>
				<span className="block truncate text-xs text-ink-500">{file ? file.name : 'JPG, PNG or PDF, up to 5 MB'}</span>
			</span>
			<input type="file" accept={accept} className="sr-only" onChange={e => onChange(e.target.files?.[0] || null)} />
		</label>
	)
}

const latestByLevel = (submissions = [], level) => submissions.find(item => item.level === level)
const usable = submission => submission && ['pending', 'approved'].includes(submission.status)

/**
 * "Complete your KYC": pick Aadhaar or PAN, then the details our review needs.
 * Submits personal details, the identity document and the address step in order,
 * skipping any part that is already submitted.
 */
export default function KycModal({ open, onClose }) {
	const queryClient = useQueryClient()
	const pushToast = useUIStore(s => s.pushToast)
	const [step, setStep] = useState('choose')
	const [docType, setDocType] = useState('')
	const [form, setForm] = useState({ document_number: '', date_of_birth: '', gender: '', address_line1: '', city: '', state: '', pincode: '' })
	const [files, setFiles] = useState({ document_front: null, document_back: null, selfie: null, address_proof: null })
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(false)

	const { data: kyc } = useQuery({
		queryKey: ['kyc-status'],
		queryFn: () => api.get('/kyc/status').then(r => r.data.data),
		enabled: open,
		refetchOnWindowFocus: false,
	})

	// Start fresh only when the form opens. This used to rerun whenever the page around it re-rendered
	// (the phone keyboard resizing the window, data refreshing after the file picker closed), which
	// threw people back to the first step mid-way through and made the form look like it vanished.
	const onCloseRef = useRef(onClose)
	useEffect(() => { onCloseRef.current = onClose }, [onClose])
	useEffect(() => {
		if (!open) return
		setStep('choose'); setError('')
		const onKey = e => e.key === 'Escape' && onCloseRef.current()
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [open])

	if (!open) return null

	const doc = DOCUMENTS.find(d => d.value === docType)
	const set = key => e => setForm(f => ({ ...f, [key]: key === 'document_number' ? e.target.value.toUpperCase().replace(/\s/g, '') : e.target.value }))
	const setFile = key => file => setFiles(f => ({ ...f, [key]: file }))
	const submissions = kyc?.submissions || []
	const needsBasic = !usable(latestByLevel(submissions, 'basic'))
	const underReview = kyc?.overall_status === 'pending' && usable(latestByLevel(submissions, 'address'))

	const detailsError = () => {
		if (!doc.pattern.test(form.document_number)) return `Enter a valid ${doc.hint}.`
		if (needsBasic && (!form.date_of_birth || !form.gender)) return 'Add your date of birth and gender.'
		if (!files.document_front) return `Upload the front of your ${doc.label}.`
		if (!files.selfie) return 'Add a selfie so we can match you to the document.'
		return ''
	}
	const addressError = () => {
		if (!form.address_line1.trim() || !form.city.trim() || !form.state.trim()) return 'Add your full address.'
		if (!/^\d{6}$/.test(form.pincode)) return 'Enter a 6-digit PIN code.'
		if (!doc.back && !files.address_proof) return 'Upload an address proof, such as a utility bill or bank statement.'
		return ''
	}

	const multipart = values => {
		const fd = new FormData()
		Object.entries(values).forEach(([key, value]) => value !== null && value !== '' && fd.append(key, value))
		return fd
	}

	const submit = async () => {
		const problem = addressError()
		if (problem) { setError(problem); return }
		setError(''); setBusy(true)
		try {
			if (needsBasic) {
				await api.post('/kyc/basic', { date_of_birth: form.date_of_birth, gender: form.gender, nationality: 'Indian' })
			}
			if (!usable(latestByLevel(submissions, 'identity'))) {
				await api.post('/kyc/identity', multipart({
					document_type: docType,
					document_number: form.document_number,
					document_front: files.document_front,
					document_back: files.document_back,
					selfie: files.selfie,
				}))
			}
			await api.post('/kyc/address', multipart({
				address_line1: form.address_line1,
				city: form.city,
				state: form.state,
				pincode: form.pincode,
				country: 'India',
				// Aadhaar carries the address, so it doubles as the proof.
				address_proof: files.address_proof || files.document_front,
			}))
			queryClient.invalidateQueries({ queryKey: ['kyc-status'] })
			queryClient.invalidateQueries({ queryKey: ['my-profile'] })
			announceProfileUpdated()
			window.dispatchEvent(new Event('creatyv:kyc-submitted'))
			pushToast({ title: 'KYC submitted', body: 'We will review it and let you know.', icon: 'check' })
			onClose()
		} catch (err) {
			setError(err?.response?.data?.errors?.join(' ') || err?.response?.data?.message || 'Could not submit KYC. Please try again.')
		} finally {
			setBusy(false)
		}
	}

	const next = () => {
		if (step === 'choose') { if (docType) setStep('details'); return }
		if (step === 'details') {
			const problem = detailsError()
			if (problem) { setError(problem); return }
			setError(''); setStep('address')
			return
		}
		submit()
	}
	const back = () => { setError(''); step === 'address' ? setStep('details') : step === 'details' ? setStep('choose') : onClose() }

	return (
		<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 font-store" role="dialog" aria-modal="true" aria-labelledby="kyc-title" onMouseDown={e => e.target === e.currentTarget && onClose()}>
			<div className="kyc-modal flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl">
				<div className="flex shrink-0 items-center justify-between border-b border-ink-100 px-5 py-3 sm:px-6 sm:py-4">
					<div className="flex min-w-0 items-center gap-2">
						<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint-50 text-mint-600"><Icon name="shield" size={18} /></span>
						<div className="min-w-0">
							<h2 id="kyc-title" className="truncate text-base font-semibold text-ink-900">Complete your KYC</h2>
							<p className="line-clamp-2 text-xs text-ink-500">We securely verify your identity. Provide the required information.</p>
						</div>
					</div>
					<button type="button" onClick={onClose} aria-label="Close" className="-mr-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100">
						<Icon name="x" size={20} />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
					{underReview ? (
						<div className="py-6 text-center">
							<p className="text-[15px] font-medium text-ink-900">Your KYC is under review</p>
							<p className="mt-1 text-sm text-ink-500">We will notify you once it is approved. Orders start after that.</p>
						</div>
					) : step === 'choose' ? (
						<div className="space-y-3">
							{DOCUMENTS.map(option => {
								const selected = docType === option.value
								return (
									<button
										key={option.value}
										type="button"
										onClick={() => setDocType(option.value)}
										aria-pressed={selected}
										className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${selected ? 'border-mint-500 bg-mint-50' : 'border-ink-200 bg-ink-50 hover:bg-ink-100'}`}
									>
										<span className="flex items-center gap-3">
											<Icon name={option.icon} size={20} className="text-ink-700" />
											<span className="text-sm font-medium text-ink-900">{option.label}</span>
										</span>
										<span className="text-xl text-ink-400">{selected ? <Icon name="check" size={18} className="text-mint-600" /> : '+'}</span>
									</button>
								)
							})}
						</div>
					) : step === 'details' ? (
						<div className="space-y-4">
							<Field label={`${doc.label} number`}>
								<input className={inputClass} value={form.document_number} onChange={set('document_number')} placeholder={doc.hint} inputMode={doc.value === 'aadhaar' ? 'numeric' : 'text'} maxLength={doc.value === 'aadhaar' ? 12 : 10} autoFocus />
							</Field>
							{needsBasic && (
								<div className="grid grid-cols-2 gap-3">
									<Field label="Date of birth"><input type="date" className={inputClass} value={form.date_of_birth} onChange={set('date_of_birth')} /></Field>
									<Field label="Gender">
										<select className={inputClass} value={form.gender} onChange={set('gender')}>
											<option value="">Select</option>
											<option value="female">Female</option>
											<option value="male">Male</option>
											<option value="non_binary">Non-binary</option>
											<option value="prefer_not_to_say">Prefer not to say</option>
										</select>
									</Field>
								</div>
							)}
							<FilePick label={`Front of ${doc.label}`} file={files.document_front} onChange={setFile('document_front')} />
							{doc.back && <FilePick label={`Back of ${doc.label} (optional)`} file={files.document_back} onChange={setFile('document_back')} />}
							<FilePick label="A selfie of you" file={files.selfie} onChange={setFile('selfie')} accept="image/*" />
						</div>
					) : (
						<div className="space-y-4">
							<Field label="Address"><input className={inputClass} value={form.address_line1} onChange={set('address_line1')} placeholder="House, street, area" autoFocus /></Field>
							<div className="grid grid-cols-2 gap-3">
								<Field label="City"><input className={inputClass} value={form.city} onChange={set('city')} /></Field>
								<Field label="State"><input className={inputClass} value={form.state} onChange={set('state')} /></Field>
							</div>
							<Field label="PIN code"><input className={inputClass} value={form.pincode} onChange={e => setForm(f => ({ ...f, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} inputMode="numeric" /></Field>
							{doc.back
								? <p className="text-xs text-ink-500">Your Aadhaar card is used as your address proof.</p>
								: <FilePick label="Address proof" file={files.address_proof} onChange={setFile('address_proof')} />}
						</div>
					)}
					{error && <p className="mt-4 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</p>}
				</div>

				<div className="flex shrink-0 justify-end gap-2 border-t border-ink-100 px-5 py-3 sm:px-6">
					<button type="button" onClick={underReview ? onClose : back} className="h-10 rounded-full border border-ink-200 px-4 text-sm font-medium text-ink-700 hover:bg-ink-100">
						{step === 'choose' || underReview ? 'Cancel' : 'Back'}
					</button>
					{!underReview && (
						<button type="button" onClick={next} disabled={busy || (step === 'choose' && !docType)} className="h-10 rounded-full bg-mint-500 px-5 text-sm font-semibold text-white hover:bg-mint-600 disabled:cursor-not-allowed disabled:opacity-60">
							{busy ? 'Submitting…' : step === 'address' ? 'Submit' : 'Continue'}
						</button>
					)}
				</div>
			</div>
		</div>
	)
}
