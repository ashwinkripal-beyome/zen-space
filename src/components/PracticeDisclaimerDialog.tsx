import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { eighteenWeekPlanDisclaimer, fourfoldRitualDisclaimer } from '@/components/practiceDisclaimerCopy'

export type PracticeDisclaimerVariant = 'fourfold' | 'plan18'

type PracticeDisclaimerDialogProps = {
  open: boolean
  variant: PracticeDisclaimerVariant
  onContinue: () => void
}

const COPY = {
  fourfold: fourfoldRitualDisclaimer,
  plan18: eighteenWeekPlanDisclaimer,
} as const

export function PracticeDisclaimerDialog({ open, variant, onContinue }: PracticeDisclaimerDialogProps) {
  const copy = COPY[variant]

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className="zen-glass-card rounded-2xl border-white/15 text-foreground"
        onPointerDownOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        <DialogHeader>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{copy.eyebrow}</p>
          <DialogTitle className="text-foreground">{copy.title}</DialogTitle>
          <DialogDescription className="leading-relaxed text-muted-foreground">{copy.body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="zen" onClick={onContinue}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
