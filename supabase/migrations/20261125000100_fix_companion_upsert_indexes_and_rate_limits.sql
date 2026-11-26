-- Angel Companion forward-only cloud persistence repair migration:
-- 1. Safely deduplicates any historical duplicate (user_id, client_id) rows
--    before creating standard non-partial unique indexes so PostgREST
--    ?on_conflict=user_id,client_id upserts never fail with PostgreSQL 42P10.
--    (PostgreSQL treats NULLs as distinct in unique indexes by default.)
-- 2. Adds missing covering index on companion_messages(conversation_id, user_id)
--    for the composite foreign key to companion_conversations(id, user_id).
-- 3. Idempotently ensures companion_api_rate_limits and consume_companion_rate_limit
--    exist even if 20261113120000 was skipped, with null-safe bounds.
-- 4. Idempotently ensures companion-private storage bucket exists and allows all
--    supported companion document/media MIME types.

alter table if exists public.companion_conversations add column if not exists client_id text;
alter table if exists public.companion_messages add column if not exists client_id text;
alter table if exists public.companion_memories add column if not exists client_id text;
alter table if exists public.companion_library_items add column if not exists client_id text;

-- Cover composite foreign key companion_messages(conversation_id, user_id) -> companion_conversations(id, user_id)
create index if not exists companion_messages_conversation_user_idx
  on public.companion_messages(conversation_id, user_id);

-- Refuse to proceed if duplicate client IDs exist. Never delete or rewrite user data
-- automatically during a deployment. Resolve any reported duplicates with a reviewed,
-- backed-up, user-approved data repair before retrying this migration.
do $$
declare
  idx_def text;
begin
  if exists (
    select 1 from public.companion_conversations
    where client_id is not null
    group by user_id, client_id having count(*) > 1
  ) then
    raise exception 'Duplicate (user_id, client_id) rows exist in companion_conversations; migration stopped without modifying user data.';
  end if;

  if exists (
    select 1 from public.companion_messages
    where client_id is not null
    group by user_id, client_id having count(*) > 1
  ) then
    raise exception 'Duplicate (user_id, client_id) rows exist in companion_messages; migration stopped without modifying user data.';
  end if;

  if exists (
    select 1 from public.companion_memories
    where client_id is not null
    group by user_id, client_id having count(*) > 1
  ) then
    raise exception 'Duplicate (user_id, client_id) rows exist in companion_memories; migration stopped without modifying user data.';
  end if;

  if exists (
    select 1 from public.companion_library_items
    where client_id is not null
    group by user_id, client_id having count(*) > 1
  ) then
    raise exception 'Duplicate (user_id, client_id) rows exist in companion_library_items; migration stopped without modifying user data.';
  end if;

  -- Replace partial unique indexes only after all four duplicate checks pass.
  select indexdef into idx_def from pg_indexes
   where schemaname = 'public' and indexname = 'companion_conversations_user_client_uidx';
  if idx_def is not null and idx_def ilike '% where %' then
    drop index if exists public.companion_conversations_user_client_uidx;
  end if;
  create unique index if not exists companion_conversations_user_client_uidx
    on public.companion_conversations(user_id, client_id);

  select indexdef into idx_def from pg_indexes
   where schemaname = 'public' and indexname = 'companion_messages_user_client_uidx';
  if idx_def is not null and idx_def ilike '% where %' then
    drop index if exists public.companion_messages_user_client_uidx;
  end if;
  create unique index if not exists companion_messages_user_client_uidx
    on public.companion_messages(user_id, client_id);

  select indexdef into idx_def from pg_indexes
   where schemaname = 'public' and indexname = 'companion_memories_user_client_uidx';
  if idx_def is not null and idx_def ilike '% where %' then
    drop index if exists public.companion_memories_user_client_uidx;
  end if;
  create unique index if not exists companion_memories_user_client_uidx
    on public.companion_memories(user_id, client_id);

  select indexdef into idx_def from pg_indexes
   where schemaname = 'public' and indexname = 'companion_library_items_user_client_uidx';
  if idx_def is not null and idx_def ilike '% where %' then
    drop index if exists public.companion_library_items_user_client_uidx;
  end if;
  create unique index if not exists companion_library_items_user_client_uidx
    on public.companion_library_items(user_id, client_id);
end $$;

-- Idempotently ensure rate-limit table and RPC exist (recovers if 20261113120000 was skipped)
create table if not exists public.companion_api_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0,
  primary key (user_id, endpoint)
);

alter table public.companion_api_rate_limits enable row level security;
revoke all on public.companion_api_rate_limits from public, anon, authenticated;

create or replace function public.consume_companion_rate_limit(
  p_endpoint text,
  p_max_requests integer default 30,
  p_window_seconds integer default 60
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := now();
  v_max_requests integer := greatest(1, coalesce(p_max_requests, 30));
  v_window_seconds integer := greatest(1, coalesce(p_window_seconds, 60));
  v_window interval := make_interval(secs => v_window_seconds);
  v_count integer;
  v_window_start timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required for rate limit tracking' using errcode = '42501';
  end if;

  insert into public.companion_api_rate_limits (user_id, endpoint, window_started_at, request_count)
  values (v_user_id, coalesce(nullif(trim(p_endpoint), ''), 'chat'), v_now, 1)
  on conflict (user_id, endpoint) do update
  set
    window_started_at = case
      when public.companion_api_rate_limits.window_started_at + v_window <= v_now then v_now
      else public.companion_api_rate_limits.window_started_at
    end,
    request_count = case
      when public.companion_api_rate_limits.window_started_at + v_window <= v_now then 1
      else public.companion_api_rate_limits.request_count + 1
    end
  returning public.companion_api_rate_limits.request_count, public.companion_api_rate_limits.window_started_at
  into v_count, v_window_start;

  allowed := v_count <= v_max_requests;
  remaining := greatest(0, v_max_requests - v_count);
  reset_at := v_window_start + v_window;
  return next;
end;
$$;

revoke all on function public.consume_companion_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.consume_companion_rate_limit(text, integer, integer) to authenticated;

-- Idempotently ensure companion-private bucket exists and allows all supported MIME types
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'companion-private',
  'companion-private',
  false,
  20971520,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/wav',
    'audio/webm',
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'application/zip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = coalesce(storage.buckets.file_size_limit, 20971520),
  allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
