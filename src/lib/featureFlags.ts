/**
 * Runtime feature flags (baked in at build time via Vite env vars).
 */

/**
 * One-time WhatsApp phone verification for clients.
 * Set VITE_WHATSAPP_OTP_ENABLED=false to temporarily hide the whole flow
 * (e.g. while the WhatsApp access token is being (re)provisioned). Defaults ON.
 */
export const WHATSAPP_OTP_ENABLED =
  (import.meta.env.VITE_WHATSAPP_OTP_ENABLED ?? 'true') !== 'false'
