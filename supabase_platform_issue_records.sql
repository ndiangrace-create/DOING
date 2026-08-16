-- DOING 平台問題中心：保存跨租戶問題的發現、處理與完成紀錄。
create table if not exists public.platform_issue_records (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  issue_type text not null,
  severity text not null default 'warning',
  status text not null default 'open',
  title text not null,
  detail text not null default '',
  tenant_id text not null default '',
  session_id text not null default '',
  registration_id text not null default '',
  source_table text not null default '',
  source_id text not null default '',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text not null default '',
  resolution_note text not null default '',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_issue_records_status_check check (status in ('open','acknowledged','resolved')),
  constraint platform_issue_records_severity_check check (severity in ('critical','warning','notice'))
);

create index if not exists platform_issue_records_status_last_seen_idx
  on public.platform_issue_records(status, last_seen_at desc);
create index if not exists platform_issue_records_tenant_status_idx
  on public.platform_issue_records(tenant_id, status, last_seen_at desc);
create index if not exists platform_issue_records_session_idx
  on public.platform_issue_records(session_id) where session_id <> '';
create index if not exists platform_issue_records_registration_idx
  on public.platform_issue_records(registration_id) where registration_id <> '';

alter table public.platform_issue_records enable row level security;
revoke all on table public.platform_issue_records from anon, authenticated;

comment on table public.platform_issue_records is
  'DOING 平台總管問題中心正式紀錄；只由 Worker service role 與平台總管 API 存取。';
