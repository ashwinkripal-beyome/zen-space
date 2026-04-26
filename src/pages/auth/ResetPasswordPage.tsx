import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionCheckDone, setSessionCheckDone] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    let slowCheck: number | undefined

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session) {
        setSessionReady(true)
        setSessionCheckDone(true)
        return
      }
      slowCheck = window.setTimeout(() => {
        if (!cancelled) setSessionCheckDone(true)
      }, 1200)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled || !session) return
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        if (slowCheck !== undefined) window.clearTimeout(slowCheck)
        setSessionReady(true)
        setSessionCheckDone(true)
      }
    })

    return () => {
      cancelled = true
      if (slowCheck !== undefined) window.clearTimeout(slowCheck)
      subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('Password updated. You can sign in with your new password.')
      await supabase.auth.signOut()
      navigate('/login', { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  if (!sessionReady) {
    if (!sessionCheckDone) {
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <p className="text-foreground text-xl">Verifying reset link…</p>
        </div>
      )
    }
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md zen-glass-card zen-ring-primary ring-0 shadow-none">
          <CardHeader>
            <CardTitle className="text-xl">Reset link</CardTitle>
            <CardDescription className="text-left text-muted-foreground">
              Open this page from the link in your email, or request a new reset from sign in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="zenOutline" className="w-full">
              <Link to="/forgot-password">Request a new link</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md zen-glass-card zen-ring-primary ring-0 shadow-none">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-foreground">Set new password</CardTitle>
          <CardDescription className="text-muted-foreground">Choose a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-foreground">
                New password
              </Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="border-white/30 bg-white/20 text-foreground"
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-foreground">
                Confirm password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="border-white/30 bg-white/20 text-foreground"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full" variant="zen" size="lg">
              {submitting ? 'Please wait…' : 'Save password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
