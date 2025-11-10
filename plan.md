# Software Components
- **Decision: Next.js 14 App Router (TypeScript, RSC, server actions).** Instructions: scaffold with `create-next-app --ts`, enable `serverActions`, `turbopack`, strict mode, ESLint/Prettier. Validation: Single stack unifies UI and API with streaming support.
  - **Critique:** Alternative stacks (Remix, SvelteKit) could reduce bundle size or simplify edge deployment. Remix has mature nested routing but weaker first-party streaming voice demos; SvelteKit would lower runtime overhead but lacks tight Vercel integration. Given the need for rapid iterating and built-in React ecosystem tooling (shadcn, TanStack), Next.js remains the best compromise despite React server component complexity.
- **Decision: Tailwind + shadcn/ui + TanStack Query.** Instructions: install only needed components, centralise tokens in `tailwind.config.js`, favour server components with minimal client islands. Validation: Accelerates accessible UI assembly.
  - **Critique:** Alternatives include Chakra UI or MUI for batteries-included components, but they introduce heavier theming layers and opinionated styling. A pure Tailwind + Headless UI approach would reduce dependency count but require more custom wiring. shadcn keeps design consistent while letting us eject to raw Radix primitives if requirements shift—best for balanced speed/customisation.
- **Decision: Supabase Postgres (+Storage) with JSONB context blobs.** Instructions: manage schema via migrations, generate TypeScript types, avoid runtime DDL. Validation: Managed SQL with typed access fits evolving context data.
  - **Critique:** DynamoDB or Firestore could simplify dynamic context storage but complicate relational queries (e.g., joins for insights). PlanetScale would offer MySQL scaling but no row security. Supabase’s RLS and Postgres JSONB provide both structure and flexibility—optimal for secure per-session data.
- **Decision: OpenAI Realtime Voice via Node SDK + WebRTC broker route.** Instructions: centralise utilities in `lib/openai.ts`, issue ephemeral tokens server-side, reuse transcript handlers. Validation: Keeps secrets server-side, supports low-latency streams.
  - **Critique:** Direct browser connection with API keys is insecure. Building a custom media server (e.g., LiveKit) offers richer conferencing but adds substantial ops overhead. Given target scale (20 concurrent users) the thin broker approach minimises code while aligning with OpenAI best practices—best option.
- **Decision: Validation with Zod + `@t3-oss/env-nextjs`; logging via Pino; env management centralised.** Instructions: define schemas under `/lib/schema`, infer types, fail-fast on env load. Validation: Reduces runtime errors and improves DX.
  - **Critique:** Alternatives include TypeScript-only interfaces (compile-time only) or Yup (less TS-friendly). Pydantic-like solutions (Valibot) are lighter but less widespread. Zod’s inference + ecosystem support remains optimal.
- **Decision: Quality automation with Husky, Vitest, Playwright.** Instructions: add hooks running lint/type/test; keep scripts simple. Validation: Maintains quality without manual checks.
  - **Critique:** Git hooks can slow contributors; consider optional lint-staged for partial runs. CI-only enforcement would reduce local friction but risks unchecked commits. Lightweight hooks strike balance—accept current plan but document override option for emergencies.

# Architecture
- **Decision: Vercel + Supabase managed services, leveraging preview deploys.** Instructions: store secrets in Vercel env vars, mirror Supabase keys, enforce RLS from day zero. Validation: Managed infra matches team bandwidth.
  - **Critique:** Self-hosting (Fly.io, Render) would give finer control over edge functions but add ops burden. For 20-user pilot, pay-as-you-go Vercel/Supabase optimises speed. Stick with managed setup, reassess at scale.
- **Decision: Anonymous sessions via UUID + signed Supabase JWT.** Instructions: generate UUID client-side, persist in storage, call `startSession` for signed JWT tied to RLS. Validation: Enables continuity without full auth.
  - **Critique:** Cookies-only sessions would avoid localStorage issues but complicate cross-device continuity. Magic link auth could provide minimal friction but adds onboarding overhead now. UUID + JWT is minimal yet secure, provided we add backup session recovery flows (phase 10 action item).
- **Decision: Modular structure (`modules/config`, `modules/conversation`, `modules/insight`, `modules/shared`).** Instructions: expose functionality via server actions/edge functions, keep helpers pure, cover key modules with tests. Validation: Encourages reuse and testability.
  - **Critique:** Feature-based foldering (per route) could align with Next.js convention but risks scattering orchestration logic. Domain-module approach matches long-term maintainability; keep but ensure clear route-level adapters.
- **Decision: Writes via server actions with service-role key; reads via anon client under RLS.** Instructions: isolate service role helpers, never ship key to client, validate inputs. Validation: Minimises attack surface.
  - **Critique:** Alternative is Supabase Edge Functions for all writes, keeping service key off Vercel runtime. That would add latency and boilerplate. For minimal code, server actions suffice if secrets restricted to server-only modules and reviews guard misuse. Document policy clearly.
- **Decision: Observability through Next.js instrumentation, Vercel Analytics, Supabase logs; optional OpenTelemetry later.** Instructions: add `instrumentation.ts`, log session metadata, persist aggregate metrics. Validation: Provides baseline visibility.
  - **Critique:** Logging to Supabase may incur storage overhead; consider DataDog or Logflare for long-term. At pilot scale, built-in tools are enough—just schedule log retention review.

## Implementation Phases (10)
**Phase 1 – Project Foundation & Tooling**
- Initialise repo with `pnpm` + `create-next-app --ts`, prune boilerplate, enforce strict mode.
- Configure Tailwind + shadcn/ui, establish tokens, base layout, dark/light support.
- Add Husky pre-commit running `pnpm lint`, `pnpm typecheck`, `pnpm test`; add `.nvmrc`.
- Validation: Ensures consistent tooling baseline.
- **Critique:** Husky can be skipped early to avoid friction; however, adding later risks inconsistent formatting. Keep hooks but document bypass command for hotfixes. Consider Nx or Turborepo if monorepo grows—defer until needed.

**Phase 2 – Supabase Bootstrap & Schema Design**
- Run `supabase init`, connect project, configure `.env.local` placeholders.
- Write migrations for core tables (`prompts`, `prompt_contexts`, `sessions`, `conversations`, `conversation_turns`, `user_goals`, `insights`, `trends`, `metrics`, `context_aux_tables`).
- Enable RLS per table keyed by `session_uuid`; seed dev data with sample prompts/goals.
- Validation: Provides secure schema foundation.
- **Critique:** Creating many tables up front risks premature optimisation. Alternative is starting with fewer tables (e.g., embed goals within sessions) and iterating. Because analytics and trends are key differentiators, storing them separately avoids later migrations—keep current plan but ensure migrations are reversible.

**Phase 3 – Environment & Configuration Guardrails**
- Implement `lib/env.ts` using `@t3-oss/env-nextjs` for runtime validation.
- Publish `.env.example`, README setup docs for local + Vercel.
- Enable Next.js experimental flags for server actions and streaming.
- Validation: Guarantees consistent configuration.
- **Critique:** Could rely on Vercel’s environment dashboard without runtime checks, but that defers errors to production. Current guardrail approach remains best; pair with CI check ensuring `.env.example` stays synced.

**Phase 4 – Supabase Client Abstractions**
- Create `lib/supabase/server.ts` service helper wrappers (`withServiceRole`, `mutate`).
- Create `lib/supabase/client.ts` anon client factories (SSR + browser) embedding session UUID claims.
- Add unit tests verifying RLS boundaries and documenting usage.
- Validation: Enforces least privilege.
- **Critique:** Directly calling Supabase client inline would reduce abstraction but invites key misuse. Conversely, a full repository layer may be overkill. The proposed thin helpers hit the right balance.

**Phase 5 – Conversation Orchestrator Core**
- Build orchestrator to compose prompt/context/goals/history into OpenAI payload.
- Integrate OpenAI streaming via async generator; define `ConversationEvent` types.
- Add transcript fallback logic and dependency injection hooks for testing.
- Validation: Centralises AI behaviour.
- **Critique:** Could rely on Supabase functions or serverless flows to orchestrate, but that would split logic and slow iteration. An in-app module is easier to test. Ensure we don’t over-engineer: keep orchestrator pure functions plus adapters.

**Phase 6 – Config Module (Prompts & Contexts)**
- Implement actions `savePrompt`, `saveContext`, `enqueueMigration` with Zod validation.
- Build `/config` page with server listing, shadcn forms, TanStack Query optimistic updates.
- Add schema migration request UI, logging audit entries.
- Validation: Provides curated prompt management.
- **Critique:** Allowing dynamic migrations introduces risk. Alternative is limiting contexts to JSON config fields instead of new tables. Given requirement for dynamic contexts, queueing controlled migrations is the safest approach—ensure automated review before execution.

**Phase 7 – Interaction Experience & Voice Integration**
- Develop `/interact` route with server data loading and client islands for chat/voice/goals.
- Implement `logTurn` action using orchestrator; stream responses via SSE.
- Create `/api/realtime/token` edge route issuing ephemeral tokens with rate limiting.
- Wire WebRTC client with reconnect strategy and text fallback.
- Validation: Delivers core user experience.
- **Critique:** SSE may not work on all corporate networks; consider fallback to WebSockets via Next.js Route Handlers. For minimal code, SSE is acceptable; document fallback plan if needed. Evaluate using OpenAI client helper libraries for realtime—currently low-level approach is fine for control.

**Phase 8 – Insights, Trends, and Goal Reinforcement**
- Implement `updateGoals` action storing structured goal state and logging to `metrics`.
- Build Supabase Edge Function/cron summarising conversations to `insights` and `trends`, pushing updates via Supabase Realtime.
- Create `/insights` page with streaks, recommendations, optional exports.
- Validation: Drives reflective feedback loop.
- **Critique:** Edge Functions add complexity; we could compute insights on-demand via server actions. However, background jobs keep interaction latency low and allow daily recaps—retain but ensure cron cadence and costs monitored.

**Phase 9 – Observability, QA, and Guardrails**
- Add Vitest unit tests (orchestrator, validators, rate limiter) and Playwright smoke tests (config CRUD, voice handshake, text loop).
- Implement `instrumentation.ts`, integrate Pino logging, expose `/api/health`.
- Configure Supabase alerts, Vercel dashboards, incident runbooks.
- Validation: Ensures reliability.
- **Critique:** Testing could be deferred to post-MVP, but that often creates debt. Ensure tests stay focused (no over-mocking). Consider using Checkly or Vercel cron for external monitoring once traffic grows.

**Phase 10 – Launch, Feedback, and Iteration Loop**
- Prepare Vercel preview/production envs, seed baseline prompts/goals.
- Run UAT covering storage-cleared sessions, device switching, offline reconnection.
- Document auth migration plan and future retention features backlog.
- Build retention dashboards (Supabase metrics + Vercel Analytics) and set weekly review cadence.
- Validation: Structures rollout and feedback loop.
- **Critique:** Could launch earlier without full insights/analytics, but success metric is daily retention—dashboards are essential. Ensure feedback loop includes qualitative user interviews, not just metrics.

# Data Flow
- **Config Creation:** User submits prompt/context -> server action validates -> Supabase write -> optional migration queue -> response. Validation: Ensures contexts consistent before use.
  - **Critique:** Consider allowing draft prompts stored client-side before committing. Current server-first flow enforces quality and audit trails—best for collaboration.
- **Context Consumption:** Interaction page loads prompts/contexts via RLS, caches with `revalidateTag('contexts')`. Validation: Minimises repeated queries.
  - **Critique:** Caching may serve stale data after edits; use revalidation hooks on mutations to avoid user confusion. Acceptable trade-off for latency if invalidations wired correctly.
- **Session Initialisation:** Client ensures UUID -> calls `startSession` -> stores signed JWT + metadata. Validation: Aligns data partitions.
  - **Critique:** If storage cleared mid-session, user loses history context. Mitigation planned in Phase 10; document session recovery pattern early.
- **Text Conversation Loop:** `logTurn` persists user input, orchestrator streams OpenAI response, writes assistant turn. Validation: Maintains authoritative history.
  - **Critique:** SSE streaming must handle backpressure; ensure retry logic. Alternative is using Supabase Realtime for updates but adds complexity. Current approach acceptable; add telemetry on dropped connections.
- **Voice Conversation Loop:** Ephemeral token -> WebRTC -> streaming transcripts -> persistence via orchestrator. Validation: Keeps parity with text flow.
  - **Critique:** WebRTC may face NAT issues; consider TURN server fallback if OpenAI relay insufficient. Monitor early testers to decide if needed.
- **Goal & Insight Update:** `updateGoals` writes goal state, triggers background summary. Validation: Keeps goals aligned.
  - **Critique:** Frequent updates could trigger excessive background runs; add throttling or debounce server-side.
- **Analytics & Retention:** Daily cron computes metrics; Vercel Analytics captures engagement. Validation: Provides feedback loop.
  - **Critique:** Cron jobs require monitoring to ensure they run; consider storing last-run timestamp and alert if stale.

# Routes and API Structure
- **Page Routes:**
  - `/`: Marketing/onboarding with stats and CTA. Validation: Guides new users.
    - **Critique:** Might be overkill for MVP; consider merging into `/interact` with lightweight intro. However, dedicated landing aids storytelling—keep but delay complex components until post-MVP.
  - `/config`: Prompt/context management with shadcn forms, optimistic updates. Validation: Centralises administration.
    - **Critique:** Without auth, config is wide open; temporarily restrict access via environment flag or secret parameter until auth arrives.
  - `/interact`: Main assistant UI with chat, voice controls, goal widgets. Validation: Core daily habit experience.
    - **Critique:** Combine server + client components carefully to avoid hydration issues. Consider skeleton loading states.
  - `/insights`: Reflection dashboard with trends/exports. Validation: Reinforces retention.
    - **Critique:** If insight cron not ready, page should gracefully degrade (e.g., show “Insights coming soon”).
- **API & Actions:**
  - `POST /api/realtime/token`: Issues ephemeral OpenAI tokens with rate limiting. Validation: Protects secrets.
    - **Critique:** Evaluate DDoS risk; add HMAC signature or require session cookie to reduce abuse.
  - `POST /api/context/migration` (Edge Function): Applies controlled schema changes. Validation: Enables safe dynamic contexts.
    - **Critique:** Schema drift risk if migrations fail mid-way; include rollback plan and version tracking.
  - Server actions `savePrompt`, `saveContext`, `startSession`, `logTurn`, `updateGoals`, `recordInsight`. Validation: Collocate mutations with UI.
    - **Critique:** Excessive server actions may complicate error handling; wrap with shared error middleware.
  - Optional webhook `/api/webhooks/openai`: Ingest transcripts when using server relay. Validation: Adds resilience.
    - **Critique:** If not used initially, leave stub disabled to avoid maintenance overhead.
- **Tooling Routes:** `/api/health`, `/api/metrics`. Validation: Simplify monitoring.
  - **Critique:** Health endpoint should avoid leaking secrets; mask internal errors. Metrics endpoint must enforce auth (token header or IP allowlist).
