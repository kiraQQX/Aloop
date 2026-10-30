-- Aloop — Supabase schema for authenticated users.
--
-- Scope: only what the current product actually needs.
--   1. profiles            — one row per auth user (display name).
--   2. experiment_sessions — a participant's run of an experiment (beLieve first).
--   3. experiment_events   — append-only event log attached to a session.
--
-- Security model: every table has Row Level Security enabled and every policy is
-- scoped to auth.uid(). The browser only ever holds the publishable (anon) key.
--
-- NOTE: the beLieve runtime still persists to localStorage. These tables are the
-- target schema; uploading participant data requires a separate protocol and
-- consent decision and is NOT wired up by this migration.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = id);

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Create the profile row when Supabase Auth creates a user. SECURITY DEFINER is
-- required because the trigger runs inside the auth schema.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- experiment_sessions
-- ---------------------------------------------------------------------------
create table if not exists public.experiment_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  experiment_id text not null,
  arm text check (arm is null or arm in ('A', 'B', 'C')),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  phase text,
  payload jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists experiment_sessions_user_updated_idx
  on public.experiment_sessions (user_id, updated_at desc);

alter table public.experiment_sessions enable row level security;

drop policy if exists "sessions_select_own" on public.experiment_sessions;
create policy "sessions_select_own" on public.experiment_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "sessions_insert_own" on public.experiment_sessions;
create policy "sessions_insert_own" on public.experiment_sessions
  for insert with check (auth.uid() = user_id);

drop policy if exists "sessions_update_own" on public.experiment_sessions;
create policy "sessions_update_own" on public.experiment_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "sessions_delete_own" on public.experiment_sessions;
create policy "sessions_delete_own" on public.experiment_sessions
  for delete using (auth.uid() = user_id);

drop trigger if exists experiment_sessions_touch_updated_at on public.experiment_sessions;
create trigger experiment_sessions_touch_updated_at
  before update on public.experiment_sessions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- experiment_events
-- ---------------------------------------------------------------------------
create table if not exists public.experiment_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.experiment_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists experiment_events_session_created_idx
  on public.experiment_events (session_id, created_at);

create index if not exists experiment_events_user_created_idx
  on public.experiment_events (user_id, created_at);

alter table public.experiment_events enable row level security;

drop policy if exists "events_select_own" on public.experiment_events;
create policy "events_select_own" on public.experiment_events
  for select using (auth.uid() = user_id);

drop policy if exists "events_insert_own" on public.experiment_events;
create policy "events_insert_own" on public.experiment_events
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.experiment_sessions s
      where s.id = experiment_events.session_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "events_delete_own" on public.experiment_events;
create policy "events_delete_own" on public.experiment_events
  for delete using (auth.uid() = user_id);
