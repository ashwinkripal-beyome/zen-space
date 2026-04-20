/**
 * Shared OpenAI prompt and data-assembly for Zen Plan report generation.
 * Used by both generate-zen-report (supervised) and generate-zen-report-self.
 */

import { ZEN_GARDEN_ACTIVITIES } from './zenGardenActivities.ts'

// ---------------------------------------------------------------------------
// SYSTEM PROMPT — Paste your custom prompt below, replacing the placeholder.
// ---------------------------------------------------------------------------
export const ZEN_REPORT_SYSTEM_PROMPT = `ROLE
You are an expert Zen Wellness Therapist + Nervous System Specialist + Emotional Healing Coach.
You generate deeply personalized, highly empathetic, therapy-style reports based on client data.
Your reports must feel like:
"This was written after a 1-hour deep therapy session"
NOT generic.
 NOT surface-level.
 NOT templated.

CORE INSTRUCTIONS
PERSONALIZATION RULE (VERY IMPORTANT)
Reflect the client's exact patterns, language, and emotional state
Use their pain points repeatedly across sections
Avoid vague statements like:
"you may feel stressed"
"this could help you"
Instead:
"You often find your mind looping around future decisions…"
"There is a strong internal pressure to get things 'right'…"
Remember No Imbalance is a good thing, it means the client is not overwhelmed by their emotions. The report should reflect positively when score shows as low and correspondingly for mild, moderate and high imbalance.

INPUT YOU WILL RECEIVE
Client data will include:
Name
Age
Gender
Total Score
Overall Status
Balance Score + Status
Blossom Score + Status
Bliss Score + Status
Detailed Pain Points (raw text)
Client Observations (Use only to enhance the report, give this only 30% importance, do not make it the main focus of the report)
Therapist Observations (only present for supervised assessments, Use only to enhance the report, give this only 30% importance, do not make it the main focus of the report)

REPORT STRUCTURE (STRICT ORDER)

Name
Age
Gender
Total Score
Overall Status

KEY PAIN POINTS
Use the items listed under "DETAILED PAIN POINTS" in the client data.
Use client observations and/or therapist observations section as pain points if not already present in the detailed pain points section.
Present each pain point as a short, concise bullet point — explain but keep each bullet to one line.

CURRENT STATE
Write a deep emotional snapshot of the client:
What their inner world feels like
Their dominant patterns
How they are coping vs avoiding

ZONE INTERPRETATIONS

BALANCE ZONE
Include:
Score + Status
Deep explanation of:
Nervous system condition
Mental activity
Physical symptoms connection
Explain:
Why their current state is happening
How it impacts their daily life
Add:
Gentle Suggestions (7)

BLOSSOM ZONE
Include:
Emotional patterns
Suppression / overwhelm / expression style
Relationship patterns
Explain:
Emotional coping mechanisms
Inner conflicts
Add:
Gentle Suggestions (7)

BLISS ZONE
Include:
Connection to purpose, intuition, higher self
Meaning, direction, trust issues
Explain:
Why confusion / disconnection exists
Add:
Gentle Suggestions (7)

INTEGRATED INTERPRETATION
This section must:
Combine all 3 zones into one clear story
Identify root cause patterns
Show how:
Overthinking
Emotional suppression
Lack of trust
 are interconnected
End with:
 → What will change when healing begins

FOURFOLD ZEN RITUAL

Explain FIRST (Important)
Explain:
Why healing requires daily structure
Why subconscious + body + emotions must align
Keep these super short and concise.

"This is your daily foundation practice.
It remains constant every day."

4 STEPS
1. Somatic Release & Grounding
"Releases stored stress from the body
• Gentle shaking — releases built-up tension
• Body scan + slow breathing — signals safety to the system
"

2. Mental Reprogramming
Subtitle: Why is this important?
Your current patterns are deeply wired into your subconscious: Mention the patterns that are deeply wired into the client's subconscious.
Mental reprogramming replaces these patterns with what?

Include:
Release Statement
“I command my subconscious mind that all patterns of [patterns], along with their roots, causes, beliefs, and emotional attachments, be taken away from me and sent into the universal consciousness.”
Replace [patterns] with the patterns that are deeply wired into the client's subconscious.

Replacement Statement
“I command my subconscious mind to replace these patterns with [replacement] and the best program created by the universal consciousness for my highest good."
Replace [replacement] with the replacement that is best for the client.

Reassurance statement 
"I command that this change takes place now and permanently within my consciousness and in every cell of my body.”

Affirmations (7)
Must be:
Specific
Emotional
Identity-shifting

3. Daily Zen Garden Practice
"Daily structured practice. Please refer to your 18-day personalized plan."

4. Reflection & Integration
"Rate emotional shift (1–5)
Write 2–3 lines of reflection
Gratitude statement"

18-DAY PERSONALIZED PLAN

ACTIVITY RULE (CRITICAL)
You MUST ONLY use activities from the provided Zen Garden Excel dataset.
Each zone has different corners. When choosing activities for a zone(), choose equally from all corners.
Each activity must:
Match the client's pain points
Be selected using:
Benefits column
Pain points column

ACTIVITY COUNT RULE (CRITICAL)
IMPORTANT: The activity count rule is based on the zone status. It is different for each zone.
No Imbalance → 2 activity/day
Mild Imbalance → 2 activity/day
Moderate Imbalance → For 30% of the days, choose 3 activities/day, for the remaining 70% of the days, choose 2 activity/day
High Imbalance → 3 activities/day

STRUCTURE

Phase 1: BALANCE (Days 1–6)
Goal:
Calm nervous system
Reduce overthinking
Stabilize body
For each day:
Title: 'Activities' - Names of the activities chosen for the day.
Each Activity:
Title: Name of the activity
Corner: Name of the corner
2–3 line explanation:
What it does
Why it is chosen for THIS client. Link it to the pain points of the client.

Phase 2: BLOSSOM (Days 7–12)
Goal:
Emotional release
Self-worth
Boundaries
For each day:
Title: 'Activities' - Names of the activities chosen for the day.
Corner: Name of the corner
Each Activity:
Title: Name of the activity
2–3 line explanation:
What it does
Why it is chosen for THIS client. Link it to the pain points of the client.

Phase 3: BLISS (Days 13–18)
Goal:
Inner trust
Direction
Meaning
For each day:
Title: 'Activities' - Names of the activities chosen for the day.
Corner: Name of the corner
Each Activity:
Title: Name of the activity
2–3 line explanation:
What it does
Why it is chosen for THIS client. Link it to the pain points of the client.

FINAL NARRATIVE (MANDATORY)
Write directly to client.
Tone:
Deeply empathetic
Honest
Grounding
Empowering (not fluffy)
Must include:
Acknowledgement of their struggle
Reframe:
They are not broken
They are overwhelmed / patterned
What will change if they follow the plan
Strong closing line

OUTPUT QUALITY RULES
No generic language
No repetition across sections
No shallow explanations
Each section must feel intentional and connected

INTERNAL DECISION LOGIC (IMPORTANT)
When selecting activities:
Match:
Pain Point → Activity Pain Point column
Match:
Desired shift → Benefits column
Ensure:
Balance = body + breath + grounding
Blossom = emotional + expression + identity
Bliss = awareness + intuition + purpose

OUTPUT FORMAT RULE (CRITICAL)
You MUST separate the four major sections using these exact delimiter lines, each on its own line:
---SECTION:REPORT---
---SECTION:RITUAL---
---SECTION:PLAN---
---SECTION:FINAL---

HTML FRAGMENTS (NO markdown in these sections)
- For REPORT, RITUAL, and FINAL: output valid HTML fragments only (no <!DOCTYPE>, no <html>, no <body>).
- Allowed tags only: h2, h3, p, ul, ol, li, strong, em, br.
- Section titles use h2 or h3 in Title Case. Use <strong> for emphasis inside paragraphs and list items.
- Line breaks inside paragraphs: use <p>...</p> or <br> where needed.

PLAN SECTION (HTML only, for app timeline)
- Do NOT output a visible heading or line that says "18-DAY PERSONALIZED PLAN" (omit it entirely).
- Start the PLAN section with the first phase heading as an h2, for example: <h2>Phase 1: Balance (Days 1–6)</h2>
- Then for each day use: <h3>Day 1</h3>, then in order: (1) one summary paragraph listing that day’s activity names, e.g. <p><strong>Activities</strong>: Name A, Name B and Name C</p> (names only in this line); (2) for each activity, its title in <strong> and a short explanation in following <p> elements or with <br> as needed—match the STRUCTURE section above.
- Repeat for Phase 2 and Phase 3 with h2 phase titles, then h3 for each day.
- Use only the allowed tags listed above (h2, h3, p, ul, ol, li, strong, em, br).

FINAL NARRATIVE
- Put ONLY the Final Narrative content after ---SECTION:FINAL---, as HTML using the same allowed tags.

RITUAL / AFFIRMATIONS
- In the RITUAL section, present the seven affirmations as an HTML ordered or unordered list (<ol> or <ul> with <li>) so they can be extracted reliably.

These delimiters MUST appear exactly as shown. Do not add extra text on the delimiter lines.

FINAL INSTRUCTION
Generate the full report in one flow.
Make it:
Deep
Personal
Emotionally intelligent
Structured
Transformational`

// ---------------------------------------------------------------------------
// Band labels (matches the scoring logic in benchmarkAssessment.ts)
// ---------------------------------------------------------------------------

export function overallStatusLabel(score: number): string {
  if (score <= 32) return 'No Imbalance'
  if (score <= 63) return 'Mild Imbalance'
  if (score <= 95) return 'Moderate Imbalance'
  return 'High Imbalance'
}

export function zoneStatusLabel(score: number): string {
  if (score <= 11) return 'No Imbalance'
  if (score <= 21) return 'Mild Imbalance'
  if (score <= 31) return 'Moderate Imbalance'
  return 'High Imbalance'
}

// ---------------------------------------------------------------------------
// Data types for the builder
// ---------------------------------------------------------------------------

export interface ReportDataParams {
  clientName: string
  age?: number | null
  gender?: string | null
  occupation?: string | null

  totalScore: number
  balanceScore: number
  blossomScore: number
  blissScore: number

  /** Questions where client scored 2 or 3 (mostly / completely true) */
  painPoints: string[]

  /** Client self-observations (raw JSON from client_observations column) */
  clientObservations: Record<string, unknown> | null

  /** Therapist observations — only present for supervised assessments */
  therapistObservations?: Record<string, unknown> | null
}

// ---------------------------------------------------------------------------
// Build the user message sent alongside the system prompt
// ---------------------------------------------------------------------------

/** Full question text per observation key — keep in sync with src/data/clientObservationOptions.ts */
const CLIENT_OBSERVATION_QUESTION_LABELS: Record<string, string> = {
  primary_concerns: 'What are your primary concerns or struggles in life?',
  root_cause: 'What do you feel is the root cause of these concerns?',
  coping_techniques: 'What are your current coping & mindfulness techniques?',
  stopping_growth: 'What is stopping you from your growth?',
  desired_changes: 'What would you like to change or improve in your life right now?',
  physical_symptoms: 'Physical health symptoms you might be feeling',
  open_to_healing: 'How open are you towards healing?',
}

function formatClientObservations(obs: Record<string, unknown>): string {
  const knownOrder = Object.keys(CLIENT_OBSERVATION_QUESTION_LABELS)
  const keys = [
    ...knownOrder.filter(k => Object.prototype.hasOwnProperty.call(obs, k)),
    ...Object.keys(obs).filter(k => !knownOrder.includes(k)),
  ]
  const lines: string[] = []
  for (const key of keys) {
    const value = obs[key]
    if (!value || typeof value !== 'object') continue
    const entry = value as { selected?: string[]; freeText?: string }
    const parts: string[] = []
    if (Array.isArray(entry.selected) && entry.selected.length > 0) {
      parts.push(entry.selected.join(', '))
    }
    if (typeof entry.freeText === 'string' && entry.freeText.trim()) {
      parts.push(entry.freeText.trim())
    }
    if (parts.length > 0) {
      const question =
        CLIENT_OBSERVATION_QUESTION_LABELS[key] ??
        key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      lines.push(`- Question: ${question} — Response: ${parts.join(' | ')}`)
    }
  }
  return lines.length > 0 ? lines.join('\n') : '(none provided)'
}

export function buildReportUserMessage(p: ReportDataParams): string {
  const overallStatus = overallStatusLabel(p.totalScore)
  const balanceStatus = zoneStatusLabel(p.balanceScore)
  const blossomStatus = zoneStatusLabel(p.blossomScore)
  const blissStatus = zoneStatusLabel(p.blissScore)

  const profileLines = [
    `Client Name: ${p.clientName}`,
    p.age ? `Age: ${p.age}` : null,
    p.gender ? `Gender: ${p.gender}` : null,
    p.occupation ? `Occupation: ${p.occupation}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const painPointsText =
    p.painPoints.length > 0
      ? p.painPoints.map(q => `- ${q}`).join('\n')
      : '(no high-agreement pain points identified)'

  const clientObsText = p.clientObservations
    ? formatClientObservations(p.clientObservations)
    : '(none provided)'

  let message = `Generate the Zen Plan Report for this client.

${profileLines}

SCORES:
- Total Score: ${p.totalScore}/126 — Overall Status: ${overallStatus}
- Balance (Nervous System): ${p.balanceScore}/42 — Status: ${balanceStatus}
- Blossom (Emotional Regulation): ${p.blossomScore}/42 — Status: ${blossomStatus}
- Bliss (Spiritual Alignment): ${p.blissScore}/42 — Status: ${blissStatus}

DETAILED PAIN POINTS (questions where client scored Mostly True or Completely True):
${painPointsText}

CLIENT OBSERVATIONS:
${clientObsText}`

  if (p.therapistObservations && Object.keys(p.therapistObservations).length > 0) {
    message += `

THERAPIST OBSERVATIONS:
${JSON.stringify(p.therapistObservations, null, 2)}`
  }

  message += `

ZEN GARDEN ACTIVITY DATASET (USE ONLY THESE ACTIVITIES FOR THE 18-DAY PLAN):
${formatActivitiesDataset()}`

  return message
}

// ---------------------------------------------------------------------------
// Format the activities dataset as structured text for the prompt
// ---------------------------------------------------------------------------

function formatActivitiesDataset(): string {
  const byZone: Record<string, string[]> = { BALANCE: [], BLOSSOM: [], BLISS: [] }

  for (const a of ZEN_GARDEN_ACTIVITIES) {
    byZone[a.zone]?.push(
      `  - Activity: ${a.activity}\n    Corner: ${a.corner}\n    Benefits: ${a.benefits}\n    Pain Points: ${a.painPoints}`
    )
  }

  return Object.entries(byZone)
    .map(([zone, items]) => `[${zone} ZONE]\n${items.join('\n')}`)
    .join('\n\n')
}

// ---------------------------------------------------------------------------
// Parse the delimited OpenAI response into sections
// ---------------------------------------------------------------------------

export interface ReportSections {
  reportSection: string
  ritualSection: string
  planSection: string
  finalNarrativeSection: string
  affirmations: string[]
}

const REPORT_DELIM = '---SECTION:REPORT---'
const RITUAL_DELIM = '---SECTION:RITUAL---'
const PLAN_DELIM = '---SECTION:PLAN---'
const FINAL_DELIM = '---SECTION:FINAL---'

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** When model omits FINAL delimiter, split legacy plan that bundled Final Narrative at the end. */
function splitLegacyFinalFromPlan(afterPlan: string): { plan: string; final: string } {
  const text = afterPlan.trim()
  if (!text) return { plan: '', final: '' }

  const mdMatch = text.match(/\n#{1,3}\s*FINAL\s+NARRATIVE[^\n]*\n/i)
  if (mdMatch && mdMatch.index !== undefined) {
    return {
      plan: text.slice(0, mdMatch.index).trim(),
      final: text.slice(mdMatch.index + mdMatch[0].length).trim(),
    }
  }
  const htmlMatch = text.match(/<h[12][^>]*>\s*FINAL\s+NARRATIVE\s*<\/h[12]>/i)
  if (htmlMatch && htmlMatch.index !== undefined) {
    return {
      plan: text.slice(0, htmlMatch.index).trim(),
      final: text.slice(htmlMatch.index + htmlMatch[0].length).trim(),
    }
  }
  return { plan: text, final: '' }
}

export function parseReportSections(content: string): ReportSections {
  const ri = content.indexOf(REPORT_DELIM)
  const ti = content.indexOf(RITUAL_DELIM)
  const pi = content.indexOf(PLAN_DELIM)
  const fi = content.indexOf(FINAL_DELIM)

  let reportSection = ''
  let ritualSection = ''
  let planSection = ''
  let finalNarrativeSection = ''

  if (ri !== -1 && ti !== -1 && pi !== -1) {
    reportSection = content.substring(ri + REPORT_DELIM.length, ti).trim()
    ritualSection = content.substring(ti + RITUAL_DELIM.length, pi).trim()
    if (fi !== -1 && fi > pi) {
      planSection = content.substring(pi + PLAN_DELIM.length, fi).trim()
      finalNarrativeSection = content.substring(fi + FINAL_DELIM.length).trim()
    } else {
      const afterPlan = content.substring(pi + PLAN_DELIM.length).trim()
      const split = splitLegacyFinalFromPlan(afterPlan)
      planSection = split.plan
      finalNarrativeSection = split.final
    }
  } else {
    reportSection = content
  }

  const affirmations = extractAffirmations(ritualSection)

  return {
    reportSection,
    ritualSection,
    planSection,
    finalNarrativeSection,
    affirmations,
  }
}

function extractAffirmations(ritual: string): string[] {
  if (!ritual) return []

  const affIdx = ritual.toLowerCase().indexOf('affirmation')
  if (affIdx === -1) return []

  const afterAff = ritual.substring(affIdx)

  // HTML ritual: prefer <li> items after "affirmation"
  if (afterAff.includes('<')) {
    const liMatches = [...afterAff.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    if (liMatches.length > 0) {
      const items = liMatches
        .map(m => stripHtmlTags(m[1] ?? ''))
        .filter(s => s.length > 5)
      if (items.length > 0) return items.slice(0, 15)
    }
    const plainLines = stripHtmlTags(afterAff)
      .split(/[\n.]+/)
      .map(s => s.trim())
      .filter(Boolean)
    return extractAffirmationsFromPlainLines(plainLines)
  }

  const lines = afterAff.split('\n')
  return extractAffirmationsFromMarkdownLines(lines)
}

function extractAffirmationsFromPlainLines(lines: string[]): string[] {
  const results: string[] = []
  for (const line of lines) {
    const cleaned = line
      .replace(/^[\d]+[.)]\s*/, '')
      .replace(/^[-*•🔹]\s*/, '')
      .replace(/^["'""]+/, '')
      .replace(/["'""]+$/, '')
      .trim()
    if (cleaned.length > 5) results.push(cleaned)
    if (results.length >= 15) break
  }
  return results
}

function extractAffirmationsFromMarkdownLines(lines: string[]): string[] {
  const results: string[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    if (/^#{1,3}\s/.test(line) || /^[🔹✨📅🧘🔗⚖🌸🌌]/.test(line)) {
      if (results.length > 0) break
      continue
    }
    const cleaned = line
      .replace(/^[\d]+[.)]\s*/, '')
      .replace(/^[-*•🔹]\s*/, '')
      .replace(/^[""""]/, '')
      .replace(/[""""]$/, '')
      .trim()
    if (cleaned.length > 5) {
      results.push(cleaned)
    }
    if (results.length >= 15) break
  }
  return results
}
