import { supabase } from '@/lib/supabase'

export type CompanyDepartmentRow = {
  id: string
  name: string
}

export type CompanyWithDepartments = {
  id: string
  name: string
  departments: CompanyDepartmentRow[]
}

function normaliseCompanyName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/** Fetch all companies plus their departments, alphabetised. */
export async function fetchCompaniesWithDepartments(): Promise<CompanyWithDepartments[]> {
  const [companiesResult, departmentsResult] = await Promise.all([
    supabase.from('companies').select('id, name').order('name', { ascending: true }),
    supabase.from('company_departments').select('id, company_id, name').order('name', { ascending: true }),
  ])

  if (companiesResult.error) {
    console.error('[companies select]', companiesResult.error)
    throw new Error(companiesResult.error.message)
  }
  if (departmentsResult.error) {
    console.error('[company_departments select]', departmentsResult.error)
    throw new Error(departmentsResult.error.message)
  }

  const byCompany = new Map<string, CompanyDepartmentRow[]>()
  for (const d of departmentsResult.data ?? []) {
    const cid = String((d as { company_id: string }).company_id)
    const arr = byCompany.get(cid) ?? []
    arr.push({
      id: String((d as { id: string }).id),
      name: String((d as { name: string }).name),
    })
    byCompany.set(cid, arr)
  }

  return (companiesResult.data ?? []).map(c => ({
    id: String((c as { id: string }).id),
    name: String((c as { name: string }).name),
    departments: byCompany.get(String((c as { id: string }).id)) ?? [],
  }))
}

/** Create (companyId = null) or update an existing company along with its departments. */
export async function upsertCompanyWithDepartments(
  name: string,
  departmentNames: string[],
  companyId: string | null
): Promise<{ company_id: string; name: string }> {
  const cleanName = normaliseCompanyName(name)
  if (!cleanName) throw new Error('Company name is required')

  const cleanDeps = Array.from(
    new Map(
      departmentNames
        .map(d => normaliseCompanyName(d))
        .filter(d => d.length > 0)
        .map(d => [d.toLowerCase(), d])
    ).values()
  )
  if (cleanDeps.length === 0) {
    throw new Error('At least one department is required')
  }

  const { data, error } = await supabase.rpc('upsert_company_with_departments', {
    p_name: cleanName,
    p_department_names: cleanDeps,
    p_company_id: companyId,
  })

  if (error) {
    console.error('[upsert_company_with_departments]', error)
    throw new Error(error.message)
  }

  const row = (data ?? {}) as { company_id?: string; name?: string }
  return {
    company_id: String(row.company_id ?? ''),
    name: String(row.name ?? cleanName),
  }
}

/** Delete a company; fails if any therapist_clients or profiles still reference it. */
export async function deleteCompany(companyId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_company_safely', { p_company_id: companyId })
  if (error) {
    if (error.message.includes('company_in_use')) {
      throw new Error('This company is still linked to clients and cannot be deleted.')
    }
    console.error('[delete_company_safely]', error)
    throw new Error(error.message)
  }
}

/** Delete a single department from an existing company. */
export async function deleteCompanyDepartment(departmentId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_company_department_safely', {
    p_department_id: departmentId,
  })
  if (error) {
    if (error.message.includes('department_in_use')) {
      throw new Error('This department is still linked to clients and cannot be deleted.')
    }
    console.error('[delete_company_department_safely]', error)
    throw new Error(error.message)
  }
}

/**
 * Save the signed-in client's company / department selection.
 * Pass notListed=true to clear company and mark the user as "not listed here".
 */
export async function setClientCompanySelection(params: {
  companyId: string | null
  departmentId: string | null
  notListed: boolean
}): Promise<void> {
  const { error } = await supabase.rpc('set_client_company_selection', {
    p_company_id: params.notListed ? null : params.companyId,
    p_department_id: params.notListed ? null : params.departmentId,
    p_not_listed: params.notListed,
  })
  if (error) {
    console.error('[set_client_company_selection]', error)
    throw new Error(error.message)
  }
}
