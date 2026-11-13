-- Stable client identifiers allow the browser's existing conversation IDs to map to UUID-backed cloud rows.
alter table public.companion_conversations add column if not exists client_id text;
alter table public.companion_messages add column if not exists client_id text;
create unique index if not exists companion_conversations_user_client_uidx
  on public.companion_conversations(user_id, client_id);
create unique index if not exists companion_messages_user_client_uidx
  on public.companion_messages(user_id, client_id);
