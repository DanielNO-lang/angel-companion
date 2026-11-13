# Angel Companion deployment and authentication

## Architecture

- The browser uses the Supabase publishable key only.
- Supabase Auth owns email/password, OAuth, email verification, session restoration and sign-out.
- The private Angel workspace is rendered only after the Supabase session is verified.
- Browser chat requests include the Supabase access token.
- Netlify Functions validate that token against Supabase before calling Gemini.
- `GEMINI_API_KEY` remains server-only. It must never use a `VITE_` prefix.
- Conversation threads are stored locally per signed-in user and synced to the existing owner-scoped Supabase Companion tables.
- GitHub Actions is the sole production deployment authority.

## GitHub Actions repository secrets

The production workflow expects these repository secrets:

| Secret | Purpose |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI authentication |
| `SUPABASE_DB_PASSWORD` | Production migration connection |
| `SUPABASE_PROJECT_REF` | `qltiogotxbxwzwmnypwu` |
| `NETLIFY_AUTH_TOKEN` | Netlify deployment authentication |
| `NETLIFY_SITE_ID` | `4d470484-81c4-443e-8a3a-d77f7df93b36` |

Do not put the values in source code, commit messages or browser variables.

## Netlify site environment variables

The existing site configuration should retain:

| Variable | Scope |
| --- | --- |
| `VITE_SUPABASE_URL` | Build |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Build |
| `SUPABASE_URL` | Functions |
| `SUPABASE_PUBLISHABLE_KEY` | Functions |
| `GEMINI_API_KEY` | Functions only |
| `GEMINI_MODEL` | Optional Functions setting |

The app accepts `VITE_SUPABASE_ANON_KEY` as a legacy alias, but `VITE_SUPABASE_PUBLISHABLE_KEY` is the preferred configured name. Never add a service-role key to the frontend.

## Google OAuth setup

Google sign-in uses Supabase's OAuth authorization-code flow with PKCE.

1. In Google Cloud Console, create an OAuth 2.0 Client ID with application type **Web application**.
2. Add the production origin `https://angel-companion.netlify.app` to Authorized JavaScript origins. Add local development origins only if needed.
3. Add this exact Authorized redirect URI to the Google OAuth client:

   `https://qltiogotxbxwzwmnypwu.supabase.co/auth/v1/callback`

4. In Supabase Dashboard, open **Authentication → Providers → Google**, enable Google, and enter the Google Web Client ID and Client Secret.
5. In Supabase **Authentication → URL Configuration**, set the production Site URL to `https://angel-companion.netlify.app` and add the allowed post-auth redirect URLs:
   - `https://angel-companion.netlify.app/auth/callback`
   - `https://angel-companion.netlify.app/**`
   - `http://localhost:3000/auth/callback` for local development, if used
   - Any explicit Netlify preview origin you intend to test
6. Save and test using a dedicated account.

The Google Client Secret belongs in Supabase's Google provider settings, not in Netlify frontend variables, Vite, or GitHub source.

The application starts Google OAuth when Supabase is configured. Supabase remains the authority for whether Google is enabled. If Google is not enabled there, the app displays the provider setup error returned from Auth.

## Other identity providers

Enable Apple, Microsoft (Azure), GitHub, Discord or other providers separately in Supabase Authentication → Providers. Configure each provider's own client credentials and callback URI in its developer console. Additional providers can be allow-listed with `VITE_SUPABASE_ENABLED_PROVIDERS` (comma-separated provider IDs).

Provider authentication and external service integrations are separate. Google sign-in does not grant Drive, Calendar or Gmail access.

## Identity linking

The account screen supports viewing and linking identities through Supabase Auth. Confirm Supabase's identity-linking configuration and any beta/manual-linking prerequisites before enabling account linking in production. Never merge identities just because unverified email strings match. Do not allow a user to unlink their only remaining authentication method.

## Production release order

1. Pull requests run type-check, automated tests and production build only.
2. Push to `main` runs validation.
3. Supabase migrations are previewed, then applied.
4. GitHub Actions builds the site and publishes the prebuilt `dist` directory to Netlify.
5. Confirm the Netlify deployment is `ready` and inspect function logs.

Netlify Git-based automatic builds should remain stopped so a frontend deployment cannot go live before the database migration job succeeds. Keep Netlify team SSO enabled during development; public visitor access is a separate launch decision.

## Smoke tests before public launch

- Email/password registration and sign-in.
- Google OAuth callback and verified session restoration.
- Sign-out clears the local and Supabase session.
- A signed-in user gets a real Gemini response through `/api/chat`.
- Unauthenticated `/api/chat` returns HTTP 401.
- Conversation save, refresh, and cloud restore.
- A second test account cannot read or inherit the first account's conversations.
- Password recovery callback completes the reset flow.
- Netlify's current production deployment includes the `chat`, `model-status`, and `title` functions.
