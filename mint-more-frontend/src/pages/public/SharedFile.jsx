import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { mintboxApi } from '../../api/mintbox'
import Icon from '../../components/ui/Icon'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'

export default function SharedFile() {
	const { token } = useParams()
	const { data: file, isLoading, isError } = useQuery({
		queryKey: ['mintbox-public-file', token],
		queryFn: () => mintboxApi.getPublicFile(token).then(res => res.data?.data?.file),
	})
	const contentUrl = `${BASE}/mintbox/public/files/${token}/content`
	const isImage = file?.mime_type?.startsWith('image/')
	const isVideo = file?.mime_type?.startsWith('video/')
	const isAudio = file?.mime_type?.startsWith('audio/')
	const isPdf = file?.mime_type === 'application/pdf'

	if (isLoading) return <div style={{ padding: 40 }}>Loading shared file...</div>
	if (isError || !file) return <div className="empty" style={{ margin: 40 }}><h3>Shared file not found</h3><p>The link may be invalid.</p></div>

	return (
		<div style={{ minHeight: '100vh', background: 'var(--paper-tint)', padding: 24 }}>
			<div style={{ maxWidth: 1100, margin: '0 auto' }}>
				<div className="row between" style={{ gap: 16, marginBottom: 18 }}>
					<div>
						<div className="h-eyebrow">Mintbox shared file</div>
						<h1 className="h-display h-2" style={{ margin: '5px 0 0' }}>{file.original_name}</h1>
					</div>
					<a className="btn primary" href={`${contentUrl}?download=1`}><Icon name="download" size={13} /> Download</a>
				</div>
				<div style={{ minHeight: 500, background: 'var(--paper)', border: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
					{isImage && <img src={contentUrl} alt={file.original_name} style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain' }} />}
					{isVideo && <video src={contentUrl} controls style={{ width: '100%', maxHeight: '75vh' }} />}
					{isAudio && <audio src={contentUrl} controls />}
					{isPdf && <iframe src={contentUrl} title={file.original_name} style={{ width: '100%', height: '75vh', border: 0 }} />}
					{!isImage && !isVideo && !isAudio && !isPdf && <div className="empty" style={{ border: 0 }}><div className="empty-glyph"><Icon name="file" /></div><h3>Preview unavailable</h3><p>Download the file to open it.</p></div>}
				</div>
			</div>
		</div>
	)
}
