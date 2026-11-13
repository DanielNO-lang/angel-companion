-- Angel Companion isolated data foundation.
-- Safe to coexist with the legacy Angel tables: every application table and
-- storage bucket created here has a companion-specific name.

create table if not exists public.companion_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companion_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.companion_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (conversation_id, user_id)
    references public.companion_conversations(id, user_id) on delete cascade
);

create table if not exists public.companion_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_type text not null default 'general',
  content text not null,
  importance smallint not null default 3 check (importance between 1 and 5),
  source_conversation_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companion_library_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  item_type text not null default 'file',
  description text,
  storage_path text,
  content_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companion_conversations_user_updated_idx
  on public.companion_conversations(user_id, updated_at desc);
create index if not exists companion_messages_conversation_created_idx
  on public.companion_messages(conversation_id, created_at);
create index if not exists companion_memories_user_updated_idx
  on public.companion_memories(user_id, updated_at desc);
create index if not exists companion_library_user_created_idx
  on public.companion_library_items(user_id, created_at desc);

alter table public.companion_profiles enable row level security;
alter table public.companion_conversations enable row level security;
alter table public.companion_messages enable row level security;
alter table public.companion_memories enable row level security;
alter table public.companion_library_items enable row level security;

grant select, insert, update, delete on public.companion_profiles to authenticated;
grant select, insert, update, delete on public.companion_conversations to authenticated;
grant select, insert, update, delete on public.companion_messages to authenticated;
grant select, insert, update, delete on public.companion_memories to authenticated;
grant select, insert, update, delete on public.companion_library_items to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='companion_profiles' and policyname='companion_profiles_owner') then
    create policy companion_profiles_owner on public.companion_profiles for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='companion_conversations' and policyname='companion_conversations_owner') then
    create policy companion_conversations_owner on public.companion_conversations for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='companion_messages' and policyname='companion_messages_owner') then
    create policy companion_messages_owner on public.companion_messages for all to authenticated
      using (user_id = (select auth.uid()) and exists (
        select 1 from public.companion_conversations c where c.id = conversation_id and c.user_id = (select auth.uid())
      ))
      with check (user_id = (select auth.uid()) and exists (
        select 1 from public.companion_conversations c where c.id = conversation_id and c.user_id = (select auth.uid())
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='companion_memories' and policyname='companion_memories_owner') then
    create policy companion_memories_owner on public.companion_memories for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='companion_library_items' and policyname='companion_library_owner') then
    create policy companion_library_owner on public.companion_library_items for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('companion-private', 'companion-private', false, 20971520,
  array['image/png','image/jpeg','image/webp','video/mp4','application/pdf'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='companion_storage_select_own') then
    create policy companion_storage_select_own on storage.objects for select to authenticated
      using (bucket_id='companion-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='companion_storage_insert_own') then
    create policy companion_storage_insert_own on storage.objects for insert to authenticated
      with check (bucket_id='companion-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='companion_storage_update_own') then
    create policy companion_storage_update_own on storage.objects for update to authenticated
      using (bucket_id='companion-private' and (storage.foldername(name))[1]=(select auth.uid())::text)
      with check (bucket_id='companion-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='companion_storage_delete_own') then
    create policy companion_storage_delete_own on storage.objects for delete to authenticated
      using (bucket_id='companion-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
  end if;
end $$;
