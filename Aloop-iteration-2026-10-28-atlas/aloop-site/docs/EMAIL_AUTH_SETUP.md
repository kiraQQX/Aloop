# Email sign-up and verification (Supabase Auth + Resend)

Accounts are email + password. Supabase Auth stores the users and sends the verification email;
Resend is the SMTP provider that delivers it from `noreply@aloop.space`. There is no backend in this
repo: the browser talks to Supabase directly with the **public** project key and Supabase talks to Resend.

Two clients are supported and only one is active per document:

- **Shell mode** — `src/lib/auth.js` (inside the Vue shell) uses `@supabase/supabase-js` with
  build-time `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`.
- **Standalone mode** — `assets/js/core/auth.js` (classic runtime) calls GoTrue REST with the public
  values in `assets/js/core/config.js`.

```
Browser (shell SDK or standalone REST) ──► Supabase Auth ──SMTP──► Resend ──► user's mailbox
                                                 ▲                                │
                                                 └──── user clicks the link ◄─────┘
                   aloop.space/#access_token=…&type=signup|recovery  → shell restores the session
```

## One-time setup (about 10 minutes)

### 1. Resend (already done)
- Domain `aloop.space` shows **Verified** under Resend → Domains (SPF/DKIM records in place).
- Create an API key: Resend → API Keys → *Sending access*, restricted to `aloop.space`.
  This key is a **secret**. It goes into Supabase (step 3) and nowhere else. Never commit it.

### 2. Supabase: enable email sign-up
- Authentication → Sign In / Providers → **Email**: enabled, **Confirm email: ON**.
- Minimum password length: **8** (the form also enforces 8).

### 3. Supabase: send mail through Resend
Authentication → Emails → **SMTP Settings** → Enable custom SMTP:

| Field | Value |
| --- | --- |
| Sender email | `noreply@aloop.space` |
| Sender name | `Aloop` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | the Resend API key from step 1 |

Authentication → Rate Limits: raise the email limit if you expect bursts (custom SMTP starts low).

### 4. Supabase: where the verification link may return
Authentication → URL Configuration:
- **Site URL**: `https://aloop.space`
- **Redirect URLs**: `https://aloop.space/**` and, for local work, `http://localhost:5173/**`

### 5. Put the public values in the site

**Shell mode (production):** set build-time variables in the Cloudflare build environment or in a local
`.env.local` (already git-ignored):

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<Publishable (anon) key>   # Project Settings → API Keys
```

**Standalone mode (no shell / no env):** edit `assets/js/core/config.js`:

```js
supabaseUrl: "https://<project-ref>.supabase.co",
supabaseAnonKey: "<Publishable (anon) key>",
siteUrl: "https://aloop.space",
```

These values are public by design. **Never** put the Resend API key or a `service_role` key in either
place. Commit `config.js` if you use standalone mode; deploy, done.

### 6. Optional: CAPTCHA (human check)
1. Create a Cloudflare Turnstile widget for `aloop.space`.
2. Supabase → Authentication → Attack Protection → enable CAPTCHA, provider *Turnstile*, paste the **secret** key.
3. Put the **site** key into `turnstileSiteKey` in `config.js`. The dialog then shows the widget and sends
   the token with sign-up, login and resend. Empty = CAPTCHA off.

### 7. Optional: bilingual verification email
Authentication → Emails → Templates → *Confirm signup*. Subject: `验证你的 Aloop 邮箱 / Verify your Aloop email`. Body:

```html
<h2>欢迎加入 Aloop / Welcome to Aloop</h2>
<p>请点击下面的链接验证邮箱，然后回到网站登录。</p>
<p>Click the link below to verify your email, then return to the site and log in.</p>
<p><a href="{{ .ConfirmationURL }}">验证邮箱 / Verify email</a></p>
<p>如果这不是你本人的操作，请忽略此邮件。 If this wasn't you, ignore this email.</p>
```

## Behaviour
- **Sign up** → verification email sent → dialog switches to *Log in* with the address filled in and a
  "resend" link. The user is **not** logged in until the address is verified.
- **Verification link** → opens `https://aloop.space/`. In shell mode the Supabase SDK consumes the
  tokens and restores the session; in standalone mode the user simply logs in after verifying.
- **Login** before verifying → "email not verified" + resend button.
- **Forgot password** → "Forgot password?" sends a recovery email. The link opens the dialog in
  *Set a new password* mode; saving updates the password and asks for a normal login.
- Already-registered addresses get a neutral message (Supabase hides whether an address exists).
- Shell sessions live in `aloop_supabase_auth`; standalone sessions live in `aloop_session_v2` and are
  refreshed automatically.
- Without any configuration the dialog states that the account service is not configured. There is no
  debug account in either mode.

## Testing
1. `npm run dev`, open the site, *Sign up* with a mailbox you control.
2. Resend → Logs shows the message; the mail arrives from `noreply@aloop.space`.
3. Click the link, log in, open beLieve.
4. Use *Forgot password?* on the login tab and complete the recovery flow.

Troubleshooting: no mail → check Resend Logs, the SMTP password, and that the sender domain is
verified. Link opens a wrong page → the URL is missing from *Redirect URLs*. "Too many attempts" →
Supabase rate limits.

## Not built yet
Profile form (gender / age / grade / handedness), per-user random code, and data-file naming. The
`profiles` and `experiment_sessions` tables plus row-level security now ship in
`supabase/migrations/`, but applying the migration and building the profile UI remain separate,
reviewed steps.
