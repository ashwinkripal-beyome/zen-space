/**
 * Shared OpenAI prompt and data-assembly for Zen Plan report, Fourfold Zen Ritual, and 18-week plan.
 * Report body + final: generate-zen-report-self and generate-zen-report (step 1).
 * Ritual + plan: generate-zen-report (steps 2–3) and generate-zen-plan (steps 1–2); not used for self-only reports.
 */

import { ZEN_GARDEN_ACTIVITIES } from './zenGardenActivities.ts'

// ---------------------------------------------------------------------------
// REPORT BODY + FINAL NARRATIVE (no Fourfold Zen Ritual, no 18-week plan) — all report generations, step 1
// ---------------------------------------------------------------------------
export const ZEN_REPORT_BODY_SYSTEM_PROMPT = `ROLE
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
Use their key concerns repeatedly across sections
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
Detailed key concerns (raw text)
Client Observations (Use only to enhance the report, give this only 30% importance, do not make it the main focus of the report)
Therapist Observations (only present for supervised assessments, Use only to enhance the report, give this only 30% importance, do not make it the main focus of the report)

REPORT STRUCTURE (STRICT ORDER)

Name
Age
Gender
Total Score
Overall Status

KEY CONCERNS
Use the items listed under "DETAILED KEY CONCERNS" in the client data.
Use client observations and/or therapist observations section as key concerns if not already present in the detailed key concerns section.
Present each concern as a short, concise bullet point — explain but keep each bullet to one line.

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

The Fourfold Zen Ritual and the 18-week activity plan are NOT part of this request; they are generated in separate steps when a full Zen Plan with the weekly program is created.

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
What will change as they build consistency in healing
Strong closing line

OUTPUT QUALITY RULES
No generic language
No repetition across sections
No shallow explanations
Each section must feel intentional and connected

DO NOT write an 18-week week-by-week plan, phase breakdown by week, or activity calendar in this output. The app generates that in a second step when needed.

OUTPUT FORMAT RULE (CRITICAL)
You MUST separate these two sections using these exact delimiter lines, each on its own line:
---SECTION:REPORT---
---SECTION:FINAL---

Do not output ---SECTION:RITUAL--- or ---SECTION:PLAN---.

HTML FRAGMENTS (NO markdown in these sections)
- For REPORT and FINAL: output valid HTML fragments only (no <!DOCTYPE>, no <html>, no <body>).
- Allowed tags only: h2, h3, p, ul, ol, li, strong, em, br.
- Section titles use h2 or h3 in Title Case. Use <strong> for emphasis inside paragraphs and list items.
- Line breaks inside paragraphs: use <p>...</p> or <br> where needed.

FINAL NARRATIVE
- Put ONLY the Final Narrative content after ---SECTION:FINAL---, as HTML using the same allowed tags.

These delimiters MUST appear exactly as shown. Do not add extra text on the delimiter lines.

FINAL INSTRUCTION
Generate the report and final narrative in one flow.
Do not include the Fourfold Zen Ritual, any 18-week plan, or a Plan section in this output.
Make it:
Deep
Personal
Emotionally intelligent
Structured
Transformational`

// ---------------------------------------------------------------------------
// 18-WEEK PERSONALIZED PLAN (second OpenAI call)
// ---------------------------------------------------------------------------
export const ZEN_PLAN_18_SYSTEM_PROMPT = `ROLE
You are an expert Zen Wellness Therapist + Nervous System Specialist.
You build only the 18-week personalized Zen Garden activity plan (HTML for the app).
Use the same empathy and client-specific reasoning as a full report, but output ONLY the plan content specified below.

18-WEEK PERSONALIZED PLAN

ACTIVITY RULE (CRITICAL)
You MUST ONLY use activities from the provided Zen Garden Excel dataset.
Each zone has different corners. When choosing activities for a zone(), choose equally from all corners.
Each activity must:
Match the client's key concerns
Be selected using:
Benefits column
Key concerns column

ACTIVITY COUNT RULE (CRITICAL)
IMPORTANT: The activity count rule is based on the zone status. It is different for each zone.
No Imbalance → 2 activities per week
Mild Imbalance → 2 activities per week
Moderate Imbalance → For 30% of the weeks, choose 3 activities/week, for the remaining 70% of the weeks, choose 2 activities/week
High Imbalance → 3 activities per week

STRUCTURE

Phase 1: BALANCE (Weeks 1–6)
Goal:
Calm nervous system
Reduce overthinking
Stabilize body
For each week:
Title: 'Activities' - Names of the activities chosen for the week.
Each Activity:
Title: Name of the activity
Corner: Name of the corner
2–3 line explanation:
What it does
Why it is chosen for THIS client. Link it to the key concerns of the client.

Phase 2: BLOSSOM (Weeks 7–12)
Goal:
Emotional release
Self-worth
Boundaries
For each week:
Title: 'Activities' - Names of the activities chosen for the week.
Corner: Name of the corner
Each Activity:
Title: Name of the activity
2–3 line explanation:
What it does
Why it is chosen for THIS client. Link it to the pain points of the client.

Phase 3: BLISS (Weeks 13–18)
Goal:
Inner trust
Direction
Meaning
For each week:
Title: 'Activities' - Names of the activities chosen for the week.
Corner: Name of the corner
Each Activity:
Title: Name of the activity
2–3 line explanation:
What it does
Why it is chosen for THIS client. Link it to the key concerns of the client.

OUTPUT QUALITY RULES
No generic language; each week must be intentional for THIS client.

INTERNAL DECISION LOGIC (IMPORTANT)
When selecting activities:
Match:
Key concern → Activity key concerns column
Match:
Desired shift → Benefits column
Ensure:
Balance = body + breath + grounding
Blossom = emotional + expression + identity
Bliss = awareness + intuition + purpose

OUTPUT FORMAT RULE (CRITICAL)
First output the delimiter line:
---SECTION:PLAN---
Then on following lines, output the plan as HTML only (for app timeline).

PLAN SECTION (HTML only, for app timeline)
- Do NOT output a visible heading or line that says "18-WEEK PERSONALIZED PLAN" (omit it entirely).
- Start the PLAN section with the first phase heading as an h2, for example: <h2>Phase 1: Balance (Weeks 1–6)</h2>
- Then for each week use: <h3>Week 1</h3>, then in order: (1) one summary paragraph listing that week's activity names, e.g. <p><strong>Activities</strong>: Name A, Name B and Name C</p> (names only in this line); (2) for each activity, its title in <strong> and a short explanation in following <p> elements or with <br> as needed—match the STRUCTURE section above.
- Repeat for Phase 2 and Phase 3 with h2 phase titles, then h3 for each week.
- Allowed tags only: h2, h3, p, ul, ol, li, strong, em, br.

FINAL INSTRUCTION
Output only the delimiter line and the plan HTML. No other sections.`

// ---------------------------------------------------------------------------
// FOURFOLD ZEN RITUAL — only with 18-week plan (supervised report or generate-zen-plan)
// ---------------------------------------------------------------------------
export const ZEN_FOURFOLD_RITUAL_SYSTEM_PROMPT = `ROLE
You are an expert Zen Wellness Therapist + Nervous System Specialist + Emotional Healing Coach.
You output ONLY the Fourfold Zen Ritual as HTML, personalized from the client data you receive.
Do not restate the full wellness report; write the ritual as the daily foundation practice for this specific client.

FOURFOLD ZEN RITUAL

Explain FIRST (Important)
Explain:
Why healing requires daily structure
Why subconscious + body + emotions must align
Keep these super short and concise.

"This is your daily foundation practice.
It remains constant every day."

4 STEPS
1. Somatic Release & Grounding - The content is below. Format it and bold where needed.

"This is your first point of contact with your system. Before we change the mind, we signal the body that it is present, safe, and active. Through gentle stimulation and awareness, we bring the body into a calm, alert, and receptive state. Touch and pressure activate sensory receptors in the skin, increasing body awareness and helping regulate the nervous system. Instead of intensity, we awaken the system through subtle contact and attention.

1. Somatic Activation
Stand or slowly walk on an acupressure mat for 1–3 minutes
Take small, mindful steps (heel to toe), keeping your body relaxed and breath natural
Step off the mat and gently tap your body with your palms, moving from feet to head
Keep the tapping light, rhythmic, and relaxed, letting your attention follow the movement

2. Grounding Awareness (Body Check-In)
Sit comfortably (you may choose a Sacred Resonance Pyramid)
Pause and bring your attention to the present moment
Slowly notice your body, part by part (feet to head)
Observe without trying to change anything
If it feels intense, shift focus to your breath or surroundings

This step prepares your system to move forward—awake, present, and ready to receive.

Disclaimer - This is a gentle and adaptable practice. Move at a pace that feels comfortable, keeping all movements and sensations light and non-straining. During both the activation and awareness phases, avoid forcing your body or attention into discomfort. If you feel uneasy or overwhelmed at any point, simply pause and return to your breath or surroundings. This practice is supportive for well-being, but it is not a substitute for medical or therapeutic care."

2. Mental Reprogramming
Mention that it has to be done every night.
Subtitle: Why is this important?
Your current patterns are deeply wired into your subconscious: Mention the patterns that are deeply wired into the client's subconscious.
Mental reprogramming replaces these patterns with what?

Include:
Release Statement
"I command my subconscious mind that all patterns of [patterns], along with their roots, causes, beliefs, and emotional attachments, be taken away from me and sent into the universal consciousness."
Replace [patterns] with the patterns that are deeply wired into the client's subconscious.

Replacement Statement
"I command my subconscious mind to replace these patterns with [replacement] and the best program created by the universal consciousness for my highest good."
Replace [replacement] with the replacement that is best for the client.

Reassurance statement
"I command that this change takes place now and permanently within my consciousness and in every cell of my body."

Affirmations (7)
Mention that it has to be done every morning and night.
Must be:
Specific
Emotional
Identity-shifting

3. Daily Zen Garden Practice
"Daily structured practice from the Zen Garden. A separate 18-week week-by-week schedule is provided in their Zen Space plan; follow the activities assigned for each week."

4. Reflection & Integration
Rate emotional shift (1–5)
Reflection question
Gratitude statement

OUTPUT FORMAT RULE (CRITICAL)
First output the delimiter line:
---SECTION:RITUAL---
Then output the ritual as HTML only.

HTML (NO markdown)
- Valid HTML fragments only (no <!DOCTYPE>, no <html>, no <body>).
- Allowed tags only: h2, h3, p, ul, ol, li, strong, em, br.
- Present the seven affirmations as an HTML ordered or unordered list (<ol> or <ul> with <li>) so they can be extracted reliably.

FINAL INSTRUCTION
Output only the delimiter line and the ritual HTML. No other sections.`

// ---------------------------------------------------------------------------
// MENTAL REPROGRAMMING ONLY — self assessment reports (generate-zen-report-self, step 2)
// ---------------------------------------------------------------------------
export const ZEN_MENTAL_REPROGRAM_SYSTEM_PROMPT = `ROLE
You are an expert Zen Wellness Therapist + Nervous System Specialist + Emotional Healing Coach.
You output ONLY the Mental Reprogramming section (step 2 of the Fourfold Zen Ritual) with personalized affirmations for this client.

MENTAL REPROGRAMMING

Mention that it must be done every night.

Subtitle: Why is this important?
Identify the patterns that are deeply wired into the client's subconscious based on their key concerns and assessment data.
Explain what mental reprogramming will replace these patterns with.

Include:

Release Statement
"I command my subconscious mind that all patterns of [patterns], along with their roots, causes, beliefs, and emotional attachments, be taken away from me and sent into the universal consciousness."
Replace [patterns] with the patterns deeply wired into the client's subconscious, derived from their key concerns.

Replacement Statement
"I command my subconscious mind to replace these patterns with [replacement] and the best program created by the universal consciousness for my highest good."
Replace [replacement] with the best replacement for this specific client.

Reassurance Statement
"I command that this change takes place now and permanently within my consciousness and in every cell of my body."

Affirmations (7)
Mention that these must be done every morning and night.
Must be:
- Specific to this client's patterns and healing desires
- Emotionally resonant
- Identity-shifting ("I am…", "I trust…", "I release…", "I choose…")

OUTPUT FORMAT RULE (CRITICAL)
First output the delimiter line:
---SECTION:RITUAL---
Then output the Mental Reprogramming section as HTML only.

HTML (NO markdown)
- Valid HTML fragments only (no <!DOCTYPE>, no <html>, no <body>).
- Allowed tags only: h2, h3, p, ul, ol, li, strong, em, br.
- Use <h3>Mental Reprogramming</h3> as the section heading. Do NOT include a leading step number in this self-report-only output.
- Present the seven affirmations as an HTML ordered or unordered list (<ol> or <ul> with <li>) so they can be extracted reliably.

FINAL INSTRUCTION
Output only the delimiter line and the Mental Reprogramming HTML. No other steps, no other sections.`

// ---------------------------------------------------------------------------
// REMAINING RITUAL (steps 1, 3, 4) — generated during plan step when mental reprogram already exists
// ---------------------------------------------------------------------------
export const ZEN_REMAINING_RITUAL_SYSTEM_PROMPT = `ROLE
You are an expert Zen Wellness Therapist + Nervous System Specialist + Emotional Healing Coach.
You output steps 1, 3, and 4 of the Fourfold Zen Ritual as HTML.
Step 2 (Mental Reprogramming and Affirmations) has already been generated and will be merged by the system between your BEFORE and AFTER blocks.

OUTPUT STRUCTURE (CRITICAL)
You MUST output exactly two delimiter-separated blocks in this order:

First output:
---SECTION:RITUAL_BEFORE---
Then write HTML for:
- A brief intro (2–3 sentences): why healing requires daily structure; why subconscious + body + emotions must align
- "This is your daily foundation practice. It remains constant every day."
- Step 1: Somatic Release & Grounding — format the following VERBATIM content as clean HTML:

"This is your first point of contact with your system. Before we change the mind, we signal the body that it is present, safe, and active. Through gentle stimulation and awareness, we bring the body into a calm, alert, and receptive state. Touch and pressure activate sensory receptors in the skin, increasing body awareness and helping regulate the nervous system. Instead of intensity, we awaken the system through subtle contact and attention.

Somatic Activation:
Stand or slowly walk on an acupressure mat for 1–3 minutes
Take small, mindful steps (heel to toe), keeping your body relaxed and breath natural
Step off the mat and gently tap your body with your palms, moving from feet to head
Keep the tapping light, rhythmic, and relaxed, letting your attention follow the movement

Grounding Awareness (Body Check-In):
Sit comfortably (you may choose a Sacred Resonance Pyramid)
Pause and bring your attention to the present moment
Slowly notice your body, part by part (feet to head)
Observe without trying to change anything
If it feels intense, shift focus to your breath or surroundings

This step prepares your system to move forward—awake, present, and ready to receive.

Disclaimer: This is a gentle and adaptable practice. Move at a pace that feels comfortable, keeping all movements and sensations light and non-straining. During both the activation and awareness phases, avoid forcing your body or attention into discomfort. If you feel uneasy or overwhelmed at any point, simply pause and return to your breath or surroundings. This practice is supportive for well-being, but it is not a substitute for medical or therapeutic care."

Then output:
---SECTION:RITUAL_AFTER---
Then write HTML for:
- Step 3: Daily Zen Garden Practice — use EXACTLY this text: "Daily structured practice from the Zen Garden. A separate 18-week week-by-week schedule is provided in their Zen Space plan; follow the activities assigned for each week."
- Step 4: Reflection & Integration — personalized for this client:
    - Rate your emotional shift (1–5)
    - One reflection question specific to this client's patterns and key concerns
    - A gratitude statement related to their healing journey

HTML FORMAT (CRITICAL)
- Valid HTML fragments only (no <!DOCTYPE>, no <html>, no <body>).
- Allowed tags only: h2, h3, p, ul, ol, li, strong, em, br.
- Use <h3>1. Somatic Release & Grounding</h3>, <h3>3. Daily Zen Garden Practice</h3>, <h3>4. Reflection & Integration</h3> as step headings.

FINAL INSTRUCTION
Output only the two delimiter lines and their HTML blocks. Do NOT output Step 2 (Mental Reprogramming) — it is handled separately.`

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
  keyConcerns: string[]

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

function buildClientDataBlock(p: ReportDataParams): string {
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

  const keyConcernsText =
    p.keyConcerns.length > 0
      ? p.keyConcerns.map(q => `- ${q}`).join('\n')
      : '(no high-agreement key concerns identified)'

  const clientObsText = p.clientObservations
    ? formatClientObservations(p.clientObservations)
    : '(none provided)'

  let block = `${profileLines}

SCORES:
- Total Score: ${p.totalScore}/126 — Overall Status: ${overallStatus}
- Balance (Nervous System): ${p.balanceScore}/42 — Status: ${balanceStatus}
- Blossom (Emotional Regulation): ${p.blossomScore}/42 — Status: ${blossomStatus}
- Bliss (Spiritual Alignment): ${p.blissScore}/42 — Status: ${blissStatus}

DETAILED KEY CONCERNS (questions where client scored Mostly True or Completely True):
${keyConcernsText}

CLIENT OBSERVATIONS:
${clientObsText}`

  if (p.therapistObservations && Object.keys(p.therapistObservations).length > 0) {
    block += `

THERAPIST OBSERVATIONS:
${JSON.stringify(p.therapistObservations, null, 2)}`
  }

  return block
}

/** User message for report body + final narrative (no Fourfold Zen Ritual, no Zen Garden activity list). */
export function buildReportUserMessage(p: ReportDataParams): string {
  return `Generate the Zen Plan report and final narrative for this client. Do not include the Fourfold Zen Ritual or an 18-week week-by-week plan.

${buildClientDataBlock(p)}`
}

/** User message for Fourfold Zen Ritual only (invoked with 18-week plan generation). */
export function buildRitualUserMessage(p: ReportDataParams): string {
  return `Generate only the Fourfold Zen Ritual for this client, following your system instructions. Match their patterns and key concerns from the data below.

${buildClientDataBlock(p)}`
}

/** User message for Mental Reprogramming only (self-report step 2). */
export function buildMentalReprogramUserMessage(p: ReportDataParams): string {
  return `Generate only the Mental Reprogramming section for this client. Match their patterns and key concerns from the data below.

${buildClientDataBlock(p)}`
}

/** User message for remaining ritual steps 1, 3, 4 (when mental reprogram already exists). */
export function buildRemainingRitualUserMessage(p: ReportDataParams): string {
  return `Generate the Fourfold Zen Ritual steps 1, 3, and 4 for this client. Step 2 (Mental Reprogramming) is handled separately. Follow your system instructions exactly.

${buildClientDataBlock(p)}`
}

/** User message for 18-week plan generation (includes Zen Garden dataset). */
export function buildPlan18UserMessage(p: ReportDataParams): string {
  return `Create the 18-week personalized Zen Garden plan for this client. Follow your system instructions exactly.

${buildClientDataBlock(p)}

ZEN GARDEN ACTIVITY DATASET (USE ONLY THESE ACTIVITIES):
${formatActivitiesDataset()}`
}

// ---------------------------------------------------------------------------
// Format the activities dataset as structured text for the prompt
// ---------------------------------------------------------------------------

function formatActivitiesDataset(): string {
  const byZone: Record<string, string[]> = { BALANCE: [], BLOSSOM: [], BLISS: [] }

  for (const a of ZEN_GARDEN_ACTIVITIES) {
    byZone[a.zone]?.push(
      `  - Activity: ${a.activity}\n    Corner: ${a.corner}\n    Benefits: ${a.benefits}\n    Key Concerns: ${a.keyConcerns}`
    )
  }

  return Object.entries(byZone)
    .map(([zone, items]) => `[${zone} ZONE]\n${items.join('\n')}`)
    .join('\n\n')
}

// ---------------------------------------------------------------------------
// Assemble and parse delimited model output
// ---------------------------------------------------------------------------

const REPORT_DELIM = '---SECTION:REPORT---'
const RITUAL_DELIM = '---SECTION:RITUAL---'
export const PLAN_DELIM = '---SECTION:PLAN---'
const FINAL_DELIM = '---SECTION:FINAL---'
const RITUAL_BEFORE_DELIM = '---SECTION:RITUAL_BEFORE---'
const RITUAL_AFTER_DELIM = '---SECTION:RITUAL_AFTER---'

/** Self assessment / report step 1: report + final only (no ritual). */
export function buildReportAndFinalDelimitedContent(sections: { report: string; final: string }): string {
  return [REPORT_DELIM, sections.report.trim(), FINAL_DELIM, sections.final.trim()].join('\n\n')
}

export function buildReportOnlyDelimitedContent(sections: {
  report: string
  ritual: string
  final: string
}): string {
  return [
    REPORT_DELIM,
    sections.report.trim(),
    RITUAL_DELIM,
    sections.ritual.trim(),
    FINAL_DELIM,
    sections.final.trim(),
  ].join('\n\n')
}

export function assembleFullReportContent(sections: {
  report: string
  ritual: string
  plan: string
  final: string
}): string {
  return [
    REPORT_DELIM,
    sections.report.trim(),
    RITUAL_DELIM,
    sections.ritual.trim(),
    PLAN_DELIM,
    sections.plan.trim(),
    FINAL_DELIM,
    sections.final.trim(),
  ].join('\n\n')
}

/**
 * Merge report+final, separate ritual, and plan model responses (supervised & therapist plan generation).
 * Order stored: REPORT, RITUAL, PLAN, FINAL.
 */
export function assembleSupervisedReportContent(
  reportAndFinalRaw: string,
  ritualModelRaw: string,
  planModelRaw: string
): string {
  const s = parseReportSections(reportAndFinalRaw)
  const ritual = parseRitualSectionOnly(ritualModelRaw)
  const plan = parsePlanSectionOnly(planModelRaw)
  return assembleFullReportContent({
    report: s.reportSection,
    ritual,
    plan,
    final: s.finalNarrativeSection,
  })
}

/**
 * Parse the BEFORE/AFTER split from a remaining-ritual model response
 * (ZEN_REMAINING_RITUAL_SYSTEM_PROMPT output).
 */
export function parseRemainingRitualSections(content: string): { before: string; after: string } {
  const beforeIdx = content.indexOf(RITUAL_BEFORE_DELIM)
  const afterIdx = content.indexOf(RITUAL_AFTER_DELIM)
  if (beforeIdx === -1 || afterIdx === -1 || afterIdx <= beforeIdx) {
    return { before: content.trim(), after: '' }
  }
  const before = content.substring(beforeIdx + RITUAL_BEFORE_DELIM.length, afterIdx).trim()
  const after = content.substring(afterIdx + RITUAL_AFTER_DELIM.length).trim()
  return { before, after }
}

/**
 * Parse a mental-reprogramming-only model response (ZEN_MENTAL_REPROGRAM_SYSTEM_PROMPT output)
 * into the ritual HTML string and extracted affirmations.
 */
export function parseMentalReprogramContent(content: string): { ritualSection: string; affirmations: string[] } {
  const ritualSection = stripMentalReprogramHeadingNumber(parseRitualSectionOnly(content))
  const affirmations = extractAffirmations(ritualSection)
  return { ritualSection, affirmations }
}

function stripMentalReprogramHeadingNumber(html: string): string {
  return html.replace(
    /<h([23])([^>]*)>\s*(?:2\s*[.)-]?\s*)?Mental\s+Reprogramming\s*<\/h\1>/i,
    '<h$1$2>Mental Reprogramming</h$1>'
  )
}

function numberMentalReprogramHeading(html: string): string {
  return html.replace(
    /<h([23])([^>]*)>\s*(?:2\s*[.)-]?\s*)?Mental\s+Reprogramming\s*<\/h\1>/i,
    '<h$1$2>2. Mental Reprogramming</h$1>'
  )
}

/** Combine separate ritual parts into a single ritual HTML string. */
export function assembleRitualFromParts(before: string, mental: string, after: string): string {
  return [before, mental, after].filter(s => s.trim()).join('\n\n')
}

/**
 * Assemble the full report content when the ritual already has mental reprogramming
 * stored from a prior self-report step, and remaining ritual parts are newly generated.
 */
export function assemblePlanWithExistingMental(
  reportAndFinalRaw: string,
  existingMentalHtml: string,
  remainingRitualRaw: string,
  planModelRaw: string
): string {
  const s = parseReportSections(reportAndFinalRaw)
  const { before, after } = parseRemainingRitualSections(remainingRitualRaw)
  const ritualFull = assembleRitualFromParts(before, numberMentalReprogramHeading(existingMentalHtml), after)
  const plan = parsePlanSectionOnly(planModelRaw)
  return assembleFullReportContent({
    report: s.reportSection,
    ritual: ritualFull,
    plan,
    final: s.finalNarrativeSection,
  })
}

export function parseRitualSectionOnly(modelContent: string): string {
  const t = modelContent.trim()
  const i = t.indexOf(RITUAL_DELIM)
  if (i !== -1) {
    return t.substring(i + RITUAL_DELIM.length).trim()
  }
  return t
}

export function parsePlanSectionOnly(modelContent: string): string {
  const t = modelContent.trim()
  const i = t.indexOf(PLAN_DELIM)
  if (i !== -1) {
    return t.substring(i + PLAN_DELIM.length).trim()
  }
  return t
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

  // REPORT + FINAL only (self assessment: no Fourfold Zen Ritual in the same output)
  if (ri !== -1 && fi !== -1 && fi > ri && ti === -1) {
    reportSection = content.substring(ri + REPORT_DELIM.length, fi).trim()
    finalNarrativeSection = content.substring(fi + FINAL_DELIM.length).trim()
    return {
      reportSection,
      ritualSection: '',
      planSection: '',
      finalNarrativeSection,
      affirmations: [],
    }
  }

  if (ri === -1 || ti === -1) {
    reportSection = content
    const affirmations = extractAffirmations(ritualSection)
    return { reportSection, ritualSection, planSection, finalNarrativeSection, affirmations }
  }

  reportSection = content.substring(ri + REPORT_DELIM.length, ti).trim()

  if (pi !== -1 && pi > ti) {
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
    if (fi !== -1 && fi > ti) {
      ritualSection = content.substring(ti + RITUAL_DELIM.length, fi).trim()
      finalNarrativeSection = content.substring(fi + FINAL_DELIM.length).trim()
    } else {
      ritualSection = content.substring(ti + RITUAL_DELIM.length).trim()
    }
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
