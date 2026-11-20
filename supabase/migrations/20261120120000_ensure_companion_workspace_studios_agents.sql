-- Forward-only idempotent verification & creation migration for Angel Companion
-- Workspace Projects, Studios State, Agent Executions, and supporting indexes/policies.
-- Safe to apply regardless of whether 20261113120000 was previously run partially or skipped.

-- Ensure core table client_id columns exist even if foundation ordering varied
alter table if exists public.companion_conversations add column if not exists client_id text;
alter table if exists public.companion_messages add column if not exists client_id text;
alter table if exists public.companion_memories add column if not exists client_id text;
alter table if exists public.companion_library_items add column if not exists client_id text;

create unique index if not exists companion_conversations_user_client_uidx
  on public.companion_conversations(user_id, client_id)
  where client_id is not null;
create unique index if not exists companion_messages_user_client_uidx
  on public.companion_messages(user_id, client_id)
  where client_id is not null;
create unique index if not exists companion_memories_user_client_uidx
  on public.companion_memories(user_id, client_id)
  where client_id is not null;
create unique index if not exists companion_library_items_user_client_uidx
  on public.companion_library_items(user_id, client_id)
  where client_id is not null;

-- 1. public.companion_projects
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

-- 2. public.companion_studios_state
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

-- 3. public.companion_agent_executions
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

-- Refresh PostgREST schema cache immediately after DDL changes
notify pgrst, 'reload schema';
