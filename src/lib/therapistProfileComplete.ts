import type { Profile } from '@/hooks/useAuth'

export function isTherapistProfileComplete(profile: Profile | null | undefined): boolean {
  if (!profile || profile.role !== 'therapist') return false
  const fn = profile.first_name?.trim()
  const ln = profile.last_name?.trim()
  const g = profile.gender?.trim()
  const ph = profile.phone_number?.trim()
  if (!fn || !ln || !g || !ph) return false

  if (profile.dob) return true

  const age = profile.age
  if (age == null || typeof age !== 'number' || !Number.isFinite(age)) return false
  if (age < 18 || age > 120) return false
  return true
}
