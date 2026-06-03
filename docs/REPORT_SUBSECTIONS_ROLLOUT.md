# Report & ritual subsection rollout

Production-safe deploy order:

1. **Database** — apply `supabase/migrations/20260604120000_report_ritual_subsections.sql` (additive nullable columns only).
2. **Edge functions** — deploy `generate-zen-report`, `generate-zen-report-self`, `generate-zen-plan` (dual-write new columns + legacy `report_section`, `ritual_section`, `content`).
3. **Frontend** — deploy app with `resolveReportSections` and section views (reads new columns; falls back to HTML split for old reports).

Until step 3 ships, the live app continues using legacy columns. Until step 2 ships, new columns stay null. No backfill required.
