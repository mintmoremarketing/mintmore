import { useQuery } from '@tanstack/react-query'
import { servicesApi } from '../../api/services'

/** Open order offers for the signed-in freelancer. The panel and the nav badges share this cache. */
export function useOrderOffers(enabled = true) {
	return useQuery({
		queryKey: ['service-offers'],
		queryFn: () => servicesApi.offers().then(res => res.data.data),
		refetchInterval: 30_000,
		enabled,
	})
}
