import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { resetPasswordForEmail } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      const { error } = await resetPasswordForEmail(email.trim())
      if (error) toast.error(error.message)
      else toast.success('If that email has an account, you will receive a reset link shortly.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md zen-glass-card zen-ring-primary ring-0 shadow-none">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-foreground">Forgot password</CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter your email and we will send you a link to choose a new password.
          </CardDescription>
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
            <Button type="submit" disabled={submitting} className="w-full" variant="zen" size="lg">
              {submitting ? 'Please wait…' : 'Send reset link'}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link to="/login" className="font-medium text-foreground underline hover:text-foreground/90">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
