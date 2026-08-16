-- DOING LINE／Google 共用會員身分
-- OAuth provider subject 只保存在 platform_member_identities；管理權限以 platform_member_id 連到同一會員。

alter table public.staff
  add column if not exists platform_member_id text references public.platform_members(id) on delete set null;

alter table public.platform_staff
  add column if not exists platform_member_id text references public.platform_members(id) on delete set null;

create index if not exists staff_platform_member_idx
  on public.staff (platform_member_id)
  where platform_member_id is not null;

create index if not exists platform_staff_platform_member_idx
  on public.platform_staff (platform_member_id)
  where platform_member_id is not null;

comment on column public.staff.platform_member_id is
  'DOING 共用會員編號；LINE 與 Google 身分經驗證後都連到此會員。';

comment on column public.platform_staff.platform_member_id is
  'DOING 共用會員編號；平台管理者的 LINE／Google 登入共用同一帳號。';
