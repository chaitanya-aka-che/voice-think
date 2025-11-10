# Supabase Setup (Phase 2)

## CLI & Project Linking
1. Install the Supabase CLI if not already available:
   ```bash
   pnpm dlx supabase@latest --help
   ```
2. Authenticate the CLI with your Supabase account:
   ```bash
   pnpm dlx supabase@latest login
   ```
3. Link this repository to a remote project once created in the Supabase dashboard:
   ```bash
   pnpm dlx supabase@latest link --project-ref <your-project-ref>
   ```
   - The generated access token will be stored under `~/.supabase/config.toml`.
   - Linking enables `supabase db push` and `supabase db diff` against the remote instance.

## Local Database
- `supabase init` has created `supabase/config.toml`, pointing to the default local ports (54321–54324).
- Start the local stack when you need to test migrations or Edge functions:
  ```bash
  pnpm dlx supabase@latest start
  ```
- Apply the migrations and seed data locally:
  ```bash
  pnpm dlx supabase@latest db reset --debug
  # or, if the stack is already running
  pnpm dlx supabase@latest db push
  pnpm dlx supabase@latest db seed
  ```

## Environment Variables (used in later phases)
These will be consumed by `lib/env.ts` in Phase 3 but are documented now so the remote project can be configured in advance.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project REST URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anonymous key for client reads under RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side key used by Next.js server actions. Store only in server runtime. |
| `SUPABASE_JWT_SECRET` | Pulled from Supabase Settings → API; required for verifying JWTs locally. |
| `SUPABASE_DB_PASSWORD` | Database password if connecting directly (optional for this app). |
| `SUPABASE_PROJECT_REF` | Project reference ID used by the CLI and automation. |
| `OPENAI_API_KEY` | Credential for text/voice orchestration. |
| `OPENAI_REALTIME_MODEL` | Optional override for realtime/WebRTC flows. |
| `OPENAI_CHAT_MODEL` | Model used for text conversation orchestration (defaults to `gpt-4o-mini`). |

## Data Model Overview
- Migrations are stored in `supabase/migrations/` and can be diffed with `supabase migration new <name>` as the schema evolves.
- Sample seeds live in `supabase/seed.sql` to pre-populate prompts and contexts for local smoke testing.
- Row Level Security (RLS) policies assume JWTs include a `session_uuid` claim; the server action that issues signed tokens must satisfy this requirement.

## Runtime Clients
- Copy `.env.example` to `.env.local` (or the environment-specific file) and fill in the values before running the app.
- Server-side helpers live in `src/lib/supabase/server.ts` and provide both service-role and anon clients with sessions disabled by default.
- Browser components should import `getBrowserClient` from `src/lib/supabase/client.ts` to reuse a single cached anon client under RLS.
- Regenerate types with `pnpm dlx supabase@latest gen types typescript --project-id <ref> --schema public --schema storage --schema auth > src/lib/supabase/types.ts` whenever the database schema changes.
