-- DOING Core：Market App 三個正式接口。
-- 只新增 Core 能力；不建立第二套會員、報名、通知或計費資料。

create table if not exists public.mobile_auth_exchanges (
  id text primary key,
  code_hash text not null unique,
  platform_member_id text not null references public.platform_members(id) on delete cascade,
  provider text not null check (provider in ('line')),
  code_challenge text not null,
  device_id text not null,
  app_state text not null default '',
  expires_at timestamptz not null,
  used_at timestamptz null,
  created_at timestamptz not null default now()
);
create index if not exists mobile_auth_exchanges_expiry_idx
  on public.mobile_auth_exchanges(expires_at) where used_at is null;

create table if not exists public.mobile_push_devices (
  id text primary key,
  platform_member_id text not null references public.platform_members(id) on delete cascade,
  installation_id text not null,
  app_id text not null default 'doing_market',
  platform text not null check (platform in ('ios','android')),
  provider text not null check (provider in ('apns','fcm')),
  push_token text not null,
  token_hash text not null,
  environment text not null default 'production' check (environment in ('sandbox','production')),
  locale text not null default 'zh-TW',
  timezone text not null default 'Asia/Taipei',
  permission_status text not null default 'authorized' check (permission_status in ('authorized','provisional')),
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform_member_id,installation_id,provider)
);
create index if not exists mobile_push_devices_token_idx on public.mobile_push_devices(provider,token_hash);
create index if not exists mobile_push_devices_member_active_idx on public.mobile_push_devices(platform_member_id,active);

create table if not exists public.mobile_push_deliveries (
  id text primary key,
  notification_id text not null references public.notifications(id) on delete cascade,
  tenant_id text not null references public.tenants(id) on delete cascade,
  platform_member_id text not null references public.platform_members(id) on delete cascade,
  device_id text not null references public.mobile_push_devices(id) on delete cascade,
  provider text not null check (provider in ('apns','fcm')),
  platform text not null check (platform in ('ios','android')),
  status text not null default 'queued' check (status in ('queued','sent','failed','cancelled')),
  payload_json jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id,device_id)
);
create index if not exists mobile_push_deliveries_queue_idx on public.mobile_push_deliveries(status,next_attempt_at);

alter table public.mobile_auth_exchanges enable row level security;
alter table public.mobile_push_devices enable row level security;
alter table public.mobile_push_deliveries enable row level security;

revoke all on table public.mobile_auth_exchanges,public.mobile_push_devices,public.mobile_push_deliveries from public,anon,authenticated;
grant select,insert,update,delete on table public.mobile_auth_exchanges,public.mobile_push_devices,public.mobile_push_deliveries to service_role;

comment on table public.mobile_auth_exchanges is 'LINE 原生 App 一次性登入交換；只存交換碼雜湊，不保存 member_token。';
comment on table public.mobile_push_devices is '會員自行登錄與撤銷的 DOING Market App 推播裝置；只允許 Worker 服務角色存取。';
comment on table public.mobile_push_deliveries is '沿用 notifications 的行動推播投遞紀錄與重試狀態。';
