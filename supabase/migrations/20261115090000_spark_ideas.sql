-- Spark (瞬间) — Idea Capsules.
--
-- Scope: persistence of ideas a signed-in user chooses to sync. Nothing here
-- stores raw EEG, audio recordings, or training data; Spark only persists the
-- text/metadata the user submits and (optionally) one generated preview image.
--
-- Security model: RLS on every object, every policy scoped to auth.uid(). The
-- browser only holds the publishable key. Depends on public.touch_updated_at()
-- from 20261031090000_init_profiles_and_sessions.sql.

create table if not exists public.spark_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 200),
  raw_input text not null default '' check (char_length(raw_input) <= 20000),
  input_mode text not null default 'mixed'
    check (input_mode in ('imagery', 'voice', 'fragments', 'image', 'mixed')),
  sensory_profile jsonb not null default '{}'::jsonb,
  visual_description text not null default '' check (char_length(visual_description) <= 4000),
  generation_prompt text not null default '' check (char_length(generation_prompt) <= 8000),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  asset_path text check (asset_path is null or char_length(asset_path) <= 300),
  result_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists spark_ideas_user_updated_idx
  on public.spark_ideas (user_id, updated_at desc);

alter table public.spark_ideas enable row level security;

drop policy if exists "spark_ideas_select_own" on public.spark_ideas;
create policy "spark_ideas_select_own" on public.spark_ideas
  for select using (auth.uid() = user_id);

drop policy if exists "spark_ideas_insert_own" on public.spark_ideas;
create policy "spark_ideas_insert_own" on public.spark_ideas
  for insert with check (auth.uid() = user_id);

drop policy if exists "spark_ideas_update_own" on public.spark_ideas;
create policy "spark_ideas_update_own" on public.spark_ideas
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "spark_ideas_delete_own" on public.spark_ideas;
create policy "spark_ideas_delete_own" on public.spark_ideas
  for delete using (auth.uid() = user_id);

drop trigger if exists spark_ideas_touch_updated_at on public.spark_ideas;
create trigger spark_ideas_touch_updated_at
  before update on public.spark_ideas
  for each row execute function public.touch_updated_at();

-- Private bucket for generated previews. Object paths are "<user id>/<idea id>.<ext>"
-- so the first folder segment identifies the owner.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('spark-assets', 'spark-assets', false, 5242880,
        array['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "spark_assets_select_own" on storage.objects;
create policy "spark_assets_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'spark-assets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "spark_assets_insert_own" on storage.objects;
create policy "spark_assets_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'spark-assets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "spark_assets_update_own" on storage.objects;
create policy "spark_assets_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'spark-assets' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'spark-assets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "spark_assets_delete_own" on storage.objects;
create policy "spark_assets_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'spark-assets' and (storage.foldername(name))[1] = auth.uid()::text);
