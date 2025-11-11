# Regression Test Suite

## Environment & Configuration
- **Env validation**: Launch `pnpm lint`/`pnpm dev` with an empty `.env.local`; verify build fails with `Missing Supabase service role key` from `lib/env.ts`.
- **Client-side shape**: Start dev server with invalid `NEXT_PUBLIC_SUPABASE_URL`; confirm runtime throws URL validation error before render.
- **Supabase CLI**: Run `pnpm dlx supabase@latest db push` to ensure migration `045_create_voice_assistant_tables.sql` applies cleanly on a fresh local stack.

## Prompt Management
- **Create prompt (happy path)**: Submit Create Prompt form with valid values; expect new prompt card, data persisted in `prompts` table, and `system_prompt` stored verbatim.
- **Create prompt (missing fields)**: Submit form without `name`; confirm action rejects and logs validation error.
- **Edit system prompt**: Modify the textarea content and submit; refresh `/config` and `/interact` to ensure the updated system prompt is reflected in both UI and conversation responses.
- **Prompt uniqueness guard**: Attempt to create a second prompt (e.g., remove the hidden `id` via devtools); verify the action still updates the existing record rather than inserting a new row.

## Context Management
- **Add context with JSON payload**: Submit context form with valid JSON; inspect database `prompt_contexts.context_payload` equals parsed object.
- **Invalid JSON**: Provide malformed JSON; expect action to reject with `Context payload must be valid JSON` and no DB changes.
- **Toggle aux schema**: Check/Uncheck `Requires auxiliary schema`; confirm boolean persists correctly.
- **Delete context**: Remove context and ensure prompt card updates without stale data (path revalidated).

## Data Access & RLS
- **Anon fetch**: Call `getPrompts()` from server component; ensure query succeeds under anon key and only returns expected columns.
- **Service role usage**: Inspect server actions to ensure `createServiceClient` never leaks to browser (no client bundles referencing service key).

## UI Smoke Tests
- **Config page render**: Navigate to `/config`; confirm prompt list renders (empty state or existing entries) and forms show default values.
- **Home CTA routing**: Verify `/` links navigate to `/config` and `/interact` without 404 (placeholder where applicable).

## Tooling Integrity
- **Quality gates**: Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` to ensure regression suite is green.
- **Types regeneration**: Execute `pnpm dlx supabase@latest gen types typescript --project-id <ref> ...` and confirm no diff when schema unchanged.


## Conversation Flow
- **Session cookie issuance**: Submit the first message on `/interact`; confirm the `voice_think_session` cookie is set with a 30-day max age and persists across refreshes.
- **Conversation persistence**: After sending multiple messages, inspect `conversations` and `conversation_turns` to verify user/assistant turns are appended in order and tied to the same conversation id.
- **OpenAI fallback handling**: Force the OpenAI API to return an empty string (e.g., by mocking the client) and ensure the UI presents the default "I did not receive a response." message without crashing.
- **Profile snapshot render**: After signing in, verify the progress snapshot displays with interaction counts and goal highlights (empty state shown until first conversation).
- **Metrics refresh**: Send a new message and confirm `user_profiles.metrics` updates (interaction counts increment, goal changes captured) and the snapshot reflects the new totals after reload.
- **Goal categories in context**: Configure goals with different `goal_state.category` values and verify both chat and voice instructions list them grouped by category.

## Voice / Realtime
- **Voice UI presence**: Load `/interact`; confirm the Voice Panel renders with Connect/Disconnect controls and audio element.
- **Token endpoint**: Call `POST /api/realtime/token` with valid env; verify response returns `client_secret.value` and `model`.
- **Connection happy path**: From Chrome, click Connect, allow mic access, and confirm `RTCPeerConnection` enters connected state and remote audio plays.
- **Connection failure handling**: Revoke microphone access and retry Connect; ensure the UI surfaces an actionable error and status returns to idle after failure.
- **Instruction parity**: Capture the `instructions` payload returned from `/api/realtime/token` and confirm it matches the composed system prompt + context used for chat completions.
- **Voice transcript logging**: Hold a voice session, then reconnect and confirm the previous conversation transcripts appear under interaction history/goals and the realtime agent references prior turns before the session starts.
- **Voice goal persistence**: During a voice session, state new personal goals; verify a matching record appears in Supabase `user_goals` and is referenced when reconnecting.
