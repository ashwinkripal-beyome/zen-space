import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export interface Profile {
  id: string
  email: string
  role: 'admin' | 'therapist' | 'client'
  name?: string
  first_name?: string
  last_name?: string
  phone_number?: string
  gender?: string
  /** Client age in years (computed from dob on save). */
  age?: number | null
  dob?: string | null
  avatar_url?: string
  occupation?: string
  company?: string
  /** Client: structured company/department link (replaces free-text occupation). */
  company_department_id?: string | null
  /** Client: true when the user picked "Not listed here" instead of choosing a company. */
  company_not_listed?: boolean
  /** Client: supervised assessments require this (set by any linked therapist, shared across links). */
  is_paid_customer?: boolean
  /** True once a new client has been redirected to Assessments on first login. */
  client_initial_login_redirect_done?: boolean
  /** Present on rows from `profiles` select; used to detect refetched data. */
  updated_at?: string
}

export interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean
  /** True while fetching profile for the current user (after session is known). */
  profileLoading: boolean
}

type SignUpMeta = { firstName: string; lastName: string; phone: string }

type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<{ error: null | { message: string } }>
  signUp: (
    email: string,
    password: string,
    meta: SignUpMeta
  ) => Promise<{
    data: Awaited<ReturnType<typeof supabase.auth.signUp>>['data']
    error: null | { message: string }
  }>
  signOut: () => Promise<void>
  refetchProfile: () => void
  resetPasswordForEmail: (email: string) => Promise<{ error: null | { message: string } }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function roleFromAuthUser(user: User): Profile['role'] {
  const r = user.user_metadata?.role ?? user.app_metadata?.role
  if (r === 'admin' || r === 'therapist' || r === 'client') return r
  return 'client'
}

function profileFromEnsureRpc(fromRpc: unknown): Profile | null {
  const row = Array.isArray(fromRpc) && fromRpc.length > 0 ? fromRpc[0] : fromRpc
  if (!row || typeof row !== 'object') return null
  const o = row as Record<string, unknown>
  if (typeof o.id !== 'string') return null
  if (o.role !== 'admin' && o.role !== 'therapist' && o.role !== 'client') return null
  return row as Profile
}

/** Fill empty profile columns from signup `user_metadata` / auth email (legacy rows). */
function signupMetadataPatchIfNeeded(user: User, row: Profile): Partial<Profile> | null {
  const meta = user.user_metadata ?? {}
  const patch: Partial<Profile> = {}

  const authEmail = user.email?.trim() ?? ''
  if (authEmail && !row.email?.trim()) patch.email = authEmail

  const fn = typeof meta.first_name === 'string' ? meta.first_name.trim() : ''
  if (fn && !row.first_name?.trim()) patch.first_name = fn

  const ln = typeof meta.last_name === 'string' ? meta.last_name.trim() : ''
  if (ln && !row.last_name?.trim()) patch.last_name = ln

  const ph = typeof meta.phone_number === 'string' ? meta.phone_number.trim() : ''
  if (ph && !row.phone_number?.trim()) patch.phone_number = ph

  let nm = typeof meta.name === 'string' ? meta.name.trim() : ''
  if (!nm && fn && ln) nm = `${fn} ${ln}`.trim()
  if (nm && !row.name?.trim()) patch.name = nm

  return Object.keys(patch).length ? patch : null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profileTick, setProfileTick] = useState(0)
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    profileLoading: false,
  })

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setState(s => ({
          ...s,
          user: session?.user ?? null,
          loading: false,
        }))
      })
      .catch(() => {
        setState(s => ({ ...s, loading: false }))
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(s => ({
        ...s,
        user: session?.user ?? null,
        loading: false,
      }))
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    let cancelled = false
    const user = state.user

    if (user) {
      // Keep the existing `profile` in state during a refetch so consumers (and
      // any route guards) don't unmount the active page while we refresh.
      setState(s => ({ ...s, profileLoading: true }))

      const fetchProfile = async () => {
        const { data: existing, error: selectError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle<Profile>()

        if (cancelled) return

        if (selectError) {
          console.error('Profile fetch error:', selectError)
        }

        if (!selectError && existing) {
          const patch = signupMetadataPatchIfNeeded(user, existing)
          if (patch) {
            const { error: patchErr } = await supabase
              .from('profiles')
              .update({ ...patch, updated_at: new Date().toISOString() })
              .eq('id', user.id)
            if (cancelled) return
            if (!patchErr) {
              setState(s => ({ ...s, profile: { ...existing, ...patch }, profileLoading: false }))
              return
            }
            console.error('Profile signup metadata backfill error:', patchErr)
          }
          setState(s => ({ ...s, profile: existing, profileLoading: false }))
          return
        }

        const { data: rpcData, error: rpcError } = await supabase.rpc('ensure_user_profile')

        if (cancelled) return

        const fromRpc = profileFromEnsureRpc(rpcData)
        if (!rpcError && fromRpc) {
          setState(s => ({ ...s, profile: fromRpc, profileLoading: false }))
          return
        }

        if (rpcError) {
          console.error('ensure_user_profile RPC:', rpcError)
        }

        const meta = user.user_metadata ?? {}
        const { error: insertError } = await supabase.from('profiles').insert({
          id: user.id,
          email: user.email ?? '',
          role: roleFromAuthUser(user),
          name: (typeof meta.name === 'string' ? meta.name : null) || null,
          first_name: (typeof meta.first_name === 'string' ? meta.first_name : null) || null,
          last_name: (typeof meta.last_name === 'string' ? meta.last_name : null) || null,
          phone_number: (typeof meta.phone_number === 'string' ? meta.phone_number : null) || null,
        })

        if (cancelled) return

        if (insertError && insertError.code !== '23505') {
          console.error('Profile bootstrap insert error:', insertError)
          setState(s => ({ ...s, profile: null, profileLoading: false }))
          return
        }

        const { data: row, error: again } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle<Profile>()

        if (cancelled) return

        if (again) {
          console.error('Profile refetch error:', again)
          setState(s => ({ ...s, profile: null, profileLoading: false }))
          return
        }

        setState(s => ({ ...s, profile: row ?? null, profileLoading: false }))
      }

      fetchProfile()
    } else {
      setState(s => ({ ...s, profile: null, profileLoading: false }))
    }

    return () => {
      cancelled = true
    }
  }, [state.user?.id, profileTick])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }, [])

  const signUp = useCallback(async (email: string, password: string, meta: SignUpMeta) => {
    const { firstName, lastName, phone } = meta
    const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, first_name: firstName.trim(), last_name: lastName.trim(), phone_number: phone.trim(), role: 'client' },
      },
    })
    return { data, error }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const resetPasswordForEmail = useCallback(async (email: string) => {
    const redirect =
      typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirect,
    })
    return { error }
  }, [])

  const refetchProfile = useCallback(() => {
    setProfileTick(t => t + 1)
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      signIn,
      signUp,
      signOut,
      resetPasswordForEmail,
      refetchProfile,
    }),
    [state, signIn, signUp, signOut, resetPasswordForEmail, refetchProfile]
  )

  return createElement(AuthContext.Provider, { value }, children)
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
