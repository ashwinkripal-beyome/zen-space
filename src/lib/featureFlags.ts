/**
 * Runtime feature flags (baked in at build time via Vite env vars).
 */

/**
 * One-time WhatsApp phone verification for clients.
 * Temporarily disabled by default while WhatsApp OTP delivery is broken.
 * Set VITE_WHATSAPP_OTP_ENABLED=true to re-enable the flow once fixed.
 */
export const WHATSAPP_OTP_ENABLED =
  (import.meta.env.VITE_WHATSAPP_OTP_ENABLED ?? 'false') === 'true'
