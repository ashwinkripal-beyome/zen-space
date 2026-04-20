/**
 * When `functions.invoke` fails, Supabase sets `error.message` to a generic string.
 * The real payload is on `response` (same as FunctionsHttpError.context). We avoid
 * `instanceof` because bundled code can load two copies of @supabase/functions-js.
 */
export async function messageFromFunctionInvokeFailure(
  error: unknown,
  response?: Response
): Promise<string> {
  const fallback =
    error && typeof error === 'object' && 'message' in error && typeof (error as Error).message === 'string'
      ? (error as Error).message
      : 'Request failed'

  if (!response || response.ok) return fallback

  const status = response.status
  let text = ''
  try {
    text = await response.text()
  } catch {
    return status ? `${fallback} (HTTP ${status})` : fallback
  }

  const trimmed = text.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const body = JSON.parse(trimmed) as { error?: string; message?: string; detail?: string }
      const err =
        typeof body.error === 'string'
          ? body.error
          : typeof body.message === 'string'
            ? body.message
            : null
      if (err) return body.detail ? `${err}: ${body.detail}` : err
    } catch {
      /* use raw text below */
    }
  }

  if (trimmed) {
    const short = trimmed.length > 500 ? `${trimmed.slice(0, 500)}…` : trimmed
    return `${fallback} (HTTP ${status}): ${short}`
  }

  return status ? `${fallback} (HTTP ${status})` : fallback
}
