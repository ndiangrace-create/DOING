begin;

create table if not exists public.doing_public_support_threads (
  id uuid primary key default gen_random_uuid(),
  member_id text not null references public.platform_members(id) on delete cascade,
  category text not null default 'platform_user' check (category in ('platform_user','applicant','system_request')),
  subject text not null default 'DOING 使用問題',
  status text not null default 'open' check (status in ('open','closed')),
  created_by_email text not null default '',
  platform_unread_count integer not null default 0,
  member_unread_count integer not null default 0,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.doing_public_support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.doing_public_support_threads(id) on delete cascade,
  member_id text not null references public.platform_members(id) on delete cascade,
  sender_scope text not null check (sender_scope in ('member','platform')),
  sender_email text not null default '',
  body text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists doing_public_support_threads_member_idx on public.doing_public_support_threads(member_id,last_message_at desc);
create index if not exists doing_public_support_messages_thread_idx on public.doing_public_support_messages(thread_id,created_at);
create index if not exists doing_public_support_messages_member_idx on public.doing_public_support_messages(member_id,created_at desc);

alter table public.doing_public_support_threads enable row level security;
alter table public.doing_public_support_messages enable row level security;
revoke all on table public.doing_public_support_threads from public, anon, authenticated, service_role;
revoke all on table public.doing_public_support_messages from public, anon, authenticated, service_role;
grant select, insert, update on table public.doing_public_support_threads to service_role;
grant select, insert on table public.doing_public_support_messages to service_role;

comment on table public.doing_public_support_threads is 'DOING 平台操作、營運申請或系統需求轉真人客服的案件；個別活動客服不進入此表。';
comment on table public.doing_public_support_messages is 'DOING 民眾與平台真人客服的訊息；未登入對話不寫入。';

commit;
