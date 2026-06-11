import { supabase } from '@/lib/supabase'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any
  }
}

/** Load Razorpay Checkout script lazily; resolves when script is ready. */
export function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout script'))
    document.head.appendChild(script)
  })
}

export type RazorpayCheckoutResult =
  | { ok: true; plan: string }
  | { ok: false; error: string }

type RazorpayPaymentResponse = {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

/**
 * Full checkout flow:
 * 1. Call create-razorpay-order edge function to create a server-side order.
 * 2. Open Razorpay Checkout modal.
 * 3. On success, call verify-razorpay-payment to validate signature + activate plan.
 *
 * Pass `onBehalfOfClientId` when a therapist is initiating checkout for a client.
 */
export async function startRazorpayCheckout(
  plan: '18_week_semi_guided' | 'one_on_one_intensive',
  durationMonths: 3 | 6 | 12,
  clientName: string,
  clientEmail: string,
  onStatusChange?: (msg: string) => void,
  onBehalfOfClientId?: string
): Promise<RazorpayCheckoutResult> {
  try {
    onStatusChange?.('Creating payment order…')
    await loadRazorpayScript()

    const body: Record<string, string | number> = { plan, duration_months: durationMonths }
    if (onBehalfOfClientId) body.on_behalf_of_client_id = onBehalfOfClientId

    const { data: orderData, error: orderErr } = await supabase.functions.invoke(
      'create-razorpay-order',
      { body }
    )

    if (orderErr || !orderData?.order_id) {
      const msg = (orderErr as { message?: string } | null)?.message ?? orderData?.error ?? 'Failed to create order'
      return { ok: false, error: msg }
    }

    const { order_id, amount, currency, key_id } = orderData as {
      order_id: string
      amount: number
      currency: string
      key_id: string
    }

    onStatusChange?.('Opening payment…')

    const paymentResult = await new Promise<RazorpayPaymentResponse | { error: string }>(
      resolve => {
        const rzp = new window.Razorpay({
          key: key_id,
          amount,
          currency,
          order_id,
          name: 'Zen Space',
          description: `${plan === '18_week_semi_guided' ? '18-week semi-guided plan' : '1-on-1 intensive guided plan'} · ${durationMonths} months`,
          prefill: { name: clientName, email: clientEmail },
          theme: { color: '#34d399' },
          handler: (resp: RazorpayPaymentResponse) => resolve(resp),
          modal: {
            ondismiss: () => resolve({ error: 'Payment cancelled' }),
          },
        })
        rzp.open()
      }
    )

    if ('error' in paymentResult) {
      return { ok: false, error: paymentResult.error }
    }

    onStatusChange?.('Verifying payment…')
    const { data: verifyData, error: verifyErr } = await supabase.functions.invoke(
      'verify-razorpay-payment',
      {
        body: {
          razorpay_order_id: paymentResult.razorpay_order_id,
          razorpay_payment_id: paymentResult.razorpay_payment_id,
          razorpay_signature: paymentResult.razorpay_signature,
        },
      }
    )

    if (verifyErr || !verifyData?.ok) {
      const msg = (verifyErr as { message?: string } | null)?.message ?? verifyData?.error ?? 'Payment verification failed'
      return { ok: false, error: msg }
    }

    return { ok: true, plan: verifyData.plan as string }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Payment failed unexpectedly'
    return { ok: false, error: msg }
  }
}
