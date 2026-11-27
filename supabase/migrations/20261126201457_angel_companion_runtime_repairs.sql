-- Safe, additive Angel Companion runtime repair.
-- Applied to the connected production project on 2026-11-26.
-- No user rows are deleted or rewritten.

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
returns table (allowed boolean, remaining integer, reset_at timestamptz)
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
  returning public.companion_api_rate_limits.request_count,
            public.companion_api_rate_limits.window_started_at
  into v_count, v_window_start;

  allowed := v_count <= v_max_requests;
  remaining := greatest(0, v_max_requests - v_count);
  reset_at := v_window_start + v_window;
  return next;
end;
$$;

revoke all on function public.consume_companion_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.consume_companion_rate_limit(text, integer, integer) to authenticated;

create index if not exists companion_messages_conversation_user_idx
  on public.companion_messages(conversation_id, user_id);

update storage.buckets
set public = false,
    file_size_limit = 20971520,
    allowed_mime_types = array[
      'image/png','image/jpeg','image/webp',
      'video/mp4','video/webm',
      'audio/mpeg','audio/wav','audio/webm',
      'application/pdf','text/plain','text/markdown','text/csv','application/json',
      'application/zip','application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/octet-stream'
    ]
where id = 'companion-private';

notify pgrst, 'reload schema';
