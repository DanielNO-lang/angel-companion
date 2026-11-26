# Angel Companion — Master Repair & Release Prompts

**Purpose:** Use these prompts in the existing Google AI Studio workspace for Angel Companion to repair the current functional defects, preserve the approved interface, verify the application end-to-end, and prepare a safe release.

**Target project:** Angel Companion (the new project/repository), not the old `Angel-ai-New` project.

**Recommended order:** Run Prompt 0 first, then Prompts 1–5 in order. Keep the same AI Studio workspace open so the agent can work against the same source tree. Do not ask it to deploy or apply production migrations until the explicit release gate in Prompt 5 has been reviewed.

---

# Prompt 0 — Master Orchestrator (paste this first)

You are the senior full-stack engineer, application reliability engineer, security reviewer, and release engineer responsible for completing **Angel Companion**. You are working inside the existing Google AI Studio code workspace. Your job is to IMPLEMENT the repairs in the actual project files, not merely explain what should be done or return a plan.

## 0. Project identity and non-negotiable constraints

- Work only on **Angel Companion**, the current new project. Do not import, merge, reference as source, or modify the old `Angel-ai-New` project.
- The current production app is `https://angel-companion.netlify.app`.
- GitHub repository: `DanielNO-lang/angel-companion`, branch `main`.
- Supabase project ref: `qltiogotxbxwzwmnypwu`; project URL: `https://qltiogotxbxwzwmnypwu.supabase.co`.
- Netlify site ID: `4d470484-81c4-443e-8a3a-d77f7df93b36`.
- Preserve the already-approved Angel Companion home screen, layout, navigation, colors, spacing, typography, responsive structure, animations, branding, and composer design. **Do not redesign, restyle, replace, or simplify the UI.** Only make the smallest UI changes required to show truthful loading, success, retry, and error states.
- Keep the model strategy exactly: primary `gemini-3.8-flash`; emergency fallback `gemini-3.1-flash-lite`. Never restore `gemini-4-hydrogen`. Do not silently change model IDs or introduce unverified model IDs.
- Keep `GEMINI_API_KEY` server-only. Never use `VITE_GEMINI_API_KEY`, put the key in client code, logs, source files, generated bundles, browser storage, test snapshots, or error messages. Never ask the user to paste a key into chat. Read it only from the server environment.
- The browser may use the Supabase publishable key. Never expose Supabase service-role or secret keys to the browser.
- Prefer free/low-cost solutions. Do not add paid services or new infrastructure without proving they are necessary and explaining cost implications.
- Do not change production Netlify settings, trigger production deployment, push to GitHub `main`, apply a production Supabase migration, delete/merge production records, or rotate credentials as part of this task. Prepare and verify the code and release artifacts first. Production actions require a separate explicit approval.
- Do not claim a test passed unless you actually ran it and have its output. Distinguish `implemented`, `automated-test verified`, `preview verified`, and `production verified`.

## 1. Start with a real source audit

Inspect the complete current workspace before editing. Read at minimum:

- `server/geminiBackend.ts` and its tests
- `netlify/functions/chat.ts`, `title.ts`, and `model-status.ts`
- `src/services/geminiModelService.ts`
- `src/services/conversationEngine.ts`
- `src/services/universalComposerService.ts`
- `src/services/universalAttachmentService.ts`
- `src/services/fileProcessingEngine.ts`
- `src/services/fileStorageService.ts`
- `src/services/companionData.ts`
- `src/services/cloudSyncCoordinator.ts`
- authentication services, `src/services/authValidation.ts`, `src/App.tsx`, and auth tests
- every migration in `supabase/migrations/`
- `.github/workflows/production.yml`, `netlify.toml`, `package.json`, lockfiles, `.env.example`, and `DEPLOYMENT.md`
- all existing tests, especially chat, composer, attachment, failover, auth, and cloud persistence tests.

Create a source-grounded defect register. For each issue record: exact file/function, observed behavior, user impact, root cause, intended repair, test that will prove the repair, and whether it requires a database or hosting change. Do not assume the earlier review is complete; verify it against the actual files in this workspace.

## 2. Known defects and risk areas to verify

The exported source review identified these concrete issues. Reconfirm each one before editing:

1. `UniversalComposerService.submit()` in `src/services/universalComposerService.ts` sets `success: true` after `conversationEngine.generateAssistantResponse()` without checking `aiMsg.status`. The conversation engine can return an assistant message with `status: 'failed'`. The composer then clears the draft. This creates false-success behavior and loses the user's unsent text.
2. Attachment extraction exists, but the ordinary chat path appears to pass attachment names/summaries rather than the extracted file content or image bytes to Gemini. Inspect the complete path from file selection through staging, message creation, request validation, Gemini `contents`, and cloud persistence. Do not claim a file is understood merely because it is staged or catalogued.
3. `fileProcessingEngine.ts` currently has partial extractors. Some PDF content extraction is heuristic; XLSX/PPTX may only be catalogued; images/audio/video may be marked `pending_integration`. Clearly distinguish supported, partially supported, and unsupported file types.
4. Attachment binary storage appears to be local IndexedDB/memory in the composer flow, while Supabase private Storage upload helpers are used elsewhere. Verify whether normal conversation attachments are actually uploaded, recoverable on another device, and deleted correctly.
5. `DEPLOYMENT.md` appears to document `/auth/callback` for AI Studio preview while the current code defines `/auth/preview-callback`. Confirm the code's actual host-based callback selection and correct documentation.
6. `package.json` has a `bun.lock` but the production workflow uses `npm install`, with no npm lockfile in the export. This is not a reproducible npm install. Choose one package manager and make CI use its committed lockfile and frozen/clean install.
7. Migration `20261125000100_fix_companion_upsert_indexes_and_rate_limits.sql` includes deduplication/deletion of rows. Treat it as data-changing and potentially destructive. Do not apply it automatically or assume migration history matches the live database.
8. Verify that `/api/chat`, `/api/title`, and `/api/model/status` are all built and deployed as Netlify Functions and share the same server-only model configuration and auth behavior.
9. Verify that the chat UI exposes real errors and retry actions and does not leave a permanent loading state after timeout, auth expiry, rate limiting, or provider failure.
10. Verify that every cloud persistence failure is visible as degraded/pending sync and that the UI never reports cloud-saved when the write has not succeeded.

## 3. Implementation expectations

Implement the following end-to-end, in small reviewable changes:

- Correct composer success/failure semantics, draft preservation, duplicate-submit protection, and retry behavior.
- Ensure failed assistant placeholders are not sent back as valid history and retry reuses the intended user turn rather than duplicating it.
- Connect supported extracted text and supported multimodal payloads to the Gemini request.
- Add secure, owner-scoped, private cloud attachment persistence and cross-device retrieval where feasible with the existing Supabase project.
- Preserve conversation/message persistence, chronological ordering, user isolation, and offline/local fallback behavior.
- Keep Gemini primary/fallback strategy, bounded retry, Retry-After support, timeout budget, model telemetry, and safe diagnostics correct.
- Correct preview OAuth route documentation and ensure redirect URLs are generated from the actual current preview origin, not hard-coded stale hostnames.
- Make dependency installation deterministic and CI reproducible.
- Review migrations and release workflow for safety. Do not silently delete data.
- Add tests for every repaired failure mode, not just happy paths.

## 4. Required engineering standards

- Follow current official Google Gemini API documentation and the installed `@google/genai` SDK version. Use supported `generateContent` content-part shapes for text and media. Do not invent SDK methods or payload fields.
- Follow current Supabase documentation for Auth, RLS, Storage, signed URLs, and migrations. Every exposed table must have RLS enabled and owner policies appropriate to its data. Storage is separately protected by `storage.objects` policies; table RLS does not secure Storage automatically.
- Validate attachment MIME type, extension, byte size, and user ownership on the server as well as client-side. Never trust browser-provided `userId`, MIME type, path, or metadata without validation.
- Bound request body size, total text characters, number of attachments, and per-file size to avoid serverless payload/time limits and runaway costs.
- Do not log raw prompts, file content, access tokens, API keys, OAuth codes, signed URLs, or personal file names. Log request IDs, model IDs, sanitized provider codes, latency, retry count, and fallback status.
- Treat uploaded documents, webpages, and file contents as untrusted data, not instructions that override Angel's system rules.
- Make all async operations cancellable or timeout-bounded where appropriate. Always clear timers and in-flight flags in `finally` blocks.
- Keep the current visual design. Add no new UI panels or navigation items unless essential to complete the existing interaction.

## 5. Acceptance gates

Do not finish with a narrative saying “done” unless the actual gates below have been executed and the results are recorded:

A. Static checks: type-check, lint, unit tests, integration tests, production build.

B. Gemini tests using mocked SDK responses: primary success; primary transient 503 then fallback success; 429 with Retry-After; timeout; invalid key/403 stops immediately; empty model response; no secret leakage; conversation context preserved; fallback telemetry correct.

C. Auth tests: no token returns 401; expired/invalid token returns 401; valid Supabase user reaches Gemini; provider callback path is correct for production and AI Studio preview; no open redirect.

D. Composer tests: success clears draft; Gemini failure does not clear draft; error state visible; retry succeeds without duplicate user messages; double click does not create duplicate turns; concurrent request lock always releases.

E. Attachment tests: text extraction is actually included in the model request; image/PDF media is actually included using a supported Gemini part; unsupported files are reported honestly; too-large files are rejected; MIME spoofing is rejected; file data is not written to logs or conversation metadata; attachment remains private and user-scoped.

F. Persistence tests: authenticated user writes and reloads conversation/messages; refresh restores order and metadata; offline mode preserves local data and queues sync; retry sync works; user A cannot read/update/delete user B's conversations, messages, memories, or files; cloud save status is truthful.

G. Deployment checks: all three Netlify functions are present in the deploy artifact; production bundle contains public Supabase config but no Gemini key, Supabase service key, OAuth client secret, or access token; Netlify build settings match the repo; CI installs deterministically.

H. Live preview acceptance: only after local automated checks pass, test with the existing configured preview environment and real authenticated user. Do not print secrets. Report actual HTTP status, request ID, actual model, fallback activation, persistence result, and timestamp.

## 6. Final report format

At completion, provide:

1. Files changed and why.
2. Defects fixed with before/after behavior.
3. Tests run and exact pass/fail counts.
4. Tests not run and the reason.
5. Required environment variables, by name only, and which runtime/context needs them. Never print values.
6. Required manual Google Console/Supabase/Netlify configuration, if any.
7. Migration review: safe/additive vs data-changing, duplicates found, backup required, and whether production migration is still pending.
8. Release readiness: `NOT READY`, `PREVIEW READY`, or `PRODUCTION READY`, with evidence.
9. Exact next action for the owner.

Begin by inspecting the project and writing the defect register. Then implement the repairs in the actual workspace. Do not stop after producing a plan.

---

# Prompt 1 — Repair the real chat pipeline and composer

Implement the chat and composer repairs in the current Angel Companion workspace. Do not redesign any UI.

## A. Trace and repair the complete text-chat path

Trace:
`UniversalComposer` → `UniversalComposerService.submit()` → `ConversationEngine.addMessage()` → `ConversationEngine.generateAssistantResponse()` → `GeminiModelService.generateChatResponse()` → `POST /api/chat` → Netlify Function → `server/geminiBackend.ts` → Gemini API → response → persisted assistant message → UI.

Confirm each handoff uses the same conversation/thread ID and authenticated Supabase access token. Confirm the request includes the intended history exactly once and excludes failed/unsent assistant placeholders.

## B. Fix false success and draft loss

In `src/services/universalComposerService.ts`:

- After each conversation call, inspect the returned `ChatMessage.status` and its error field.
- If status is `failed`, return `{ success: false, error, summaryText }`, store the context error, and do not clear the draft.
- Clear the draft only after a genuinely successful operation.
- Preserve the user message in the conversation so the user can retry it, but ensure retry does not append the same user message a second time.
- Ensure the submit lock is released in `finally`, including early returns and thrown errors.
- Ensure a failed message is not mistaken for a successful response by the UI.
- Do not treat a locally queued workspace instruction as a completed Gemini conversation; distinguish accepted/queued from model response success if the existing type requires it.

Review all composer context types (`general`, `studio`, `workspace`, `adaptive`, `agent_task`, `learning`) and apply correct per-context success semantics. Do not make agent task execution or workspace association appear to be a Gemini reply.

## C. Make retry behavior reliable

- Add or repair a retry path for a failed assistant response that reuses the existing last user turn.
- Prevent duplicate user messages, duplicate assistant messages, and concurrent generation for the same thread.
- If the auth token expires, show a sign-in/session-expired state and preserve the draft.
- If the request times out, release loading state and offer retry.
- If the provider returns 429, respect server `Retry-After` information and display a useful wait/retry message.
- Do not retry invalid API keys, permission failures, malformed requests, or unauthenticated requests as though they were transient provider failures.

## D. Verify Gemini fallback implementation

Keep exactly:
- Primary: `gemini-3.8-flash`
- Emergency fallback: `gemini-3.1-flash-lite`

Verify `server/geminiBackend.ts` is the single source of truth for server runtime model selection. The browser must never call Gemini directly in production. Remove or disable any accidental client-side/direct-key path that could expose `GEMINI_API_KEY`.

Confirm bounded retry, jitter, `Retry-After`, per-tier deadline, total serverless timeout budget, and immediate stop for invalid credentials/permission errors. Make telemetry accurate: `requestedModel`, `actualModel`, `fallbackActivated`, `fallbackReason`, `retryCount`, `durationMs`, `requestId`.

Check that `/api/title` uses the same safe server-side model configuration and does not block chat if title generation fails. A title failure must never convert a successful chat turn into a failed chat turn.

## E. Add tests

Add tests proving:
- successful response clears draft;
- failed `aiMsg.status` returns `success:false` and preserves draft;
- retry sends one user turn and returns one assistant turn;
- double submit is rejected safely;
- auth failure preserves draft;
- timeout clears loading/in-flight state;
- primary 503 triggers Lite fallback;
- invalid API key/403 does not retry to fallback;
- title endpoint failure does not undo successful chat;
- no key or bearer token leaks into logs or browser bundle.

Run all relevant existing tests plus new tests. Report exact results. Do not claim success based only on source inspection.

---

# Prompt 2 — Make attachments genuinely usable by Angel

Implement end-to-end attachment understanding in the existing composer. Preserve the UI and existing attachment workflow. Do not tell users Angel can read a file unless its content was actually included in the Gemini request.

## A. Map the existing attachment flow

Inspect:
- `src/services/fileProcessingEngine.ts`
- `src/services/universalAttachmentService.ts`
- `src/services/fileStorageService.ts`
- `src/types/attachment.ts`
- `src/services/universalComposerService.ts`
- `src/services/conversationEngine.ts`
- `src/services/geminiModelService.ts`
- `server/geminiBackend.ts`
- `src/services/companionData.ts`

The current extraction engine has partial text extraction for plain text/code, CSV/TSV, DOCX, some PDFs, and archive/presentation cataloguing. Some images/audio/video are currently `pending_integration`. Preserve this honest distinction and improve it.

## B. Design a bounded, secure attachment request contract

Extend the chat request with a typed attachment payload, separate from persisted chat text. Do not put raw base64 data into conversation history, localStorage metadata, Supabase message metadata, analytics, or logs.

For each attachment, validate server-side:
- allowed MIME type and extension agree;
- byte size is within the configured maximum;
- total request payload and attachment count are bounded;
- base64 decodes correctly;
- file belongs to the authenticated user/conversation when a stored object is referenced;
- unsupported or dangerous file types are rejected with a clear user-safe error.

Align the client maximum with the private Supabase bucket limit. The export currently has a 25 MB client cap while the bucket migration specifies 20 MB. Choose one consistent safe maximum (no more than the configured bucket cap) and test it.

## C. Implement supported Gemini media parts

Use the installed `@google/genai` SDK and official current Gemini API documentation. For images and PDFs, use supported inline data parts with the correct `mimeType` and base64 `data`, or the official Files API where file size/reuse justifies it. Do not invent method names or payload structures.

For extracted text formats (TXT, Markdown, CSV/TSV, code, DOCX, and formats where extraction is verified), add bounded extracted content to the current user turn in a clearly delimited untrusted-data section. Preserve the user's original question separately. Never allow file text to override the system instruction.

For PDF, prefer a reliable parser or Gemini PDF inline input rather than relying only on regex extraction of uncompressed PDF text streams. If you add a dependency, pin it and update the chosen lockfile.

For XLSX and PPTX, either implement actual text/table/slide extraction with the existing ZIP/XML stack or clearly report that the format is only catalogued and is not yet understood. Do not silently treat slide counts or filenames as extracted content.

For audio/video, only enable direct model input if the selected model and current SDK documentation explicitly support the required media type and request shape. Otherwise keep the file preserved and show `not yet supported for analysis`; do not fake transcription or understanding.

## D. Secure private cloud storage

Use the existing private bucket `companion-private` and existing `companionData.uploadPrivateFile`, `getPrivateSignedUrl`, and `deletePrivateFile` patterns where appropriate.

- Store under an owner-scoped path such as `<verified-user-id>/<conversation-id>/<attachment-id>/<safe-file-name>`.
- Obtain user identity from the verified Supabase session, never from a caller-supplied `userId` alone.
- Keep the bucket private. Do not create public URLs for personal attachments.
- Verify `storage.objects` SELECT/INSERT/UPDATE/DELETE policies are restricted to the authenticated owner folder. Check the existing migration policy before adding duplicates.
- For upsert, ensure the required Storage permissions/policies cover INSERT, SELECT, and UPDATE.
- Persist only safe attachment metadata and storage path in the conversation record. Never persist raw file bytes in the messages table.
- On a second device, restore attachment metadata and allow an authenticated owner to retrieve the file via Storage download or short-lived signed URL.
- Delete cloud objects when the user deletes an attachment, and handle failed deletion with a retryable cleanup state.
- Keep local IndexedDB/offline behavior as a fallback, but do not label an attachment `cloud-saved` until upload succeeds.

## E. Correct status and UX truthfulness

Use existing status values meaningfully (`ready`, `processing`, `processed`, `error`, `pending_integration`). Show the user whether a file was:
- extracted and included in the current model request;
- uploaded privately but not yet analyzed;
- preserved locally only;
- unsupported for analysis;
- rejected due to type/size/security.

If upload or processing fails, preserve the draft and give a retry/removal path. Avoid adding new panels or redesigning the composer.

## F. Attachment tests

Add tests proving:
- extracted text reaches the Gemini SDK request;
- image and PDF parts contain correct MIME and data;
- binary data is not placed in conversation history or metadata;
- a malicious extension or MIME mismatch is rejected;
- files above the agreed cap are rejected;
- unsupported formats are reported honestly;
- private upload uses owner-scoped paths and authenticated tokens;
- another user cannot download or sign another user's file;
- cloud upload failure is not reported as cloud success;
- deleted attachments are removed from metadata and cloud storage or marked for cleanup retry.

Run tests and report exact results. Do not claim multimodal support for any type that was not exercised in an actual SDK request or a deterministic SDK mock test.

---

# Prompt 3 — Reconcile Supabase persistence and database safety

Harden Angel Companion's Supabase persistence without risking existing production user data.

## A. Inspect actual database state before writing migrations

Use the connected Supabase project `qltiogotxbxwzwmnypwu`. Read the live schema, migration ledger, indexes, constraints, RLS policies, Storage bucket configuration, and table counts. Compare them with every migration in this repository.

At minimum inspect:
- `companion_conversations`
- `companion_messages`
- `companion_memories`
- `companion_profiles`
- `companion_library_items`
- `companion_projects`
- `companion_studios_state`
- `companion_agent_executions`
- `api_rate_limits` and `companion_api_rate_limits`
- `storage.buckets` and `storage.objects` policies for `companion-private`.

Record migration-history drift. Do not assume a migration file absent from the ledger is safe to replay, and do not assume a migration recorded in the ledger exactly matches the current schema.

## B. Review the existing 20261125000100 migration as a data-changing migration

The current file `supabase/migrations/20261125000100_fix_companion_upsert_indexes_and_rate_limits.sql` contains DELETE statements that deduplicate conversations, messages, memories, and library items. It can delete existing rows. Do not apply it to production as-is without:

1. Read-only duplicate reports for every affected `(user_id, client_id)` pair.
2. Counts of rows and child relationships that would be affected.
3. A backup/export plan and proof that the backup is recoverable.
4. A deterministic merge plan that preserves messages, metadata, attachments, timestamps, and foreign-key relationships.
5. A dry-run report showing exactly which rows would be merged/deleted.
6. Explicit human approval before any production data-changing SQL executes.

Prefer a safer forward-only migration that adds missing indexes/RPC/policies without deleting user records. If duplicates prevent a unique index, stop and produce a remediation report rather than silently choosing a row and deleting the rest.

Do not modify a migration already applied in production. Create a new migration for any approved correction. Follow the current Supabase CLI migration workflow and verify it against the actual migration ledger.

## C. Verify RLS and authorization

- RLS must be enabled on every exposed user-data table.
- Every SELECT/UPDATE/DELETE policy must scope by `auth.uid()` and row owner.
- UPDATE policies need both `USING` and `WITH CHECK` to prevent ownership reassignment.
- Do not trust user-editable `user_metadata` for authorization.
- Do not use a service-role key in browser code or ordinary user chat requests.
- Keep rate-limit table inaccessible to anon/authenticated direct table operations; use the authenticated RPC with `auth.uid()` validation and least privilege.
- Review any `SECURITY DEFINER` function carefully: fixed `search_path`, authenticated identity check, explicit grants/revokes, and no caller-controlled user ID.
- Storage RLS is separate from public table RLS. Verify the private bucket's object policies separately.

## D. Verify persistence behavior

Trace `conversationEngine.persist()` and `cloudSyncCoordinator` through `companionData.syncThreads()` and `loadThreads()`.

Implement/fix:
- stable client IDs and idempotent writes;
- no duplicate messages on retries;
- chronological ordering after refresh;
- user-scoped local cache keys;
- local-first offline writes and explicit pending sync state;
- retry of failed cloud sync;
- conflict resolution that does not overwrite newer cloud messages with stale local snapshots;
- sign-out/user-switch cleanup so one account never sees another account's local cache;
- attachment metadata restoration and secure file retrieval.

Never display “saved to cloud” until the corresponding write is confirmed. Keep local persistence if cloud is temporarily unavailable and show a clear sync warning.

## E. Live tests

Use two dedicated test accounts if available. Do not use the owner's personal data for destructive tests. Verify account A can create/read/update/delete only A's data and account B cannot access A's data, including Storage. Verify message writes and reads after a full refresh/new browser session.

If no second test account is available, run deterministic RLS contract tests and explicitly mark live cross-user verification as pending.

## F. Report

Return the live migration ledger, schema drift, indexes, RLS status, Storage policy status, duplicate counts, and proposed migration SQL. Do not apply production migration or delete production rows in this prompt.

---

# Prompt 4 — Authentication, Netlify functions, dependencies, and CI reliability

Harden the authentication and deployment plumbing while preserving the current user experience.

## A. Google OAuth callback routes

Inspect `src/services/authValidation.ts`, `src/services/authService.ts`, `src/App.tsx`, and `DEPLOYMENT.md`.

The code currently defines separate routes:
- production: `/auth/callback`
- AI Studio preview/local development: `/auth/preview-callback`

Verify actual hostname detection and callback generation. Do not hard-code old AI Studio preview hostnames into application logic. Use the current `window.location.origin` for redirect URL generation and allowlist the exact origin/path in Supabase.

Correct `DEPLOYMENT.md` so its AI Studio callback URLs use `/auth/preview-callback` if that is what the current code requires. Keep Google's Authorized redirect URI pointed to the Supabase callback:
`https://qltiogotxbxwzwmnypwu.supabase.co/auth/v1/callback`
Do not replace the Google redirect URI with the app preview callback.

Test production, AI Studio preview, localhost, Netlify deploy preview, invalid host, cancelled OAuth, expired OTP, PKCE code exchange, and open-redirect rejection. Ensure callback query/hash values are scrubbed from browser history after processing.

## B. Server-only secret boundaries

Check all references to:
- `GEMINI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_SECRET_KEY`
- Google OAuth client secret
- Supabase publishable key

Only the publishable key and Supabase URL may be included in the frontend build. Gemini API key and service-role/secret keys must be server-only. Add a production bundle scan and tests that fail if key patterns are found in `dist/`.

Never log request Authorization headers, OAuth codes, full provider error bodies that may include secrets, signed storage URLs, or attachment content.

## C. Netlify functions

Verify that these functions exist and build:
- `netlify/functions/chat.ts`
- `netlify/functions/title.ts`
- `netlify/functions/model-status.ts`

Verify `netlify.toml` routes `/api/chat`, `/api/title`, and `/api/model/status` to the correct functions. Ensure shared imports are bundled correctly and the `@google/genai` dependency is available at runtime. Do not add unnecessary externalization that makes Lambda unable to resolve packages.

Ensure function timeout budgets are compatible with primary + fallback attempts and do not exceed Netlify runtime limits. Ensure abort signals actually stop timed-out requests where supported.

## D. Deterministic dependency installation

The export contains `bun.lock`, but the workflow currently uses `npm install` and there is no `package-lock.json`. Resolve this inconsistency.

Choose one path and apply it consistently:
- Recommended: generate and commit `package-lock.json`, use `npm ci` in CI and deployment jobs, and ensure all dependencies are pinned by the lockfile; or
- Use Bun consistently by installing the exact Bun version in CI and running `bun install --frozen-lockfile` plus matching Bun scripts.

Do not maintain two conflicting lockfiles unless there is a documented reason. Ensure package versions are compatible with Node 22 and the installed Vite/TypeScript versions. Do not casually upgrade major dependencies during bug fixing.

## E. CI and release workflow safety

Review `.github/workflows/production.yml`.

- PRs and pushes should run install, type-check, all tests, production build, and secret scan.
- Production deployment must remain manually gated.
- Separate “preview migration” from “apply production migration” and “deploy production” so a successful dry-run does not automatically authorize a destructive schema change.
- Do not run `supabase db push --include-all --remote --yes` against a drifted production ledger without a reviewed migration plan and explicit approval.
- Ensure deploy job depends on validation and successful approved migration step.
- Avoid deploying from AI Studio preview directly to production.
- Ensure Netlify Git auto-deploy behavior does not bypass the intended GitHub Actions release gate.

## F. Documentation and environment matrix

Update `.env.example` and `DEPLOYMENT.md` with variable names, purpose, and runtime scope only. Never include actual values. Document:
- browser build: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (or explicitly supported legacy anon alias);
- server functions: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `GEMINI_API_KEY`, optional `GEMINI_MODEL`;
- GitHub Actions secrets for controlled migration/deploy;
- OAuth callback path by environment;
- exact smoke tests and release gates.

Run type-check, tests, build, and workflow syntax validation. Report exact output.

---

# Prompt 5 — Full acceptance test, repair loop, and release candidate

Do not add features or redesign Angel. This prompt is the final verification and defect-closure phase.

## A. Run all automated checks from a clean install

Use the package manager and lockfile chosen in Prompt 4. Run:
1. clean dependency install;
2. type-check/lint;
3. complete unit/integration test suite;
4. Gemini backend/fallback tests;
5. composer and conversation behavior tests;
6. attachment processing and request payload tests;
7. Supabase cloud persistence/RLS contract tests;
8. production build;
9. Netlify function build/bundle verification;
10. client bundle secret scan.

If any command fails, diagnose and fix the underlying cause. Do not suppress errors, weaken tests, skip failing tests, or mark them as expected just to obtain a green build. Re-run the affected tests and then the full suite.

## B. Real signed-in preview acceptance

Only after automated checks pass, use the current authenticated AI Studio preview or a controlled preview deployment. Never paste secrets into chat or logs.

Perform these real tests:

1. Open Angel Companion and sign in with Google.
2. Confirm Supabase returns a verified authenticated session.
3. Send a simple text message such as “Hi Angel. Reply with one short sentence.”
4. Confirm the request reaches `/api/chat` with a valid bearer token.
5. Confirm the server validates the token with Supabase before calling Gemini.
6. Confirm Gemini returns genuine non-empty generated text.
7. Record requested model, actual model, fallback flag, retry count, request ID, HTTP status, and duration. Do not reveal secrets.
8. Force or mock a primary 503 and confirm Lite fallback returns a response without duplicate user turns.
9. Send a multi-turn follow-up and confirm relevant prior context is preserved.
10. Refresh the page and confirm the conversation is restored from cloud.
11. Upload a supported text file and ask a question about a specific sentence in it. Verify the extracted content is actually present in the Gemini request and the answer is grounded in that content.
12. Upload a supported image or PDF and verify the actual media part reaches Gemini. If this is not implemented or the model rejects it, report it as incomplete; do not fake a pass.
13. Verify a failed request preserves the draft and exposes a retry action.
14. Sign out and confirm protected workspace access is blocked.

If no live authenticated preview or test account is available, do not fabricate a live pass. Mark it `BLOCKED — requires owner sign-in` and provide exact steps for the owner.

## C. Production release gate

Do not push to `main`, apply production migrations, change Netlify production environment variables, or deploy production in this prompt.

Prepare:
- a clean diff summary;
- a list of changed files;
- migration preview and data-loss analysis;
- required GitHub secrets by name only;
- required Netlify variables by name only;
- OAuth allowlist values to be configured manually;
- exact GitHub branch/PR release procedure;
- rollback plan for application deploy and database migration;
- production smoke-test checklist.

Production status may be called `PRODUCTION READY` only if all production gates have been genuinely completed. Otherwise use `PREVIEW READY` or `NOT READY`.

## D. Final response must be evidence-based

Provide a concise but complete table:

| Area | Status | Evidence |
|---|---|---|
| Text chat | | |
| Gemini primary | | |
| Gemini fallback | | |
| Auth | | |
| Composer failure/retry | | |
| Text/PDF/image attachments | | |
| Supabase conversation persistence | | |
| Supabase attachment storage | | |
| RLS isolation | | |
| Netlify function bundle | | |
| CI install/build | | |
| Production migration safety | | |
| Live preview test | | |

List every remaining blocker and the exact next action. Never use “everything works” unless every relevant acceptance gate has evidence.

---

# Verified project facts and references for the implementation agent

## Source facts from the supplied Google AI Studio ZIP

- The export has `server/geminiBackend.ts` with `DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash'` and `EMERGENCY_FALLBACK_MODEL = 'gemini-3.1-flash-lite'`.
- `src/services/universalComposerService.ts` creates a successful result after `generateAssistantResponse()` without checking `aiMsg.status` in the general, studio, and learning branches, and clears the draft after the switch completes.
- `src/services/conversationEngine.ts` can create an assistant message with `status: 'failed'` and an error field when generation fails.
- `src/services/fileProcessingEngine.ts` has partial extraction support. Images/audio/video can return `pending_integration`; PPTX currently catalogs slide count; PDF extraction uses a limited heuristic.
- `src/services/universalAttachmentService.ts` stores attachment content via `fileStorageService` and metadata locally. `commitAttachments()` returns attachment records; normal conversation chat must still explicitly pass the actual content/media into Gemini.
- `src/services/conversationEngine.ts` stores `attachmentDetails` on user messages, but the normal chat request path must be verified to include their actual content.
- `src/services/companionData.ts` has private Storage upload, signed URL, and delete helpers; verify they are wired into normal composer attachments, not only Library items.
- `supabase/migrations/20261125000100_fix_companion_upsert_indexes_and_rate_limits.sql` includes DELETE-based deduplication. It is not safe to treat as a purely additive migration.
- `DEPLOYMENT.md` documents `/auth/callback` for AI Studio preview while `src/services/authValidation.ts` currently defines `/auth/preview-callback` for preview/local development. Correct the documentation after verifying runtime host detection.
- The export includes `bun.lock`, but `package.json` and `.github/workflows/production.yml` currently use npm commands and no `package-lock.json` was present in the export.

## Official documentation to follow

- Gemini models: https://ai.google.dev/gemini-api/docs/models
- Gemini content generation: https://ai.google.dev/gemini-api/docs/generate-content
- Gemini Files API: https://ai.google.dev/gemini-api/docs/files
- JavaScript SDK: https://googleapis.github.io/js-genai/
- Supabase Storage access control: https://supabase.com/docs/guides/storage/security/access-control
- Supabase private buckets: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Supabase JavaScript Storage upload: https://supabase.com/docs/reference/javascript/file-buckets-upload
- Netlify Functions configuration: https://docs.netlify.com/build/functions/configuration/
- Netlify Functions getting started: https://docs.netlify.com/build/functions/get-started/

Use the current docs, not this prompt as a substitute for API documentation. If the docs or installed SDK version conflict with an assumption here, explain the conflict and implement the supported current API.
