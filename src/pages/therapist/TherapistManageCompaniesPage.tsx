import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'
import {
  deleteCompany,
  fetchCompaniesWithDepartments,
  upsertCompanyWithDepartments,
  type CompanyWithDepartments,
} from '@/lib/companyDirectory'
import { cn } from '@/lib/utils'

const glassCard = cn('zen-glass-card ring-0 shadow-none', 'zen-ring-primary')

type EditorMode =
  | { kind: 'create' }
  | { kind: 'edit'; company: CompanyWithDepartments }

type CompanyEditorState = {
  mode: EditorMode
  name: string
  departments: string[]
  newDepartment: string
}

function emptyEditor(): CompanyEditorState {
  return {
    mode: { kind: 'create' },
    name: '',
    departments: [],
    newDepartment: '',
  }
}

function editorFromCompany(company: CompanyWithDepartments): CompanyEditorState {
  return {
    mode: { kind: 'edit', company },
    name: company.name,
    departments: company.departments.map(d => d.name),
    newDepartment: '',
  }
}

export function TherapistManageCompaniesPage() {
  const [companies, setCompanies] = useState<CompanyWithDepartments[]>([])
  const [loading, setLoading] = useState(true)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editor, setEditor] = useState<CompanyEditorState>(() => emptyEditor())
  const [saving, setSaving] = useState(false)

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const rows = await fetchCompaniesWithDepartments()
      setCompanies(rows)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load companies'
      toast.error(message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const staggerVisible = usePageStaggerVisible(!loading, `${companies.length}`)
  const headerStagger = usePageStaggerVisible(true)

  const pendingDeleteCompany = useMemo(
    () => companies.find(c => c.id === pendingDeleteId) ?? null,
    [companies, pendingDeleteId]
  )

  const openCreate = () => {
    setEditor(emptyEditor())
    setEditorOpen(true)
  }

  const openEdit = (company: CompanyWithDepartments) => {
    setEditor(editorFromCompany(company))
    setEditorOpen(true)
  }

  const addDepartmentChip = () => {
    setEditor(prev => {
      const next = prev.newDepartment.trim().replace(/\s+/g, ' ')
      if (!next) return prev
      if (prev.departments.some(d => d.toLowerCase() === next.toLowerCase())) {
        return { ...prev, newDepartment: '' }
      }
      return {
        ...prev,
        departments: [...prev.departments, next],
        newDepartment: '',
      }
    })
  }

  const removeDepartmentChip = (name: string) => {
    setEditor(prev => ({
      ...prev,
      departments: prev.departments.filter(d => d !== name),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return

    const trimmedName = editor.name.trim()
    if (!trimmedName) {
      toast.error('Please enter a company name.')
      return
    }

    // Auto-include the typed-but-not-yet-added department chip.
    let departments = editor.departments
    const pending = editor.newDepartment.trim().replace(/\s+/g, ' ')
    if (
      pending &&
      !departments.some(d => d.toLowerCase() === pending.toLowerCase())
    ) {
      departments = [...departments, pending]
    }

    if (departments.length === 0) {
      toast.error('Add at least one department.')
      return
    }

    setSaving(true)
    try {
      await upsertCompanyWithDepartments(
        trimmedName,
        departments,
        editor.mode.kind === 'edit' ? editor.mode.company.id : null
      )
      toast.success(
        editor.mode.kind === 'edit' ? 'Company updated.' : 'Company added.'
      )
      setEditorOpen(false)
      setEditor(emptyEditor())
      await load(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the company.'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!pendingDeleteCompany) return
    setDeleting(true)
    try {
      await deleteCompany(pendingDeleteCompany.id)
      toast.success('Company deleted.')
      setPendingDeleteId(null)
      await load(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not delete the company.'
      toast.error(message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div
        className="flex flex-wrap items-start justify-between gap-4"
        style={pageStaggerItemStyle(0, headerStagger)}
      >
        <div>
          <h1 className="text-4xl font-bold text-foreground">Manage companies</h1>
          <p className="mt-2 max-w-2xl text-lg text-muted-foreground">
            Maintain the list of companies and departments shown to clients during onboarding.
          </p>
        </div>
        <Button type="button" variant="zen" className="gap-1" onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          Add company
        </Button>
      </div>

      <Card className={glassCard} style={pageStaggerItemStyle(1, headerStagger)}>
        <CardHeader>
          <CardTitle className="text-2xl text-foreground">Companies</CardTitle>
          <CardDescription className="text-muted-foreground">
            This list is shared across all therapists. Updates appear immediately to your clients.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" aria-hidden />
              <span className="text-sm">Loading companies…</span>
            </div>
          ) : companies.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-14 text-center">
              <div className="rounded-full bg-white/5 p-6 ring-1 ring-white/10">
                <Building2 className="size-10 text-muted-foreground" aria-hidden />
              </div>
              <p className="text-muted-foreground">No companies yet. Add your first to get started.</p>
              <Button type="button" variant="zen" className="gap-1" onClick={openCreate}>
                <Plus className="size-4" aria-hidden />
                Add company
              </Button>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {companies.map((company, idx) => (
                <li key={company.id} style={pageStaggerItemStyle(idx, staggerVisible)}>
                  <div
                    className={cn(
                      'flex h-full flex-col gap-3 rounded-2xl border border-white/12 bg-white/[0.05] p-5 shadow-sm',
                      'ring-1 ring-white/5 transition-all',
                      'hover:border-white/20 hover:bg-white/[0.08] hover:ring-white/15'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-semibold tracking-tight text-foreground">
                          {company.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {company.departments.length} department
                          {company.departments.length === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          type="button"
                          variant="zenOutline"
                          size="sm"
                          className="h-8 gap-1"
                          onClick={() => openEdit(company)}
                        >
                          <Pencil className="size-3.5" aria-hidden />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="zenOutline"
                          size="sm"
                          className="h-8 gap-1 border-rose-400/40 text-rose-100 hover:bg-rose-500/15"
                          onClick={() => setPendingDeleteId(company.id)}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          Delete
                        </Button>
                      </div>
                    </div>

                    {company.departments.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No departments configured.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {company.departments.map(d => (
                          <Badge
                            key={d.id}
                            variant="outline"
                            className="border-white/15 bg-white/[0.04] text-xs text-foreground/90"
                          >
                            {d.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={editorOpen}
        onOpenChange={open => {
          if (!open && saving) return
          setEditorOpen(open)
          if (!open) setEditor(emptyEditor())
        }}
      >
        <DialogContent
          className="zen-glass-card rounded-2xl border-white/15 text-foreground"
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <DialogHeader>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {editor.mode.kind === 'edit' ? 'Edit company' : 'New company'}
              </p>
              <DialogTitle className="text-foreground">
                {editor.mode.kind === 'edit'
                  ? `Edit ${editor.mode.company.name}`
                  : 'Add a new company'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company-name" className="text-foreground">
                  Company name
                </Label>
                <Input
                  id="company-name"
                  value={editor.name}
                  onChange={e => setEditor(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Acme Inc."
                  className="border-white/30 bg-white/15 text-foreground"
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-department" className="text-foreground">
                  Departments
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="company-department"
                    value={editor.newDepartment}
                    onChange={e =>
                      setEditor(prev => ({ ...prev, newDepartment: e.target.value }))
                    }
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addDepartmentChip()
                      }
                    }}
                    placeholder="Add a department and press Enter"
                    className="border-white/30 bg-white/15 text-foreground"
                  />
                  <Button
                    type="button"
                    variant="zenOutline"
                    onClick={addDepartmentChip}
                    disabled={!editor.newDepartment.trim()}
                  >
                    <Plus className="size-4" aria-hidden />
                    Add
                  </Button>
                </div>
                {editor.departments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Add at least one department.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {editor.departments.map(d => (
                      <span
                        key={d}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-xs text-foreground/90"
                      >
                        {d}
                        <button
                          type="button"
                          aria-label={`Remove ${d}`}
                          className="rounded-full p-0.5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                          onClick={() => removeDepartmentChip(d)}
                        >
                          <X className="size-3" aria-hidden />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {editor.mode.kind === 'edit' ? (
                  <p className="pt-1 text-xs text-muted-foreground">
                    Removing a department only works if no clients are linked to it.
                  </p>
                ) : null}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="zenOutline"
                disabled={saving}
                onClick={() => setEditorOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="zen" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : editor.mode.kind === 'edit' ? (
                  'Save changes'
                ) : (
                  'Create company'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingDeleteId !== null}
        onOpenChange={open => {
          if (!open && deleting) return
          if (!open) setPendingDeleteId(null)
        }}
      >
        <DialogContent className="zen-glass-card rounded-2xl border-white/15 text-foreground">
          <DialogHeader>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Delete company
            </p>
            <DialogTitle className="text-foreground">
              {pendingDeleteCompany
                ? `Delete ${pendingDeleteCompany.name}?`
                : 'Delete company?'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes the company and all of its departments from the shared list. The action only
            succeeds if no clients are currently linked to it or to any of its departments.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="zenOutline"
              disabled={deleting}
              onClick={() => setPendingDeleteId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="zen"
              className="border-rose-400/40 bg-rose-500/20 text-rose-50 hover:bg-rose-500/30"
              disabled={deleting}
              onClick={() => void handleConfirmDelete()}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Deleting…
                </>
              ) : (
                'Delete company'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
