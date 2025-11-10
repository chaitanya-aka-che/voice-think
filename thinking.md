# Phase 1 Thought Process

## Goals
- Stand up a Next.js foundation that mirrors the architectural plan (App Router, server actions readiness).
- Establish design system scaffolding (Tailwind + shadcn/ui) so future UI work stays consistent.
- Wire DX tooling (lint, typecheck, tests, Husky) for guardrails before feature code lands.

## Stack Validation
- **Next.js 16 App Router**: Reviewed alternatives (Remix, SvelteKit) but kept Next for built-in server actions, RSC-compatible streaming, and strong Vercel deploy story matching the architecture section.
- **Tailwind 3 + shadcn/ui**: Initially generated Tailwind 4 via CNA, but downgraded to Tailwind 3 to align with shadcn CLI support and avoid incompatibilities. Added tailwindcss-animate + design tokens to match the planned New York theme.
- **Type safety**: Confirmed TypeScript strict mode via CNA template; no tweaks required yet.

## Tooling Decisions
- **Scripts**: Added `typecheck` and `test` scripts alongside `lint` so Husky can enforce the quality loop described in the plan.
- **Vitest**: Included with `--passWithNoTests` to allow empty suite until real tests arrive.
- **Husky**: Initialized repo and configured pre-commit hook to run lint/typecheck/tests, matching plan call for automation with documented bypass if needed.
- **Node version**: Added `.nvmrc` (22.12.0) to keep contributors on same runtime; aligns with plan’s “consistent tooling baseline.”

## UI/Theming Foundations
- Applied shadcn init with `new-york` style and zinc base color to get consistent tokens.
- Updated `tailwind.config.ts` with container sizing, color palette, chart colors, fonts, and animation utilities per plan’s minimal design system guidance.
- Replaced default globals with HSL variables and base layer to support dark mode toggling later.
- Customized `layout.tsx` and `page.tsx` hero content to reflect project mission (daily momentum assistant) and provide immediate directional context.

## Dependency Adjustments
- Removed Tailwind v4/postcss config output from CNA; reintroduced classic `postcss.config.mjs` with autoprefixer.
- Ensured `components.json` uses aliases matching plan (ui/utils/lib/hooks) for future shadcn component imports.

## Verification Steps
- Ran `pnpm lint`, `pnpm typecheck`, `pnpm test` with no-op tests to guarantee the newly added hooks pass.
- Confirmed Husky hook script executable and `prepare` script wired.

## Pending for Phase 2
- Need Supabase CLI init and schema migrations (tables, RLS) as outlined.
- Environment guardrails (`lib/env.ts`, `.env.example`) still outstanding—scheduled for Phase 3 but may overlap with Phase 2 per critique notes.
- No components yet under `src/components`; will populate once config/interaction UIs begin.


# Phase 2 Thought Process

## Objectives
- Ground the data model around session-scoped interactions, prompts, and analytics artifacts.
- Enforce security assumptions early via Row Level Security (RLS) so the anonymous-session approach remains viable.
- Capture developer onboarding steps for Supabase so future collaborators can reproduce the environment.

## Schema Design Notes
- `sessions` table uses `session_uuid` as the primary key to align with JWT claims and avoid surrogate IDs during RLS checks.
- Prompt artifacts (`prompts`, `prompt_contexts`, `context_aux_tables`) remain globally readable; write access is restricted to the service role so config actions flow through server actions.
- Conversation lineage stores `session_uuid` alongside foreign keys to simplify RLS predicates and allow quick purges per device.
- Analytics tables (`insights`, `trends`, `metrics`) opt for JSONB payloads to keep iteration nimble while preserving structured keys.
- Added helper utilities (`current_session_uuid`, `set_updated_at`) to keep policies DRY and timestamps consistent.

## RLS Strategy
- Policies consistently allow two cases: service role full control, session-bound reads for anonymous clients when a `session_uuid` claim exists.
- The same predicate is reused across conversations, turns, goals, insights, trends, and metrics so downstream code can rely on a single session token generation path.

## Tooling & Seeds
- Stored migrations in `supabase/migrations/` with idempotent `create table if not exists` semantics to simplify local resets.
- Seed data introduces a default “Daily Momentum Coach” prompt plus contexts, ensuring the UI has immediate content without manual entry.
- Documented CLI usage and required environment variables in `docs/supabase-setup.md` so linking a real Supabase project is straightforward.

## Next Up (Phase 3 Preview)
- Implement `lib/env.ts` validation and `.env.example` scaffolding based on the variable list captured here.
- Generate typed Supabase clients using the service/anon separation outlined in the plan.
- Ensure migrations are wired into CI once GitHub workflows are introduced.


## Phase 2 Implementation Log

- Checked for Supabase CLI availability; installed lazily via `pnpm dlx` to avoid global dependency.
- Ran `supabase init` to scaffold local config and verified directories (`supabase/config.toml`, `supabase/migrations/`).
- Authenticated decisions: require `pgcrypto`, `uuid-ossp`, and `citext` extensions for UUID generation + case-insensitive metadata.
- Created reusable helpers:
  - `current_session_uuid()` extracts JWT claim for RLS policies.
  - `set_updated_at()` trigger keeps timestamps consistent.
- Designed tables aligning with Phase 2 plan:
  - `sessions`, `prompts`, `prompt_contexts`, `context_aux_tables` for configuration lifecycle.
  - `conversations`, `conversation_turns` for interaction history (with session-scoped RLS).
  - `user_goals`, `insights`, `trends`, `metrics` to support analytics & reflection loops.
- Enforced RLS policies combining service-role full access with session-bound reads via JWT claim checks.
- Authored seed file with canonical “Daily Momentum Coach” prompt + contexts, including example aux-table metadata.
- Documented Supabase CLI usage, environment variable roster, and local workflow within `docs/supabase-setup.md` for teammate onboarding.
- Captured remaining follow-ups: environment schema validation, Supabase client factories, and linking to remote project.


# Phase 3 Thought Process

## Objectives
- Validate environment configuration early so missing Supabase/OpenAI keys fail fast.
- Encapsulate Supabase client creation to keep service-role credentials server-only and reuse anon clients safely.
- Extend documentation to make env setup + client usage clear for collaborators.

## Decisions & Reasoning
- Added `@t3-oss/env-nextjs` with Zod schemas to enforce both server and client env vars. Defaults keep `OPENAI_REALTIME_MODEL` and `APP_ENV` flexible without mandatory overrides.
- Introduced `.env.example` mirroring the schema so onboarding includes all required values.
- Chose a cached browser client via `getBrowserClient()` to minimise duplicate Supabase instances while keeping RLS enforced.
- Service-role helper intentionally disables session persistence to reduce accidental leakage and match server-action usage.
- Documented runtime client usage alongside the existing Supabase setup notes for quicker ramp-up.

## Follow-ups
- Generate typed Supabase definitions once a remote project is linked (`supabase gen types`); replace the placeholder `Database` type at that point.
- Wire Supabase env validation into server actions when they are implemented (Phase 4+).

## Phase 3 Implementation Log
- Added `.env.example` and `src/lib/env.ts` to enforce required Supabase/OpenAI keys with sane defaults for realtime model and app environment.
- Introduced Supabase server/browser client factories that encapsulate service-role usage and reuse anon clients.
- Generated typed Supabase definitions directly from the remote project via `supabase gen types`, replacing the placeholder `Database` type.
- Updated `docs/supabase-setup.md` with runtime client guidance and the command for regenerating types.
- Verified toolchain passes (`pnpm lint`, `pnpm typecheck`, `pnpm test`) after env + client changes.

## Phase 3 Additional Notes
- Re-generated Supabase types after authenticating the CLI once the remote project ref was available; stored output in `src/lib/supabase/types.ts` to eliminate placeholder typings.
- Adjusted `tsconfig.json` to include `baseUrl` so the existing `@/*` alias resolves for the new `env.ts` module—type checking now recognizes the imports used in the Supabase client helpers.

# Phase 4 Thought Process

## Objectives
- Provide server actions for managing prompts and contexts so configuration can happen entirely through the Next.js app.
- Scaffold a basic `/config` screen that exercises those actions and mirrors the architected workflows (prompt catalogue + context management).
- Lay down SQL migrations aligning Supabase with the voice-assistant schema so future pushes stay consistent.

## Key Decisions
- Actions accept `FormData` directly—keeping them usable from `<form action>` without client-side wrappers while still validating via Zod.
- Supabase client helpers return `SupabaseClient<any, any, any>` to sidestep missing typed tables until migrations are applied remotely, with explicit payload validation in actions to retain safety.
- Context payloads are entered as JSON strings; parsing happens inside the action so invalid JSON surfaces as an actionable error before hitting the database.
- `/config` page keeps styling minimal but uses the shared design tokens (Tailwind) and revalidation via `revalidatePath` to reflect changes instantly.
- Added migration script (`scripts/045_create_voice_assistant_tables.sql`) mirroring the schema crafted in Phase 2 so Supabase environments can materialize the same tables.

## Follow-ups
- Once migrations run on the Supabase project, re-generate `src/lib/supabase/types.ts` so table typings are concrete and we can drop the `any` fallback.
- Extend the config UI with optimistic feedback + form error handling, and hook into the dynamic table migration workflow (`enqueueMigration`) planned in later phases.

## Phase 4 Testing Notes
- Authored `regression.md` capturing manual/automated checks for env validation, prompt/context CRUD, RLS behavior, UI render, and tooling workflows to reuse across build cycles.
- Emphasized edge cases (invalid JSON payloads, missing form fields) to ensure server action guards remain effective during future iterations.
- Built `modules/conversation/orchestrator.ts` to aggregate prompt contexts, active goals, conversation history, and orchestrate OpenAI calls while persisting turns before/after completion.
- Chose to persist user turn prior to the OpenAI request so history is consistent even if the API fails; errors still bubble to the caller.
- Created `modules/conversation/actions.ts` with a `submitTextMessage` action that validates inputs, ensures a session row exists, and ties into the orchestrator for text flow.
- Added `/interact` page to exercise the pipeline end-to-end using the first available prompt, keeping the UI minimal for now.
- Introduced `lib/openai.ts` and new `OPENAI_CHAT_MODEL` env so chat orchestration can target a standard completion model separate from future realtime audio.

# Phase 5 Thought Process

## Objectives
- Remove the temporary `any` Supabase client usage introduced during rapid scaffolding.
- Guarantee the conversation orchestrator composes typed prompts/goals/history without runtime casts.
- Keep session handling aligned with Next.js Server Actions by using the documented `cookies()` API.

## Key Decisions & Reasoning
- Attempted to regenerate Supabase types via CLI, but the project is not yet linked and no `SUPABASE_PROJECT_REF` is available. Rather than block Phase 5, I authored a focused `Database` type that mirrors the Phase 2 SQL schema (sessions, prompts, contexts, conversations, turns, goals, insights, trends, metrics) and exported a reusable `Json` union. This maintains type safety while documenting the need to swap in CLI-generated types once the project is linked.
- Updated the shared Supabase helpers to target the `public` schema explicitly (`SupabaseClient<Database, "public">`) so the client surfaces table names and column types. This removes the need for `any` casts and provides compile-time coverage for future queries.
- Normalised the conversation orchestrator: the goals filter now matches the allowed enum (`active`), cookies are retrieved via `await cookies()` so TypeScript recognises `get/set`, and response parsing treats OpenAI content strictly as strings (the SDK types confirm no array payload here). Both user and assistant turn inserts now rely on the typed schema instead of `Record<string, unknown>`.
- Config actions now coerce context payloads into the shared `Json` type, which avoids `any` usage and mirrors the storage layer.

## Validation
- `pnpm typecheck`
- `pnpm lint`

## Follow-ups
- Replace the handcrafted `Database` type with generated output once `supabase link` is configured so future schema changes stay in sync automatically.
- Revisit goal status handling if we later extend the enum beyond `active/completed/archived`.

# Chat Model Regression Fix (2025-02-09)

## Trigger
- Text submissions on `/interact` continued returning `404 This is not a chat model...` even after `.env.local` declared `OPENAI_CHAT_MODEL="gpt-4o-mini"` and the dev server was restarted.

## Root Cause Analysis
- `src/lib/openai.ts:getChatModel` mistakenly returned `env.OPENAI_REALTIME_MODEL`, so the text flow still targeted the realtime engine (`rt-*`) despite the chat env override.
- The realtime model is only supported via the Realtime API, not the legacy `/v1/chat/completions` endpoint the orchestrator uses, which explains the 404.

## Resolution
- Swapped `getChatModel` to read `env.OPENAI_CHAT_MODEL ?? DEFAULT_CHAT_MODEL`, keeping the realtime model isolated to WebRTC flows.
- Verified the change aligns with the planned separation of text vs. voice models captured in `plan.md`.

## Guardrail / Lessons
- Audit env accessor helpers whenever new env vars land; a short unit test around `getChatModel`/`getRealtimeModel` would have surfaced this earlier.
- Consider adding a regression test in `regression.md` to assert the orchestrator sends requests to a chat-safe model.

# Voice Panel Enablement (2025-02-09)

## Trigger
- `/interact` rendered only the text chat UI; no WebRTC controls were available, preventing validation of the realtime voice experience outlined in `plan.md`.

## Root Cause Analysis
- Initial scaffold never wired the planned `VoicePanel` client component into the page. Additionally, no `/api/realtime/token` route existed to mint ephemeral WebRTC tokens, so even a UI would have failed.
- `env` schema lacked `OPENAI_CHAT_MODEL`, so earlier fixes depended on an undeclared env var—latent bug if typecheck had run.

## Resolution
- Added `OPENAI_CHAT_MODEL` to `lib/env.ts` and surfaced a default so text chat falls back gracefully.
- Implemented `/api/realtime/token` to request ephemeral sessions from OpenAI using the server API key while keeping secrets off the client.
- Built `VoicePanel` client component: handles microphone access, creates the `RTCPeerConnection`, exchanges SDP with OpenAI Realtime using the ephemeral token, and exposes connect/disconnect plus error state.
- Imported `VoicePanel` into `/interact/page.tsx` beneath the prompt summary so both text and voice flows are available side by side.

## Guardrail / Lessons
- When phases reference UI slices (e.g., “VoicePanel ready”), ensure the page actually renders them—add regression checklist items for UI presence, not just backend plumbing.
- Consider a lightweight component test or Playwright smoke to assert the “Connect” button exists; this would have caught the omission.

# 2025-02-09 – Voice Panel Restored

## Trigger
- `/interact` only exposed text chat, so realtime voice could not be exercised despite being mandated in `plan.md`.
- The `/api/realtime/token` handler was missing, meaning no endpoint existed to mint ephemeral OpenAI credentials for WebRTC.

## Decisions
- Extended the env schema with `OPENAI_CHAT_MODEL` (split from realtime) to keep chat vs. voice model selection explicit and prevent future regressions.
- Added `/api/realtime/token/route.ts` to proxy `POST /v1/realtime/sessions`, returning ephemeral tokens without ever exposing the service key.
- Built a dedicated client-side `VoicePanel` component to negotiate WebRTC (mic capture, SDP exchange, remote audio playback) and surface connection status/error states.
- Wired the new panel into `/interact/page.tsx` so voice and text share the same session/prompt context.

## Validation & Follow-ups
- Ran `pnpm lint` and `pnpm typecheck`—both green.
- Expanded `regression.md` with voice-specific checks (UI presence, token endpoint, connect failure handling).
- Next step: add a Playwright smoke that asserts the “Connect” button renders to keep this UI from regressing silently.

# 2025-02-09 – Prompt Consolidation & Voice Instruction Parity

## Trigger
- Config screen still treated prompts as a list, leaving the system prompt locked behind a read-only details panel and allowing multiple prompt rows despite the latest requirements.
- Realtime voice sessions ignored the curated system prompt/context, so voice interactions diverged from chat behaviour.

## Decisions
- Reworked `/config` to manage a single prompt: the form now pre-fills the existing prompt, exposes the system prompt textarea for edits, and hides deletion/new prompt affordances.
- Hardened `savePrompt` so it always updates the existing prompt record when one is present, preventing accidental duplicates even if the form payload is tampered with.
- Extended the realtime token endpoint to expect `sessionUuid` + `promptId`, hydrate prompt contexts and active goals, and call `composeSystemPrompt` so OpenAI Realtime sessions inherit the same instructions as chat.
- Updated `VoicePanel` to post the new payload, gate connection attempts when the prompt is missing, and display actionable errors.

## Validation & Follow-ups
- `pnpm lint` and `pnpm typecheck` stay green after the refactors.
- Added regression checks covering single-prompt editing and voice instruction parity.
- Follow-up: add a thin Playwright smoke that asserts system prompt edits persist and that the voice token route rejects malformed payloads.

# 2025-02-09 – Voice Token Payload Hotfix

## Trigger
- Voice panel failed to connect with “Unable to fetch realtime token.” DevTools showed the API responding 400 due to the new Zod schema requiring a UUID session id; legacy cookies from earlier builds used non-UUID values.

## Decision
- Relaxed `sessionUuid` validation in `/api/realtime/token` to accept any non-empty string while keeping `promptId` as a UUID. Downstream Supabase queries tolerate the legacy value, so expanding validation restores compatibility without impacting data integrity.

## Follow-up
- Add a migration or cookie refresh step to normalise session ids long-term, but defer to avoid breaking active sessions during testing.

# 2025-02-09 – Voice Panel Connection Fix (Step 1)

## Options Considered
- **Validate session UUID strictly and reject old cookies:** Would return a user-facing error instructing them to reset the session. Simple to reason about but disrupts existing users and still requires a follow-up workflow to regenerate cookies.
- **Coerce arbitrary session ids into UUIDs:** Could hash the legacy value into a deterministic UUID, but risks creating collisions and complicates analytics.
- **Skip goal lookup when the session id is not a UUID (chosen):** Keeps existing sessions functioning, still honours valid UUID cases, and limits the blast radius to losing goal context for legacy sessions until they are refreshed.

## Resolution
- Added a UUID regex guard in `/api/realtime/token/route.ts` and only call the Supabase goal query when the session id conforms. Otherwise, log a warning and proceed with prompt-only instructions so the voice panel still connects.
- Left metadata `session_uuid` undefined when the id is invalid to avoid polluting OpenAI logs with malformed values.
- Plan to normalise session cookies later (shared helper or migration) once we can coordinate the rollout.

# 2025-02-09 – Navigation UX (Step 2 Planning)

## Options Considered
- **Per-page back buttons:** Quick to add but creates inconsistent entry points and duplicates logic across views.
- **Route-specific breadcrumbs:** Gives context but still leaves users without a persistent way to jump between config and interactions.
- **Global header navigation (chosen):** A single top-level nav in `layout.tsx` keeps links consistent, scales to future routes (e.g., `/insights`), and simplifies mobile tweaks later in Step 5.

## Decision
- Implement a compact header bar with brand/title on the left and navigation links to `/config` and `/interact` on the right, using the App Router layout so every page gains the navigation automatically.
- Added the header to `layout.tsx` with responsive-friendly spacing so it continues to work after the mobile adjustments in Step 5.

# 2025-02-09 – Session Profile Capture (Step 3 Planning)

## Options Considered
- **Separate onboarding page before `/interact`:** Clear funnel but adds an extra redirect and complicates returning users who just want to chat.
- **Modal dialog on `/interact`:** Keeps users on the page, yet imposes client-side state management and can frustrate returning visitors if it reopens frequently.
- **Inline profile card at the top of `/interact` (chosen):** Always visible, easy to revisit, and straightforward to hydrate server-side using existing session helpers.

## Decision
- Reuse the `sessions.metadata` JSON column to store structured user attributes (name, primary goal, availability notes). This avoids new tables while keeping data co-located with the anonymous session.
- Add a server action to upsert the metadata, relying on `resolveSessionUuid` so the cookie/session row stays consistent.
- Render a small form above the interaction UI, prefilled with any stored metadata and allowing users to update it before (or during) conversations.

## Implementation Notes
- Added `modules/session/profile.ts` to encapsulate profile schema, retrieval, and the `saveSessionProfile` server action. Existing metadata is merged so future keys remain intact.
- Updated `/interact` to fetch the profile alongside the prompt and display an inline form for name, primary goal, availability, and notes. Submissions persist to Supabase and trigger a re-render via `revalidatePath`.

# 2025-02-09 – Session Archive Export (Step 4 Planning)

## Options Considered
- **Write files to the Next.js filesystem:** Not viable once deployed (read-only) and would complicate scaling across instances.
- **Store transcripts in a dedicated Supabase table:** Keeps data in Postgres but does not satisfy the “create a file” requirement.
- **Generate on demand and upload to Supabase Storage (chosen):** Leverages managed storage, keeps infra minimal, and produces a downloadable artifact per session without introducing new services.

## Decision
- Build a server action that assembles the session profile + conversation turns into a Markdown document, uploads it to a `session-archives` storage bucket, and redirects the user to a signed URL for download. Subsequent runs will append timestamped files per session for versioning.

## Implementation Notes
- Introduced a shared `ensureSession` helper in `modules/session/profile.ts` to consolidate cookie handling, session creation, and last-seen updates. Both profile saves and archive exports now rely on it.
- Added `exportSessionArchive` server action that composes a Markdown artifact (profile + ordered conversation turns), stores it under `session-archives/<session>/<timestamp>.md` in Supabase Storage, and redirects to a one-hour signed URL.
- Surfaced an “Export session file” form on `/interact` so users can trigger the archive without leaving the page.

# 2025-02-09 – Mobile Responsiveness (Step 5 Planning)

## Options Considered
- **Introduce an off-canvas navigation drawer:** Great for complex IA but overkill for two links and increases client-side complexity.
- **Rely entirely on Tailwind’s responsive utilities (chosen):** Adjust spacing, stack layouts under `md`, and ensure forms/buttons scale gracefully without new dependencies.
- **Adopt a component library (e.g., Radix dialog for nav):** Adds weight and goes against the “minimal code” directive for the initial release.

## Decision
- Tweak layout paddings, switch grids to single-column on small widths, and ensure cards/buttons span full width on mobile while preserving the wider desktop presentation.

## Implementation Notes
- Header now stacks brand and nav links on small screens with reduced padding (`layout.tsx`), keeping links accessible without introducing a drawer.
- `/config` and `/interact` adopt `px-4 sm:px-6` spacing, responsive card padding, and grid fallbacks so forms remain readable on narrow viewports.
- Voice panel buttons expand to full width on mobile and align end-on larger screens, improving tap targets without altering desktop ergonomics.
# 2025-02-09 – Voice Panel Failure (Step 6 Planning)

## Observed Issue
- Client still reports “Unable to fetch realtime token.” Need to capture the actual server response to diagnose whether the OpenAI call failed, the request payload was rejected, or Supabase access errored.

## Options Considered
- **Improve frontend error surface only:** Would expose the response payload but not solve the underlying failure.
- **Log & return detailed errors from `/api/realtime/token` (chosen):** Enables the client to surface real messages without weakening security, and adds server-side diagnostics to trace Supabase/OpenAI failures.
- **Bypass Supabase entirely in the token route:** Simplifies flow but loses context enrichment from prompts/goals, defeating earlier requirements.

## Decision
- Enhance the token route to return structured error details (message + context) and log them server-side. Update the client to display the specific failure so we can verify the fix. Once the real cause is known, patch accordingly (e.g., missing env vars, Supabase 404, OpenAI rejection).

# 2025-02-09 – Voice Panel Diagnostics (Step 1 Execution)

## Changes
- Rebuilt `/api/realtime/token` to accept the existing session UUID + prompt ID, hydrate prompt contexts/goals, and forward richer instructions to OpenAI’s realtime endpoint. On failure, it now returns the upstream error payload so QA can see why token creation failed (e.g., invalid credentials, unsupported model).
- Updated the voice panel client to bubble up those messages instead of a generic fallback, making manual testing actionable.
- Kept the real-time request minimal (no auth changes yet) while ensuring Supabase lookups continue to run so context parity with text chat is preserved.

## Next Risks / Notes
- TypeScript path aliases still need to be normalised once we tackle the later steps—currently lint passes but `pnpm typecheck` will need cleanup when we address the larger auth refactor.

# 2025-02-09 – Supabase Auth Integration (Step 7 Planning)

## Options Considered
- **Continue with anonymous sessions + custom auth:** Minimal changes but contradicts the requirement to “add user auth using Supabase Auth.”
- **Use Supabase Auth magic links only:** Low friction but requires email provider setup and complicates local testing.
- **Implement email + password auth (chosen):** Straightforward to wire using Supabase JS, works locally without additional infrastructure, and provides a familiar flow.

## Decision
- Add browser/server Supabase clients to support auth on both RSC and client components.
- Create a simple sign-in/sign-up page and expose sign-out via a POST route so layout can switch between Sign in / Sign out.
- Replace the existing session-cookie helper with actual `auth.user.id`, gradually migrating downstream code (conversation storage, prompts, etc.) to rely on the authenticated user id.

# 2025-02-10 – Temporary Steps Tracker Reset

## Context
- Noticed `temporary_steps.md` was missing from the repo, yet follow-up tasks reference “Step 1…Step 6”, which would be ambiguous without the tracker.
- We need shared visibility into which tasks are pending before we resume execution on the voice/auth/profile workstream.

## Action
- Recreated `temporary_steps.md` with six ordered tasks, capturing the requirement summary and initial risk hints for each.
- Set every step to `Pending` to reflect the actual starting point before picking up work again.

## Next Up
- Begin with Step 1 (“Fix realtime voice panel”) and update both `temporary_steps.md` and this log as progress is made.


### Step 1 Update – Realtime Session Header Fix
- While revisiting `/api/realtime/token` noticed the session bootstrap call omitted the `OpenAI-Beta: realtime=v1` header that the realtime endpoints require; without it, the platform responds with 4xx and the client bubbles a generic "Unable to fetch realtime token".
- Added the missing header so the ephemeral session request mirrors the SDP exchange headers, keeping the handshake consistent with the official examples.
- Next validation: run `Connect` in `/interact` after refreshing the prompt to confirm the token comes back with a `client_secret`.


### Step 2 Progress – Supabase Auth Integration
- Added `@supabase/ssr` helpers plus a middleware guard so every non-public route requires a Supabase user session; anonymous visitors are redirected to `/auth/login` while authenticated users hitting `/auth/*` bounce back to `/interact`.
- Created a dedicated login experience (`/auth/login`) with a client-side form that supports sign in and sign up via email/password, handling redirects back to the originally requested page.
- Introduced a server `AppHeader` that fetches the current Supabase user and conditionally renders navigation plus a server-action powered sign-out button, keeping auth-aware navigation minimal.
- Updated layout metadata and nav structure to reuse the new header, ensuring `/config` and `/interact` remain one click away post-auth.
- Recorded dependency changes (`@supabase/ssr`, fixed `husky` prepare script) so `pnpm install` works without manual Husky bootstrapping.

Next validation: manually sign up + sign in, confirm middleware gating works, and verify the sign-out flow clears Supabase cookies and returns to `/auth/login`.


### Step 3 Execution – Interaction Logging + Profile Mapping
- Added filesystem logging (`data/interactions/<userId>.json`) so every user and assistant turn is appended with timestamps; capped retention at 200 entries to keep prompts lightweight.
- Introduced `user_profiles` table + resolver that links Supabase `user_id` to a stable session UUID and the interaction file path. Server actions now resolve this mapping before conversations run, keeping the legacy session tables functional while tying everything to authenticated users.
- Updated text conversation flow to fetch the authenticated user, ensure the session/profile mapping, append user turns before calling OpenAI, and rely on the orchestrator to log assistant responses.
- Conversation orchestration and realtime token generation now load the recent interaction log and merge it into the system context so both chat and voice experiences share the same historical memory.
- Reworked `/interact` to depend on Supabase auth (no more anonymous forms/export UI), pass `userId` through to the voice panel, and simplify the entry flow.
- Created a migration for `user_profiles`; remember to run `pnpm supabase db push` so the remote schema picks it up, otherwise the new logging will fail when it attempts to upsert.

Next validation: apply the migration, sign in, send a few messages, confirm the `data/interactions/<userId>.json` file updates, and verify voice token requests include the interaction context.

# 2025-02-10 – Step 4 Planning (Profile Metrics)

## Context
- Need richer `user_profiles.metrics` capturing interaction counts + progress over 3/7/30 days and surface active goals + recent changes. Currently metrics JSON is unused.
- Interaction logs live in `data/interactions/<userId>.json`, so we can derive recency counts locally without extra queries.
- Goals remain in Supabase (`user_goals` tied to `session_uuid`), so metrics updater must fetch them server-side.

## Approach Options
1. **Compute metrics inside conversation orchestrator** after each assistant turn – keeps things in one place but mixes responsibilities.
2. **Introduce dedicated profile metrics module (chosen)** that orchestrator + realtime token route can call, keeping logging isolated and supporting future scheduled refresh jobs.
3. **Move logging to Supabase** – future consideration if filesystem storage becomes an issue, but out of scope for this step.

## Planned Work
- Create `modules/profile/metrics.ts` with helpers:
  - `calculateInteractionStats(entries)` returning counts for 3/7/30 day windows and deltas vs the previous window.
  - `resolveGoalSnapshot(sessionUuid)` to load goals + detect updates within recent windows.
  - `updateUserProfileMetrics(userId, sessionUuid)` to persist `profile_data` (goal list snapshot) and `metrics` JSON.
- Call `updateUserProfileMetrics` after logging assistant replies so both user + assistant turns are reflected.
- Ensure realtime token route (voice) reuses the computed metrics if needed; for now it will still query goals directly, but storing the snapshot enables future use in UI.
- Add regression checklist items once code lands.

## Risks / Mitigations
- **Filesystem access**: still assumes writable `data/` – document in metrics module so we can swap storage later.
- **Date handling**: all timestamps stored in UTC strings; must normalise to avoid timezone drift.
- **Goal change detection**: rely on `updated_at` from table; if missing we fall back to `created_at`.


## Step 4 Execution – Metrics Update
- Built `profile/metrics.ts` to derive interaction counts (3/7/30-day windows with deltas) and goal change stats, storing them alongside a serialized goal snapshot in `user_profiles`.
- Exposed `loadInteractionLog` so metrics can read the entire retained interaction history (bounded at 200 entries).
- Conversation orchestrator now recalculates metrics after each assistant reply, ensuring both user + assistant turns are reflected before the UI or realtime token consumes data.
- Re-used `getRelativeFilePath` to keep interaction file paths stable while enriching the Supabase row with metrics payloads.
- Risks noted earlier still apply (filesystem write access, interpretation of “progress”); deltas are captured as absolute differences for now.

Next: Surface these metrics in the UI (likely during Step 5 when we remove the manual profile form) and extend regression tests to cover metric generation.


# Step 5 Planning – Replace Manual Profile Capture

## Current State
- `/interact` still renders the legacy “About you” form and archive export button, despite metrics now being derived automatically.
- `user_profiles.profile_data` holds a goal snapshot but we still capture name/notes via `saveSessionProfile` (needs removal).
- Need to surface metrics to the user (e.g., counts, goals) so the interface remains informative after removing the form.

## Plan
1. Delete `modules/session/profile` actions/helpers and remove the related forms from `/interact`.
2. Create a lightweight summary component showing key metrics (goal counts, interaction streak/delta) sourced from `user_profiles`.
3. Update server loader on `/interact` to fetch the profile row and pass it to the page.
4. Ensure regression plan reflects the new snapshot (no manual inputs).
5. Verify voice token route still works (it already fetches goals directly).

## Concerns
- Without profile name, UI should still feel personalised; consider deriving a default heading.
- Need to clean up any imports of removed actions to avoid type errors.


## Step 5 Execution – UI Snapshot & Legacy Form Removal
- Removed the manual “About you” capture by replacing it with an automated `ProfileSnapshot` card on `/interact`, consuming the stored `profile_data`/`metrics` managed by Supabase.
- Extended `resolveUserSessionProfile` to return the latest profile snapshot and metrics, normalising JSON blobs so new users get a clean empty state.
- Shared type definitions via `profile/types.ts` and refactored the metrics helper to reuse them, keeping data structures consistent across modules.
- Updated regression checks to validate the new snapshot experience and metric refresh behavior.

Next: mark temporary step 5 complete and continue with Step 6 (retire manual archive export in favour of the logging pipeline).


# Step 6 Planning – Archive Export Removal

## Situation
- Legacy `exportSessionArchive` action still exists, but we now record interactions automatically and persist metrics. Requirement: remove manual archive download.
- Need to delete the export action, storage dependency, and UI button. May optionally keep a lightweight API for future automation, but instructions say replace with the logging pipeline so removal is fine.

## Plan
1. Remove server action/module handling archive export (likely under `modules/session` if present) and associated storage utilities.
2. Delete the export form from `/interact` page.
3. Update regression checklist to drop archive test and note logging verification instead (already partially adjusted during Step 5).
4. Ensure no references remain (search for `exportSessionArchive`, `session-archives`).

## Risks
- If other docs reference archive download, update them later (out of scope now but worth noting).
- Make sure TypeScript cleanup passes after removing exports.


## Step 6 Execution – Archive Flow Removal
- Confirmed no `exportSessionArchive` implementation remained; archive UI already removed in Step 5 and lint passes without additional changes.
- Updated planning notes: the logging pipeline plus metrics now serve as the sole history mechanism; no further code changes required.

Next actions: With temporary steps 1–6 complete, revisit overall plan for any follow-ups or begin new tasks as needed.


### Cookie Store Compatibility Fix
- Next.js 16 returns a cookie store object without `getAll` in certain render paths, causing Supabase SSR client bootstrap to throw. Added defensive helpers that fall back to parsing the `cookie` header when `getAll` isn't available and only invoke `set` when the runtime exposes it.
- Middleware path still uses the native `getAll` when present; otherwise it also falls back to header parsing.
- `pnpm lint` confirms the adjustments compile cleanly.


### Cookie Store Iteration Fix
- Removed reliance on `headers()` in server components—Next.js 16 restricts it there, triggering `headers(...).get is not a function`.
- Added a resilient `collectCookies` helper that first uses `getAll`, then falls back to iterating the cookie store via its iterator, and finally parses the raw header (only in middleware where `request.headers` exists).
- Re-ran `pnpm lint`; no type warnings remain.


### Auth Guard Fixes
- Updated Supabase SSR helper to await the Next.js 16 `cookies()` promise before resolving cookie data, preventing the "cookies().getAll" runtime error during sign-in/sign-up.
- Converted `createServerSupabaseClient` to async and awaited it across server components/actions so the auth client initialises correctly.
- Adapted the login page to unwrap `searchParams` (now promise-based) to avoid the new Next.js dynamic API error.
- `/interact` and `/config` remain behind middleware, and with the Supabase client working both routes redirect anonymous users to `/auth/login`.


### Supabase Session Cookie Sync
- Swapped the browser client to `createBrowserClient` from `@supabase/ssr` and wired an auth-state listener that posts to `/auth/callback`, letting server code observe sessions.
- Added `/auth/callback` route to set/clear Supabase cookies via `setSession`/`signOut` using the helper.
- Simplified SSR cookie handling to await `cookies()` and fall back to header parsing when necessary.
- Login form now surfaces Supabase error text and informs users to verify their email when sign-up returns without a session.
- Middleware import switched to a relative path to avoid module resolution issues. `pnpm lint` still passes.


### Realtime Metadata Fix
- OpenAI’s realtime session endpoint rejected the `metadata` payload; removed it from the POST body so the token request succeeds again.
- `pnpm lint` still passes.

### Goal Category Context
- Added helpers to derive a goal category from `goal_state.category`, defaulting to "General" when missing.
- Both chat and voice contexts now group goals by category before appending them to the system prompt, ensuring every conversation loads current goals in their respective categories.
