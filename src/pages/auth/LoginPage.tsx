import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const roleBlurbs: Record<string, string> = {
  '/login/client': 'Client sign in',
  '/login/therapist': 'Therapist sign in',
  '/login/admin': 'Admin sign in',
}

export function LoginPage() {
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { user, profile, profileLoading, loading, signIn, signOut, refetchProfile } = useAuth()

  const subtitle = roleBlurbs[location.pathname] ?? 'Welcome back'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      const { error } = await signIn(email, password)
      if (error) toast.error(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!loading && user && profile && !profileLoading) {
    return <Navigate to="/" replace />
  }

  if (!loading && user && !profileLoading && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md zen-glass-card zen-ring-primary ring-0 shadow-none">
          <CardHeader>
            <CardTitle className="text-xl">Signed in, but no profile</CardTitle>
            <CardDescription className="text-left text-muted-foreground">
              Run <code className="text-foreground/90">supabase/migrations/20260330220000_zen_space_init.sql</code> in
              Supabase, then retry.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button variant="zenOutline" onClick={() => refetchProfile()}>
              Retry loading profile
            </Button>
            <Button variant="zen" onClick={() => void signOut()}>
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!loading && user && profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-foreground text-xl">Loading profile…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md zen-glass-card zen-ring-primary ring-0 shadow-none">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-foreground">Zen Space</CardTitle>
          <CardDescription className="text-muted-foreground">{subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="border-white/30 bg-white/20 text-foreground placeholder:text-muted-foreground"
                placeholder="you@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="border-white/30 bg-white/20 text-foreground placeholder:text-muted-foreground"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full"
              variant="zen"
              size="lg"
            >
              {submitting ? 'Please wait…' : 'Sign in'}
            </Button>
          </form>
          <div className="mt-6 space-y-3 text-center text-sm text-muted-foreground">
            <p>
              <Link to="/signup" className="font-medium text-foreground underline hover:text-foreground/90">
                Create account
              </Link>
            </p>
            <p className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">
              <Link to="/login/client">Client</Link>
              <span className="text-muted-foreground">·</span>
              <Link to="/login/therapist">Therapist</Link>
              <span className="text-muted-foreground">·</span>
              <Link to="/login/admin">Admin</Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
