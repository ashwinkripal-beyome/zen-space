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
import { clearClientOtpVerifiedSession } from '@/lib/clientOtpSession'
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
}

export interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean
  /** True while fetching profile for the current user (after session is known). */
  profileLoading: boolean
}

type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<{ error: null | { message: string } }>
  signUp: (
    email: string,
    password: string,
    name: string
  ) => Promise<{
    data: Awaited<ReturnType<typeof supabase.auth.signUp>>['data']
    error: null | { message: string }
  }>
  signOut: () => Promise<void>
  refetchProfile: () => void
  signInWithMagicLink: (email: string) => Promise<{ error: null | { message: string } }>
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
      setState(s => ({ ...s, profileLoading: true, profile: null }))

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

        const { error: insertError } = await supabase.from('profiles').insert({
          id: user.id,
          email: user.email ?? '',
          role: roleFromAuthUser(user),
          name: (typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : null) || null,
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

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role: 'client' },
      },
    })
    return { data, error }
  }, [])

  const signOut = useCallback(async () => {
    clearClientOtpVerifiedSession()
    await supabase.auth.signOut()
  }, [])

  const signInWithMagicLink = useCallback(async (email: string) => {
    const redirect = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirect },
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
      signInWithMagicLink,
      refetchProfile,
    }),
    [state, signIn, signUp, signOut, signInWithMagicLink, refetchProfile]
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
