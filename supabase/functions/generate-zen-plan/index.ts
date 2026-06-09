import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import {
  ZEN_FOURFOLD_RITUAL_SYSTEM_PROMPT,
  ZEN_PLAN_18_SYSTEM_PROMPT,
  ZEN_REMAINING_RITUAL_SYSTEM_PROMPT,
  assembleFullReportContent,
  assemblePlanWithExistingMental,
  assembleRitualFromParts,
  assembleSupervisedReportContent,
  buildPlan18UserMessage,
  buildPlan18UserMessageWithSelections,
  buildReportAndFinalDelimitedContent,
  buildReportDbFields,
  buildRitualDbFields,
  buildRemainingRitualUserMessage,
  buildRitualUserMessage,
  hasReportSubsectionDelimiters,
  parsePlanSectionOnly,
  parseReportSections,
  parseReportSubsections,
  parseRitualSectionOnly,
  parseRitualSubsections,
  parseRemainingRitualSections,
  parseRemainingRitualSubsections,
  resolveLegacyReportBodyAndFinal,
  shouldUseLegacyPlanGenerationPath,
} from '../_shared/zenReportPrompt.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function summarizeOpenAiErrorBody(errText: string): string {
  try {
    const j = JSON.parse(errText) as { error?: { message?: string; code?: string; type?: string } }
    const e = j?.error
    if (!e) return errText.slice(0, 400)

    if (e.code === 'insufficient_quota' || e.type === 'insufficient_quota') {
      return 'OpenAI quota or billing is inactive for this API key. Add payment method or credits at https://platform.openai.com/account/billing'
    }
    if (e.code === 'invalid_api_key') {
      return 'Invalid OpenAI API key. Update the OPENAI_API_KEY secret for this project.'
    }
    if (typeof e.message === 'string' && e.message.length > 0) {
      return e.message.length > 500 ? `${e.message.slice(0, 500)}…` : e.message
    }
  } catch {
    /* not JSON */
  }
  return errText.trim().length > 400 ? `${errText.trim().slice(0, 400)}…` : errText.trim()
}

type ScoreZones = {
  balance?: { sum?: number }
  blossom?: { sum?: number }
  bliss?: { sum?: number }
}
type ScoreData = {
  zones?: ScoreZones
  overall?: { sum?: number }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.info('generate-zen-plan request', req.method)

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
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured on project' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace(/^Bearer\s+/i, '')
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userErr,
    } = await supabaseUser.auth.getUser(token)
    if (userErr || !user) {
      console.error('getUser failed', userErr?.message)
      return new Response(JSON.stringify({ error: 'Invalid session', detail: userErr?.message ?? null }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as {
      assessment_id?: string
      force?: boolean
      scrap_and_regenerate?: boolean
      /** When true the caller is the client themselves (after payment); skip therapist-link check. */
      client_initiated?: boolean
      /** Pre-selected activities for 1-on-1 plan (18 entries keyed by week number). */
      selected_activities?: Record<string, { activity_name: string; zone: string; corner: string }>
    }
    const assessmentId = body.assessment_id
    const forceRegenerate = body.force === true
    const scrapAndRegenerate = body.scrap_and_regenerate === true
    const clientInitiated = body.client_initiated === true
    const selectedActivities = body.selected_activities ?? null
    if (!assessmentId || typeof assessmentId !== 'string') {
      return new Response(JSON.stringify({ error: 'assessment_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: assessment, error: aErr } = await admin
      .from('assessments')
      .select(
        'id, client_id, status, score_total, score_data, therapist_observations, client_observations, assessment_kind, assessment_mode'
      )
      .eq('id', assessmentId)
      .maybeSingle()

    if (aErr || !assessment) {
      return new Response(JSON.stringify({ error: 'Assessment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (assessment.status !== 'completed') {
      return new Response(JSON.stringify({ error: 'Assessment must be completed before generating a plan' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: link } = await admin
      .from('therapist_clients')
      .select('therapist_id')
      .eq('client_id', assessment.client_id)
      .eq('therapist_id', user.id)
      .maybeSingle()

    if (!link) {
      // Allow paid clients to trigger their own plan generation (e.g., after Razorpay checkout).
      if (clientInitiated && user.id === assessment.client_id) {
        const { data: clientProfile } = await admin
          .from('profiles')
          .select('is_paid_customer')
          .eq('id', user.id)
          .maybeSingle()
        if (!clientProfile?.is_paid_customer) {
          return new Response(JSON.stringify({ error: 'Plan activation requires a paid account' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      } else {
        return new Response(JSON.stringify({ error: 'Not assigned to this client' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const { data: reportRow, error: rErr } = await admin
      .from('reports')
      .select(
        'id, content, report_section, ritual_section, final_narrative_section, plan_section, assessment_id, report_client_info, report_key_concerns, report_current_state, report_balance_zone, report_blossom_zone, report_bliss_zone, report_integrated_interpretation, ritual_explain, ritual_somatic, ritual_mental, ritual_daily, ritual_reflect, affirmations'
      )
      .eq('assessment_id', assessmentId)
      .maybeSingle()

    if (rErr || !reportRow) {
      return new Response(JSON.stringify({ error: 'Report not found for this assessment' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const existingPlan = (reportRow.plan_section as string) || ''
    const planLooksComplete = existingPlan.trim().length > 200
    if (planLooksComplete && !forceRegenerate && !scrapAndRegenerate) {
      return new Response(JSON.stringify({ error: 'This report already has an 18-week plan' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (scrapAndRegenerate) {
      const { error: clearErr } = await admin
        .from('reports')
        .update({
          plan_section: null,
          ritual_section: null,
          ritual_explain: null,
          ritual_somatic: null,
          ritual_mental: null,
          ritual_daily: null,
          ritual_reflect: null,
        })
        .eq('id', reportRow.id as string)
      if (clearErr) {
        console.error('reports clear plan/ritual', clearErr)
        return new Response(JSON.stringify({ error: clearErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      reportRow.plan_section = null
      reportRow.ritual_section = null
      reportRow.ritual_mental = null
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('first_name, name, email, age, dob, gender, occupation')
      .eq('id', assessment.client_id)
      .maybeSingle()

    const displayName =
      (profile?.first_name as string)?.trim() ||
      (typeof profile?.name === 'string' ? profile.name.trim().split(/\s+/)[0] : '') ||
      (profile?.email as string)?.split('@')[0] ||
      'Client'

    let clientAge: number | null = null
    if (profile?.dob) {
      const [y, m, d] = (profile.dob as string).split('-').map(Number)
      const now = new Date()
      clientAge = now.getFullYear() - y
      if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) clientAge--
    } else if (typeof profile?.age === 'number') {
      clientAge = profile.age as number
    }

    const scoreData = (assessment.score_data || {}) as ScoreData
    const zones = scoreData.zones || {}
    const totalScore =
      typeof scoreData.overall?.sum === 'number'
        ? scoreData.overall.sum
        : typeof assessment.score_total === 'number'
          ? assessment.score_total
          : 0
    const balanceScore = typeof zones.balance?.sum === 'number' ? zones.balance.sum : 0
    const blossomScore = typeof zones.blossom?.sum === 'number' ? zones.blossom.sum : 0
    const blissScore = typeof zones.bliss?.sum === 'number' ? zones.bliss.sum : 0

    const { data: painPointRows } = await admin
      .from('assessment_answers')
      .select('question_text')
      .eq('assessment_id', assessmentId)
      .in('answer_value', ['2', '3'])

    const keyConcerns = (painPointRows ?? [])
      .map(r => (r.question_text as string) || '')
      .filter(Boolean)

    const isSelfAssessment = assessment.assessment_mode === 'self'
    const existingMentalHtml = scrapAndRegenerate
      ? ''
      : (
          ((reportRow.ritual_mental as string) || '').trim() ||
          ((reportRow.ritual_section as string) || '').trim()
        )
    // Use remaining-ritual prompt when a self-report already has mental reprogramming stored
    const hasExistingMental = isSelfAssessment && existingMentalHtml.length > 0 && !scrapAndRegenerate
    const isSupervised = assessment.assessment_mode === 'supervised'

    const reportParams = {
      clientName: displayName,
      age: clientAge,
      gender: profile?.gender as string | null,
      occupation: profile?.occupation as string | null,
      totalScore,
      balanceScore,
      blossomScore,
      blissScore,
      keyConcerns,
      clientObservations: (assessment.client_observations || null) as Record<string, unknown> | null,
      therapistObservations: isSupervised
        ? ((assessment.therapist_observations || null) as Record<string, unknown> | null)
        : null,
    }

    const userMessagePlan = selectedActivities
      ? buildPlan18UserMessageWithSelections(reportParams, selectedActivities)
      : buildPlan18UserMessage(reportParams)
    const userMessageRitual = buildRitualUserMessage(reportParams)

    const contentStr = (reportRow.content as string) || ''
    const rs = (reportRow.report_section as string) || ''
    const fin = (reportRow.final_narrative_section as string) || ''

    const reportRowRecord = reportRow as Record<string, unknown>
    const { reportHtml: legacyReportHtml, finalHtml: legacyFinalHtml } = resolveLegacyReportBodyAndFinal({
      reportSection: rs,
      finalNarrativeSection: fin,
      content: contentStr,
    })

    // scrapAndRegenerate: always use report_section + final_narrative_section as the report body.
    // This skips the legacy/new-format detection entirely and is guaranteed to work whenever those
    // two columns are populated (which they always are for paid self-assessment reports).
    if (scrapAndRegenerate && !legacyReportHtml.trim()) {
      return new Response(
        JSON.stringify({ error: 'Report body missing; cannot regenerate plan. Try regenerating the full report first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let isLegacyReport =
      !scrapAndRegenerate &&
      shouldUseLegacyPlanGenerationPath({
        content: contentStr,
        reportSection: rs,
        reportRow: reportRowRecord,
      })

    // For new-format reports we keep the delimited content intact so subsection columns can be repopulated.
    let toParse = ''

    if (scrapAndRegenerate) {
      // Always reconstruct from aggregate columns so old content blobs don't pollute the new run.
      toParse = buildReportAndFinalDelimitedContent({
        report: legacyReportHtml,
        final: legacyFinalHtml,
      })
      isLegacyReport = false
    } else if (!isLegacyReport) {
      if (contentStr.trim() && (contentStr.includes('---SECTION:REPORT---') || contentStr.includes('---SECTION:FINAL---'))) {
        toParse = contentStr
      } else if (rs.trim() && fin.trim()) {
        toParse = buildReportAndFinalDelimitedContent({ report: rs, final: fin })
      } else if (
        contentStr.trim() &&
        (hasReportSubsectionDelimiters(contentStr) || contentStr.includes('---SECTION:FINAL---'))
      ) {
        toParse = contentStr
      }

      const parsed = parseReportSections(toParse)
      if (!parsed.reportSection.trim() || !parsed.finalNarrativeSection.trim()) {
        if (legacyReportHtml.trim()) {
          isLegacyReport = true
        } else {
          return new Response(
            JSON.stringify({ error: 'Report sections incomplete; regenerate the Zen Plan report first.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    if (isLegacyReport && !legacyReportHtml.trim()) {
      return new Response(
        JSON.stringify({ error: 'Report content is missing; cannot attach a plan. Regenerate the report first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini'

    const openaiPlanRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.65,
        messages: [
          { role: 'system', content: ZEN_PLAN_18_SYSTEM_PROMPT },
          { role: 'user', content: userMessagePlan },
        ],
      }),
    })

    if (!openaiPlanRes.ok) {
      const errText = await openaiPlanRes.text()
      console.error('OpenAI plan error', openaiPlanRes.status, errText)
      const detail = summarizeOpenAiErrorBody(errText)
      return new Response(JSON.stringify({ error: 'OpenAI request failed (18-week plan)', detail }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const openaiPlanJson = (await openaiPlanRes.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const planOnlyRaw = openaiPlanJson.choices?.[0]?.message?.content?.trim()
    if (!planOnlyRaw) {
      return new Response(JSON.stringify({ error: 'Empty model response (18-week plan)' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Choose ritual system prompt: use remaining-ritual (steps 1,3,4) when mental reprogram
    // already exists from self-report; otherwise generate the full Fourfold Zen Ritual.
    const ritualSystemPrompt = hasExistingMental
      ? ZEN_REMAINING_RITUAL_SYSTEM_PROMPT
      : ZEN_FOURFOLD_RITUAL_SYSTEM_PROMPT
    const ritualUserMessage = hasExistingMental
      ? buildRemainingRitualUserMessage(reportParams)
      : userMessageRitual

    const openaiRitualRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.65,
        messages: [
          { role: 'system', content: ritualSystemPrompt },
          { role: 'user', content: ritualUserMessage },
        ],
      }),
    })

    if (!openaiRitualRes.ok) {
      const errText = await openaiRitualRes.text()
      console.error('OpenAI ritual error', openaiRitualRes.status, errText)
      const detail = summarizeOpenAiErrorBody(errText)
      return new Response(JSON.stringify({ error: 'OpenAI request failed (Fourfold Zen Ritual)', detail }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const openaiRitualJson = (await openaiRitualRes.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const ritualOnlyRaw = openaiRitualJson.choices?.[0]?.message?.content?.trim()
    if (!ritualOnlyRaw) {
      return new Response(JSON.stringify({ error: 'Empty model response (Fourfold Zen Ritual)' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let row: Record<string, unknown>

    if (!isLegacyReport) {
      const fullContent = hasExistingMental
        ? assemblePlanWithExistingMental(toParse, existingMentalHtml, ritualOnlyRaw, planOnlyRaw)
        : assembleSupervisedReportContent(toParse, ritualOnlyRaw, planOnlyRaw)
      const sections = parseReportSections(fullContent)
      const reportDb = buildReportDbFields(parseReportSubsections(toParse), toParse)
      const ritualParsed = hasExistingMental
        ? {
            ...parseRemainingRitualSubsections(ritualOnlyRaw),
            mental: existingMentalHtml.trim(),
            usedNewFormat: true,
          }
        : parseRitualSubsections(ritualOnlyRaw)
      const ritualDb = buildRitualDbFields(ritualParsed, ritualOnlyRaw)

      row = {
        content: fullContent,
        report_section: reportDb.reportSection || sections.reportSection || null,
        ritual_section: ritualDb.ritualSection || sections.ritualSection || null,
        plan_section: sections.planSection || null,
        final_narrative_section: reportDb.finalNarrativeSection || sections.finalNarrativeSection || null,
        report_client_info: reportDb.report_client_info,
        report_key_concerns: reportDb.report_key_concerns,
        report_current_state: reportDb.report_current_state,
        report_balance_zone: reportDb.report_balance_zone,
        report_blossom_zone: reportDb.report_blossom_zone,
        report_bliss_zone: reportDb.report_bliss_zone,
        report_integrated_interpretation: reportDb.report_integrated_interpretation,
        ritual_explain: ritualDb.ritual_explain,
        ritual_somatic: ritualDb.ritual_somatic,
        ritual_mental: ritualDb.ritual_mental || (existingMentalHtml.trim() ? existingMentalHtml.trim() : null),
        ritual_daily: ritualDb.ritual_daily,
        ritual_reflect: ritualDb.ritual_reflect,
        affirmations: sections.affirmations.length > 0 ? sections.affirmations : null,
      }
    } else {
      // Legacy report: store the old way and keep ALL subsection columns null so the frontend
      // falls back to splitting report_section / ritual_section HTML (display unchanged).
      const planSection = parsePlanSectionOnly(planOnlyRaw)
      const ritualSectionLegacy = hasExistingMental
        ? (() => {
            const remaining = parseRemainingRitualSections(ritualOnlyRaw)
            return assembleRitualFromParts(remaining.before, existingMentalHtml, remaining.after)
          })()
        : parseRitualSectionOnly(ritualOnlyRaw)
      const legacyContent = assembleFullReportContent({
        report: legacyReportHtml,
        ritual: ritualSectionLegacy,
        plan: planSection,
        final: legacyFinalHtml,
      })
      const legacySections = parseReportSections(legacyContent)

      row = {
        content: legacyContent,
        report_section: legacyReportHtml || null,
        ritual_section: ritualSectionLegacy || reportRow.ritual_section || null,
        plan_section: planSection || legacySections.planSection || null,
        final_narrative_section: legacyFinalHtml || reportRow.final_narrative_section || null,
        affirmations:
          legacySections.affirmations.length > 0
            ? legacySections.affirmations
            : (reportRow.affirmations as string[] | null) ?? null,
      }
    }

    const { error: upErr } = await admin
      .from('reports')
      .update(row)
      .eq('id', reportRow.id as string)

    if (upErr) {
      console.error('reports update plan', upErr)
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ ok: true, report_id: reportRow.id, assessment_id: assessmentId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: (e as Error).message || 'Server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
