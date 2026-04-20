import { CLIENT_GENDER_OPTIONS } from '@/data/clientProfileOptions'

export type ProfileNameFields = {
  email?: string | null
  name?: string | null
  first_name?: string | null
  last_name?: string | null
}

export function formatClientDisplayName(p: ProfileNameFields | undefined): string {
  if (!p) return 'Client'
  const trimmed = p.name?.trim()
  if (trimmed) return trimmed
  const fromParts = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  if (fromParts) return fromParts
  const em = p.email?.trim()
  if (em) return em
  return 'Client'
}

export function formatGenderLabel(gender: string | null | undefined): string {
  if (!gender?.trim()) return '—'
  const v = gender.trim().toLowerCase()
  const opt = CLIENT_GENDER_OPTIONS.find(o => o.value === v)
  return opt?.label ?? gender.replace(/_/g, ' ')
}

export function formatAgeDisplay(age: number | null | undefined): string {
  if (age == null || !Number.isFinite(Number(age))) return '—'
  return String(Math.floor(Number(age)))
}
