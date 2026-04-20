/** Session flag after successful `validate_therapist_otp` (client flow). */
export const SESSION_CLIENT_OTP_VERIFIED_KEY = 'zenspace_client_otp_verified'

export function isClientOtpVerifiedInSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_CLIENT_OTP_VERIFIED_KEY) === '1'
  } catch {
    return false
  }
}

export function clearClientOtpVerifiedSession(): void {
  try {
    sessionStorage.removeItem(SESSION_CLIENT_OTP_VERIFIED_KEY)
  } catch {
    /* ignore */
  }
}
