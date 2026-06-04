import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { mintboxApi } from '../../api/mintbox'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import { timeAgo } from '../../utils/format'
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

export default function Mintbox() {
	const { jobId, token } = useParams()
	const navigate = useNavigate()
	const fileRef = useRef(null)
	const queryClient = useQueryClient()
	const role = useAuthStore(s => s.user?.role)
	const pushToast = useUIStore(s => s.pushToast)
	const [note, setNote] = useState('')
	const [reviewNotes, setReviewNotes] = useState({})

	const queryKey = token ? ['mintbox-share', token] : ['mintbox-job', jobId]
	const { data, isLoading } = useQuery({
		queryKey,
		queryFn: async () => {
			const res = token ? await mintboxApi.getSharedFolder(token) : await mintboxApi.getJobFolder(jobId)
			return res.data?.data
		},
	})

	const folder = data?.folder
	const files = data?.files || []
	const quota = data?.quota
	const shareUrl = folder?.share_token ? `${window.location.origin}/mintbox/share/${folder.share_token}` : ''
	const usedPct = quota?.limit ? Math.min(100, (quota.used / quota.limit) * 100) : 0

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

	const copyShare = async () => {
		await navigator.clipboard.writeText(shareUrl)
		pushToast({ title: 'Folder link copied', icon: 'copy' })
	}

	const sortedFiles = useMemo(() => files, [files])

	if (isLoading) return (
		<div className="stack-6">
			<SkeletonCard />
			<SkeletonCard />
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

			<div className="card reveal" style={{ padding: 18 }}>
				<div className="row between" style={{ marginBottom: 10 }}>
					<div className="h-eyebrow">Storage</div>
					<span className="mono" style={{ fontSize: 12 }}>{formatBytes(quota?.used)} / {formatBytes(quota?.limit)}</span>
				</div>
				<div style={{ height: 7, background: 'var(--hairline)', borderRadius: 4, overflow: 'hidden' }}>
					<div style={{ height: '100%', width: `${usedPct}%`, background: usedPct > 90 ? 'var(--rose)' : 'var(--mint-500)' }} />
				</div>
			</div>

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
		</div>
	)
}
