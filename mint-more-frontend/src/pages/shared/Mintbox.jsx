import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { mintboxApi } from '../../api/mintbox'
import { addonsApi } from '../../api/addons'
import { walletApi } from '../../api/wallet'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import Modal from '../../components/ui/Modal'
import { rupee, timeAgo } from '../../utils/format'
import { SkeletonCard } from '../../components/ui/Skeleton'

const GB = 1024 * 1024 * 1024

const formatBytes = (bytes = 0) => {
	if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`
	if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
	if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${bytes} B`
}

const statusLabel = {
	submitted: 'Submitted',
	revision_requested: 'Revision requested',
	approved: 'Approved',
}

function StorageBar({ quota }) {
	const usedPct = quota?.limit ? Math.min(100, (quota.used / quota.limit) * 100) : 0
	return (
		<div className="card reveal" style={{ padding: 18 }}>
			<div className="row between" style={{ marginBottom: 10 }}>
				<div className="h-eyebrow">Storage</div>
				<span className="mono" style={{ fontSize: 12 }}>{formatBytes(quota?.used)} / {formatBytes(quota?.limit)}</span>
			</div>
			<div style={{ height: 7, background: 'var(--hairline)', borderRadius: 4, overflow: 'hidden' }}>
				<div style={{ height: '100%', width: `${usedPct}%`, background: usedPct > 90 ? 'var(--rose)' : 'var(--mint-500)' }} />
			</div>
		</div>
	)
}

export default function Mintbox() {
	const { jobId, token } = useParams()
	const navigate = useNavigate()
	const fileRef = useRef(null)
	const queryClient = useQueryClient()
	const role = useAuthStore(s => s.user?.role)
	const pushToast = useUIStore(s => s.pushToast)
	const [note, setNote] = useState('')
	const [reviewNotes, setReviewNotes] = useState({})
	const [confirmPlan, setConfirmPlan] = useState(null)

	const isOverview = !jobId && !token
	const queryKey = token ? ['mintbox-share', token] : jobId ? ['mintbox-job', jobId] : ['mintbox']
	const { data, isLoading } = useQuery({
		queryKey,
		queryFn: async () => {
			const res = token
				? await mintboxApi.getSharedFolder(token)
				: jobId
				? await mintboxApi.getJobFolder(jobId)
				: await mintboxApi.getFolders()
			return res.data?.data
		},
	})

	const folder = data?.folder
	const folders = data?.folders || []
	const files = data?.files || []
	const quota = data?.quota
	const shareUrl = folder?.share_token ? `${window.location.origin}/mintbox/share/${folder.share_token}` : ''

	const { data: plansData } = useQuery({
		queryKey: ['addon-plans'],
		queryFn: () => addonsApi.plans().then(r => r.data?.data),
		enabled: role === 'client',
	})

	const { data: walletData } = useQuery({
		queryKey: ['wallet'],
		queryFn: () => walletApi.get().then(r => r.data?.data),
		enabled: role === 'client',
	})

	const storagePlans = (plansData?.plans || []).filter(plan =>
		Number(plan.storage_gb || 0) > 0 || plan.features?.includes('mintbox_storage')
	)
	const walletBalance = Number(walletData?.wallet?.balance ?? 0)

	const uploadMutation = useMutation({
		mutationFn: (file) => {
			const fd = new FormData()
			fd.append('file', file)
			if (note.trim()) fd.append('note', note.trim())
			return mintboxApi.uploadWork(folder.job_id, fd)
		},
		onSuccess: () => {
			pushToast({ title: 'Uploaded to Mintbox', icon: 'check' })
			setNote('')
			queryClient.invalidateQueries({ queryKey })
		},
		onError: err => pushToast({ title: 'Upload failed', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' }),
	})

	const reviewMutation = useMutation({
		mutationFn: ({ fileId, action }) => mintboxApi.reviewFile(fileId, {
			action,
			note: reviewNotes[fileId] || undefined,
		}),
		onSuccess: () => {
			pushToast({ title: 'Review saved', icon: 'check' })
			queryClient.invalidateQueries({ queryKey })
		},
		onError: err => pushToast({ title: 'Review failed', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' }),
	})

	const purchaseMutation = useMutation({
		mutationFn: (planId) => addonsApi.purchase(planId),
		onSuccess: (res) => {
			pushToast({ title: `${res.data?.data?.plan?.name || 'Storage'} added`, icon: 'check' })
			setConfirmPlan(null)
			queryClient.invalidateQueries({ queryKey: ['mintbox'] })
			queryClient.invalidateQueries({ queryKey: ['addon-plans'] })
			queryClient.invalidateQueries({ queryKey: ['wallet'] })
			if (jobId) queryClient.invalidateQueries({ queryKey: ['mintbox-job', jobId] })
		},
		onError: err => pushToast({ title: 'Purchase failed', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' }),
	})

	const copyShare = async () => {
		await navigator.clipboard.writeText(shareUrl)
		pushToast({ title: 'Folder link copied', icon: 'copy' })
	}

	const sortedFiles = useMemo(() => files, [files])
	const purchaseModal = confirmPlan && (
		<Modal
			title="Confirm storage add-on"
			subtitle={confirmPlan.name}
			onClose={() => setConfirmPlan(null)}
			maxWidth={420}
			footer={(
				<>
					<button className="btn ghost" onClick={() => setConfirmPlan(null)}>Cancel</button>
					<button className="btn primary" onClick={() => purchaseMutation.mutate(confirmPlan.id)} disabled={purchaseMutation.isPending || walletBalance < Number(confirmPlan.price)}>
						{purchaseMutation.isPending ? 'Processing...' : `Pay ${rupee(confirmPlan.price)}`}
					</button>
				</>
			)}
		>
			<div className="stack" style={{ gap: 12 }}>
				<div className="row between"><span className="muted">Storage</span><strong>{confirmPlan.storage_gb} GB</strong></div>
				<div className="row between"><span className="muted">Duration</span><strong>{confirmPlan.duration_days} days</strong></div>
				<div className="row between"><span className="muted">Price</span><strong className="mono">{rupee(confirmPlan.price)}</strong></div>
				{walletBalance < Number(confirmPlan.price) && (
					<div style={{ color: 'var(--amber)', fontSize: 12 }}>Add {rupee(Number(confirmPlan.price) - walletBalance)} to your wallet first.</div>
				)}
			</div>
		</Modal>
	)

	if (isLoading) return (
		<div className="stack-6">
			<SkeletonCard />
			<SkeletonCard />
		</div>
	)

	if (isOverview) return (
		<div className="stack-6">
			<div className="row between reveal" style={{ alignItems: 'flex-start', gap: 16 }}>
				<div>
					<div className="h-eyebrow" style={{ marginBottom: 4 }}>Mintbox</div>
					<h1 className="h-display h-1" style={{ margin: 0 }}>Project storage</h1>
					<p className="muted" style={{ marginTop: 6 }}>
						Every project gets its own folder for submissions, revisions, and final files.
					</p>
				</div>
				<button className="btn primary" onClick={() => navigate('/jobs')}>
					<Icon name="briefcase" size={13} /> View jobs
				</button>
			</div>

			<StorageBar quota={quota} />

			{storagePlans.length > 0 && (
				<div className="card reveal" style={{ padding: 18 }}>
					<div className="row between" style={{ gap: 14, marginBottom: 14 }}>
						<div>
							<div className="h-eyebrow" style={{ marginBottom: 6 }}>Storage add-ons</div>
							<div style={{ fontSize: 13, color: 'var(--ink-600)' }}>Add more Mintbox space when projects need larger files.</div>
						</div>
					</div>
					<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
						{storagePlans.map(plan => (
							<div key={plan.id} style={{ border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', padding: 14 }}>
								<div className="row between" style={{ marginBottom: 8 }}>
									<div style={{ fontWeight: 600, color: 'var(--ink-950)' }}>{plan.name}</div>
									<span className="badge mint">{Number(plan.storage_gb || 0)} GB</span>
								</div>
								<div className="mono" style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>{rupee(plan.price)}</div>
								<div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 12 }}>{plan.duration_days} days</div>
								<button className="btn primary block" onClick={() => setConfirmPlan(plan)} disabled={purchaseMutation.isPending}>
									<Icon name="plus" size={13} /> Add storage
								</button>
							</div>
						))}
					</div>
				</div>
			)}

			<div className="card reveal" style={{ padding: 0, overflow: 'hidden' }}>
				{folders.length === 0 ? (
					<div className="empty" style={{ border: 0, padding: 48 }}>
						<div className="empty-glyph"><Icon name="layers" /></div>
						<h3>No project folders yet</h3>
						<p>Post a brief and its Mintbox folder will appear here.</p>
						<button className="btn primary" onClick={() => navigate('/jobs/new')}>
							<Icon name="plus" /> Post a brief
						</button>
					</div>
				) : (
					folders.map((item, index) => (
						<button
							key={item.id}
							onClick={() => navigate(`/mintbox/jobs/${item.job_id}`)}
							style={{
								width: '100%',
								border: 0,
								borderTop: index === 0 ? 0 : '1px solid var(--hairline)',
								background: 'transparent',
								padding: 16,
								textAlign: 'left',
								cursor: 'pointer',
							}}
						>
							<div className="row between" style={{ gap: 14 }}>
								<div style={{ display: 'flex', gap: 12, minWidth: 0, alignItems: 'center' }}>
									<div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--paper-tint)', border: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
										<Icon name="layers" size={15} />
									</div>
									<div style={{ minWidth: 0 }}>
										<div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-950)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
											{item.name}
										</div>
										<div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 3 }}>
											{item.file_count || 0} files - {formatBytes(Number(item.storage_used || 0))}
										</div>
									</div>
								</div>
								<Icon name="arrowRight" size={13} />
							</div>
						</button>
					))
				)}
			</div>
			{purchaseModal}
		</div>
	)

	if (!folder) return (
		<div className="empty">
			<h3>Mintbox not found</h3>
			<button className="btn ghost" onClick={() => navigate('/jobs')}>Back to jobs</button>
		</div>
	)

	return (
		<div className="stack-6">
			<div className="row between reveal" style={{ alignItems: 'flex-start', gap: 16 }}>
				<div>
					<button className="btn link sm" style={{ padding: 0, color: 'var(--ink-500)', fontSize: 12 }} onClick={() => navigate(`/jobs/${folder.job_id}`)}>
						<Icon name="arrowLeft" size={12} /> Project
					</button>
					<div className="h-eyebrow" style={{ marginTop: 14, marginBottom: 4 }}>Mintbox</div>
					<h1 className="h-display h-1" style={{ margin: 0 }}>{folder.name}</h1>
					<p className="muted" style={{ marginTop: 6 }}>
						Project files, submissions, and revisions in one folder.
					</p>
				</div>
				<button className="btn ghost" onClick={copyShare}>
					<Icon name="copy" size={13} />
					Copy folder link
				</button>
			</div>

			<StorageBar quota={quota} />

			{role === 'freelancer' && (
				<div className="card reveal" style={{ padding: 18 }}>
					<div className="row between" style={{ gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
						<div>
							<div className="h-eyebrow" style={{ marginBottom: 6 }}>Submit work</div>
							<div style={{ fontSize: 13, color: 'var(--ink-600)' }}>Upload finished work, drafts, or revised files for the client to review.</div>
						</div>
						<button className="btn primary" onClick={() => fileRef.current?.click()} disabled={uploadMutation.isPending}>
							<Icon name="upload" size={13} />
							{uploadMutation.isPending ? 'Uploading...' : 'Upload file'}
						</button>
						<input
							ref={fileRef}
							type="file"
							style={{ display: 'none' }}
							onChange={(e) => {
								const file = e.target.files?.[0]
								if (file) uploadMutation.mutate(file)
								e.target.value = ''
							}}
						/>
					</div>
					<textarea
						className="textarea"
						rows={2}
						value={note}
						onChange={e => setNote(e.target.value)}
						placeholder="Optional note for the client..."
					/>
				</div>
			)}

			<div className="card reveal" style={{ padding: 0, overflow: 'hidden' }}>
				{sortedFiles.length === 0 ? (
					<div className="empty" style={{ border: 0, padding: 48 }}>
						<div className="empty-glyph"><Icon name="upload" /></div>
						<h3>No files yet</h3>
						<p>Submitted work will appear here.</p>
					</div>
				) : (
					sortedFiles.map((file, index) => (
						<div key={file.id} style={{ padding: 16, borderTop: index === 0 ? 0 : '1px solid var(--hairline)' }}>
							<div className="row between" style={{ gap: 14, alignItems: 'flex-start' }}>
								<div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
									<div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--paper-tint)', border: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
										<Icon name="file" size={15} />
									</div>
									<div style={{ minWidth: 0 }}>
										<a href={file.public_url} target="_blank" rel="noreferrer" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-950)', textDecoration: 'none' }}>
											{file.original_name}
										</a>
										<div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 3 }}>
											{formatBytes(Number(file.size_bytes))} · {file.uploaded_by_name} · {timeAgo(file.created_at)}
										</div>
										{file.freelancer_note && <div style={{ fontSize: 12.5, color: 'var(--ink-600)', marginTop: 8 }}>{file.freelancer_note}</div>}
										{file.client_note && <div style={{ fontSize: 12.5, color: 'var(--amber)', marginTop: 8 }}>Client note: {file.client_note}</div>}
									</div>
								</div>
								<span className={`badge ${file.status === 'approved' ? 'mint' : file.status === 'revision_requested' ? 'amber' : 'neutral'}`}>
									<span className="bdot" /> {statusLabel[file.status] || file.status}
								</span>
							</div>

							{role === 'client' && file.status !== 'approved' && (
								<div style={{ marginTop: 12, paddingLeft: 48 }}>
									<input
										className="input"
										value={reviewNotes[file.id] || ''}
										onChange={e => setReviewNotes(prev => ({ ...prev, [file.id]: e.target.value }))}
										placeholder="Optional revision note..."
										style={{ marginBottom: 8 }}
									/>
									<div className="row" style={{ gap: 8 }}>
										<button className="btn primary" onClick={() => reviewMutation.mutate({ fileId: file.id, action: 'approve' })} disabled={reviewMutation.isPending}>
											<Icon name="check" size={13} /> Satisfied
										</button>
										<button className="btn ghost" onClick={() => reviewMutation.mutate({ fileId: file.id, action: 'revision' })} disabled={reviewMutation.isPending}>
											<Icon name="refresh" size={13} /> Request revision
										</button>
									</div>
								</div>
							)}
						</div>
					))
				)}
			</div>

			{purchaseModal}
		</div>
	)
}
