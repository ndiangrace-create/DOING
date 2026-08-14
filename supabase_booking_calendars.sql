-- DOING 預約日曆：同一營運帳號可建立多個日曆，時段與預約可分開或合併檢視。
create table if not exists public.booking_calendars (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  operation_unit_id text null references public.operation_units(id) on delete set null,
  name text not null,
  color text not null default '#8bbfd1',
  status text not null default 'active' check (status in ('active','inactive','archived')),
  owner_staff_id text null references public.staff(id) on delete set null,
  sort_order integer not null default 0,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);

alter table public.booking_calendars enable row level security;
revoke all on table public.booking_calendars from anon, authenticated;

create index if not exists booking_calendars_tenant_status_idx
  on public.booking_calendars (tenant_id, status, sort_order);
create index if not exists booking_calendars_operation_unit_idx
  on public.booking_calendars (tenant_id, operation_unit_id);

alter table public.timeslots add column if not exists booking_calendar_id text null;
alter table public.registrations add column if not exists booking_calendar_id text null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='timeslots_booking_calendar_id_fkey') then
    alter table public.timeslots add constraint timeslots_booking_calendar_id_fkey
      foreign key (booking_calendar_id) references public.booking_calendars(id)
      on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='registrations_booking_calendar_id_fkey') then
    alter table public.registrations add constraint registrations_booking_calendar_id_fkey
      foreign key (booking_calendar_id) references public.booking_calendars(id)
      on delete set null not valid;
  end if;
end $$;

create index if not exists timeslots_booking_calendar_idx
  on public.timeslots (tenant_id, booking_calendar_id, date_key);
create index if not exists registrations_booking_calendar_idx
  on public.registrations (tenant_id, booking_calendar_id, created_at);

insert into public.booking_calendars (id,tenant_id,operation_unit_id,name,color,status,sort_order,config_json)
select 'CAL_'||substr(md5(u.tenant_id||':'||u.id),1,20),u.tenant_id,u.id,
       coalesce(nullif(u.name,''),'主要預約日曆'),'#8bbfd1',
       case when u.status in ('closed','archived') then 'inactive' else 'active' end,
       u.sort_order,jsonb_build_object('createdFrom','existing_booking_unit')
from public.operation_units u
where coalesce(u.modules_json->>'operatingMode','activity')='booking'
on conflict (id) do nothing;

update public.timeslots t set booking_calendar_id=c.id
from public.booking_calendars c
where t.booking_calendar_id is null and c.tenant_id=t.tenant_id and c.operation_unit_id=t.operation_unit_id;

update public.registrations r set booking_calendar_id=c.id
from public.booking_calendars c
where r.booking_calendar_id is null and c.tenant_id=r.tenant_id and c.operation_unit_id=r.operation_unit_id;
