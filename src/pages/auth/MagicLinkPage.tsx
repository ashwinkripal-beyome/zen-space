import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function MagicLinkPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { user, loading, signInWithMagicLink } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      const { error } = await signInWithMagicLink(email.trim())
      if (error) toast.error(error.message)
      else {
        setSent(true)
        toast.success('Check your email for the login link.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!loading && user) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md zen-glass-card zen-ring-primary ring-0 shadow-none">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-foreground">Magic link</CardTitle>
          <CardDescription className="text-muted-foreground">
            We&apos;ll email you a one-time sign-in link (configure redirect URLs in Supabase).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <p className="text-center text-muted-foreground">If an account exists, you&apos;ll receive an email shortly.</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ml-email" className="text-foreground">
                  Email
                </Label>
                <Input
                  id="ml-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="border-white/30 bg-white/20 text-foreground"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full"
                variant="zen"
              >
                {submitting ? 'Sending…' : 'Send link'}
              </Button>
            </form>
          )}
          <p className="mt-6 text-center text-sm">
            <Link to="/login" className="text-muted-foreground underline hover:text-foreground">
              Back to password login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
