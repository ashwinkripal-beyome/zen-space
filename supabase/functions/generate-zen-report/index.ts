import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import {
  ZEN_REPORT_SYSTEM_PROMPT,
  buildReportUserMessage,
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

  console.info('generate-zen-report request', req.method)

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
      .select('id, client_id, therapist_id, status, score_total, score_data, therapist_observations, client_observations, assessment_kind')
      .eq('id', assessmentId)
      .maybeSingle()

    if (aErr || !assessment) {
      return new Response(JSON.stringify({ error: 'Assessment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (assessment.status !== 'completed') {
      return new Response(JSON.stringify({ error: 'Assessment must be completed before generating a report' }), {
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

    // Scores
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

    // Pain points: questions where client scored 2 or 3 (mostly / completely true)
    const { data: painPointRows } = await admin
      .from('assessment_answers')
      .select('question_text')
      .eq('assessment_id', assessmentId)
      .in('answer_value', ['2', '3'])

    const painPoints = (painPointRows ?? [])
      .map(r => (r.question_text as string) || '')
      .filter(Boolean)

    const userMessage = buildReportUserMessage({
      clientName: displayName,
      age: clientAge,
      gender: profile?.gender as string | null,
      occupation: profile?.occupation as string | null,
      totalScore,
      balanceScore,
      blossomScore,
      blissScore,
      painPoints,
      clientObservations: (assessment.client_observations || null) as Record<string, unknown> | null,
      therapistObservations: (assessment.therapist_observations || null) as Record<string, unknown> | null,
    })

    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini'

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.65,
        messages: [
          { role: 'system', content: ZEN_REPORT_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      }),
    })

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      console.error('OpenAI error', openaiRes.status, errText)
      const detail = summarizeOpenAiErrorBody(errText)
      return new Response(JSON.stringify({ error: 'OpenAI request failed', detail }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const openaiJson = (await openaiRes.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = openaiJson.choices?.[0]?.message?.content?.trim()
    if (!content) {
      return new Response(JSON.stringify({ error: 'Empty model response' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const sections = parseReportSections(content)

    const row = {
      assessment_id: assessmentId,
      client_id: assessment.client_id,
      therapist_id: user.id,
      content,
      report_section: sections.reportSection || null,
      ritual_section: sections.ritualSection || null,
      plan_section: sections.planSection || null,
      final_narrative_section: sections.finalNarrativeSection || null,
      affirmations: sections.affirmations.length > 0 ? sections.affirmations : null,
      imbalance_score: balanceScore,
      blossom_zone_emotional: blossomScore,
      bliss_zone_spiritual: blissScore,
    }

    const { data: rep, error: repErr } = await admin
      .from('reports')
      .upsert(row, { onConflict: 'assessment_id' })
      .select('id')
      .single()

    if (repErr) {
      console.error('reports upsert', repErr)
      return new Response(JSON.stringify({ error: repErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ ok: true, report_id: rep.id, assessment_id: assessmentId }),
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
