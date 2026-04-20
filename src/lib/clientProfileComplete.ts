import type { Profile } from '@/hooks/useAuth'

/** Required fields before the client can leave profile onboarding. */
export function isClientProfileComplete(profile: Profile | null | undefined): boolean {
  if (!profile || profile.role !== 'client') return false
  const fn = profile.first_name?.trim()
  const ln = profile.last_name?.trim()
  const g = profile.gender?.trim()
  if (!fn || !ln || !g) return false

  if (profile.dob) return true

  const age = profile.age
  if (age == null || typeof age !== 'number' || !Number.isFinite(age)) return false
  if (age < 13 || age > 120) return false
  return true
}
