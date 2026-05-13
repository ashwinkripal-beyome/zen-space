import { useLayoutEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CLIENT_GENDER_OPTIONS } from '@/data/clientProfileOptions'
import { ChangePasswordCard } from '@/components/ChangePasswordCard'
import {
  CompanyDepartmentPicker,
  type CompanySelectionState,
} from '@/components/CompanyDepartmentPicker'
import { useAuth } from '@/hooks/useAuth'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'
import { isClientProfileComplete } from '@/lib/clientProfileComplete'
import { setClientCompanySelection } from '@/lib/companyDirectory'
import { dobSelectPartsFromProfile, genderValueForSelect, profileFormSyncKey } from '@/lib/profileFormValues'
import { supabase } from '@/lib/supabase'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function daysInMonth(month: number, year: number): number {
  if (!month || !year) return 31
  return new Date(year, month, 0).getDate()
}

function computeAge(year: number, month: number, day: number): number {
  const today = new Date()
  let age = today.getFullYear() - year
  const m = today.getMonth() + 1
  if (m < month || (m === month && today.getDate() < day)) age--
  return age
}

const currentYear = new Date().getFullYear()
const MIN_YEAR = currentYear - 120
const MAX_YEAR = currentYear - 13

export function ClientProfilePage() {
  const navigate = useNavigate()
  const { user, profile, refetchProfile } = useAuth()
  const [firstName, setFirstName] = useState(() => profile?.first_name ?? '')
  const [lastName, setLastName] = useState(() => profile?.last_name ?? '')
  const [email, setEmail] = useState(
    () => profile?.email?.trim() || user?.email?.trim() || ''
  )
  const [gender, setGender] = useState(() => (profile ? genderValueForSelect(profile.gender) : ''))
  const [dobDay, setDobDay] = useState(() => {
    if (!profile) return ''
    return dobSelectPartsFromProfile(profile.dob, profile.age)?.day ?? ''
  })
  const [dobMonth, setDobMonth] = useState(() => {
    if (!profile) return ''
    return dobSelectPartsFromProfile(profile.dob, profile.age)?.month ?? ''
  })
  const [dobYear, setDobYear] = useState(() => {
    if (!profile) return ''
    return dobSelectPartsFromProfile(profile.dob, profile.age)?.year ?? ''
  })
  const [phone, setPhone] = useState(() => profile?.phone_number ?? '')
  const [companySelection, setCompanySelection] = useState<CompanySelectionState>(() => ({
    companyId: null,
    departmentId: profile?.company_department_id ?? null,
    notListed: profile?.company_not_listed === true,
  }))
  const [saving, setSaving] = useState(false)
  const staggerVisible = usePageStaggerVisible(true)

  const profileSync = profileFormSyncKey(profile)
  useLayoutEffect(() => {
    if (!profile) return
    setFirstName(profile.first_name ?? '')
    setLastName(profile.last_name ?? '')
    setEmail(profile.email?.trim() || user?.email?.trim() || '')
    setGender(genderValueForSelect(profile.gender))
    setPhone(profile.phone_number ?? '')
    setCompanySelection({
      companyId: null,
      departmentId: profile.company_department_id ?? null,
      notListed: profile.company_not_listed === true,
    })

    const dobParts = dobSelectPartsFromProfile(profile.dob, profile.age)
    if (dobParts) {
      setDobYear(dobParts.year)
      setDobMonth(dobParts.month)
      setDobDay(dobParts.day)
    } else {
      setDobYear('')
      setDobMonth('')
      setDobDay('')
    }
  }, [profileSync, profile, user?.email])

  const maxDays = daysInMonth(Number(dobMonth), Number(dobYear))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return

    if (!firstName.trim() || !lastName.trim()) {
      toast.error('First name and last name are required.')
      return
    }
    const emailTrim = email.trim()
    if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      toast.error('Please enter a valid email.')
      return
    }
    if (!gender) {
      toast.error('Please select a gender.')
      return
    }
    const day = parseInt(dobDay, 10)
    const month = parseInt(dobMonth, 10)
    const year = parseInt(dobYear, 10)
    if (!day || !month || !year || year < MIN_YEAR || year > MAX_YEAR) {
      toast.error('Please select a valid date of birth.')
      return
    }
    const age = computeAge(year, month, day)
    if (age < 13 || age > 120) {
      toast.error('You must be between 13 and 120 years old.')
      return
    }

    const dobStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    if (!companySelection.notListed && companySelection.companyId && !companySelection.departmentId) {
      toast.error('Please select your department or choose "Not listed here".')
      return
    }

    setSaving(true)
    const wasIncomplete = profile ? !isClientProfileComplete(profile) : true
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          email: emailTrim,
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          gender: gender || null,
          dob: dobStr,
          age,
          phone_number: phone.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) {
        toast.error(error.message)
        return
      }

      if (companySelection.notListed) {
        await setClientCompanySelection({
          companyId: null,
          departmentId: null,
          notListed: true,
        })
      } else if (companySelection.companyId && companySelection.departmentId) {
        await setClientCompanySelection({
          companyId: companySelection.companyId,
          departmentId: companySelection.departmentId,
          notListed: false,
        })
      }

      toast.success('Profile updated.')
      await refetchProfile()

      if (wasIncomplete) {
        navigate('/app/client', { replace: true })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save your profile.'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSave} className="space-y-6">
        <div
          className="flex flex-wrap items-start justify-between gap-4"
          style={pageStaggerItemStyle(0, staggerVisible)}
        >
          <h1 className="text-3xl font-bold text-foreground">Profile</h1>
          <Button
            type="submit"
            disabled={saving}
            variant="zen"
            className="shrink-0"
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>

        <Card
          className="zen-glass-card zen-ring-primary ring-0 shadow-none"
          style={pageStaggerItemStyle(1, staggerVisible)}
        >
        <CardHeader>
          <CardTitle>Your details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fn">First name</Label>
              <Input
                id="fn"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="border-white/30 bg-white/15 text-foreground"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ln">Last name</Label>
              <Input
                id="ln"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="border-white/30 bg-white/15 text-foreground"
                required
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="border-white/30 bg-white/15 text-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select value={gender || undefined} onValueChange={setGender} required>
                <SelectTrigger id="gender" aria-required>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_GENDER_OPTIONS.filter(o => o.value !== '').map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="border-white/30 bg-white/15 text-foreground"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Date of birth</Label>
              <div className="grid grid-cols-3 gap-2">
                <Select value={dobDay || undefined} onValueChange={setDobDay}>
                  <SelectTrigger aria-label="Day">
                    <SelectValue placeholder="Day" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: maxDays }, (_, i) => i + 1).map(d => (
                      <SelectItem key={d} value={String(d)}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={dobMonth || undefined} onValueChange={setDobMonth}>
                  <SelectTrigger aria-label="Month">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={dobYear || undefined} onValueChange={setDobYear}>
                  <SelectTrigger aria-label="Year">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MAX_YEAR - i).map(y => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <CompanyDepartmentPicker
                value={companySelection}
                onChange={setCompanySelection}
                idPrefix="profile-company"
              />
            </div>

          </div>
        </CardContent>
        </Card>
      </form>

      <ChangePasswordCard style={pageStaggerItemStyle(2, staggerVisible)} />
    </div>
  )
}
