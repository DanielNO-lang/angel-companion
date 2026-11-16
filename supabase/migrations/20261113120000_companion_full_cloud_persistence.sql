-- Angel Companion Phase 2 Foundation Completion:
-- Forward-only schema expansion for full user-owned cloud persistence,
-- idempotent local-to-cloud migration, private Storage MIME coverage,
-- and user-scoped rate limiting without requiring service-role keys in functions.

-- 1. Add stable client_id columns + unique owner indexes on existing companion tables
alter table public.companion_memories add column if not exists client_id text;
create unique index if not exists companion_memories_user_client_uidx
  on public.companion_memories(user_id, client_id)
  where client_id is not null;

alter table public.companion_library_items add column if not exists client_id text;
create unique index if not exists companion_library_items_user_client_uidx
  on public.companion_library_items(user_id, client_id)
  where client_id is not null;

-- 2. User-owned Workspace Projects & Files
create table if not exists public.companion_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  name text not null,
  description text not null default '',
  studio_id text,
  files jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

create index if not exists companion_projects_user_updated_idx
  on public.companion_projects(user_id, updated_at desc);

alter table public.companion_projects enable row level security;
grant select, insert, update, delete on public.companion_projects to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'companion_projects' and policyname = 'companion_projects_owner'
  ) then
    create policy companion_projects_owner on public.companion_projects
      for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end $$;

-- 3. User-owned Studios State
create table if not exists public.companion_studios_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  studio_id text not null,
  active_tool text not null,
  canvas_buffer text not null default '',
  history jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, studio_id)
);

create index if not exists companion_studios_state_user_updated_idx
  on public.companion_studios_state(user_id, updated_at desc);

alter table public.companion_studios_state enable row level security;
grant select, insert, update, delete on public.companion_studios_state to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'companion_studios_state' and policyname = 'companion_studios_state_owner'
  ) then
    create policy companion_studios_state_owner on public.companion_studios_state
      for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end $$;

-- 4. User-owned Agent Execution History & Definitions State
create table if not exists public.companion_agent_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  agent_id text not null,
  task_description text not null,
  status text not null check (status in ('completed', 'failed', 'blocked', 'cancelled')),
  result jsonb,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, client_id)
);

create index if not exists companion_agent_executions_user_started_idx
  on public.companion_agent_executions(user_id, started_at desc);

alter table public.companion_agent_executions enable row level security;
grant select, insert, update, delete on public.companion_agent_executions to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'companion_agent_executions' and policyname = 'companion_agent_executions_owner'
  ) then
    create policy companion_agent_executions_owner on public.companion_agent_executions
      for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end $$;

-- 5. Rate-limiting state & atomic RPC (uses auth.uid(), never caller-supplied user_id)
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
  v_window interval := make_interval(secs => greatest(1, p_window_seconds));
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

  allowed := v_count <= greatest(1, p_max_requests);
  remaining := greatest(0, greatest(1, p_max_requests) - v_count);
  reset_at := v_window_start + v_window;
  return next;
end;
$$;

revoke all on function public.consume_companion_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.consume_companion_rate_limit(text, integer, integer) to authenticated;

-- 6. Expand private companion storage bucket allowed MIME types for Library & Composer attachments
update storage.buckets
set allowed_mime_types = array[
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
where id = 'companion-private';
