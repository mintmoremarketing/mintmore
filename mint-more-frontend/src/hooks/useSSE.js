import { useEffect, useRef } from 'react'
import { useAuthStore } from '../store/auth'
import { useUIStore } from '../store/ui'
import { useQueryClient } from '@tanstack/react-query'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'

export function useSSE() {
	const accessToken = useAuthStore((s) => s.accessToken)
	const isAuthed = useAuthStore((s) => s.isAuthed)
	const pushToast = useUIStore((s) => s.pushToast)
	const addNotif = useUIStore((s) => s.addNotif)
	const queryClient = useQueryClient()
	const esRef = useRef(null)

	useEffect(() => {
		if (!isAuthed || !accessToken) return

		const url = `${BASE}/notifications/stream?token=${encodeURIComponent(accessToken)}`
		const es = new EventSource(url)
		esRef.current = es

		es.onopen = () => {
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
					if (['revision_requested', 'revision_delivered', 'work_delivered', 'mintbox_seen'].includes(notif.type)) {
						queryClient.invalidateQueries({ queryKey: ['mintbox-job', notif.entity_id] })
						queryClient.invalidateQueries({ queryKey: ['notifications'] })
					}
				}

				if (payload.type === 'chat_message') {
					queryClient.invalidateQueries({
						queryKey: ['chat', payload.roomId],
					})
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
			console.warn('[SSE] Connection error - will retry')
		}

		return () => {
			es.close()
			esRef.current = null
		}
	}, [isAuthed, accessToken])
}
