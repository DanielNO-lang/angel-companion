# Local email testing (free)

Angel Companion uses Supabase Auth for email/password signup, OTP verification, and password recovery. Do not test real email delivery by repeatedly sending messages through the production project's built-in mailer.

## Local email inbox

The Supabase CLI local stack includes Inbucket, a local email catcher. It captures outgoing Auth emails without delivering them to real mailboxes.

The repository enables Inbucket in `supabase/config.toml`:

- Inbox UI: http://127.0.0.1:54324
- SMTP host used by the local Supabase stack: `inbucket`
- SMTP port: `54325`
- POP3 port: `54326`

## Start it

Requirements: Docker Desktop must be running.

From the Angel Companion repository root:

```bash
npx supabase start
npx supabase status
```

Open http://127.0.0.1:54324 in your browser. Register a test account against the local Supabase stack, then inspect the captured confirmation/OTP email in the inbox. Open the message and copy the one-time code into Angel Companion's verification screen.

To stop the local stack:

```bash
npx supabase stop
```

If the Supabase CLI is already installed globally, `supabase start`, `supabase status`, and `supabase stop` can be used instead.

## Important separation

- Local Auth emails are captured by Inbucket and are not sent to real recipients.
- The production Netlify site continues to use the connected hosted Supabase project.
- This local inbox does not fix production SMTP delivery or bypass Supabase's hosted default-mailer restrictions.
- Never put Gemini API keys, Supabase service-role keys, or SMTP passwords in frontend code or commit them to Git.
- No production Supabase settings, users, or database migrations are changed by this local testing setup.
