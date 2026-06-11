import { supabase } from '@/lib/supabase'

/** Stamp the signed-in client's informed-consent acceptance. Idempotent. */
export async function recordClientConsent(): Promise<string> {
  const { data, error } = await supabase.rpc('record_client_consent')
  if (error) {
    console.error('[record_client_consent]', error)
    throw new Error(error.message)
  }
  return String(data ?? '')
}
