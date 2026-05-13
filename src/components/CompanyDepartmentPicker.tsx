import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  fetchCompaniesWithDepartments,
  type CompanyWithDepartments,
} from '@/lib/companyDirectory'
import { cn } from '@/lib/utils'

const NOT_LISTED_VALUE = '__not_listed__'

export type CompanySelectionState = {
  companyId: string | null
  departmentId: string | null
  notListed: boolean
}

type Props = {
  value: CompanySelectionState
  onChange: (next: CompanySelectionState) => void
  /** Optional id prefix to ensure label/htmlFor uniqueness across multiple mounts. */
  idPrefix?: string
  /** Show a subtle helper above the company select. Defaults to undefined (no helper). */
  helperText?: string
  /** Compact layout (used inside dialogs). */
  compact?: boolean
}

export function CompanyDepartmentPicker({
  value,
  onChange,
  idPrefix = 'company-picker',
  helperText,
  compact = false,
}: Props) {
  const [companies, setCompanies] = useState<CompanyWithDepartments[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadCompanies() {
      try {
        const rows = await fetchCompaniesWithDepartments()
        if (cancelled) return
        setCompanies(rows)
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Failed to load companies'
        setError(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadCompanies()
    return () => {
      cancelled = true
    }
  }, [])

  // Auto-resolve missing companyId from a saved departmentId once companies load.
  useEffect(() => {
    if (loading) return
    if (value.notListed) return
    if (!value.departmentId) return
    if (value.companyId) return
    for (const c of companies) {
      if (c.departments.some(d => d.id === value.departmentId)) {
        onChange({
          companyId: c.id,
          departmentId: value.departmentId,
          notListed: false,
        })
        return
      }
    }
  }, [loading, companies, value.companyId, value.departmentId, value.notListed, onChange])

  const selectedCompany = useMemo(
    () => (value.companyId ? companies.find(c => c.id === value.companyId) ?? null : null),
    [companies, value.companyId]
  )

  const companySelectValue = value.notListed
    ? NOT_LISTED_VALUE
    : value.companyId ?? ''

  const handleCompanyChange = (next: string) => {
    if (next === NOT_LISTED_VALUE) {
      onChange({ companyId: null, departmentId: null, notListed: true })
      return
    }
    onChange({ companyId: next, departmentId: null, notListed: false })
  }

  const handleDepartmentChange = (next: string) => {
    onChange({
      companyId: value.companyId,
      departmentId: next,
      notListed: false,
    })
  }

  const departmentsForSelected = selectedCompany?.departments ?? []
  const departmentSelectDisabled =
    value.notListed || !value.companyId || departmentsForSelected.length === 0

  return (
    <div className={cn('space-y-3', compact ? 'space-y-3' : 'space-y-4')}>
      {helperText ? (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-company`} className="text-foreground">
          Company
        </Label>
        <Select
          value={companySelectValue || undefined}
          onValueChange={handleCompanyChange}
          disabled={loading}
        >
          <SelectTrigger id={`${idPrefix}-company`} aria-label="Company">
            <SelectValue
              placeholder={loading ? 'Loading companies…' : 'Select your company'}
            />
          </SelectTrigger>
          <SelectContent>
            {companies.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
            <SelectItem value={NOT_LISTED_VALUE}>Not listed here</SelectItem>
          </SelectContent>
        </Select>
        {loading ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden />
            Loading companies…
          </p>
        ) : error ? (
          <p className="text-xs text-rose-200">{error}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-department`} className="text-foreground">
          Department
        </Label>
        <Select
          value={value.departmentId ?? undefined}
          onValueChange={handleDepartmentChange}
          disabled={departmentSelectDisabled}
        >
          <SelectTrigger id={`${idPrefix}-department`} aria-label="Department">
            <SelectValue
              placeholder={
                value.notListed
                  ? 'Not applicable'
                  : !value.companyId
                    ? 'Select a company first'
                    : departmentsForSelected.length === 0
                      ? 'No departments configured'
                      : 'Select your department'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {departmentsForSelected.map(d => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value.notListed ? (
          <p className="text-xs text-muted-foreground">
            We&apos;ll skip company-specific guidance for you.
          </p>
        ) : null}
      </div>
    </div>
  )
}
