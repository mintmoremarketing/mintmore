import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useIsMobile } from '../../hooks/useIsMobile'
import Icon from '../ui/Icon'
import KycModal from './KycModal'
import {
	COMPLETION_QUERY_KEY, OPEN_COMPLETION_EVENT, OPEN_KYC_EVENT, PROFILE_UPDATED_EVENT, fetchCompletion, stepMeta,
} from './completionApi'

const DISMISSED_KEY = 'creatyv_profile_pill_dismissed_at'
const DAY_MS = 24 * 60 * 60 * 1000

const readStorage = key => { try { return localStorage.getItem(key) } catch { return null } }
const writeStorage = (key, value) => { try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value) } catch { /* private mode */ } }
const hiddenToday = () => {
	const at = Number(readStorage(DISMISSED_KEY))
	return Boolean(at && Date.now() - at < DAY_MS)
}

/** Progress ring used by the minimized button and the mobile pill. */
function Ring({ percent, size = 40 }) {
	const circumference = 2 * Math.PI * 15
	return (
		<span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
			<svg viewBox="0 0 36 36" className="-rotate-90" style={{ width: size, height: size }} aria-hidden="true">
				<circle cx="18" cy="18" r="15" fill="none" stroke="var(--color-ink-100, #f3f4f6)" strokeWidth="3" />
				<circle cx="18" cy="18" r="15" fill="none" stroke="var(--color-ink-900, #111827)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(percent / 100) * circumference} ${circumference}`} className="transition-[stroke-dasharray] duration-500" />
			</svg>
			<span className="absolute text-[11px] font-semibold tabular-nums text-ink-900">{percent}%</span>
		</span>
	)
}

function StepRow({ step, onNavigate, onKyc, large = false }) {
	const meta = stepMeta(step)
	const circle = large
		? `h-6 w-6 border-2 ${step.done ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-300 bg-white'}`
		: `h-5 w-5 border ${step.done ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-300 bg-white'}`
	const content = (
		<>
			<span className={`inline-flex shrink-0 items-center justify-center rounded-full transition-colors ${circle}`}>
				{step.done && <Icon name="check" size={large ? 13 : 11} />}
			</span>
			<span className={`min-w-0 flex-1 truncate ${large ? 'text-[15px]' : 'text-sm'} ${step.done ? 'text-ink-400 line-through' : `text-ink-900 ${large ? 'font-semibold' : 'font-medium'}`}`}>
				{meta.label}
			</span>
			{!step.done && <Icon name="chevronRight" size={large ? 18 : 15} className="shrink-0 text-ink-400" />}
		</>
	)
	const rowClass = `flex w-full items-center gap-3 text-left transition-colors ${large ? 'rounded-lg px-1 py-2.5 active:bg-ink-50' : 'rounded-xl px-3 py-2.5 hover:bg-ink-50'}`

	if (step.done) return <li className={rowClass}>{content}</li>
	if (meta.kind === 'kyc') {
		if (step.status === 'pending') {
			return (
				<li className={rowClass}>
					<span className={`inline-flex shrink-0 rounded-full ${circle}`} />
					<span className={`min-w-0 flex-1 truncate ${large ? 'text-[15px]' : 'text-sm'} text-ink-900`}>KYC under review</span>
				</li>
			)
		}
		return <li><button type="button" onClick={onKyc} className={rowClass}>{content}</button></li>
	}
	return <li><Link to={meta.href} onClick={onNavigate} className={rowClass}>{content}</Link></li>
}

/**
 * Freelancer "Complete your profile" checklist.
 * Desktop: a card docked bottom-right that collapses to a progress ring button and can be hidden for 24 hours.
 * Mobile: a bottom sheet, opened from the Menu tab or the dashboard (OPEN_COMPLETION_EVENT).
 */
export default function ProfileCompletion() {
	const isFreelancer = useAuthStore(s => s.user?.role === 'freelancer')
	const isMobile = useIsMobile()
	const { pathname } = useLocation()
	const queryClient = useQueryClient()
	const [hidden, setHidden] = useState(hiddenToday)
	const [panelOpen, setPanelOpen] = useState(false)
	const [panelState, setPanelState] = useState('in')
	const [sheetOpen, setSheetOpen] = useState(false)
	const [kycOpen, setKycOpen] = useState(false)

	const { data } = useQuery({
		queryKey: COMPLETION_QUERY_KEY,
		queryFn: fetchCompletion,
		enabled: isFreelancer,
		staleTime: 30_000,
	})

	const openPanel = useCallback(() => {
		setPanelOpen(true)
		requestAnimationFrame(() => setPanelState('in'))
	}, [])

	useEffect(() => {
		if (!isFreelancer) return
		const refetch = () => queryClient.invalidateQueries({ queryKey: COMPLETION_QUERY_KEY })
		const open = () => { writeStorage(DISMISSED_KEY, null); setHidden(false); isMobile ? setSheetOpen(true) : openPanel() }
		const openKyc = () => setKycOpen(true)
		window.addEventListener(PROFILE_UPDATED_EVENT, refetch)
		window.addEventListener(OPEN_COMPLETION_EVENT, open)
		window.addEventListener(OPEN_KYC_EVENT, openKyc)
		return () => {
			window.removeEventListener(PROFILE_UPDATED_EVENT, refetch)
			window.removeEventListener(OPEN_COMPLETION_EVENT, open)
			window.removeEventListener(OPEN_KYC_EVENT, openKyc)
		}
	}, [isFreelancer, isMobile, queryClient, openPanel])

	const closePanel = () => {
		setPanelState('out')
		setTimeout(() => setPanelOpen(false), 280)
	}
	const hideForToday = () => {
		writeStorage(DISMISSED_KEY, String(Date.now()))
		closePanel()
		setTimeout(() => setHidden(true), 300)
	}
	const startKyc = () => { closePanel(); setSheetOpen(false); setKycOpen(true) }
	const closeKyc = useCallback(() => setKycOpen(false), [])

	// The KYC form always renders in this one place, so nothing around it can remount it mid-way.
	return <>{checklist()}<KycModal open={kycOpen} onClose={closeKyc} /></>

	function checklist() {
	if (!isFreelancer || !data || data.isComplete || (pathname.startsWith('/assessments/') && !sheetOpen && !panelOpen)) return null

	const { steps, completed, total, percent } = data

	// Phones: no floating bar over the page. The checklist opens from Menu and the dashboard.
	if (isMobile) {
		return (
			<>
				{sheetOpen && (
					<>
						<div className="completion-backdrop fixed inset-0 z-50 bg-black/40" onClick={() => setSheetOpen(false)} />
						<div role="dialog" aria-label="Complete your profile" className="completion-sheet fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col rounded-t-[28px] bg-white pb-[env(safe-area-inset-bottom)] font-store">
							<div className="flex justify-center pb-1 pt-3"><span className="h-1.5 w-12 rounded-full bg-ink-300" /></div>
							<div className="px-6 pt-3">
								<h2 className="text-[20px] font-semibold leading-tight text-ink-900">Getting Started on Creatyv</h2>
								<p className="mt-1 text-[13.5px] text-ink-500">Complete your profile to start getting bookings</p>
								<div className="mt-5 flex items-center justify-between text-[13px] font-semibold text-ink-900">
									<span>{completed} of {total} Completed</span>
									<span className="tabular-nums">{percent}%</span>
								</div>
								<div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
									<div className="h-full rounded-full bg-ink-900 transition-[width] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]" style={{ width: `${percent}%` }} />
								</div>
							</div>
							<div className="flex-1 overflow-y-auto px-6 pb-2 pt-5">
								<ul className="space-y-1.5">
									{steps.map(step => <StepRow key={step.key} step={step} large onNavigate={() => setSheetOpen(false)} onKyc={startKyc} />)}
								</ul>
							</div>
							<div className="flex justify-center border-t border-ink-100 px-6 pb-5 pt-3">
								<button type="button" onClick={() => setSheetOpen(false)} className="text-[13px] text-ink-500 underline underline-offset-2 active:text-ink-700">Close</button>
							</div>
						</div>
					</>
				)}
			</>
		)
	}

	if (hidden) return null

	return (
		<>
			{panelOpen ? (
				<div className="completion-panel fixed bottom-0 right-0 z-50 w-[360px] rounded-tl-2xl border border-b-0 border-r-0 border-ink-200 bg-white font-store" data-state={panelState}>
					<div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
						<h3 className="text-sm font-semibold text-ink-900">Complete your profile to start getting bookings</h3>
						<button type="button" onClick={closePanel} aria-label="Close" className="ml-3 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700">
							<Icon name="x" size={15} />
						</button>
					</div>
					<div className="px-5 pb-1 pt-3">
						<div className="mb-1.5 flex items-center justify-between text-xs">
							<span className="text-ink-500">{completed} of {total} completed</span>
							<span className="font-semibold tabular-nums text-ink-900">{percent}%</span>
						</div>
						<div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
							<div className="h-full rounded-full bg-ink-900 transition-[width] duration-500" style={{ width: `${percent}%` }} />
						</div>
					</div>
					<div className="max-h-[52vh] overflow-y-auto px-3 py-3">
						<ul className="space-y-0.5">
							{steps.map(step => <StepRow key={step.key} step={step} onNavigate={closePanel} onKyc={startKyc} />)}
						</ul>
					</div>
					<div className="border-t border-ink-100 px-5 py-3">
						<button type="button" onClick={hideForToday} className="text-xs text-ink-400 underline transition-colors hover:text-ink-600">Hide for 24 hours</button>
					</div>
				</div>
			) : (
				<button
					type="button"
					onClick={openPanel}
					className="fixed bottom-0 right-0 z-50 flex items-center gap-3 rounded-tl-2xl border border-b-0 border-r-0 border-ink-200 bg-white py-3 pl-3 pr-5 font-store transition-colors hover:bg-ink-50"
				>
					<Ring percent={percent} />
					<span className="text-sm font-semibold text-ink-900">Complete profile</span>
					<Icon name="chevronDown" size={16} className="rotate-180 text-ink-500" />
				</button>
			)}
		</>
	)
	}
}
