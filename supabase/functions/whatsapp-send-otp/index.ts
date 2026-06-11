// Supabase "Send SMS" Auth Hook -> WhatsApp Cloud API.
//
// GoTrue calls this function whenever it needs to deliver a phone OTP (here:
// the phone-change OTP triggered by supabase.auth.updateUser({ phone }) during
// the one-time client phone verification). Instead of an SMS provider we send
// the code over WhatsApp using a pre-approved AUTHENTICATION message template.
//
// Configure in Supabase: Authentication -> Hooks -> "Send SMS hook" pointing at
// this function's URL, then copy the generated secret into SEND_SMS_HOOK_SECRET.
//
// Required secrets (supabase secrets set ...):
//   WHATSAPP_ACCESS_TOKEN      - Meta Graph API access token (system user token)
//   WHATSAPP_PHONE_NUMBER_ID   - WhatsApp Business phone number id
//   WHATSAPP_APP_SECRET        - Meta App secret (used for appsecret_proof)
//   WHATSAPP_OTP_TEMPLATE_NAME - approved AUTHENTICATION template name (default: otp_login)
//   WHATSAPP_OTP_TEMPLATE_LANG - template language code (default: en_US)
//   SEND_SMS_HOOK_SECRET       - the secret Supabase generates for this hook (v1,whsec_...)
// Optional:
//   WHATSAPP_GRAPH_VERSION     - Graph API version (default: v21.0)
//   WHATSAPP_OTP_TEMPLATE_HAS_BUTTON - "false" to omit the copy-code button param (default: true)

const GRAPH_VERSION = Deno.env.get('WHATSAPP_GRAPH_VERSION') || 'v21.0'

interface SendSmsHookPayload {
  user?: { id?: string; phone?: string; new_phone?: string }
  // For a phone-change OTP, GoTrue supplies the recipient in sms.phone (user.phone
  // is still empty until the number is confirmed).
  sms?: { otp?: string; phone?: string }
}

function jsonError(message: string, httpCode = 500): Response {
  // GoTrue expects this envelope so it can surface a useful client error.
  return new Response(JSON.stringify({ error: { http_code: httpCode, message } }), {
    status: httpCode,
    headers: { 'Content-Type': 'application/json' },
  })
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

async function hmacSha256Base64(keyBytes: Uint8Array, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return bytesToBase64(new Uint8Array(sig))
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Verify a Standard Webhooks signature (the scheme Supabase Auth hooks use). */
async function verifyHookSignature(req: Request, rawBody: string, secret: string): Promise<boolean> {
  const id = req.headers.get('webhook-id')
  const timestamp = req.headers.get('webhook-timestamp')
  const signatureHeader = req.headers.get('webhook-signature')
  if (!id || !timestamp || !signatureHeader) return false

  // Secret arrives as "v1,whsec_<base64>" (or bare base64). Strip the prefix.
  const rawSecret = secret.includes(',') ? secret.split(',')[1] : secret
  const cleaned = rawSecret.startsWith('whsec_') ? rawSecret.slice('whsec_'.length) : rawSecret
  const keyBytes = base64ToBytes(cleaned)

  const expected = await hmacSha256Base64(keyBytes, `${id}.${timestamp}.${rawBody}`)

  // Header is a space-separated list of "<version>,<base64sig>" pairs.
  for (const part of signatureHeader.split(' ')) {
    const sig = part.includes(',') ? part.split(',')[1] : part
    if (sig && timingSafeEqual(sig, expected)) return true
  }
  return false
}

async function sendWhatsAppOtp(phone: string, otp: string): Promise<void> {
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
  const appSecret = Deno.env.get('WHATSAPP_APP_SECRET')
  // appsecret_proof is OFF by default — only attached when explicitly enabled.
  // A mismatched app secret makes Meta reject the call with OAuth code 190.
  const useAppSecretProof = (Deno.env.get('WHATSAPP_USE_APPSECRET_PROOF') || 'false') === 'true'
  const templateName = Deno.env.get('WHATSAPP_OTP_TEMPLATE_NAME') || 'otp_login'
  const templateLang = Deno.env.get('WHATSAPP_OTP_TEMPLATE_LANG') || 'en_US'
  const includeButton = (Deno.env.get('WHATSAPP_OTP_TEMPLATE_HAS_BUTTON') || 'true') !== 'false'

  if (!accessToken || !phoneNumberId) {
    throw new Error('WhatsApp credentials are not configured')
  }

  // E.164 digits only; WhatsApp `to` does not want the leading "+".
  const to = phone.replace(/[^\d]/g, '')

  // AUTHENTICATION templates take the OTP as the body parameter and, for the
  // one-tap "copy code" button, the same code as the button's URL parameter.
  const components: unknown[] = [
    { type: 'body', parameters: [{ type: 'text', text: otp }] },
  ]
  if (includeButton) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: otp }],
    })
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: templateLang },
      components,
    },
  }

  let url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`
  // appsecret_proof hardens the call so a leaked access token alone can't be replayed.
  // Opt-in: requires WHATSAPP_USE_APPSECRET_PROOF=true AND a matching WHATSAPP_APP_SECRET.
  if (useAppSecretProof && appSecret) {
    const proof = await hmacSha256Hex(appSecret, accessToken)
    url += `?appsecret_proof=${proof}`
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const detail = await res.text()
    // Don't log the OTP; log the recipient + Graph error only.
    console.error('WhatsApp send failed', { status: res.status, to, detail })
    throw new Error(`WhatsApp delivery failed (${res.status})`)
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405)
  }

  const rawBody = await req.text()

  const hookSecret = Deno.env.get('SEND_SMS_HOOK_SECRET')
  if (hookSecret) {
    const ok = await verifyHookSignature(req, rawBody, hookSecret).catch(() => false)
    if (!ok) {
      console.error('Send SMS hook signature verification failed')
      return jsonError('Invalid signature', 401)
    }
  } else {
    console.warn('SEND_SMS_HOOK_SECRET is not set — skipping signature verification')
  }

  let payload: SendSmsHookPayload
  try {
    payload = JSON.parse(rawBody) as SendSmsHookPayload
  } catch {
    console.error('Invalid JSON body from hook')
    return jsonError('Invalid JSON body', 400)
  }

  // Recipient: sms.phone is authoritative for phone-change OTPs; fall back to the
  // pending new_phone / current phone for other phone-OTP flows.
  const phone = (payload.sms?.phone || payload.user?.new_phone || payload.user?.phone)?.trim()
  const otp = payload.sms?.otp?.trim()
  if (!phone || !otp) {
    console.error('Missing phone or otp in hook payload', {
      topKeys: Object.keys(payload ?? {}),
      userKeys: Object.keys(payload?.user ?? {}),
      smsKeys: Object.keys(payload?.sms ?? {}),
    })
    return jsonError('Missing phone or otp in hook payload', 400)
  }

  try {
    await sendWhatsAppOtp(phone, otp)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send WhatsApp OTP'
    console.error('whatsapp-send-otp error', message)
    return jsonError(message, 500)
  }

  // Empty 200 tells GoTrue delivery succeeded.
  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
})
