import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type PaidPlan = '18_week_semi_guided' | 'one_on_one_intensive'

const VALID_PLANS: PaidPlan[] = ['18_week_semi_guided', 'one_on_one_intensive']
const VALID_MONTHS = [3, 6, 12]

/**
 * Resolve the price (in paise) for a plan + duration from Supabase secrets.
 * Secret names: PLAN_PRICE_SEMI_GUIDED_<N>M_PAISE / PLAN_PRICE_ONE_ON_ONE_<N>M_PAISE.
 * Defaults below are the launch prices; override them by setting the secrets.
 */
const PRICE_DEFAULTS_PAISE: Record<PaidPlan, Record<number, number>> = {
  '18_week_semi_guided': { 3: 749900, 6: 1199900, 12: 1999900 },
  'one_on_one_intensive': { 3: 899900, 6: 1499900, 12: 2399900 },
}

function resolveAmountPaise(plan: PaidPlan, months: number): number {
  const envKey =
    plan === '18_week_semi_guided'
      ? `PLAN_PRICE_SEMI_GUIDED_${months}M_PAISE`
      : `PLAN_PRICE_ONE_ON_ONE_${months}M_PAISE`
  const fromEnv = Deno.env.get(envKey)
  if (fromEnv) {
    const parsed = parseInt(fromEnv, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return PRICE_DEFAULTS_PAISE[plan][months]
}

type RazorpayOrder = {
  id: string
  amount: number
  currency: string
  receipt: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID')
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
    if (!razorpayKeyId || !razorpayKeySecret) {
      return new Response(JSON.stringify({ error: 'Razorpay credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate caller.
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser(token)
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as {
      plan?: string
      /** Package length: 3, 6, or 12 months. */
      duration_months?: number
      /** Therapist/admin may pass this to create an order on behalf of a client. */
      on_behalf_of_client_id?: string
    }
    const plan = body.plan as PaidPlan
    if (!plan || !VALID_PLANS.includes(plan)) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan. Must be 18_week_semi_guided or one_on_one_intensive' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const durationMonths = Number(body.duration_months)
    if (!VALID_MONTHS.includes(durationMonths)) {
      return new Response(
        JSON.stringify({ error: 'Invalid duration_months. Must be 3, 6, or 12' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const admin = createClient(supabaseUrl, serviceKey)

    // Resolve which client this order is for.
    let clientId = user.id
    if (body.on_behalf_of_client_id && body.on_behalf_of_client_id !== user.id) {
      // Caller must be a linked therapist or admin.
      const { data: callerProfile } = await admin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      const isAdmin = callerProfile?.role === 'admin'
      const isTherapist = callerProfile?.role === 'therapist'

      if (!isAdmin && !isTherapist) {
        return new Response(JSON.stringify({ error: 'Only therapists or admins can create orders on behalf of clients' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (isTherapist) {
        const { data: link } = await admin
          .from('therapist_clients')
          .select('therapist_id')
          .eq('therapist_id', user.id)
          .eq('client_id', body.on_behalf_of_client_id)
          .maybeSingle()
        if (!link) {
          return new Response(JSON.stringify({ error: 'Not linked to this client' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      clientId = body.on_behalf_of_client_id
    }

    const amountPaise = resolveAmountPaise(plan, durationMonths)

    // Create the Razorpay order via their REST API.
    const receipt = `zs_${clientId.slice(0, 8)}_${Date.now()}`
    const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt,
        notes: { client_id: clientId, plan, duration_months: String(durationMonths) },
      }),
    })

    if (!razorpayRes.ok) {
      const errText = await razorpayRes.text()
      console.error('Razorpay create order error', razorpayRes.status, errText)
      return new Response(
        JSON.stringify({ error: 'Failed to create payment order', detail: errText.slice(0, 400) }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const rzOrder = (await razorpayRes.json()) as RazorpayOrder

    // Persist the order so we can verify it later.
    const { error: insertErr } = await admin.from('payment_orders').insert({
      client_id: clientId,
      razorpay_order_id: rzOrder.id,
      plan,
      duration_months: durationMonths,
      amount_paise: amountPaise,
      currency: 'INR',
      status: 'created',
    })

    if (insertErr) {
      console.error('payment_orders insert error', insertErr)
      // Non-fatal — verification will still work via Razorpay signature check.
    }

    return new Response(
      JSON.stringify({
        order_id: rzOrder.id,
        amount: amountPaise,
        currency: 'INR',
        key_id: razorpayKeyId,
        plan,
        duration_months: durationMonths,
        client_id: clientId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('create-razorpay-order unhandled', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
