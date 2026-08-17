begin;

create table if not exists public.member_helper_traces (
  id text primary key,
  member_id text not null references public.platform_members(id) on delete cascade,
  topic text not null check (topic in ('summary','data','billing','adjust')),
  use_cases_json jsonb not null default '[]'::jsonb,
  pain_points_json jsonb not null default '[]'::jsonb,
  work_situations_json jsonb not null default '[]'::jsonb,
  reply text not null default '',
  reply_source text not null check (reply_source in ('ai','rules')),
  created_at timestamptz not null default now()
);

create index if not exists member_helper_traces_member_created_idx
  on public.member_helper_traces (member_id, created_at desc);

alter table public.member_helper_traces enable row level security;
revoke all on table public.member_helper_traces from public, anon, authenticated, service_role;
grant select, insert on table public.member_helper_traces to service_role;

commit;
