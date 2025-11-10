-- Enable required extensions
create extension if not exists "pgcrypto" with schema public;
create extension if not exists "uuid-ossp" with schema public;
create extension if not exists "citext" with schema public;

-- Utility function to expose the current session UUID from JWT claims
create or replace function public.current_session_uuid()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'session_uuid', '')::uuid;
$$;

grant execute on function public.current_session_uuid() to public;

-- Generic trigger to maintain updated_at columns
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Sessions represent anonymous device/browser identities
create table if not exists public.sessions (
  session_uuid uuid primary key default gen_random_uuid(),
  label text,
  created_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists sessions_last_seen_idx on public.sessions (last_seen_at desc);

alter table public.sessions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'sessions'
      and policyname = 'select own sessions'
  ) then
    create policy "select own sessions"
      on public.sessions
      for select
      using (
        auth.role() = 'service_role'
        or (
          public.current_session_uuid() is not null
          and session_uuid = public.current_session_uuid()
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'sessions'
      and policyname = 'service role manage sessions'
  ) then
    create policy "service role manage sessions"
      on public.sessions
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end;
$$;

-- Prompt catalog (can be global or session-scoped)
create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  owner_session_uuid uuid references public.sessions(session_uuid) on delete cascade,
  name text not null,
  description text,
  system_prompt text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists prompts_owner_idx on public.prompts (owner_session_uuid);

create trigger set_prompts_updated_at
  before update on public.prompts
  for each row
  execute function public.set_updated_at();

alter table public.prompts enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'prompts'
      and policyname = 'public read prompts'
  ) then
    create policy "public read prompts"
      on public.prompts
      for select
      using (true);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'prompts'
      and policyname = 'service role manage prompts'
  ) then
    create policy "service role manage prompts"
      on public.prompts
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end;
$$;

-- Prompt contexts extend prompts with selectable data payloads
create table if not exists public.prompt_contexts (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  name text not null,
  description text,
  context_payload jsonb not null default '{}'::jsonb,
  aux_schema_required boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists prompt_contexts_prompt_idx on public.prompt_contexts (prompt_id);

create trigger set_prompt_contexts_updated_at
  before update on public.prompt_contexts
  for each row
  execute function public.set_updated_at();

alter table public.prompt_contexts enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'prompt_contexts'
      and policyname = 'public read prompt contexts'
  ) then
    create policy "public read prompt contexts"
      on public.prompt_contexts
      for select
      using (true);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'prompt_contexts'
      and policyname = 'service role manage prompt contexts'
  ) then
    create policy "service role manage prompt contexts"
      on public.prompt_contexts
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end;
$$;

-- Metadata for auxiliary tables requested by contexts
create table if not exists public.context_aux_tables (
  id uuid primary key default gen_random_uuid(),
  prompt_context_id uuid not null references public.prompt_contexts(id) on delete cascade,
  table_name citext not null,
  ddl text not null,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.sessions(session_uuid)
);

create unique index if not exists context_aux_tables_name_idx on public.context_aux_tables (table_name);

alter table public.context_aux_tables enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'context_aux_tables'
      and policyname = 'service role manage aux tables'
  ) then
    create policy "service role manage aux tables"
      on public.context_aux_tables
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'context_aux_tables'
      and policyname = 'public read aux metadata'
  ) then
    create policy "public read aux metadata"
      on public.context_aux_tables
      for select
      using (true);
  end if;
end;
$$;

-- Conversations and turns capture interaction history per session
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  session_uuid uuid not null references public.sessions(session_uuid) on delete cascade,
  prompt_id uuid references public.prompts(id) on delete set null,
  title text,
  status text not null default 'active' check (status in ('active', 'archived', 'completed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists conversations_session_idx on public.conversations (session_uuid);
create index if not exists conversations_created_idx on public.conversations (created_at desc);

create trigger set_conversations_updated_at
  before update on public.conversations
  for each row
  execute function public.set_updated_at();

alter table public.conversations enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'conversations'
      and policyname = 'select conversations by session'
  ) then
    create policy "select conversations by session"
      on public.conversations
      for select
      using (
        auth.role() = 'service_role'
        or (
          public.current_session_uuid() is not null
          and session_uuid = public.current_session_uuid()
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'conversations'
      and policyname = 'service role manage conversations'
  ) then
    create policy "service role manage conversations"
      on public.conversations
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end;
$$;

create table if not exists public.conversation_turns (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  session_uuid uuid not null references public.sessions(session_uuid) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null default '',
  content_tokens jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists conversation_turns_conversation_idx on public.conversation_turns (conversation_id, created_at);
create index if not exists conversation_turns_session_idx on public.conversation_turns (session_uuid);

alter table public.conversation_turns enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'conversation_turns'
      and policyname = 'select turns by session'
  ) then
    create policy "select turns by session"
      on public.conversation_turns
      for select
      using (
        auth.role() = 'service_role'
        or (
          public.current_session_uuid() is not null
          and session_uuid = public.current_session_uuid()
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'conversation_turns'
      and policyname = 'service role manage turns'
  ) then
    create policy "service role manage turns"
      on public.conversation_turns
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end;
$$;

-- Goal tracking per session
create table if not exists public.user_goals (
  id uuid primary key default gen_random_uuid(),
  session_uuid uuid not null references public.sessions(session_uuid) on delete cascade,
  title text not null,
  description text,
  goal_state jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  target_date date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists user_goals_session_idx on public.user_goals (session_uuid, status);

create trigger set_user_goals_updated_at
  before update on public.user_goals
  for each row
  execute function public.set_updated_at();

alter table public.user_goals enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_goals'
      and policyname = 'select goals by session'
  ) then
    create policy "select goals by session"
      on public.user_goals
      for select
      using (
        auth.role() = 'service_role'
        or (
          public.current_session_uuid() is not null
          and session_uuid = public.current_session_uuid()
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_goals'
      and policyname = 'service role manage goals'
  ) then
    create policy "service role manage goals"
      on public.user_goals
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end;
$$;

-- Insights derived from conversations/goals
create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  session_uuid uuid not null references public.sessions(session_uuid) on delete cascade,
  goal_id uuid references public.user_goals(id) on delete set null,
  insight_type text,
  headline text not null,
  details text,
  data jsonb not null default '{}'::jsonb,
  summary_window tstzrange,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists insights_session_idx on public.insights (session_uuid, created_at desc);

alter table public.insights enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'insights'
      and policyname = 'select insights by session'
  ) then
    create policy "select insights by session"
      on public.insights
      for select
      using (
        auth.role() = 'service_role'
        or (
          public.current_session_uuid() is not null
          and session_uuid = public.current_session_uuid()
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'insights'
      and policyname = 'service role manage insights'
  ) then
    create policy "service role manage insights"
      on public.insights
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end;
$$;

-- Trends capture aggregated metrics for reflection
create table if not exists public.trends (
  id uuid primary key default gen_random_uuid(),
  session_uuid uuid not null references public.sessions(session_uuid) on delete cascade,
  metric_key text not null,
  metric_payload jsonb not null default '{}'::jsonb,
  summary_window tstzrange,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists trends_unique_metric_idx on public.trends (session_uuid, metric_key);

alter table public.trends enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'trends'
      and policyname = 'select trends by session'
  ) then
    create policy "select trends by session"
      on public.trends
      for select
      using (
        auth.role() = 'service_role'
        or (
          public.current_session_uuid() is not null
          and session_uuid = public.current_session_uuid()
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'trends'
      and policyname = 'service role manage trends'
  ) then
    create policy "service role manage trends"
      on public.trends
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end;
$$;

-- Metrics table for granular analytics
create table if not exists public.metrics (
  id uuid primary key default gen_random_uuid(),
  session_uuid uuid not null references public.sessions(session_uuid) on delete cascade,
  metric_key text not null,
  metric_value jsonb not null,
  captured_at timestamptz not null default timezone('utc', now())
);

create index if not exists metrics_session_idx on public.metrics (session_uuid, metric_key, captured_at desc);

alter table public.metrics enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'metrics'
      and policyname = 'select metrics by session'
  ) then
    create policy "select metrics by session"
      on public.metrics
      for select
      using (
        auth.role() = 'service_role'
        or (
          public.current_session_uuid() is not null
          and session_uuid = public.current_session_uuid()
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'metrics'
      and policyname = 'service role manage metrics'
  ) then
    create policy "service role manage metrics"
      on public.metrics
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end;
$$;
