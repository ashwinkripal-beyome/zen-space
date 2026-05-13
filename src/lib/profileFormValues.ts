import type { Profile } from '@/hooks/useAuth'
import { CLIENT_GENDER_OPTIONS } from '@/data/clientProfileOptions'

const ALLOWED_GENDER = new Set(
  CLIENT_GENDER_OPTIONS.map(o => o.value).filter((v): v is string => v.length > 0)
)

const GENDER_ALIASES: Record<string, string> = {
  'non-binary': 'non_binary',
  'non binary': 'non_binary',
  'nb': 'non_binary',
  'prefer not to say': 'prefer_not_to_say',
}

/** Map DB / legacy strings to a `SelectItem` value; empty if unknown. */
export function genderValueForSelect(stored: string | null | undefined): string {
  if (stored == null) return ''
  const t = stored.trim()
  if (!t) return ''
  const lower = t.toLowerCase()
  if (ALLOWED_GENDER.has(lower)) return lower
  const aliased = GENDER_ALIASES[lower]
  if (aliased && ALLOWED_GENDER.has(aliased)) return aliased
  const asSnake = lower.replace(/[\s-]+/g, '_')
  if (ALLOWED_GENDER.has(asSnake)) return asSnake
  return ''
}

/** Parse DOB for day/month year selects (date column, ISO string, or `Date`). */
export function dobSelectPartsFromProfile(
  dob: unknown,
  age: number | null | undefined
): { year: string; month: string; day: string } | null {
  if (dob != null && dob !== '') {
    let s: string
    if (typeof dob === 'string') {
      s = dob.trim()
    } else if (dob instanceof Date) {
      s = Number.isNaN(dob.getTime()) ? '' : dob.toISOString()
    } else {
      s = String(dob)
    }
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (m) {
      const y = m[1]
      const monthNum = parseInt(m[2], 10)
      const dayNum = parseInt(m[3], 10)
      if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1) {
        return {
          year: y,
          month: String(monthNum),
          day: String(dayNum),
        }
      }
    }
    // Fallback: strict YYYY-MM-DD from start of the date-only part (e.g. before "T")
    const dPart = (s.split('T')[0] ?? s).slice(0, 10)
    const p3 = dPart.split('-')
    if (p3.length === 3) {
      const y = p3[0] ?? ''
      const monthNum = parseInt(p3[1] ?? '', 10)
      const dayNum = parseInt(p3[2] ?? '', 10)
      if (y.length === 4 && monthNum >= 1 && monthNum <= 12 && dayNum >= 1) {
        return { year: y, month: String(monthNum), day: String(dayNum) }
      }
    }
  }
  if (age != null && typeof age === 'number' && Number.isFinite(age) && age > 0) {
    const y = new Date().getFullYear() - age
    return { year: String(y), month: '1', day: '1' }
  }
  return null
}

/** Bumps when server profile fields that drive the form should be re-read (same mount, new data). */
export function profileFormSyncKey(p: Profile | null | undefined): string {
  if (!p) return ''
  return [
    p.id,
    p.email ?? '',
    p.gender ?? '',
    p.dob == null ? '' : String(p.dob),
    p.age ?? '',
    p.first_name ?? '',
    p.last_name ?? '',
    p.phone_number ?? '',
    p.occupation ?? '',
    p.company ?? '',
    p.company_department_id ?? '',
    p.company_not_listed == null ? '' : String(p.company_not_listed),
    p.updated_at == null ? '' : p.updated_at,
  ].join('\0')
}
