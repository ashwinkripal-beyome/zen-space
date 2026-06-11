// ---------------------------------------------------------------------------
// PDF report generation.
//
// As of the pdfmake migration this module is a thin compatibility shim. The
// actual generator lives in `zenPdfMake.ts`, which produces a true text-based
// PDF (selectable / copyable text) with automatic line-safe pagination —
// replacing the previous html2canvas approach that rasterised the whole
// document into images.
// ---------------------------------------------------------------------------

import { downloadZenPlanPdfMake } from '@/lib/zenPdfMake'

export type { ZenPlanPrintPayload, ZenPrintProfileFacts } from '@/lib/zenPdfMake'
import type { ZenPlanPrintPayload } from '@/lib/zenPdfMake'

/**
 * Generates and downloads a text-based wellness report PDF.
 *
 * The returned promise resolves once the browser download has been triggered.
 */
export function downloadZenPlanPdf(
  payload: ZenPlanPrintPayload
): Promise<{ ok: boolean; error?: string }> {
  return downloadZenPlanPdfMake(payload)
}
