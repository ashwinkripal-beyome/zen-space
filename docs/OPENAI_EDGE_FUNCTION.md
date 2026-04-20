# OpenAI + Zen Plan report (Edge Function)

The app **never** sends your OpenAI API key to the browser. Report generation runs in **Supabase Edge Function** `generate-zen-report`, which uses the **service role** to write `reports` after validating the therapist’s JWT and assignment.

## 1. Apply database changes

Run the latest migrations (or full init), including:

- `supabase/migrations/20260330230600_reports_therapist_observations.sql`

This adds `assessments.therapist_observations`, `reports.content`, `UNIQUE(assessment_id)` on `reports`, and RPC `save_therapist_observations`.

## 2. Set secrets (OpenAI + optional model)

**Hosted Supabase**

1. Project → **Edge Functions** → **Secrets** (or **Project Settings → Edge Functions**).
2. Add:
   - `OPENAI_API_KEY` — your OpenAI key (rotate here when switching accounts).
   - Optional: `OPENAI_MODEL` — defaults to `gpt-4o-mini` if unset.

**CLI**

```bash
supabase secrets set OPENAI_API_KEY=sk-...
# optional:
supabase secrets set OPENAI_MODEL=gpt-4o-mini
```

Supabase injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` into the function environment automatically — do not paste the service role into the Vite app.

## 3. Deploy the function

From the repo root (with [Supabase CLI](https://supabase.com/docs/guides/cli) linked to your project):

```bash
supabase functions deploy generate-zen-report
```

Local testing:

```bash
supabase start
supabase secrets set OPENAI_API_KEY=sk-... --env-file ./supabase/.env.local
supabase functions serve generate-zen-report
```

## 4. Frontend environment (no OpenAI)

Keep only:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

in `.env` / Vercel. **Do not** add `VITE_OPENAI_API_KEY`.

The therapist UI calls:

```ts
supabase.functions.invoke('generate-zen-report', { body: { assessment_id } })
```

## 5. Switching OpenAI accounts later

Update the **`OPENAI_API_KEY`** secret in Supabase (same key name, new value). Redeploy the function only if you change code, not when rotating keys.

## 6. Troubleshooting

| Issue | Check |
|--------|--------|
| `OPENAI_API_KEY not configured` | Secret missing in project |
| `Not assigned to this client` | `therapist_clients` row for this therapist + client |
| `Assessment must be completed` | Client submitted Benchmark (`assessments.status = completed`) |
| CORS / 401 on invoke | User must be logged in; pass session JWT (Supabase client does this automatically) |
