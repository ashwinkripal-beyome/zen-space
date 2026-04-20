# PDF print template — pagination + content-only styling

## Product direction (user feedback)

- **Remove** the cover **mandala** SVG (feels cheap).
- **Remove** the **“What’s inside”** outline / TOC block entirely (and the `extractH2Titles` / `buildTocHtml` pipeline if nothing else uses it).
- **Do not add** editorial or decorative HTML that is not part of the stored report: remove **infographic blocks** injected into sections (zones strip, fourfold flow, 18-day timeline + day dots). Those are not in the source HTML.
- **Keep** the real report fragments as-is; only improve **typography, spacing, phase/day wrappers, pagination**, and **color accents** derived from existing structure.
- **Zone colors** for Balance / Blossom / Bliss in the PDF should match the **assessment swipe card** gradients (same palette as the app), not ad-hoc sage/tan/lavender.

### Canonical swipe gradients (source of truth)

From [`src/styles/zen-tokens.css`](e:\zariyaa\App\zen-space\src\styles\zen-tokens.css) — classes used on [`ClientAssessmentSessionPage`](e:\zariyaa\App\zen-space\src\pages\client\ClientAssessmentSessionPage.tsx):

| Zone    | Class               | Gradient stops |
|---------|---------------------|----------------|
| Balance | `assessment-cardbg1` | `linear-gradient(to bottom right, #1f3168, #374f97, #283f84)` |
| Blossom | `assessment-cardbg2` | `linear-gradient(to bottom right, #5e2244, #8b3a6a, #6b2e52)` |
| Bliss   | `assessment-cardbg3` | `linear-gradient(to bottom right, #1a4a3a, #2d6b52, #1f5742)` |

Use these for **print-safe** treatments: soft tinted backgrounds, left borders, or pill accents on phase cards / day labels (not full-bleed dark cards behind body copy, unless tested readable).

---

## Implementation target

Single file: [`src/lib/zenPrintDocument.ts`](e:\zariyaa\App\zen-space\src\lib\zenPrintDocument.ts).

### A. Strip non-source UI

- Delete **`svgCoverMandala`** usage from the cover header; keep a **minimal** cover (document title + optional short tagline + confidentiality line) — **no** decorative SVG.
- Remove **`buildTocHtml`**, **`extractH2Titles`**, and **`${tocHtml}`** from the document body.
- Remove **`infographic` / `infographicZonesStrip` / `infographicFourfoldFlow` / `infographicTimeline18`** from `SectionMeta` and **`sectionBlock`** entirely.

### A1. One report, not “numbered parts” (user preference)

- **Remove section numbers** (no `01`, `02`, …).
- **Remove per-section icons** in the header row so the PDF reads as **one continuous report**, not a slide deck of parts.
- **Section titles** (Report, Final narrative, Fourfold Zen Ritual, 18-Day Plan): use **bright, swipe-aligned colored bands or backgrounds** as the only strong visual demarcation — see **D** for palette. Body typography stays **minimal and clean** (neutral paper, restrained prose styles).

### B. Content-only display

- **`enhanceInnerHtml`** / **`enhancePlanHtmlForPrint`** remain for **classes** that improve layout (headings, phase cards, day pills) — no new textual content.
- Optional **day wrappers** (`zen-day-block`) for pagination only — no new copy.

### C. Pagination (from prior plan — still valid)

- **`@page`**: sensible margins in `mm`; optional `max-width` on `.zen-wrap` in `mm` for A4/Letter printable width.
- **`.zen-section-card`**: `overflow: visible` (remove hidden overflow).
- **`.zen-phase-card`**: remove **`break-inside: avoid`** on entire phase; allow split across pages.
- **`p` / `li`**: `orphans` / `widows` (2–3).
- **Headings** / **`.zen-section-head`**: `break-after: avoid` where supported.
- **Small fixed blocks** (if any remain): `break-inside: avoid` only where compact.

### D. Recolor Balance / Blossom / Bliss

- Replace current green/tan/purple print variables with **tints** derived from the three gradients above for:
  - `.zen-phase-balance` / `.zen-phase-blossom` / `.zen-phase-bliss`
  - `h3.zen-day-heading` (and phase-specific variants)
- Keep **WCAG-ish** contrast for body text on paper (dark text on very light tinted backgrounds).

---

## Verification

- PDF: no mandala, no TOC, no three-zone / fourfold / 18-dot infographics, **no part numbers/icons**.
- One-document feel: **colored section title bars** only; rest minimal.
- Long report: page breaks look natural; phases can span pages.
- Phase/day accents use swipe palette (**Balance** = cardbg1 blues, **Blossom** = cardbg2 rose, **Bliss** = cardbg3 greens).

---

## Execution status

Implemented in [`src/lib/zenPrintDocument.ts`](e:\zariyaa\App\zen-space\src\lib\zenPrintDocument.ts) (Agent mode). `npm run build` passes.

## Todos

- [ ] Remove mandala, TOC, infographics, section numbers, and section icons; simplify cover.
- [ ] Redesign `sectionBlock` header: single title row with **bright gradient strip** (swipe colors); map each major section to a consistent bar style where it makes sense (e.g. Report + Final may share a neutral or primary bar; Ritual/Plan or phase blocks use zone colors — **decide in implementation** so it stays one report, not rainbow noise).
- [ ] Apply pagination CSS (margins, overflow, widows/orphans, phase break rules).
- [ ] Map Balance/Blossom/Bliss phase/day UI to `assessment-cardbg1/2/3` stops (tints or bars; keep body text readable).
- [ ] Optional: `zen-day-block` wrappers for day-level `break-inside` if needed after testing.
