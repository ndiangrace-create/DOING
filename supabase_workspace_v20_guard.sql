-- DOING World Tree v20 — one owned workspace guard
-- Uses existing SSOT tables only. No new business-data table is introduced.
-- Invited staff/collaborators are not owners and remain allowed across workspaces.

create or replace function public.doing_guard_single_owned_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_role text;
  collision_id text;
begin
  owner_role := lower(coalesce(new.normalized_role, new.role, ''));
  if owner_role not in ('organizer_owner','owner') or coalesce(new.is_active,new.active,true) is not true then
    return new;
  end if;

  select s.tenant_id::text into collision_id
  from public.staff s
  where s.id is distinct from new.id
    and s.tenant_id is distinct from new.tenant_id
    and coalesce(s.is_active,s.active,true) is true
    and lower(coalesce(s.normalized_role,s.role,'')) in ('organizer_owner','owner')
    and (
      (new.platform_member_id is not null and s.platform_member_id = new.platform_member_id)
      or
      (nullif(lower(trim(coalesce(new.email,''))),'') is not null and lower(trim(coalesce(s.email,''))) = lower(trim(new.email)))
    )
  limit 1;

  if collision_id is not null then
    raise exception using
      errcode = '23505',
      message = '此會員已擁有自己的 DOING 工作空間；如需第二個獨立工作空間，請由平台總管處理。';
  end if;
  return new;
end;
$$;

drop trigger if exists doing_single_owned_workspace_guard on public.staff;
create trigger doing_single_owned_workspace_guard
before insert or update of tenant_id, platform_member_id, email, role, normalized_role, active, is_active
on public.staff
for each row execute function public.doing_guard_single_owned_workspace();

create or replace function public.doing_guard_workspace_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_exists boolean;
  pending_exists boolean;
  e text := lower(trim(coalesce(new.contact_email,'')));
begin
  if e = '' then return new; end if;
  if lower(coalesce(new.status,'')) not in ('pending','line_verification_pending','supplement_required') then return new; end if;

  select exists(
    select 1 from public.staff s
    where lower(trim(coalesce(s.email,''))) = e
      and coalesce(s.is_active,s.active,true) is true
      and lower(coalesce(s.normalized_role,s.role,'')) in ('organizer_owner','owner')
  ) into owner_exists;

  if owner_exists then
    raise exception using
      errcode = '23505',
      message = '此會員已有自己的 DOING 工作空間；不可重複申請第二個工作空間。';
  end if;

  select exists(
    select 1 from public.tenant_apply_logs a
    where a.id is distinct from new.id
      and lower(trim(coalesce(a.contact_email,''))) = e
      and lower(coalesce(a.status,'')) in ('pending','line_verification_pending','supplement_required')
  ) into pending_exists;

  if pending_exists then
    raise exception using
      errcode = '23505',
      message = '此會員已有進行中的工作空間申請，請直接查看原申請進度。';
  end if;
  return new;
end;
$$;

drop trigger if exists doing_single_workspace_application_guard on public.tenant_apply_logs;
create trigger doing_single_workspace_application_guard
before insert or update of contact_email, status
on public.tenant_apply_logs
for each row execute function public.doing_guard_workspace_application();

comment on function public.doing_guard_single_owned_workspace() is 'DOING v20: one member owns at most one workspace; collaboration in other workspaces remains allowed.';
comment on function public.doing_guard_workspace_application() is 'DOING v20: blocks duplicate self-owned workspace applications while preserving collaborator invitations.';
