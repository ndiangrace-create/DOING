-- DOING 通用預約核心：同一套空檔引擎供美業、導覽、課程、場地與活動使用。
-- 只擴充既有正式結構；不建立第二套服務、場次、帳務或通知資料。

alter table public.service_items add column if not exists buffer_before_minutes integer not null default 0;
alter table public.service_items add column if not exists buffer_after_minutes integer not null default 0;
alter table public.service_items add column if not exists start_interval_minutes integer not null default 30;
alter table public.service_items add column if not exists deposit numeric not null default 0;
alter table public.service_items add column if not exists min_booking_gap_minutes integer not null default 0;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='service_items_booking_minutes_check') then
    alter table public.service_items add constraint service_items_booking_minutes_check check (
      duration_minutes between 5 and 1440 and
      buffer_before_minutes between 0 and 1440 and
      buffer_after_minutes between 0 and 1440 and
      start_interval_minutes between 5 and 720 and
      min_booking_gap_minutes between 0 and 10080 and
      capacity >= 1 and price >= 0 and deposit >= 0
    ) not valid;
  end if;
end $$;

create table if not exists public.availability_rules (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  booking_calendar_id text not null references public.booking_calendars(id) on delete cascade,
  operation_unit_id text null references public.operation_units(id) on delete cascade,
  staff_id text null references public.staff(id) on delete cascade,
  resource_id text null references public.resources(id) on delete cascade,
  weekdays smallint[] not null,
  start_text text not null,
  end_text text not null,
  effective_from date not null,
  effective_until date null,
  timezone text not null default 'Asia/Taipei',
  status text not null default 'active' check (status in ('active','inactive','archived')),
  config_json jsonb not null default '{}'::jsonb,
  created_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,id),
  check (weekdays <@ array[0,1,2,3,4,5,6]::smallint[] and cardinality(weekdays)>0),
  check (start_text ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  check (end_text ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and end_text>start_text),
  check (effective_until is null or effective_until>=effective_from)
);

create table if not exists public.availability_exceptions (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  booking_calendar_id text not null references public.booking_calendars(id) on delete cascade,
  operation_unit_id text null references public.operation_units(id) on delete cascade,
  staff_id text null references public.staff(id) on delete cascade,
  resource_id text null references public.resources(id) on delete cascade,
  date_key date not null,
  start_text text not null,
  end_text text not null,
  mode text not null check (mode in ('open','closed')),
  reason text null,
  config_json jsonb not null default '{}'::jsonb,
  created_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,id),
  check (start_text ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  check (end_text ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and end_text>start_text)
);

-- 顧客標籤、備註及限制永遠屬於建立它的租戶。
create table if not exists public.tenant_customer_profiles (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  platform_member_id text null references public.platform_members(id) on delete set null,
  email text null,
  phone text null,
  display_name text null,
  birthday date null,
  status text not null default 'general' check (status in ('general','vip','watch','restricted')),
  tags_json jsonb not null default '[]'::jsonb,
  notes text null,
  preferences_json jsonb not null default '{}'::jsonb,
  restrictions_json jsonb not null default '{}'::jsonb,
  created_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,id)
);

-- 平台總部只能管理風險案件；不把某店家的黑名單公開給其他租戶。
create table if not exists public.platform_risk_cases (
  id text primary key,
  source_tenant_id text null references public.tenants(id) on delete set null,
  platform_member_id text null references public.platform_members(id) on delete set null,
  severity text not null default 'review' check (severity in ('review','high','critical')),
  status text not null default 'pending' check (status in ('pending','confirmed','rejected','expired','appealed')),
  reason text not null,
  evidence_json jsonb not null default '[]'::jsonb,
  platform_restriction_json jsonb not null default '{}'::jsonb,
  reviewed_by text null,
  reviewed_at timestamptz null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.availability_rules enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.tenant_customer_profiles enable row level security;
alter table public.platform_risk_cases enable row level security;
revoke all on table public.availability_rules from anon, authenticated;
revoke all on table public.availability_exceptions from anon, authenticated;
revoke all on table public.tenant_customer_profiles from anon, authenticated;
revoke all on table public.platform_risk_cases from anon, authenticated;

create index if not exists availability_rules_lookup_idx on public.availability_rules
  (tenant_id,booking_calendar_id,status,effective_from,effective_until);
create index if not exists availability_exceptions_lookup_idx on public.availability_exceptions
  (tenant_id,booking_calendar_id,date_key,mode);
create index if not exists tenant_customer_profiles_member_idx on public.tenant_customer_profiles
  (tenant_id,platform_member_id);
create index if not exists tenant_customer_profiles_contact_idx on public.tenant_customer_profiles
  (tenant_id,email,phone);
create index if not exists platform_risk_cases_status_idx on public.platform_risk_cases
  (status,severity,created_at desc);

create or replace function public.enforce_doing_tenant_reference()
returns trigger language plpgsql set search_path=public as $$
declare ref_tenant text;
begin
  select tenant_id into ref_tenant from public.booking_calendars where id=new.booking_calendar_id;
  if ref_tenant is null or ref_tenant<>new.tenant_id then
    raise exception using message='預約日曆不屬於此營運空間';
  end if;
  if new.operation_unit_id is not null and not exists (
    select 1 from public.operation_units where id=new.operation_unit_id and tenant_id=new.tenant_id
  ) then raise exception using message='營運項目不屬於此營運空間'; end if;
  if new.staff_id is not null and not exists (
    select 1 from public.staff where id=new.staff_id and tenant_id=new.tenant_id
  ) then raise exception using message='工作人員不屬於此營運空間'; end if;
  if new.resource_id is not null and not exists (
    select 1 from public.resources where id=new.resource_id and tenant_id=new.tenant_id
  ) then raise exception using message='資源不屬於此營運空間'; end if;
  return new;
end $$;

drop trigger if exists availability_rules_tenant_guard on public.availability_rules;
create trigger availability_rules_tenant_guard before insert or update on public.availability_rules
for each row execute function public.enforce_doing_tenant_reference();
drop trigger if exists availability_exceptions_tenant_guard on public.availability_exceptions;
create trigger availability_exceptions_tenant_guard before insert or update on public.availability_exceptions
for each row execute function public.enforce_doing_tenant_reference();
revoke all on function public.enforce_doing_tenant_reference() from public,anon,authenticated;
