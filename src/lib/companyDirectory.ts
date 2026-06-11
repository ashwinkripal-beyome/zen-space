import { supabase } from '@/lib/supabase'

export type CompanyDepartmentRow = {
  id: string
  name: string
}

export type CompanyWithDepartments = {
  id: string
  name: string
  departments: CompanyDepartmentRow[]
  /** Count of client profiles linked to any of this company's departments. */
  memberCount: number
}

export type CompanyMember = {
  id: string
  email: string
  name: string | null
  firstName: string | null
  lastName: string | null
  gender: string | null
  age: number | null
  clientStatus: string | null
  departmentId: string | null
  departmentName: string | null
}

function normaliseCompanyName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/** Fetch all companies plus their departments, alphabetised. */
export async function fetchCompaniesWithDepartments(): Promise<CompanyWithDepartments[]> {
  const [companiesResult, departmentsResult, countsResult] = await Promise.all([
    supabase.from('companies').select('id, name').order('name', { ascending: true }),
    supabase.from('company_departments').select('id, company_id, name').order('name', { ascending: true }),
    supabase.rpc('company_member_counts'),
  ])

  if (companiesResult.error) {
    console.error('[companies select]', companiesResult.error)
    throw new Error(companiesResult.error.message)
  }
  if (departmentsResult.error) {
    console.error('[company_departments select]', departmentsResult.error)
    throw new Error(departmentsResult.error.message)
  }
  if (countsResult.error) {
    // Non-fatal: fall back to zero counts rather than blocking the whole page.
    console.error('[company_member_counts]', countsResult.error)
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

  const countByCompany = new Map<string, number>()
  for (const row of (countsResult.data ?? []) as { company_id: string; member_count: number }[]) {
    countByCompany.set(String(row.company_id), Number(row.member_count) || 0)
  }

  return (companiesResult.data ?? []).map(c => {
    const cid = String((c as { id: string }).id)
    return {
      id: cid,
      name: String((c as { name: string }).name),
      departments: byCompany.get(cid) ?? [],
      memberCount: countByCompany.get(cid) ?? 0,
    }
  })
}

/** Read-only roster of client profiles linked to a company's departments. */
export async function fetchCompanyMembers(companyId: string): Promise<CompanyMember[]> {
  const { data, error } = await supabase.rpc('list_company_members', {
    p_company_id: companyId,
  })

  if (error) {
    console.error('[list_company_members]', error)
    throw new Error(error.message)
  }

  return ((data ?? []) as Record<string, unknown>[]).map(row => ({
    id: String(row.id),
    email: String(row.email ?? ''),
    name: (row.name as string | null) ?? null,
    firstName: (row.first_name as string | null) ?? null,
    lastName: (row.last_name as string | null) ?? null,
    gender: (row.gender as string | null) ?? null,
    age:
      row.age != null && Number.isFinite(Number(row.age)) ? Number(row.age) : null,
    clientStatus: (row.client_status as string | null) ?? null,
    departmentId: (row.department_id as string | null) ?? null,
    departmentName: (row.department_name as string | null) ?? null,
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
