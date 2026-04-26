import { useState, type CSSProperties } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const MIN_PASSWORD_LEN = 6
const MAX_PASSWORD_LEN = 72

type ChangePasswordCardProps = {
  className?: string
  style?: CSSProperties
}

function resetFormState() {
  return {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  }
}

export function ChangePasswordCard({ className, style }: ChangePasswordCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [{ currentPassword, newPassword, confirmPassword }, setFields] = useState(resetFormState)
  const [submitting, setSubmitting] = useState(false)

  const closeDialog = () => {
    setDialogOpen(false)
    setFields(resetFormState())
  }

  const handleOpenChange = (open: boolean) => {
    if (submitting) return
    if (!open) closeDialog()
    else setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentPassword) {
      toast.error('Enter your current password.')
      return
    }
    if (newPassword.length < MIN_PASSWORD_LEN) {
      toast.error(`New password must be at least ${MIN_PASSWORD_LEN} characters.`)
      return
    }
    if (newPassword.length > MAX_PASSWORD_LEN) {
      toast.error(`New password must be at most ${MAX_PASSWORD_LEN} characters.`)
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match.')
      return
    }
    if (newPassword === currentPassword) {
      toast.error('New password must be different from your current password.')
      return
    }

    setSubmitting(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const email = session?.user?.email
      if (!email) {
        toast.error('Could not read your email. Sign out and sign in again, then try again.')
        return
      }

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      })
      if (verifyError) {
        toast.error('Current password is incorrect.')
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) {
        toast.error(updateError.message)
        return
      }

      toast.success('Password updated.')
      closeDialog()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Card
        className={cn('zen-glass-card zen-ring-primary ring-0 shadow-none', className)}
        style={style}
      >
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>Password</CardTitle>
            <CardDescription className="text-muted-foreground">
              Change the password you use to sign in.
            </CardDescription>
          </div>
          <Button type="button" variant="zenOutline" className="shrink-0" onClick={() => setDialogOpen(true)}>
            Change password
          </Button>
        </CardHeader>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="zen-glass-card rounded-2xl border-white/15 text-foreground"
          onPointerDownOutside={e => e.preventDefault()}
          onEscapeKeyDown={e => e.preventDefault()}
        >
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Account security</p>
              <DialogTitle className="text-foreground">Change password</DialogTitle>
              <DialogDescription className="leading-relaxed text-muted-foreground">
                Enter your current password, then choose a new one. You will stay signed in after saving.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="change-pw-current" className="text-foreground">
                  Current password
                </Label>
                <Input
                  id="change-pw-current"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={e => setFields(f => ({ ...f, currentPassword: e.target.value }))}
                  className="border-white/30 bg-white/15 text-foreground"
                  required
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="change-pw-new" className="text-foreground">
                  New password
                </Label>
                <Input
                  id="change-pw-new"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={e => setFields(f => ({ ...f, newPassword: e.target.value }))}
                  className="border-white/30 bg-white/15 text-foreground"
                  required
                  minLength={MIN_PASSWORD_LEN}
                  maxLength={MAX_PASSWORD_LEN}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="change-pw-confirm" className="text-foreground">
                  Confirm new password
                </Label>
                <Input
                  id="change-pw-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => setFields(f => ({ ...f, confirmPassword: e.target.value }))}
                  className="border-white/30 bg-white/15 text-foreground"
                  required
                  minLength={MIN_PASSWORD_LEN}
                  maxLength={MAX_PASSWORD_LEN}
                  disabled={submitting}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="zenOutline" disabled={submitting} onClick={() => closeDialog()}>
                Cancel
              </Button>
              <Button type="submit" variant="zen" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save new password'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
