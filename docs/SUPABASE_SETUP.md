# Supabase setup (Zen Space)

Follow these steps on your Supabase project to match the app and [`supabase/migrations/20260330220000_zen_space_init.sql`](../supabase/migrations/20260330220000_zen_space_init.sql).

## 1. Optional: wipe old test data

If you have previous `public` tables from experiments, run [`supabase/manual_full_reset.sql`](../supabase/manual_full_reset.sql) in **SQL Editor** first.  
This drops app tables and the `profiles` trigger function; it does **not** delete `auth.users`.

## 2. Apply the schema

1. Open **SQL Editor** → New query.  
2. Paste the **entire** contents of `supabase/migrations/20260330220000_zen_space_init.sql`.  
3. Run it once.

If the project already had an older init without Benchmark columns, also run **`supabase/migrations/20260330230500_assessment_benchmark_schema.sql`** (adds `assessment_kind` and unique answer rows).

For **AI reports**, run **`supabase/migrations/20260330230600_reports_therapist_observations.sql`**, then deploy the Edge Function and set `OPENAI_API_KEY` — see **[OPENAI_EDGE_FUNCTION.md](OPENAI_EDGE_FUNCTION.md)**.

You should get no errors. If Realtime publication fails with a notice, enable **`public.therapist_clients`** and **`public.therapist_otp_sessions`** under **Database → Publications** for live dashboard updates. The app also **polls every 5s** on therapist screens so counts refresh even without Realtime.

## 3. Auth settings

- **Authentication → URL configuration**: add your site URL and `http://localhost:5173` (or your dev port) to **Redirect URLs** so magic links and email confirmations work.
- **Email templates**: ensure sign-up confirmation is enabled if you require verified emails.

## 4. Create staff users (therapist / admin)

Clients can sign up in the app (`/signup`). Therapists and admins are usually created manually:

1. **Authentication → Users** → Add user (email + password).  
2. In **Table Editor → `profiles`**, set `role` to `therapist` or `admin` for that user’s row.  
   - If no `profiles` row exists, insert one with `id` = the user’s UUID from Auth.  
   - Or run:

```sql
INSERT INTO public.profiles (id, email, role)
VALUES ('<auth-user-uuid>', 'therapist@example.com', 'therapist')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, email = EXCLUDED.email;
```

## 5. Admin: manual therapist–client links

Users with `profiles.role = 'admin'` can insert, update, or delete rows in **`therapist_clients`** (e.g. Table Editor or the Admin app) for assignments that are not created by the OTP join RPC.

## 6. App environment

In `.env` (or Vercel):

- `VITE_SUPABASE_URL` = Project URL  
- `VITE_SUPABASE_ANON_KEY` = anon public key  

## 7. RPCs the app calls

| RPC | Who | Purpose |
|-----|-----|---------|
| `ensure_user_profile()` | Any signed-in user | Creates `profiles` row if missing |
| `create_therapist_otp_session(therapist_id, max_clients, session_name)` | Therapist | “Generate OTP for assessment” (default cap 200, name `Assessment`) |
| `join_therapist_session(otp_code_param)` | Client | Links client to therapist; same code can be used by many clients until `max_clients` or expiry |

## 8. Smoke test

1. Log in as therapist → **Generate OTP for assessment** → copy code.  
2. Log in as client → **Link code** → enter 6 digits → should land on **Assessment**.  
3. Therapist **Clients** list should show the linked client.

If you see **“Signed in, but no profile”** or **`42501` / permission denied for table `profiles`**, run this in **SQL Editor** (or apply migration `20260330230200_grant_profiles_authenticated.sql`):

```sql
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
```

The init script now includes that grant; older pastes of the init file omitted it.

If profile load still fails, check the browser console for `ensure_user_profile` or `Profile fetch` errors and confirm step 2 completed successfully.

If Postgres returns **`42P17` infinite recursion on `profiles`**, your database still has the old admin policies. Run migration **`20260330230300_fix_profiles_rls_recursion.sql`** in SQL Editor (or re-run the full init script from a clean reset).
