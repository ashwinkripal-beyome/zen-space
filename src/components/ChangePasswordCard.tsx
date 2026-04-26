import { useState, type CSSProperties } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type ChangePasswordCardProps = {
  className?: string
  style?: CSSProperties
}

export function ChangePasswordCard({ className, style }: ChangePasswordCardProps) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
      toast.success('Password updated.')
      setNewPassword('')
      setConfirmPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card
      className={cn('zen-glass-card zen-ring-primary ring-0 shadow-none', className)}
      style={style}
    >
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription className="text-muted-foreground">
          Change the password you use to sign in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="max-w-md space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="border-white/30 bg-white/15 text-foreground"
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="border-white/30 bg-white/15 text-foreground"
              required
              minLength={6}
            />
          </div>
          <Button type="submit" disabled={submitting} variant="zen">
            {submitting ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
