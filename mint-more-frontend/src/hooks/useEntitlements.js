import { useQuery } from '@tanstack/react-query'
import { commerceApi } from '../api/commerce'
import { useAuthStore } from '../store/auth'

export function useEntitlements() {
  const isAuthed = useAuthStore(s => s.isAuthed)
  const isGuest = useAuthStore(s => s.isGuest)
  return useQuery({
    queryKey: ['entitlements'],
    queryFn: () => commerceApi.entitlements().then(res => res.data.data),
    staleTime: 30_000,
    enabled: isAuthed && !isGuest,
  })
}
