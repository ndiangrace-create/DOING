-- DOING LINE／Google 共用會員身分
-- OAuth provider subject 只保存在 platform_member_identities；管理權限以 platform_member_id 連到同一會員。

alter table public.staff
  add column if not exists platform_member_id text references public.platform_members(id) on delete set null;

alter table public.platform_staff
  add column if not exists platform_member_id text references public.platform_members(id) on delete set null;

alter table public.platform_members
  add column if not exists contact_email text,
  add column if not exists phone_normalized text;

update public.platform_members
set contact_email = lower(trim(email))
where contact_email is null and email is not null;

update public.platform_members
set phone_normalized = case
  when regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') like '886%' then '0' || substr(regexp_replace(phone, '[^0-9]', '', 'g'), 4)
  when length(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) = 9 and regexp_replace(phone, '[^0-9]', '', 'g') like '9%' then '0' || regexp_replace(phone, '[^0-9]', '', 'g')
  else regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')
end
where phone_normalized is null and phone is not null;

create index if not exists staff_platform_member_idx
  on public.staff (platform_member_id)
  where platform_member_id is not null;

create index if not exists platform_staff_platform_member_idx
  on public.platform_staff (platform_member_id)
  where platform_member_id is not null;

drop index if exists public.platform_members_contact_email_idx;
create unique index if not exists platform_members_contact_email_unique_idx
  on public.platform_members (lower(btrim(contact_email)))
  where contact_email is not null and btrim(contact_email) <> '';

drop index if exists public.platform_members_phone_normalized_idx;
create unique index if not exists platform_members_phone_normalized_unique_idx
  on public.platform_members (phone_normalized)
  where phone_normalized is not null and btrim(phone_normalized) <> '';

create unique index if not exists platform_members_email_normalized_unique_idx
  on public.platform_members (lower(btrim(email)))
  where email is not null and btrim(email) <> '';

comment on column public.staff.platform_member_id is
  'DOING 共用會員編號；LINE 與 Google 身分經驗證後都連到此會員。';

comment on column public.platform_staff.platform_member_id is
  'DOING 共用會員編號；平台管理者的 LINE／Google 登入共用同一帳號。';

comment on column public.platform_members.email is
  '主要登入服務已驗證 Email；不可被使用者手填聯絡信箱覆蓋。不同登入服務的 Email 保存在 platform_member_identities。';

comment on column public.platform_members.contact_email is
  '會員聯絡 Email；同一 Email 不得建立第二會員。手填值不可單獨作為登入身分、合併或授權依據。';

comment on column public.platform_members.phone_normalized is
  '正規化聯絡電話；同一電話不得建立第二會員。電話相同只阻擋重複建檔，不會自動合併或授權。';
