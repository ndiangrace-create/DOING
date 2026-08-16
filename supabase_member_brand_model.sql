-- DOING 會員／品牌／報名／現場執行人分離模型
-- 原則：
-- 1. LINE／Google 身分只識別「人」。電話與品牌同名不得自動合併會員。
-- 2. 品牌是獨立資料，一個品牌可有多位會員共同管理。
-- 3. 一筆活動報名可由一人送出、由另一人到場報到與申請撤場。
-- 4. 既有 registrations 欄位保留作歷史快照；新關聯欄位採相容式加入。

create table if not exists public.brands (
  id text primary key,
  display_name text not null,
  normalized_name text not null,
  category text not null default '',
  intro text not null default '',
  items text not null default '',
  facebook_url text not null default '',
  instagram_url text not null default '',
  profile_url text not null default '',
  company_name text not null default '',
  tax_id text not null default '',
  status text not null default 'active',
  created_by_member_id text null references public.platform_members(id) on update cascade on delete set null,
  merged_into_brand_id text null references public.brands(id) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brands_status_check check (status in ('active','pending_review','archived','merged')),
  constraint brands_not_self_merged_check check (merged_into_brand_id is null or merged_into_brand_id <> id)
);

create table if not exists public.brand_members (
  id text primary key,
  brand_id text not null references public.brands(id) on update cascade on delete cascade,
  platform_member_id text not null references public.platform_members(id) on update cascade on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  permissions_json jsonb not null default '{}'::jsonb,
  invited_by_member_id text null references public.platform_members(id) on update cascade on delete set null,
  joined_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brand_members_role_check check (role in ('owner','manager','member')),
  constraint brand_members_status_check check (status in ('pending','active','rejected','revoked')),
  constraint brand_members_brand_member_unique unique (brand_id, platform_member_id)
);

create table if not exists public.brand_access_requests (
  id text primary key,
  brand_id text not null references public.brands(id) on update cascade on delete cascade,
  platform_member_id text not null references public.platform_members(id) on update cascade on delete cascade,
  request_type text not null,
  status text not null default 'pending',
  requested_role text not null default 'member',
  note text not null default '',
  resolved_by_member_id text null references public.platform_members(id) on update cascade on delete set null,
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brand_access_requests_type_check check (request_type = 'brand_member'),
  constraint brand_access_requests_status_check check (status in ('pending','approved','rejected','cancelled')),
  constraint brand_access_requests_role_check check (requested_role in ('manager','member'))
);

alter table public.registrations
  add column if not exists brand_id text null,
  add column if not exists submitted_by_member_id text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'registrations_brand_id_fkey'
      and conrelid = 'public.registrations'::regclass
  ) then
    alter table public.registrations
      add constraint registrations_brand_id_fkey
      foreign key (brand_id) references public.brands(id)
      on update cascade on delete set null not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'registrations_submitted_by_member_id_fkey'
      and conrelid = 'public.registrations'::regclass
  ) then
    alter table public.registrations
      add constraint registrations_submitted_by_member_id_fkey
      foreign key (submitted_by_member_id) references public.platform_members(id)
      on update cascade on delete set null not valid;
  end if;
end $$;

create table if not exists public.registration_members (
  id text primary key,
  tenant_id text not null references public.tenants(id) on update cascade on delete cascade,
  registration_id text not null references public.registrations(id) on update cascade on delete cascade,
  platform_member_id text not null references public.platform_members(id) on update cascade on delete cascade,
  brand_id text null references public.brands(id) on update cascade on delete set null,
  role text not null,
  status text not null default 'active',
  permissions_json jsonb not null default '{}'::jsonb,
  invited_by_member_id text null references public.platform_members(id) on update cascade on delete set null,
  accepted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint registration_members_role_check check (role in ('submitter','onsite_representative','assistant')),
  constraint registration_members_status_check check (status in ('pending','active','revoked')),
  constraint registration_members_registration_member_unique unique (registration_id, platform_member_id)
);

create table if not exists public.registration_member_invites (
  id text primary key,
  tenant_id text not null references public.tenants(id) on update cascade on delete cascade,
  registration_id text not null references public.registrations(id) on update cascade on delete cascade,
  brand_id text null references public.brands(id) on update cascade on delete set null,
  role text not null default 'onsite_representative',
  status text not null default 'pending',
  invited_by_member_id text not null references public.platform_members(id) on update cascade on delete cascade,
  accepted_by_member_id text null references public.platform_members(id) on update cascade on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint registration_member_invites_role_check check (role in ('onsite_representative','assistant')),
  constraint registration_member_invites_status_check check (status in ('pending','accepted','revoked','expired'))
);

create index if not exists brands_normalized_name_idx
  on public.brands (normalized_name, status);
create index if not exists brands_created_by_member_idx
  on public.brands (created_by_member_id)
  where created_by_member_id is not null;
create index if not exists brands_merged_into_brand_idx
  on public.brands (merged_into_brand_id)
  where merged_into_brand_id is not null;
create index if not exists brand_members_member_status_idx
  on public.brand_members (platform_member_id, status, updated_at desc);
create index if not exists brand_members_brand_status_idx
  on public.brand_members (brand_id, status, role);
create index if not exists brand_members_invited_by_member_idx
  on public.brand_members (invited_by_member_id)
  where invited_by_member_id is not null;
create index if not exists brand_access_requests_brand_status_idx
  on public.brand_access_requests (brand_id, status, created_at desc);
create index if not exists brand_access_requests_member_status_idx
  on public.brand_access_requests (platform_member_id, status, created_at desc);
create index if not exists brand_access_requests_resolved_by_member_idx
  on public.brand_access_requests (resolved_by_member_id)
  where resolved_by_member_id is not null;
create unique index if not exists brand_access_requests_pending_unique
  on public.brand_access_requests (brand_id, platform_member_id, request_type)
  where status = 'pending';
create index if not exists registrations_brand_created_idx
  on public.registrations (brand_id, created_at desc)
  where brand_id is not null;
create index if not exists registrations_submitted_by_member_idx
  on public.registrations (submitted_by_member_id, created_at desc)
  where submitted_by_member_id is not null;
create unique index if not exists registrations_active_brand_session_unit_unique
  on public.registrations (tenant_id, session_id, coalesce(operation_unit_id,''), brand_id)
  where brand_id is not null
    and registration_status = 'active'
    and review_status not in ('已取消','不錄取','未錄取')
    and coalesce(transfer_status,'') not in ('已退費','已退款');
create index if not exists registration_members_member_status_idx
  on public.registration_members (platform_member_id, status, created_at desc);
create index if not exists registration_members_registration_status_idx
  on public.registration_members (registration_id, status, role);
create index if not exists registration_members_brand_status_idx
  on public.registration_members (brand_id, status)
  where brand_id is not null;
create index if not exists registration_members_tenant_idx
  on public.registration_members (tenant_id);
create index if not exists registration_members_invited_by_member_idx
  on public.registration_members (invited_by_member_id)
  where invited_by_member_id is not null;
create index if not exists registration_member_invites_registration_status_idx
  on public.registration_member_invites (registration_id, status, expires_at);
create index if not exists registration_member_invites_acceptor_idx
  on public.registration_member_invites (accepted_by_member_id)
  where accepted_by_member_id is not null;
create index if not exists registration_member_invites_tenant_idx
  on public.registration_member_invites (tenant_id);
create index if not exists registration_member_invites_brand_idx
  on public.registration_member_invites (brand_id)
  where brand_id is not null;
create index if not exists registration_member_invites_invited_by_member_idx
  on public.registration_member_invites (invited_by_member_id);

alter table public.brands enable row level security;
alter table public.brand_members enable row level security;
alter table public.brand_access_requests enable row level security;
alter table public.registration_members enable row level security;
alter table public.registration_member_invites enable row level security;

revoke all on public.brands from anon, authenticated;
revoke all on public.brand_members from anon, authenticated;
revoke all on public.brand_access_requests from anon, authenticated;
revoke all on public.registration_members from anon, authenticated;
revoke all on public.registration_member_invites from anon, authenticated;
grant select, insert, update, delete on public.brands to service_role;
grant select, insert, update, delete on public.brand_members to service_role;
grant select, insert, update, delete on public.brand_access_requests to service_role;
grant select, insert, update, delete on public.registration_members to service_role;
grant select, insert, update, delete on public.registration_member_invites to service_role;

-- 接受出攤邀請與建立活動成員必須在同一個 transaction；同一邀請同時開啟時只能由一位會員取得權限。
create or replace function public.accept_registration_member_invite_atomic(
  p_invite_id text,
  p_member_id text,
  p_now timestamptz default now()
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_invite public.registration_member_invites%rowtype;
begin
  select * into v_invite
  from public.registration_member_invites
  where id = p_invite_id
  for update;

  if not found then
    return jsonb_build_object('ok',false,'error','找不到這筆出攤邀請');
  end if;
  if v_invite.status = 'accepted' and v_invite.accepted_by_member_id = p_member_id then
    return jsonb_build_object('ok',true,'alreadyAccepted',true,'registrationId',v_invite.registration_id);
  end if;
  if v_invite.status <> 'pending' or v_invite.expires_at <= p_now then
    return jsonb_build_object('ok',false,'error','出攤邀請已失效，請報名人重新分享');
  end if;

  insert into public.registration_members (
    id, tenant_id, registration_id, platform_member_id, brand_id,
    role, status, permissions_json, invited_by_member_id,
    accepted_at, created_at, updated_at
  ) values (
    'RM_' || substr(md5(v_invite.id || ':' || p_member_id),1,20),
    v_invite.tenant_id, v_invite.registration_id, p_member_id, v_invite.brand_id,
    v_invite.role, 'active',
    '{"view":true,"checkin":true,"request_teardown":true}'::jsonb,
    v_invite.invited_by_member_id, p_now, p_now, p_now
  ) on conflict (registration_id, platform_member_id) do nothing;

  update public.registration_member_invites
  set status = 'accepted', accepted_by_member_id = p_member_id,
      accepted_at = p_now, updated_at = p_now
  where id = v_invite.id;

  return jsonb_build_object('ok',true,'accepted',true,'registrationId',v_invite.registration_id);
end;
$$;

revoke all on function public.accept_registration_member_invite_atomic(text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.accept_registration_member_invite_atomic(text,text,timestamptz) to service_role;

-- 只回填已由登入會員明確擁有的品牌。歷史 registrations 沒有會員 ID，保留快照、不猜人、不自動合併。
insert into public.brands (
  id, display_name, normalized_name, category, intro, items,
  facebook_url, instagram_url, profile_url, company_name, tax_id,
  status, created_by_member_id, created_at, updated_at
)
select
  'BRD_' || substr(md5(pm.id),1,20),
  trim(pm.vendor_json->>'brandName'),
  lower(regexp_replace(trim(pm.vendor_json->>'brandName'),'[[:space:]　]+','','g')),
  coalesce(pm.vendor_json->>'category',''),
  coalesce(pm.vendor_json->>'brandIntro',''),
  coalesce(pm.vendor_json->>'items',''),
  coalesce(pm.vendor_json->>'facebook',''),
  coalesce(pm.vendor_json->>'instagram',''),
  coalesce(pm.vendor_json->>'photoUrl',''),
  coalesce(pm.vendor_json->>'company',''),
  coalesce(pm.vendor_json->>'taxId',''),
  'active', pm.id, pm.created_at, now()
from public.platform_members pm
where nullif(trim(pm.vendor_json->>'brandName'),'') is not null
on conflict (id) do nothing;

insert into public.brand_members (
  id, brand_id, platform_member_id, role, status, permissions_json,
  invited_by_member_id, joined_at, created_at, updated_at
)
select
  'BM_' || substr(md5(pm.id),1,20),
  'BRD_' || substr(md5(pm.id),1,20),
  pm.id, 'owner', 'active',
  '{"edit_brand":true,"manage_members":true,"submit_registration":true}'::jsonb,
  pm.id, pm.created_at, pm.created_at, now()
from public.platform_members pm
where nullif(trim(pm.vendor_json->>'brandName'),'') is not null
on conflict (brand_id, platform_member_id) do nothing;

update public.registrations r
set submitted_by_member_id = r.platform_member_id
where r.submitted_by_member_id is null
  and r.platform_member_id is not null;

update public.registrations r
set brand_id = bm.brand_id
from public.brand_members bm
join public.brands b on b.id = bm.brand_id
where r.brand_id is null
  and r.platform_member_id = bm.platform_member_id
  and bm.status = 'active'
  and lower(regexp_replace(trim(coalesce(r.brand_name,'')),'[[:space:]　]+','','g')) = b.normalized_name;

insert into public.registration_members (
  id, tenant_id, registration_id, platform_member_id, brand_id,
  role, status, permissions_json, invited_by_member_id,
  accepted_at, created_at, updated_at
)
select
  'RM_' || substr(md5(r.id || ':' || r.platform_member_id),1,20),
  r.tenant_id, r.id, r.platform_member_id, r.brand_id,
  'submitter', 'active',
  '{"view":true,"manage_registration":true,"invite_team":true,"checkin":true,"request_teardown":true}'::jsonb,
  r.platform_member_id, r.created_at, r.created_at, now()
from public.registrations r
where r.platform_member_id is not null
on conflict (registration_id, platform_member_id) do nothing;

comment on table public.brands is 'DOING 平台級品牌主檔；品牌名稱只作候選比對，不作會員身分證明。';
comment on table public.brand_members is '會員與品牌的多對多關係；同一品牌可由夫妻、家人、夥伴各自使用自己的 LINE 共同管理。';
comment on table public.registration_members is '每筆報名的實際操作人；區分送出者、現場代表與助手。';
comment on table public.registration_member_invites is '單次、限時的報名協作邀請；接受後綁定對方自己的 LINE 會員。';
comment on column public.registrations.brand_id is '正式品牌關聯；brand_name 保留當時送出內容作歷史快照。';
comment on column public.registrations.submitted_by_member_id is '實際送出此報名的會員；不等於唯一品牌管理者或實際出攤者。';
