import { api } from '../../api/client'

export const COMPLETION_QUERY_KEY = ['profile-completion']

export const fetchCompletion = () => api.get('/profile/me/completion').then(res => res.data.data.completion)

// Pages that change a checklist field fire this so the panel refetches.
export const PROFILE_UPDATED_EVENT = 'creatyv:profile-updated'
export const OPEN_COMPLETION_EVENT = 'creatyv:open-profile-completion'
export const OPEN_KYC_EVENT = 'creatyv:open-kyc'

export const announceProfileUpdated = () => window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT))

/** The five checklist steps, in the order the panel lists them. */
export const STEP_META = {
	basic: { label: 'Basic details', href: '/profile/edit' },
	tools: { label: 'Tools you know', href: '/profile/edit?tools=1' },
	posts: { label: 'Minimum 3 posts on profile', href: '/profile' },
	kyc: { label: 'Complete KYC', kind: 'kyc' },
	services: { label: 'Get qualified for a service', href: '/assessments' },
}
