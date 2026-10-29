// The Creatyv helper: the editor's engine on the client's own computer. Only Creatyv pages can
// reach it (it checks the Origin), and footage goes from this page straight to it, never to us.

export const HELPER_URL = 'http://127.0.0.1:4321'

// The helper's key, from /hello. <video> and <img> send no Origin, so their links carry it.
let helperKey = ''

async function request(method, path, body) {
	const res = await fetch(`${HELPER_URL}/api${path}`, {
		method,
		headers: body ? { 'Content-Type': 'application/json' } : undefined,
		body: body ? JSON.stringify(body) : undefined,
	})
	const data = await res.json().catch(() => ({}))
	if (!res.ok) {
		const error = new Error(data.error || `The helper could not do that (${res.status}).`)
		error.code = data.code
		throw error
	}
	return data
}

export const helperApi = {
	/** Resolves with the helper's details, or null when it isn't running on this computer. */
	hello: async () => {
		try {
			const res = await fetch(`${HELPER_URL}/api/hello`, { signal: AbortSignal.timeout(2500) })
			if (!res.ok) return null
			const data = await res.json()
			if (data.app !== 'creatyv-helper') return null
			helperKey = data.key
			return data
		} catch {
			return null
		}
	},
	meta: () => request('GET', '/meta'),
	check: () => request('GET', '/check'),
	setupStudio: () => request('POST', '/setup/studio'),
	setupYtDlp: () => request('POST', '/setup/ytdlp'),
	jobsFor: (aiEditId) => request('GET', `/jobs?ai_edit=${encodeURIComponent(aiEditId)}`),
	createJob: (title, creatyv) => request('POST', '/jobs', { title, creatyv }),
	job: (id) => request('GET', `/jobs/${id}`),
	patchJob: (id, patch) => request('PATCH', `/jobs/${id}`, patch),
	connect: (id, access) => request('POST', `/jobs/${id}/connect`, access),
	addLink: (id, group, url) => request('POST', `/jobs/${id}/links`, { group, url }),
	removeItem: (id, itemId) => request('DELETE', `/jobs/${id}/items/${itemId}`),
	plan: (id, notes) => request('POST', `/jobs/${id}/plan`, { notes }),
	approve: (id, notes, answers) => request('POST', `/jobs/${id}/approve`, { notes, answers }),
	revise: (id, notes) => request('POST', `/jobs/${id}/revise`, { notes }),
	stop: (id) => request('POST', `/jobs/${id}/stop`),
	continue: (id) => request('POST', `/jobs/${id}/continue`),
	openFolder: (id, sub) => request('POST', `/jobs/${id}/open`, { sub }),
}

/** Copies one file to the helper's job folder on this computer, with progress (0–1). */
export function uploadToHelper(jobId, group, file, onProgress) {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest()
		xhr.open('POST', `${HELPER_URL}/api/jobs/${jobId}/upload/${group}`)
		xhr.upload.onprogress = (event) => event.lengthComputable && onProgress?.(event.loaded / event.total)
		xhr.onload = () => {
			let data = {}
			try { data = JSON.parse(xhr.responseText || '{}') } catch { /* not JSON */ }
			if (xhr.status < 300) resolve(data.item)
			else reject(new Error(data.error || 'The file could not be added.'))
		}
		xhr.onerror = () => reject(new Error('The file could not be added. Is the helper still running?'))
		const form = new FormData()
		form.append('file', file, file.name)
		xhr.send(form)
	})
}

/** Live events for a job, or 'system' for setup. Returns an unsubscribe. */
export function listenToHelper(channel, onEvent) {
	const path = channel === 'system' ? '/api/system/events' : `/api/jobs/${channel}/events`
	const source = new EventSource(`${HELPER_URL}${path}`)
	source.onmessage = (message) => {
		try { onEvent(JSON.parse(message.data)) } catch { /* keep-alive */ }
	}
	return () => source.close()
}

export const helperFileUrl = (jobId, path, bust) =>
	`${HELPER_URL}/api/jobs/${jobId}/files/${path}?k=${encodeURIComponent(helperKey)}${bust ? `&v=${encodeURIComponent(bust)}` : ''}`

export function formatSize(bytes) {
	if (!bytes && bytes !== 0) return ''
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`
	if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
	return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}
