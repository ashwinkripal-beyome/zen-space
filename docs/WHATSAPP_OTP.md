# WhatsApp OTP phone verification

Login stays **email + password**. On top of that, every **client** must prove
ownership of their WhatsApp number **once**. We do this through Supabase Auth's
phone-change OTP flow, but the code is delivered over **WhatsApp Cloud API**
instead of SMS via a *Send SMS Auth Hook*.

## Flow

1. Client signs up / logs in with email + password (unchanged).
2. Inside the client app, `ClientPhoneVerificationGate` blocks until the phone
   is verified. It calls `supabase.auth.updateUser({ phone })`, which makes
   GoTrue generate a phone-change OTP.
3. GoTrue invokes the **Send SMS hook** → the `whatsapp-send-otp` edge function,
   which sends the OTP via an approved WhatsApp AUTHENTICATION template.
4. Client enters the code → `supabase.auth.verifyOtp({ type: 'phone_change' })`.
   GoTrue stamps `auth.users.phone_confirmed_at`.
5. The `on_auth_user_phone_confirmed` trigger mirrors the confirmed phone onto
   `profiles.phone_number` + `profiles.phone_verified_at`, and the gate clears.

## One-time setup

### 1. Edge function secrets

```bash
supabase secrets set \
  WHATSAPP_ACCESS_TOKEN="<your access token>" \
  WHATSAPP_PHONE_NUMBER_ID="<your phone number id>" \
  WHATSAPP_APP_SECRET="<your meta app secret>" \
  WHATSAPP_OTP_TEMPLATE_NAME="otp_login" \
  WHATSAPP_OTP_TEMPLATE_LANG="en_US"
```

(`WHATSAPP_OTP_TEMPLATE_HAS_BUTTON=false` if your template has no copy-code
button; `WHATSAPP_GRAPH_VERSION` overrides the default `v21.0`.)

Maps to the credentials you were given:
`WHATSAPP_ACCESS_TOKEN` = WhatsAppAccesstoken,
`WHATSAPP_PHONE_NUMBER_ID` = WhatsAppPhonenumberid,
`WHATSAPP_APP_SECRET` = WhatsAppAppsecret.
`WhatsAppSecretKeyForValidation` is the Meta **webhook** verify token — it is
only needed if you also wire up inbound/delivery webhooks, which this OTP flow
does not require. `SEND_SMS_HOOK_SECRET` (below) is a *separate* value that
Supabase generates.

### 2. Deploy the function

```bash
supabase functions deploy whatsapp-send-otp
```

### 3. Enable phone auth + register the hook (Supabase dashboard)

- **Authentication → Providers → Phone**: enable it. You do **not** need a real
  SMS provider — the hook overrides delivery. (If a provider field is required,
  any placeholder works since the hook intercepts sending.)
- **Authentication → Hooks → Send SMS hook**: enable, point it at the
  `whatsapp-send-otp` function (HTTPS endpoint), and copy the generated secret
  (`v1,whsec_…`) into the function's secrets:

```bash
supabase secrets set SEND_SMS_HOOK_SECRET="v1,whsec_xxxxxxxx"
```

### 4. WhatsApp AUTHENTICATION template

In Meta Business Manager create/approve an **AUTHENTICATION**-category template
whose name + language match `WHATSAPP_OTP_TEMPLATE_NAME` / `_LANG`. The function
passes the OTP as the body parameter and (by default) as the copy-code button
parameter. Sending will fail until the template is approved.

### 5. Run the migration

`supabase/migrations/20260611140000_client_phone_verified.sql` adds
`profiles.phone_verified_at` and the sync trigger. Apply with `supabase db push`
(or run it in the SQL editor).

## Notes

- The hook request is authenticated by its **Standard-Webhooks signature**
  (`SEND_SMS_HOOK_SECRET`), not a user JWT — hence `verify_jwt = false` in
  `config.toml`. If the secret is unset the function logs a warning and skips
  verification (dev only — always set it in production).
- The OTP itself is never logged.
