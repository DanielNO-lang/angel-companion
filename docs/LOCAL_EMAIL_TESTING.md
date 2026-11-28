# Local email testing (free)

Angel Companion uses Supabase Auth for email/password signup, OTP verification, and password recovery. Do not test real email delivery by repeatedly sending messages through the production project's built-in mailer.

## Local email inbox

The Supabase CLI starts a local SMTP catcher (Mailpit) with the local Supabase stack. It captures outgoing Auth emails without delivering them to real mailboxes.

The repository enables it in `supabase/config.toml` using the current `[local_smtp]` configuration:

- Inbox UI: http://127.0.0.1:54324
- SMTP port: `54325`

## Start it on Windows

Requirements:
- Docker Desktop installed and running.
- Node.js 20 or later.
- The Angel Companion repository cloned to your computer.

Open PowerShell in the Angel Companion repository folder and run:

```powershell
npm install
npx supabase start
npx supabase status
```

The first start downloads the local Supabase containers and can take several minutes. When startup completes, open http://127.0.0.1:54324 to view the local email inbox.

For a safe signup test, the local Supabase stack must be running and the local Angel Companion development app must be configured to use the local Supabase URL and anon key printed by `npx supabase status`. Do not point the production Netlify site at the local stack. Register a test account in the local app, open the captured confirmation email in Mailpit, and copy its one-time code into the verification screen.

Stop the local stack when finished:

```powershell
npx supabase stop
```

## Important separation

- Local Auth emails are captured by Mailpit and are not sent to real recipients.
- The production Netlify site continues to use the connected hosted Supabase project.
- This local inbox does not fix production SMTP delivery or bypass Supabase's hosted default-mailer restrictions.
- Never put Gemini API keys, Supabase service-role keys, or SMTP passwords in frontend code or commit them to Git.
- No production Supabase settings, users, or database migrations are changed by this local testing setup.
