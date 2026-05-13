import type { Profile } from '@/hooks/useAuth'

export function isTherapistProfileComplete(profile: Profile | null | undefined): boolean {
  if (!profile || profile.role !== 'therapist') return false
  const fn = profile.first_name?.trim()
  const ln = profile.last_name?.trim()
  const ph = profile.phone_number?.trim()
  return Boolean(fn && ln && ph)
}
