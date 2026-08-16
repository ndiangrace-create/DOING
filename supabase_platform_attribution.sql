-- DOING 平台曝光／點擊／報名歸因
-- 正式資料只經 tobeloved-api 的 service role 寫入；瀏覽器不可直連此表。

create table if not exists public.platform_attribution_events (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  session_id text not null references public.sessions(id) on delete cascade,
  exposure_order_id text references public.exposure_orders(id) on delete set null,
  registration_id text references public.registrations(id) on delete set null,
  attribution_id text not null,
  event_type text not null check (event_type in ('impression','click','registration')),
  source text not null check (source in ('paid_exposure','global_discovery')),
  page_path text not null default '/',
  idempotency_key text not null unique,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists platform_attribution_events_tenant_time_idx
  on public.platform_attribution_events (tenant_id, occurred_at desc);
create index if not exists platform_attribution_events_session_time_idx
  on public.platform_attribution_events (session_id, occurred_at desc);
create index if not exists platform_attribution_events_order_time_idx
  on public.platform_attribution_events (exposure_order_id, occurred_at desc)
  where exposure_order_id is not null;
create index if not exists platform_attribution_events_type_time_idx
  on public.platform_attribution_events (event_type, occurred_at desc);

alter table public.platform_attribution_events enable row level security;
revoke all on table public.platform_attribution_events from anon, authenticated;
grant select, insert, update, delete on table public.platform_attribution_events to service_role;

comment on table public.platform_attribution_events is
  'DOING 平台活動曝光、點擊與完成報名的匿名歸因事件；不保存 Email、手機、IP 或 User-Agent。';
