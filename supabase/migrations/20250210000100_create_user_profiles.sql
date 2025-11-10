-- User profiles store per-account metadata and link Supabase users to session UUIDs
create table if not exists public.user_profiles (
  user_id uuid primary key,
  session_uuid uuid references public.sessions(session_uuid) on delete set null,
  interaction_file text not null,
  profile_data jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_user_profiles_updated_at
  before update on public.user_profiles
  for each row
  execute function public.set_updated_at();

alter table public.user_profiles enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_profiles'
      and policyname = 'select own profile'
  ) then
    create policy "select own profile"
      on public.user_profiles
      for select
      using (
        auth.role() = 'service_role'
        or auth.uid() = user_id
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
      and tablename = 'user_profiles'
      and policyname = 'upsert own profile'
  ) then
    create policy "upsert own profile"
      on public.user_profiles
      for insert
      with check (
        auth.role() = 'service_role'
        or auth.uid() = user_id
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
      and tablename = 'user_profiles'
      and policyname = 'update own profile'
  ) then
    create policy "update own profile"
      on public.user_profiles
      for update
      using (
        auth.role() = 'service_role'
        or auth.uid() = user_id
      )
      with check (
        auth.role() = 'service_role'
        or auth.uid() = user_id
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
      and tablename = 'user_profiles'
      and policyname = 'service role manage profiles'
  ) then
    create policy "service role manage profiles"
      on public.user_profiles
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end;
$$;
