/**
 * Duration packages for the two paid plans.
 *
 * Pricing is mirrored here for display only; the Razorpay amount actually charged
 * is resolved server-side in the create-razorpay-order edge function from Supabase
 * secrets (PLAN_PRICE_*_PAISE). Keep the paise values below in sync with those
 * secrets so the UI and the charge agree.
 *
 * There is no 1-month package — durations are 3, 6, and 12 months only.
 */

export type PaidPlanId = '18_week_semi_guided' | 'one_on_one_intensive'
export type PackageMonths = 3 | 6 | 12

export type PlanPackage = {
  months: PackageMonths
  /** Total price label, e.g. "₹7,499". */
  priceLabel: string
  /** Effective per-month label, e.g. "₹2,499/mo". */
  perMonthLabel: string
  /** Total amount in paise (display/reference; edge function is authoritative). */
  amountPaise: number
}

export const PLAN_PACKAGES: Record<PaidPlanId, PlanPackage[]> = {
  '18_week_semi_guided': [
    { months: 3, priceLabel: '₹7,499', perMonthLabel: '₹2,499/mo', amountPaise: 749900 },
    { months: 6, priceLabel: '₹11,999', perMonthLabel: '₹1,999/mo', amountPaise: 1199900 },
    { months: 12, priceLabel: '₹19,999', perMonthLabel: '₹1,499/mo', amountPaise: 1999900 },
  ],
  one_on_one_intensive: [
    { months: 3, priceLabel: '₹8,999', perMonthLabel: '₹2,999/mo', amountPaise: 899900 },
    { months: 6, priceLabel: '₹14,999', perMonthLabel: '₹2,499/mo', amountPaise: 1499900 },
    { months: 12, priceLabel: '₹23,999', perMonthLabel: '₹1,999/mo', amountPaise: 2399900 },
  ],
}

/** Returns the package definition for a plan + duration, or undefined. */
export function getPlanPackage(plan: string, months: number | null | undefined): PlanPackage | undefined {
  const list = PLAN_PACKAGES[plan as PaidPlanId]
  return list?.find(p => p.months === months)
}

/** Short human label for a package length, e.g. "6 months". */
export function formatPackageMonths(months: number | null | undefined): string | null {
  if (months == null) return null
  return `${months} months`
}
