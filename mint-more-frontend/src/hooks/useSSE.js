import { useEffect, useRef } from 'react'
import { useAuthStore } from '../store/auth'
import { useUIStore } from '../store/ui'
import { useQueryClient } from '@tanstack/react-query'
import { getTokenExpiryMs, getValidAccessToken, refreshAccessToken } from '../api/client'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'

export function useSSE() {
	const accessToken = useAuthStore((s) => s.accessToken)
	const isAuthed = useAuthStore((s) => s.isAuthed)
	const pushToast = useUIStore((s) => s.pushToast)
	const addNotif = useUIStore((s) => s.addNotif)
	const queryClient = useQueryClient()
	const esRef = useRef(null)
	const warnedRef = useRef(false)

	useEffect(() => {
		if (!isAuthed || !accessToken) return

		let cancelled = false
		let refreshTimer = null
		warnedRef.current = false

		const scheduleRefresh = (token) => {
			const expiry = getTokenExpiryMs(token)
			if (!expiry) return
			const delay = Math.max(5_000, expiry - Date.now() - 60_000)
			refreshTimer = window.setTimeout(() => {
				refreshAccessToken().catch((err) => {
					console.warn('[SSE] Token refresh failed', err?.message || err)
				})
			}, delay)
		}

		const connect = async () => {
			try {
				const streamToken = await getValidAccessToken()
				if (cancelled || !streamToken) return
				const url = `${BASE}/notifications/stream?token=${encodeURIComponent(streamToken)}`
				const es = new EventSource(url)
				esRef.current = es
				scheduleRefresh(streamToken)

				es.onopen = () => {
					warnedRef.current = false
					console.log('[SSE] Connected')
				}

				es.onmessage = (event) => {
					try {
						const payload = JSON.parse(event.data)

						if (payload.type === 'notification') {
							const notif = payload.payload

							addNotif(notif)

							const toastTypes = [
								'job_matched',
								'deal_approved',
								'assignment_created',
								'negotiation_accepted',
								'kyc_approved',
								'revision_requested',
								'revision_delivered',
								'work_delivered',
								'mintbox_seen',
								'job_completed',
							]
							if (toastTypes.includes(notif.type)) {
								pushToast({
									title: notif.title,
									body: notif.body,
									icon: 'bell',
								})
							}

							if (
								['job_matched', 'deal_approved', 'assignment_created'].includes(
									notif.type
								)
							) {
								queryClient.invalidateQueries({ queryKey: ['jobs'] })
								queryClient.invalidateQueries({ queryKey: ['job', notif.entity_id] })
							}
							if (notif.type === 'deal_approved') {
								queryClient.invalidateQueries({ queryKey: ['wallet'] })
							}
							if (notif.type === 'job_completed') {
								queryClient.invalidateQueries({ queryKey: ['jobs'] })
								queryClient.invalidateQueries({ queryKey: ['wallet'] })
							}
							if (['revision_requested', 'revision_delivered', 'work_delivered', 'mintbox_seen'].includes(notif.type)) {
								queryClient.invalidateQueries({ queryKey: ['mintbox-job', notif.entity_id] })
								queryClient.invalidateQueries({ queryKey: ['notifications'] })
							}
						}

						if (payload.type === 'chat_message') {
							queryClient.invalidateQueries({
								queryKey: ['chat', payload.roomId],
							})
							queryClient.invalidateQueries({ queryKey: ['chat-rooms'] })
						}

						if (payload.type === 'chat_read') {
							queryClient.invalidateQueries({ queryKey: ['chat', payload.roomId] })
							queryClient.invalidateQueries({ queryKey: ['chat-rooms'] })
						}

						if (payload.type === 'ai_progress') {
							useUIStore
								.getState()
								.setAIProgress(payload.generationId, payload.status, payload)
							if (payload.status === 'completed') {
								queryClient.invalidateQueries({ queryKey: ['ai-generations'] })
							}
						}
					} catch {
						// Ignore non-JSON keepalive messages.
					}
				}

				es.onerror = () => {
					if (!warnedRef.current) {
						warnedRef.current = true
						console.warn('[SSE] Connection error - will retry when the API is reachable')
					}
				}
			} catch (err) {
				if (!cancelled) {
					console.warn('[SSE] Could not open stream', err?.message || err)
				}
			}
		}

		connect()

		return () => {
			cancelled = true
			if (refreshTimer) window.clearTimeout(refreshTimer)
			esRef.current?.close()
			esRef.current = null
		}
	}, [isAuthed, accessToken, addNotif, pushToast, queryClient])
}
