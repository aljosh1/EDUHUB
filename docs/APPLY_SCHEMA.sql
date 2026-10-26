-- Paperstack schema
create extension if not exists "pgcrypto";

-- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- documents
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists documents_owner_updated_idx on public.documents (owner_id, updated_at desc);

-- shares
create table if not exists public.document_shares (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  shared_by uuid not null references auth.users(id) on delete cascade,
  shared_with uuid not null references auth.users(id) on delete cascade,
  permission text not null check (permission in ('viewer','editor')),
  created_at timestamptz not null default now(),
  unique (document_id, shared_with),
  check (shared_by <> shared_with)
);
create index if not exists document_shares_recipient_idx on public.document_shares (shared_with);

-- updated_at trigger
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

drop trigger if exists documents_touch_updated_at on public.documents;
create trigger documents_touch_updated_at before update on public.documents
for each row execute function public.touch_updated_at();

-- profile auto-create
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.document_shares enable row level security;

drop policy if exists "profiles readable by authenticated" on public.profiles;
create policy "profiles readable by authenticated" on public.profiles
  for select to authenticated using (true);

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- documents policies
drop policy if exists "owner can read own docs" on public.documents;
create policy "owner can read own docs" on public.documents
  for select to authenticated using (auth.uid() = owner_id);

drop policy if exists "insert own doc" on public.documents;
create policy "insert own doc" on public.documents
  for insert to authenticated with check (auth.uid() = owner_id);

drop policy if exists "owner or editor can update" on public.documents;
create policy "owner or editor can update" on public.documents
  for update to authenticated
  using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.document_shares s
      where s.document_id = id and s.shared_with = auth.uid() and s.permission = 'editor'
    )
  )
  with check (
    auth.uid() = owner_id
    or exists (
      select 1 from public.document_shares s
      where s.document_id = id and s.shared_with = auth.uid() and s.permission = 'editor'
    )
  );

drop policy if exists "owner can delete" on public.documents;
create policy "owner can delete" on public.documents
  for delete to authenticated using (auth.uid() = owner_id);

-- shares policies
drop policy if exists "owner manages shares" on public.document_shares;
create policy "owner manages shares" on public.document_shares
  for all to authenticated
  using (exists (select 1 from public.documents d where d.id = document_id and d.owner_id = auth.uid()))
  with check (
    exists (select 1 from public.documents d where d.id = document_id and d.owner_id = auth.uid())
    and shared_by = auth.uid()
  );

drop policy if exists "recipient can read own share" on public.document_shares;
create policy "recipient can read own share" on public.document_shares
  for select to authenticated using (shared_with = auth.uid() or shared_by = auth.uid());

drop policy if exists "shared docs readable" on public.documents;
create policy "shared docs readable" on public.documents
  for select to authenticated using (
    exists (
      select 1 from public.document_shares s
      where s.document_id = id and s.shared_with = auth.uid()
    )
  );

-- Secure email → user lookup for the share flow (server-only, via anon-key client with RLS).
-- Only authenticated users may call it, and it only reveals an exact email match.
create or replace function public.get_user_id_by_email(target_email text)
returns table (id uuid, email text, display_name text)
language sql security definer stable set search_path = public as $$
  select u.id,
         u.email,
         (select p.display_name from public.profiles p where p.id = u.id)
  from auth.users u
  where lower(u.email) = lower(target_email)
  limit 1;
$$;

revoke all on function public.get_user_id_by_email(text) from public, anon;
grant execute on function public.get_user_id_by_email(text) to authenticated;

-- Keep the PostgREST schema cache in sync after creating tables via SQL editor.
notify pgrst, 'reload schema';

-- Test users are NOT created here (auth.users is managed by Supabase Auth).
-- After applying this migration, use one of:
--   1. the Sign up form in the app, or
--   2. Supabase Dashboard -> Authentication -> Add user
-- Create two: user-a@paperstack.test and user-b@paperstack.test
-- See README.md -> Reviewer access.
