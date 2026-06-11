import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Verify Razorpay payment signature using Web Crypto API (available in Deno). */
async function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string
): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(keySecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const data = encoder.encode(`${orderId}|${paymentId}`)
  const sigBuffer = await crypto.subtle.sign('HMAC', key, data)
  const sigHex = Array.from(new Uint8Array(sigBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return sigHex === signature
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

    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
    if (!razorpayKeySecret) {
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
      razorpay_order_id?: string
      razorpay_payment_id?: string
      razorpay_signature?: string
    }
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(
        JSON.stringify({ error: 'razorpay_order_id, razorpay_payment_id, razorpay_signature are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify signature.
    const valid = await verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      razorpayKeySecret
    )
    if (!valid) {
      console.error('Razorpay signature verification failed for order', razorpay_order_id)
      return new Response(
        JSON.stringify({ error: 'Payment signature verification failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const admin = createClient(supabaseUrl, serviceKey)

    // Look up the order to get the plan.
    const { data: orderRow, error: orderErr } = await admin
      .from('payment_orders')
      .select('client_id, plan, duration_months, status')
      .eq('razorpay_order_id', razorpay_order_id)
      .maybeSingle()

    if (orderErr || !orderRow) {
      console.error('payment_orders lookup error', orderErr)
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Idempotent — already processed.
    if (orderRow.status === 'paid') {
      return new Response(
        JSON.stringify({ ok: true, already_paid: true, plan: orderRow.plan }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Allow: the client themselves, OR a linked therapist/admin who created the order on their behalf.
    if (orderRow.client_id !== user.id) {
      const { data: callerProfile } = await admin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      const isAdmin = callerProfile?.role === 'admin'
      const isLinkedTherapist = callerProfile?.role === 'therapist' && await (async () => {
        const { data: link } = await admin
          .from('therapist_clients')
          .select('therapist_id')
          .eq('therapist_id', user.id)
          .eq('client_id', orderRow.client_id)
          .maybeSingle()
        return Boolean(link)
      })()

      if (!isAdmin && !isLinkedTherapist) {
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Activate the plan via SECURITY DEFINER RPC (bypasses RLS safely).
    // Activate against the order's client (may differ from the caller when a
    // therapist/admin paid on behalf of a client).
    const { error: activateErr } = await admin.rpc('activate_client_plan', {
      p_client_id: orderRow.client_id,
      p_plan: orderRow.plan,
      p_months: orderRow.duration_months,
      p_razorpay_order_id: razorpay_order_id,
      p_payment_id: razorpay_payment_id,
      p_signature: razorpay_signature,
    })

    if (activateErr) {
      console.error('activate_client_plan error', activateErr)
      return new Response(
        JSON.stringify({ error: 'Failed to activate plan', detail: activateErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.info('Plan activated', { client_id: orderRow.client_id, plan: orderRow.plan, months: orderRow.duration_months, order: razorpay_order_id })

    return new Response(
      JSON.stringify({ ok: true, plan: orderRow.plan }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('verify-razorpay-payment unhandled', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
