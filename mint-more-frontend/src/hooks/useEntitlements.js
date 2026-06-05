import { useQuery } from '@tanstack/react-query'
import { commerceApi } from '../api/commerce'

export function useEntitlements() {
  return useQuery({
    queryKey: ['entitlements'],
    queryFn: () => commerceApi.entitlements().then(res => res.data.data),
    staleTime: 30_000,
  })
}
