import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as tus from 'tus-js-client'
import { mintboxApi } from '../../api/mintbox'
import { addonsApi } from '../../api/addons'
import { walletApi } from '../../api/wallet'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import Avatar from '../../components/ui/Avatar'
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

const showLegacyFileGrid = import.meta.env.VITE_SHOW_LEGACY_MINTBOX_GRID === 'true'

const inferredMimeTypes = {
	psd: 'application/vnd.adobe.photoshop',
	ai: 'application/postscript',
	eps: 'application/postscript',
	zip: 'application/zip',
	rar: 'application/vnd.rar',
	'7z': 'application/x-7z-compressed',
	otf: 'font/otf',
	ttf: 'font/ttf',
	woff: 'font/woff',
	woff2: 'font/woff2',
}

const getFileType = (file) => {
	if (file.type) return file.type
	const extension = file.name.split('.').pop()?.toLowerCase()
	return inferredMimeTypes[extension] || 'application/octet-stream'
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
	const { jobId, token, categoryToken } = useParams()
	const navigate = useNavigate()
	const fileRef = useRef(null)
	const queryClient = useQueryClient()
	const role = useAuthStore(s => s.user?.role)
	const pushToast = useUIStore(s => s.pushToast)
	const [note, setNote] = useState('')
	const [reviewNotes, setReviewNotes] = useState({})
	const [confirmPlan, setConfirmPlan] = useState(null)
	const [approvedFileId, setApprovedFileId] = useState(null)
	const [showRating, setShowRating] = useState(false)
	const [completionReview, setCompletionReview] = useState({
		rating_quality: 0,
		brief_adherence_rating: 0,
		timeliness_rating: 0,
		rating_communication: 0,
		review_text: '',
	})
	const [uploadState, setUploadState] = useState({ status: 'idle', progress: 0, file: null, error: '', uploadId: null })
	const uploadRef = useRef(null)

	const isOverview = !jobId && !token && !categoryToken
	const queryKey = useMemo(() => (
		categoryToken ? ['mintbox-category-share', categoryToken] : token ? ['mintbox-share', token] : jobId ? ['mintbox-job', jobId] : ['mintbox']
	), [categoryToken, jobId, token])
	const { data, isLoading } = useQuery({
		queryKey,
		queryFn: async () => {
			const res = categoryToken
				? await mintboxApi.getSharedCategory(categoryToken)
				: token
				? await mintboxApi.getSharedFolder(token)
				: jobId
				? await mintboxApi.getJobFolder(jobId)
				: await mintboxApi.getFolders()
			return res.data?.data
		},
	})

	const folder = data?.folder
	const folders = data?.folders || []
	const files = useMemo(() => data?.files || [], [data?.files])
	const quota = data?.quota
	const uploadPolicy = data?.upload_policy
	const revisions = data?.revisions
	const categoryShares = data?.category_shares || []
	const shareUrl = folder?.share_token && !folder?.share_revoked_at ? `${window.location.origin}/mintbox/share/${folder.share_token}` : ''
	const canDeleteMintboxContent = Boolean(folder?.job_id) && ['client', 'admin'].includes(role) && !token && !categoryToken

	useEffect(() => {
		if (!folder?.job_id || !['client', 'freelancer', 'designer', 'admin'].includes(role)) return
		mintboxApi.markSeen(folder.job_id)
			.then(() => queryClient.invalidateQueries({ queryKey }))
			.catch(() => {})
	}, [folder?.job_id, queryClient, queryKey, role])

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

	const startUpload = async (file) => {
		if (!file || !folder) return
		const extension = `.${file.name.split('.').pop()?.toLowerCase()}`
		const fileType = getFileType(file)
		if (uploadPolicy?.max_file_size_bytes && file.size > Number(uploadPolicy.max_file_size_bytes)) {
			pushToast({ title: 'File is too large', body: `Maximum size is ${uploadPolicy.max_file_size_mb}MB`, tone: 'amber', icon: 'x' })
			return
		}
		const allowedByType = uploadPolicy?.allowed_file_types?.includes(fileType)
		const allowedByExtension = uploadPolicy?.allowed_extensions?.includes(extension)
		if (uploadPolicy?.allowed_file_types?.length && !allowedByType && !allowedByExtension) {
			pushToast({ title: 'File type not allowed', body: fileType, tone: 'amber', icon: 'x' })
			return
		}

		setUploadState({ status: 'preparing', progress: 0, file, error: '', uploadId: null })
		try {
			const prepared = await mintboxApi.prepareUpload(folder.job_id, {
				name: file.name,
				size: file.size,
				type: fileType,
				note: note.trim() || undefined,
			})
			const config = prepared.data?.data?.upload
			setUploadState(prev => ({ ...prev, uploadId: config.upload_id }))
			await new Promise((resolve, reject) => {
			const upload = new tus.Upload(file, {
				endpoint: config.endpoint,
				// Version the fingerprint so tus-js-client never resumes uploads
				// created against the old unsigned endpoint.
				fingerprint: () => Promise.resolve(`mintbox-signed-v1-${config.upload_id}`),
				retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
				chunkSize: config.policy?.chunk_size_bytes || 6 * 1024 * 1024,
				uploadDataDuringCreation: true,
				removeFingerprintOnSuccess: true,
				headers: {
					'x-signature': String(config.token || '').trim(),
				},
				metadata: {
					bucketName: config.bucket,
					objectName: config.storage_path,
					contentType: fileType,
					cacheControl: '3600',
				},
				onProgress: (uploaded, total) => {
					setUploadState(prev => ({ ...prev, status: 'uploading', progress: Math.round((uploaded / total) * 100), error: '' }))
				},
				onError: (error) => {
					setUploadState(prev => ({ ...prev, status: 'failed', error: error.message || 'Upload failed' }))
					reject(error)
				},
				onSuccess: async () => {
					try {
						await mintboxApi.completeUpload(config.upload_id)
						setUploadState({ status: 'complete', progress: 100, file: null, error: '', uploadId: null })
						setNote('')
						queryClient.invalidateQueries({ queryKey })
						queryClient.invalidateQueries({ queryKey: ['mintbox'] })
						pushToast({ title: 'Uploaded to Mintbox', icon: 'check' })
						resolve()
					} catch (error) {
						setUploadState(prev => ({ ...prev, status: 'failed', error: error.response?.data?.message || 'Upload finished but could not be finalized' }))
						reject(error)
					}
				},
			})
			uploadRef.current = upload
			upload.start()
			})
		} catch (error) {
			setUploadState({ status: 'failed', progress: 0, file, error: error.response?.data?.message || error.message || 'Could not prepare upload', uploadId: null })
			throw error
		}
	}

	const startUploads = async (fileList) => {
		const selected = Array.from(fileList || [])
		for (const file of selected) {
			try {
				await startUpload(file)
			} catch {
				break
			}
		}
	}

	const pauseUpload = async () => {
		await uploadRef.current?.abort()
		setUploadState(prev => ({ ...prev, status: 'paused' }))
	}

	const resumeUpload = () => {
		uploadRef.current?.start()
		setUploadState(prev => ({ ...prev, status: 'uploading', error: '' }))
	}

	const retryUpload = () => {
		if (uploadRef.current) {
			resumeUpload()
		} else if (uploadState.file) {
			startUpload(uploadState.file)
		}
	}

	const cancelUpload = async () => {
		await uploadRef.current?.abort(true)
		if (uploadState.uploadId) {
			try {
				await mintboxApi.cancelUpload(uploadState.uploadId)
			} catch {
				// The signed upload may already have expired or completed.
			}
		}
		uploadRef.current = null
		setUploadState({ status: 'idle', progress: 0, file: null, error: '', uploadId: null })
	}

	const reviewMutation = useMutation({
		mutationFn: ({ fileId, action }) => mintboxApi.reviewFile(fileId, {
			action,
			note: reviewNotes[fileId] || undefined,
		}),
		onSuccess: (_, variables) => {
			pushToast({ title: 'Review saved', icon: 'check' })
			if (variables.action === 'approve') setApprovedFileId(variables.fileId)
			if (variables.action === 'revision') setApprovedFileId(null)
			queryClient.invalidateQueries({ queryKey })
			queryClient.invalidateQueries({ queryKey: ['wallet'] })
			queryClient.invalidateQueries({ queryKey: ['notifications'] })
		},
		onError: err => pushToast({ title: 'Review failed', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' }),
	})

	const completeMutation = useMutation({
		mutationFn: () => mintboxApi.completeProject(folder.job_id, completionReview),
		onSuccess: () => {
			pushToast({ title: 'Project completed', body: 'Your review was submitted and escrow was released.', icon: 'check' })
			queryClient.invalidateQueries({ queryKey: ['jobs'] })
			queryClient.invalidateQueries({ queryKey: ['wallet'] })
			navigate(`/jobs/${folder.job_id}`)
		},
		onError: err => pushToast({ title: 'Could not complete project', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' }),
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

	const revokeShareMutation = useMutation({
		mutationFn: ({ scope, id }) => mintboxApi.revokeShare(scope, id),
		onSuccess: (_, variables) => {
			pushToast({ title: 'Share link revoked', icon: 'check' })
			queryClient.invalidateQueries({ queryKey })
			if (variables.scope === 'folder') navigate(`/mintbox/jobs/${folder.job_id}`)
		},
		onError: err => pushToast({ title: 'Could not revoke link', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' }),
	})
	const rotateShareMutation = useMutation({
		mutationFn: ({ scope, id }) => mintboxApi.rotateShare(scope, id),
		onSuccess: () => {
			pushToast({ title: 'New share link created', icon: 'check' })
			queryClient.invalidateQueries({ queryKey })
		},
		onError: err => pushToast({ title: 'Could not create link', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' }),
	})
	const deleteFileMutation = useMutation({
		mutationFn: (fileId) => mintboxApi.deleteFile(fileId),
		onSuccess: () => {
			pushToast({ title: 'File deleted', icon: 'trash' })
			queryClient.invalidateQueries({ queryKey })
			queryClient.invalidateQueries({ queryKey: ['mintbox'] })
		},
		onError: err => pushToast({ title: 'Could not delete file', body: err.response?.data?.message || 'Try again', tone: 'danger', icon: 'x' }),
	})
	const deleteCategoryMutation = useMutation({
		mutationFn: (category) => mintboxApi.deleteCategory(folder.job_id, category),
		onSuccess: () => {
			pushToast({ title: 'Folder deleted', icon: 'trash' })
			queryClient.invalidateQueries({ queryKey })
			queryClient.invalidateQueries({ queryKey: ['mintbox'] })
		},
		onError: err => pushToast({ title: 'Could not delete folder', body: err.response?.data?.message || 'Try again', tone: 'danger', icon: 'x' }),
	})
	const deleteProjectMutation = useMutation({
		mutationFn: () => mintboxApi.deleteProject(folder.job_id),
		onSuccess: () => {
			pushToast({ title: 'Project files deleted', icon: 'trash' })
			queryClient.invalidateQueries({ queryKey })
			queryClient.invalidateQueries({ queryKey: ['mintbox'] })
			navigate('/mintbox')
		},
		onError: err => pushToast({ title: 'Could not delete project', body: err.response?.data?.message || 'Try again', tone: 'danger', icon: 'x' }),
	})

	const copyShare = async () => {
		await navigator.clipboard.writeText(shareUrl)
		pushToast({ title: 'Folder link copied', icon: 'copy' })
	}
	const copyFileShare = async (file) => {
		await navigator.clipboard.writeText(`${window.location.origin}${file.share_url}`)
		pushToast({ title: 'File link copied', icon: 'copy' })
	}
	const copyCategoryShare = async (category) => {
		const share = categoryShares.find(item => item.category === category)
		if (!share) return
		await navigator.clipboard.writeText(`${window.location.origin}${share.share_url}`)
		pushToast({ title: 'Folder link copied', icon: 'copy' })
	}

	const sortedFiles = useMemo(() => files, [files])
	const sharedFolders = useMemo(() => sortedFiles.reduce((groups, file) => {
		const category = file.purpose === 'brief' ? 'brief' : (file.file_category || 'other')
		if (!groups[category]) groups[category] = []
		groups[category].push(file)
		return groups
	}, {}), [sortedFiles])
	const groupedFiles = useMemo(() => sortedFiles.reduce((groups, file) => {
		const category = file.purpose === 'brief' ? 'brief' : (file.file_category || 'other')
		if (!groups[category]) groups[category] = []
		groups[category].push(file)
		return groups
	}, {}), [sortedFiles])
	const conversationItems = useMemo(() => {
		const fileItems = sortedFiles.map(file => ({
			id: `file-${file.id}`,
			kind: 'file',
			created_at: file.created_at,
			mine: file.uploaded_by_role === role,
			file,
		}))
		const feedbackItems = (revisions?.rounds || []).flatMap(round =>
			(round.feedback || []).map(feedback => ({
				id: `feedback-${feedback.id}`,
				kind: 'feedback',
				created_at: feedback.created_at,
				mine: role === 'client',
				round,
				feedback,
			}))
		)
		return [...fileItems, ...feedbackItems].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
	}, [sortedFiles, revisions?.rounds, role])
	const categoryMeta = {
		brief: { label: 'Brief references', icon: 'paperclip', hint: 'Source material from the client' },
		photos: { label: 'Photos & design', icon: 'image', hint: 'Drop JPG, PNG, PSD, AI or EPS files' },
		audio: { label: 'Music & sounds', icon: 'microphone', hint: 'Drop MP3 or WAV files' },
		video: { label: 'Video', icon: 'video', hint: 'Drop MP4, MOV or WebM files' },
		documents: { label: 'Documents', icon: 'file', hint: 'Drop PDF, Office, TXT or CSV files' },
		archives: { label: 'Archives', icon: 'layers', hint: 'ZIP, RAR and 7Z packages' },
		other: { label: 'Other files', icon: 'paperclip', hint: 'Other supported project files' },
	}
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
	const completionDecisionModal = approvedFileId && !showRating && (
		<Modal
			title="Delivery approved"
			subtitle="What would you like to do next?"
			onClose={() => setApprovedFileId(null)}
			footer={(
				<>
					<button
						className="btn ghost"
						onClick={() => reviewMutation.mutate({ fileId: approvedFileId, action: 'revision' })}
						disabled={reviewMutation.isPending || !String(reviewNotes[approvedFileId] || '').trim()}
					>
						<Icon name="refresh" size={13} /> Request another revision
					</button>
					<button className="btn primary" onClick={() => setShowRating(true)}>
						<Icon name="check" size={13} /> Complete & rate
					</button>
				</>
			)}
		>
			<p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ink-600)', lineHeight: 1.6 }}>
				Complete the project when you are satisfied. Escrow is released only after you submit your rating.
			</p>
			<textarea
				className="textarea"
				rows={3}
				value={reviewNotes[approvedFileId] || ''}
				onChange={e => setReviewNotes(prev => ({ ...prev, [approvedFileId]: e.target.value }))}
				placeholder="For another revision, describe exactly what should change..."
			/>
		</Modal>
	)
	const ratingModal = approvedFileId && showRating && (
		<Modal
			title="Complete project"
			subtitle="Rate the creative before escrow is released"
			onClose={() => setShowRating(false)}
			maxWidth={520}
			footer={(
				<>
					<button className="btn ghost" onClick={() => setShowRating(false)}>Back</button>
					<button
						className="btn primary"
						onClick={() => completeMutation.mutate()}
						disabled={completeMutation.isPending || ['rating_quality', 'brief_adherence_rating', 'timeliness_rating', 'rating_communication'].some(key => !completionReview[key])}
					>
						<Icon name="check" size={13} /> {completeMutation.isPending ? 'Completing...' : 'Submit review & release escrow'}
					</button>
				</>
			)}
		>
			<div className="stack" style={{ gap: 14 }}>
				{[
					['rating_quality', 'Quality of work'],
					['brief_adherence_rating', 'Brief adherence'],
					['timeliness_rating', 'Timeliness'],
					['rating_communication', 'Communication'],
				].map(([key, label]) => (
					<div className="row between" key={key} style={{ gap: 16 }}>
						<span style={{ fontSize: 13 }}>{label}</span>
						<div className="row" style={{ gap: 5 }}>
							{[1, 2, 3, 4, 5].map(value => (
								<button
									key={value}
									type="button"
									className="icon-btn"
									aria-label={`${label}: ${value} stars`}
									onClick={() => setCompletionReview(prev => ({ ...prev, [key]: value }))}
									style={{ color: value <= completionReview[key] ? '#F59E0B' : 'var(--ink-300)' }}
								>
									<Icon name="star" size={16} />
								</button>
							))}
						</div>
					</div>
				))}
				<textarea
					className="textarea"
					rows={4}
					value={completionReview.review_text}
					onChange={e => setCompletionReview(prev => ({ ...prev, review_text: e.target.value }))}
					placeholder="Share a short review (optional)"
				/>
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

			<div className="card reveal" style={{ padding: 18, overflow: 'hidden' }}>
				<div className="h-eyebrow" style={{ marginBottom: 12 }}>Delivery conversation</div>
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
				<div className="row" style={{ gap: 8 }}>
					{jobId && ['client', 'freelancer', 'designer'].includes(role) && (
						<button className="btn ghost" onClick={() => navigate(`/disputes?jobId=${folder.job_id}`)}>
							<Icon name="shield" size={13} /> Get support
						</button>
					)}
					{shareUrl && <>
					<button className="btn ghost" onClick={copyShare}>
						<Icon name="copy" size={13} />
						Copy folder link
					</button>
					{role === 'client' && <button className="icon-btn" onClick={() => revokeShareMutation.mutate({ scope: 'folder', id: folder.id })} title="Revoke folder share link"><Icon name="x" size={12} /></button>}
					</>}
					{role === 'client' && !shareUrl && <button className="btn ghost" onClick={() => rotateShareMutation.mutate({ scope: 'folder', id: folder.id })}><Icon name="refresh" size={13} /> Create folder link</button>}
					{canDeleteMintboxContent && (
						<button
							className="btn ghost"
							onClick={() => {
								if (window.confirm('Delete all files in this project Mintbox? This removes them from the project view and revokes share links.')) deleteProjectMutation.mutate()
							}}
						>
							<Icon name="trash" size={13} /> Delete project files
						</button>
					)}
				</div>
			</div>

			{quota && <StorageBar quota={quota} />}

			{revisions && <div className="card reveal" style={{ padding: 18 }}>
				<div className="row between" style={{ gap: 14, marginBottom: 14 }}>
					<div>
						<div className="h-eyebrow">Project folders</div>
						<div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Files are automatically organized by type. Every file has its own share link.</div>
					</div>
					<span className="badge neutral">{Object.keys(sharedFolders).length} folders</span>
				</div>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
					{Object.entries(sharedFolders).map(([category, categoryFiles]) => (
						<div key={category} style={{ border: '1px solid var(--hairline)', padding: 12, background: 'var(--paper-tint)' }}>
							<div className="row between" style={{ gap: 8, marginBottom: 9 }}>
								<div className="row" style={{ gap: 7 }}>
									<Icon name={categoryMeta[category]?.icon || 'file'} size={13} />
									<strong style={{ fontSize: 12.5 }}>{categoryMeta[category]?.label || category}</strong>
								</div>
								<div className="row" style={{ gap: 5 }}>
									<span className="badge neutral">{categoryFiles.length}</span>
									{categoryShares.find(item => item.category === category)?.share_url && <button className="icon-btn" onClick={() => copyCategoryShare(category)} title="Copy folder share link"><Icon name="copy" size={11} /></button>}
									{role === 'client' && categoryShares.find(item => item.category === category)?.share_url && <button className="icon-btn" onClick={() => revokeShareMutation.mutate({ scope: 'category', id: categoryShares.find(item => item.category === category).id })} title="Revoke folder share link"><Icon name="x" size={11} /></button>}
									{role === 'client' && categoryShares.find(item => item.category === category)?.id && !categoryShares.find(item => item.category === category)?.share_url && <button className="icon-btn" onClick={() => rotateShareMutation.mutate({ scope: 'category', id: categoryShares.find(item => item.category === category).id })} title="Create new folder share link"><Icon name="refresh" size={11} /></button>}
									{canDeleteMintboxContent && <button className="icon-btn" onClick={() => { if (window.confirm(`Delete the ${categoryMeta[category]?.label || category} folder and all files inside it?`)) deleteCategoryMutation.mutate(category) }} title="Delete folder"><Icon name="trash" size={11} /></button>}
								</div>
							</div>
							<div className="stack" style={{ gap: 5 }}>
								{categoryFiles.map(file => (
									<div key={file.id} className="row between" style={{ gap: 8, fontSize: 11.5 }}>
										{file.share_url ? <a href={file.share_url} target="_blank" rel="noreferrer" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink-700)' }}>{file.original_name}</a> : <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.original_name}</span>}
										<div className="row" style={{ gap: 4 }}>
											{file.share_url && <button className="icon-btn" onClick={() => copyFileShare(file)} title="Copy file share link"><Icon name="copy" size={11} /></button>}
											{role === 'client' && file.share_url && <button className="icon-btn" onClick={() => revokeShareMutation.mutate({ scope: 'file', id: file.id })} title="Revoke file share link"><Icon name="x" size={11} /></button>}
											{role === 'client' && !file.share_url && <button className="icon-btn" onClick={() => rotateShareMutation.mutate({ scope: 'file', id: file.id })} title="Create new file share link"><Icon name="refresh" size={11} /></button>}
											{canDeleteMintboxContent && <button className="icon-btn" onClick={() => { if (window.confirm(`Delete ${file.original_name}?`)) deleteFileMutation.mutate(file.id) }} title="Delete file"><Icon name="trash" size={11} /></button>}
										</div>
									</div>
								))}
							</div>
						</div>
					))}
					{Object.keys(sharedFolders).length === 0 && <div className="muted" style={{ fontSize: 12.5 }}>Folders appear automatically when files are added.</div>}
				</div>
			</div>}

			<div className="card reveal" style={{ padding: 18 }}>
				<div className="row between" style={{ gap: 14, alignItems: 'flex-start' }}>
					<div>
						<div className="h-eyebrow" style={{ marginBottom: 6 }}>Revision terms</div>
						<div style={{ fontSize: 13, color: 'var(--ink-700)', lineHeight: 1.6 }}>
							{revisions?.definition || 'One revision includes all feedback sent within 24 hours after delivery.'}
						</div>
						<div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 5 }}>
							The first {revisions?.free_rounds || 3} rounds are included. Further rounds cost {rupee(revisions?.paid_revision_price || 20)} each and are paid directly to the creative.
						</div>
					</div>
					<span className="badge neutral">{revisions?.completed_rounds || 0} completed</span>
				</div>
				{revisions?.active_round && (
					<div style={{ marginTop: 12, padding: 10, border: '1px solid var(--hairline)', background: 'var(--paper-tint)', borderRadius: 'var(--radius-md)', fontSize: 12.5 }}>
						<strong>Revision {revisions.active_round.round_number}</strong> is open
						{Number(revisions.active_round.charge_amount) > 0 ? ` - ${rupee(revisions.active_round.charge_amount)} paid` : ' - included'}
					</div>
				)}
				<div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 10 }}>
					Both parties acknowledge these terms by accepting the order.
				</div>
			</div>

			{['freelancer', 'designer'].includes(role) && (
				<div className="card reveal" style={{ padding: 18 }}>
					<div className="row between" style={{ gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
						<div>
							<div className="h-eyebrow" style={{ marginBottom: 6 }}>Submit work</div>
							<div style={{ fontSize: 13, color: 'var(--ink-600)' }}>Upload finished work, drafts, or revised files for the client to review.</div>
						</div>
						<button className="btn primary" onClick={() => fileRef.current?.click()} disabled={['preparing', 'uploading', 'paused'].includes(uploadState.status)}>
							<Icon name="upload" size={13} />
							{['preparing', 'uploading'].includes(uploadState.status) ? 'Uploading...' : 'Choose files'}
						</button>
						<input
							ref={fileRef}
							type="file"
							multiple
							accept={uploadPolicy?.allowed_file_types?.join(',')}
							style={{ display: 'none' }}
							onChange={(e) => {
								if (e.target.files?.length) startUploads(e.target.files)
								e.target.value = ''
							}}
						/>
					</div>
					<div
						onDragOver={e => e.preventDefault()}
						onDrop={e => {
							e.preventDefault()
							if (e.dataTransfer.files?.length) startUploads(e.dataTransfer.files)
						}}
						onClick={() => fileRef.current?.click()}
						style={{ border: '1px dashed var(--ink-300)', padding: 18, cursor: 'pointer', marginBottom: 12, background: 'var(--paper-tint)' }}
					>
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
							{Object.entries(categoryMeta).slice(0, 4).map(([key, meta]) => (
								<div key={key} style={{ minHeight: 78, border: '1px solid var(--hairline)', background: 'var(--paper)', padding: 12, display: 'flex', gap: 9, alignItems: 'flex-start' }}>
									<Icon name={meta.icon} size={15} />
									<div>
										<div style={{ fontSize: 12.5, fontWeight: 600 }}>{meta.label}</div>
										<div style={{ fontSize: 10.5, color: 'var(--ink-500)', marginTop: 4, lineHeight: 1.4 }}>{meta.hint}</div>
									</div>
								</div>
							))}
						</div>
					</div>
					<textarea
						className="textarea"
						rows={2}
						value={note}
						onChange={e => setNote(e.target.value)}
						placeholder="Optional note for the client..."
					/>
					<div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 8 }}>
						JPG, PNG, WebP, GIF, TIFF, SVG, PSD, AI, EPS, PDF, ZIP, RAR, 7Z, MP4, MOV, WebM, MP3, WAV, fonts, Office documents, TXT and CSV. Maximum {uploadPolicy?.max_file_size_mb || 2048}MB per file.
					</div>

					{uploadState.status !== 'idle' && (
						<div style={{ marginTop: 14, padding: 12, background: 'var(--paper-tint)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)' }}>
							<div className="row between" style={{ gap: 12, marginBottom: 8 }}>
								<div style={{ minWidth: 0 }}>
									<div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
										{uploadState.file?.name || 'Upload complete'}
									</div>
									<div style={{ fontSize: 11.5, color: uploadState.status === 'failed' ? 'var(--rose)' : 'var(--ink-500)', marginTop: 2 }}>
										{uploadState.status === 'failed' ? uploadState.error : uploadState.status === 'complete' ? 'Upload complete' : `${uploadState.progress}% uploaded - resumable`}
									</div>
								</div>
								<div className="row" style={{ gap: 6, flexShrink: 0 }}>
									{uploadState.status === 'failed' && uploadState.file && (
										<button className="btn ghost sm" onClick={retryUpload}>
											<Icon name="refresh" size={12} /> Retry
										</button>
									)}
									{uploadState.status === 'uploading' && (
										<button className="btn ghost sm" onClick={pauseUpload}>Pause</button>
									)}
									{uploadState.status === 'paused' && (
										<button className="btn ghost sm" onClick={resumeUpload}>Resume</button>
									)}
									{['preparing', 'uploading', 'paused'].includes(uploadState.status) && (
										<button className="btn ghost sm" onClick={cancelUpload}>Cancel</button>
									)}
								</div>
							</div>
							<div style={{ height: 6, background: 'var(--hairline)', borderRadius: 3, overflow: 'hidden' }}>
								<div style={{ height: '100%', width: `${uploadState.progress}%`, background: uploadState.status === 'failed' ? 'var(--rose)' : 'var(--mint-500)', transition: 'width 0.2s ease' }} />
							</div>
						</div>
					)}
				</div>
			)}

			<div className="card reveal" style={{ padding: 18 }}>
				<div className="row between" style={{ gap: 16, marginBottom: 16 }}>
					<div>
						<div className="h-eyebrow">Messages & deliveries</div>
						<div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Project files and revision feedback stay together in one conversation.</div>
					</div>
					<span className="badge neutral">{conversationItems.length} messages</span>
				</div>

				<div style={{ padding: 18, background: 'var(--paper-tint)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', minHeight: 220 }}>
					{conversationItems.length === 0 ? (
						<div className="empty" style={{ border: 0, padding: 32 }}>
							<div className="empty-glyph"><Icon name="upload" /></div>
							<h3>No messages yet</h3>
							<p>References, deliveries, and revision feedback will appear here.</p>
						</div>
					) : conversationItems.map(item => {
						if (item.kind === 'feedback') {
							return (
								<div key={item.id} className={`offer-card ${item.mine ? 'me' : 'them'}`}>
									<div className="row between" style={{ gap: 12 }}>
										<div className="row" style={{ gap: 8 }}>
											<Avatar name={item.mine ? 'You' : 'Client'} size="sm" />
											<strong style={{ fontSize: 12.5 }}>{item.mine ? 'You' : 'Client'}</strong>
											<span className="muted" style={{ fontSize: 12 }}>requested a revision</span>
										</div>
										<span className="muted" style={{ fontSize: 11.5 }}>Round {item.round.round_number}</span>
									</div>
									<div className="msg">{item.feedback.feedback_text || item.feedback.note || 'Revision requested'}</div>
									<div className="row between" style={{ gap: 12, marginTop: 10 }}>
										<span className="muted" style={{ fontSize: 11.5 }}>{timeAgo(item.created_at)}</span>
										{item.mine && <span className="muted" style={{ fontSize: 11.5 }}>{item.feedback.seen_by_freelancer_at ? 'Seen' : 'Delivered'}</span>}
									</div>
								</div>
							)
						}

						const file = item.file
						const seen = ['freelancer', 'designer'].includes(role) ? file.seen_by_client_at : file.seen_by_freelancer_at
						const action = file.purpose === 'brief'
							? 'shared a reference'
							: file.revision_round
								? 'delivered a revision'
								: 'delivered work'

						return (
							<div key={item.id} className={`offer-card ${item.mine ? 'me' : 'them'}`}>
								<div className="row between" style={{ gap: 12 }}>
									<div className="row" style={{ gap: 8 }}>
										<Avatar name={item.mine ? 'You' : file.uploaded_by_name} size="sm" />
										<strong style={{ fontSize: 12.5 }}>{item.mine ? 'You' : file.uploaded_by_name}</strong>
										<span className="muted" style={{ fontSize: 12 }}>{action}</span>
									</div>
									{file.revision_round && <span className="muted" style={{ fontSize: 11.5 }}>Round {file.revision_round}</span>}
								</div>

								<div
									className="offer-row"
									role={file.public_url ? 'link' : undefined}
									tabIndex={file.public_url ? 0 : undefined}
									onClick={() => file.public_url && window.open(file.public_url, '_blank', 'noopener,noreferrer')}
									onKeyDown={e => { if (file.public_url && e.key === 'Enter') window.open(file.public_url, '_blank', 'noopener,noreferrer') }}
									style={{ textDecoration: 'none', alignItems: 'center', cursor: file.public_url ? 'pointer' : 'default' }}
								>
									<span style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--hairline)', background: 'var(--paper)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
										<Icon name="file" size={14} />
									</span>
									<span style={{ minWidth: 0 }}>
										<span className="big" style={{ display: 'block', fontFamily: 'inherit', fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.original_name}</span>
										<span className="small">{formatBytes(Number(file.size_bytes))}</span>
									</span>
								</div>

								{file.freelancer_note && <div className="msg">{file.freelancer_note}</div>}
								<div className="row between" style={{ gap: 12, marginTop: 10 }}>
									<span className={`badge ${file.status === 'approved' ? 'mint' : file.status === 'revision_requested' ? 'amber' : 'neutral'}`}>
										<span className="bdot" /> {statusLabel[file.status] || file.status}
									</span>
									<div className="row" style={{ gap: 6 }}>
										<span className="muted" style={{ fontSize: 11.5 }}>{timeAgo(file.created_at)}{item.mine ? ` - ${seen ? 'Seen' : 'Delivered'}` : ''}</span>
										{canDeleteMintboxContent && (
											<button className="icon-btn" onClick={() => { if (window.confirm(`Delete ${file.original_name}?`)) deleteFileMutation.mutate(file.id) }} title="Delete file">
												<Icon name="trash" size={11} />
											</button>
										)}
									</div>
								</div>

								{role === 'client' && file.purpose !== 'brief' && file.status !== 'approved' && (
									<div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline)' }}>
										<input
											className="input"
											value={reviewNotes[file.id] || ''}
											onChange={e => setReviewNotes(prev => ({ ...prev, [file.id]: e.target.value }))}
											placeholder="Describe what needs changing..."
											style={{ marginBottom: 8 }}
										/>
										<div className="row" style={{ gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
											<button className="btn ghost" onClick={() => reviewMutation.mutate({ fileId: file.id, action: 'revision' })} disabled={reviewMutation.isPending}>
												<Icon name="refresh" size={13} /> Request revision
											</button>
											<button className="btn primary" onClick={() => reviewMutation.mutate({ fileId: file.id, action: 'approve' })} disabled={reviewMutation.isPending}>
												<Icon name="check" size={13} /> Accept delivery
											</button>
										</div>
									</div>
								)}
								{role === 'client' && file.purpose !== 'brief' && file.status === 'approved' && (
									<div className="row" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline)', justifyContent: 'flex-end' }}>
										<button className="btn primary" onClick={() => setApprovedFileId(file.id)}>
											<Icon name="check" size={13} /> Continue project completion
										</button>
									</div>
								)}
							</div>
						)
					})}
				</div>
			</div>

			{showLegacyFileGrid && <div className="card reveal" style={{ padding: 0, overflow: 'hidden' }}>
				{sortedFiles.length === 0 ? (
					<div className="empty" style={{ border: 0, padding: 48 }}>
						<div className="empty-glyph"><Icon name="upload" /></div>
						<h3>No files yet</h3>
						<p>Submitted work will appear here.</p>
					</div>
				) : (
					Object.entries(groupedFiles).map(([category, categoryFiles]) => (
						<div key={category} style={{ marginTop: 12 }}>
							<div style={{ padding: '10px 0', borderBottom: '1px solid var(--hairline)' }}>
								<div className="row" style={{ gap: 8 }}>
									<Icon name={categoryMeta[category]?.icon || 'file'} size={13} />
									<strong style={{ fontSize: 12.5 }}>{categoryMeta[category]?.label || category}</strong>
									<span className="muted" style={{ fontSize: 11.5 }}>{categoryFiles.length}</span>
								</div>
							</div>
							{categoryFiles.map((file) => (
						<div key={file.id} style={{ width: 'min(720px, 90%)', marginTop: 12, marginLeft: file.uploaded_by_role === role ? 'auto' : 0, padding: 16, border: `1px solid ${file.uploaded_by_role === role ? 'var(--mint-300)' : 'var(--hairline)'}`, background: file.uploaded_by_role === role ? 'var(--mint-50)' : 'var(--paper)', borderRadius: 'var(--radius-md)' }}>
							<div className="row between" style={{ gap: 14, alignItems: 'flex-start' }}>
								<div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
									<div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--paper-tint)', border: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
										<Icon name="file" size={15} />
									</div>
									<div style={{ minWidth: 0 }}>
										<a href={file.public_url} target="_blank" rel="noreferrer" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-950)', textDecoration: 'none' }}>
											{file.original_name}
										</a>
										{file.uploaded_by_role === role && (
											<div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 4 }}>
												{(['freelancer', 'designer'].includes(role) ? file.seen_by_client_at : file.seen_by_freelancer_at) ? 'Seen' : 'Delivered'}
											</div>
										)}
										{file.revision_round && <div style={{ fontSize: 11.5, color: 'var(--mint-700)', marginTop: 4 }}>Revised delivery · Round {file.revision_round}</div>}
										<div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 3 }}>
											{formatBytes(Number(file.size_bytes))} · {file.uploaded_by_name} · {timeAgo(file.created_at)}
										</div>
										{file.freelancer_note && <div style={{ fontSize: 12.5, color: 'var(--ink-600)', marginTop: 8 }}>{file.freelancer_note}</div>}
										{file.client_note && <div style={{ fontSize: 12.5, color: 'var(--amber)', marginTop: 8 }}>Client note: {file.client_note}</div>}
									</div>
								</div>
								<div className="row" style={{ gap: 6 }}>
									<span className={`badge ${file.status === 'approved' ? 'mint' : file.status === 'revision_requested' ? 'amber' : 'neutral'}`}>
										<span className="bdot" /> {statusLabel[file.status] || file.status}
									</span>
									{canDeleteMintboxContent && (
										<button className="icon-btn" onClick={() => { if (window.confirm(`Delete ${file.original_name}?`)) deleteFileMutation.mutate(file.id) }} title="Delete file">
											<Icon name="trash" size={11} />
										</button>
									)}
								</div>
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
							))}
						</div>
					))
				)}
			</div>}

			{purchaseModal}
			{completionDecisionModal}
			{ratingModal}
		</div>
	)
}
