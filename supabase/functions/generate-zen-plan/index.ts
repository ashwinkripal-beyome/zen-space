import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import {
  ZEN_FOURFOLD_RITUAL_SYSTEM_PROMPT,
  ZEN_PLAN_18_SYSTEM_PROMPT,
  assembleSupervisedReportContent,
  buildPlan18UserMessage,
  buildReportAndFinalDelimitedContent,
  buildRitualUserMessage,
  parseReportSections,
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

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userErr,
    } = await supabaseUser.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as { assessment_id?: string }
    const assessmentId = body.assessment_id
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
      return new Response(JSON.stringify({ error: 'Not assigned to this client' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: reportRow, error: rErr } = await admin
      .from('reports')
      .select(
        'id, content, report_section, ritual_section, final_narrative_section, plan_section, assessment_id'
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
    if (existingPlan.trim().length > 0) {
      return new Response(JSON.stringify({ error: 'This report already has an 18-week plan' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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

    const userMessagePlan = buildPlan18UserMessage(reportParams)
    const userMessageRitual = buildRitualUserMessage(reportParams)

    const contentStr = (reportRow.content as string) || ''
    const rs = (reportRow.report_section as string) || ''
    const fin = (reportRow.final_narrative_section as string) || ''

    let toParse: string
    if (contentStr.trim() && (contentStr.includes('---SECTION:REPORT---') || contentStr.includes('---SECTION:FINAL---'))) {
      toParse = contentStr
    } else if (rs.trim() && fin.trim()) {
      toParse = buildReportAndFinalDelimitedContent({ report: rs, final: fin })
    } else {
      return new Response(
        JSON.stringify({ error: 'Report content is missing; cannot attach a plan. Regenerate the report first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const parsed = parseReportSections(toParse)
    if (!parsed.reportSection.trim() || !parsed.finalNarrativeSection.trim()) {
      return new Response(JSON.stringify({ error: 'Report sections incomplete; regenerate the Zen Plan report first.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const normalizedReportAndFinal = buildReportAndFinalDelimitedContent({
      report: parsed.reportSection,
      final: parsed.finalNarrativeSection,
    })

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
          { role: 'system', content: ZEN_FOURFOLD_RITUAL_SYSTEM_PROMPT },
          { role: 'user', content: userMessageRitual },
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

    const fullContent = assembleSupervisedReportContent(normalizedReportAndFinal, ritualOnlyRaw, planOnlyRaw)
    const sections = parseReportSections(fullContent)

    const row = {
      content: fullContent,
      report_section: sections.reportSection || null,
      ritual_section: sections.ritualSection || null,
      plan_section: sections.planSection || null,
      final_narrative_section: sections.finalNarrativeSection || null,
      affirmations: sections.affirmations.length > 0 ? sections.affirmations : null,
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
