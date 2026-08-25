-- DOING CURRENT｜一會員 → 一自有租戶 → 多系統權限
-- 2026-08-25
-- SSOT: tenant_settings.module_flags_json.workModules
-- 公開系統: market / project / booking
-- 本 migration 不新增業務資料表；保留既有 tenant、會員、正式工作資料。

create or replace function public.doing_application_system(app jsonb)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  raw text := lower(trim(coalesce(app->>'requestedSystem','')));
  use_type text := lower(trim(coalesce(app->'moduleProfile'->>'useType','')));
  uses jsonb := coalesce(app->'useCases','[]'::jsonb);
begin
  if raw in ('market','project','booking') then return raw; end if;
  if use_type in ('beauty','service_booking','resource_booking','booking','appointment') then return 'booking'; end if;
  if use_type in ('market','event','workshop','course','activity') then return 'market'; end if;
  if use_type in ('project','construction','engineering','interior') then return 'project'; end if;
  if jsonb_typeof(uses)='array' then
    if uses ? 'beauty' or uses ? 'service_booking' or uses ? 'resource_booking' then return 'booking'; end if;
    if uses ? 'market' then return 'market'; end if;
    if uses ? 'project' or uses ? 'construction' or uses ? 'interior' then return 'project'; end if;
  end if;
  return '';
end;
$$;

-- 舊正式租戶補上明確的 workModules；只補權限分類，不刪除／重算既有能力旗標。
with mapped as (
  select t.id,
    case
      when lower(coalesce(t.config_json->'moduleProfile'->>'useType','')) in ('beauty','service_booking','resource_booking','booking','appointment') then 'booking'
      when lower(coalesce(t.config_json->'moduleProfile'->>'useType','')) in ('market','event','workshop','course','activity') then 'market'
      when lower(coalesce(t.config_json->'moduleProfile'->>'useType','')) in ('project','construction','engineering','interior') then 'project'
      else ''
    end as system_key
  from public.tenants t
)
update public.tenant_settings ts
set module_flags_json = jsonb_set(
      coalesce(ts.module_flags_json,'{}'::jsonb),
      '{workModules}',
      coalesce(ts.module_flags_json->'workModules','{}'::jsonb) || jsonb_build_object(m.system_key,true),
      true
    ),
    updated_at = now()
from mapped m
where ts.tenant_id=m.id and m.system_key<>'';

-- config_json 同步保存「已開通系統」與每套系統自己的 profile；保留原 moduleProfile 作舊程式相容。
with mapped as (
  select t.id, coalesce(t.config_json,'{}'::jsonb) as cfg,
    case
      when lower(coalesce(t.config_json->'moduleProfile'->>'useType','')) in ('beauty','service_booking','resource_booking','booking','appointment') then 'booking'
      when lower(coalesce(t.config_json->'moduleProfile'->>'useType','')) in ('market','event','workshop','course','activity') then 'market'
      when lower(coalesce(t.config_json->'moduleProfile'->>'useType','')) in ('project','construction','engineering','interior') then 'project'
      else ''
    end as system_key
  from public.tenants t
), enriched as (
  select id, system_key, cfg,
    case
      when jsonb_typeof(cfg->'enabledSystems')='array' and (cfg->'enabledSystems') ? system_key then cfg->'enabledSystems'
      when jsonb_typeof(cfg->'enabledSystems')='array' then (cfg->'enabledSystems') || jsonb_build_array(system_key)
      else jsonb_build_array(system_key)
    end as enabled_systems,
    coalesce(cfg->'systemProfiles','{}'::jsonb) ||
      jsonb_build_object(system_key,coalesce(cfg->'systemProfiles'->system_key,cfg->'moduleProfile','{}'::jsonb)) as system_profiles
  from mapped where system_key<>''
)
update public.tenants t
set config_json = jsonb_set(
      jsonb_set(e.cfg,'{enabledSystems}',e.enabled_systems,true),
      '{systemProfiles}',e.system_profiles,true
    ),
    updated_at=now()
from enriched e
where t.id=e.id;

-- 同一會員可在既有自有租戶加開不同系統；只阻擋「同一租戶同一系統」重複申請。
create or replace function public.doing_guard_workspace_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  e text := lower(trim(coalesce(new.contact_email,'')));
  requested_system text := public.doing_application_system(coalesce(new.application_json,'{}'::jsonb));
  owner_tenant text;
  enabled boolean := false;
  pending_exists boolean := false;
begin
  if e='' then return new; end if;
  if lower(coalesce(new.status,'')) not in ('pending','line_verification_pending','supplement_required') then return new; end if;
  if requested_system not in ('market','project','booking') then return new; end if;

  select lower(trim(s.tenant_id)) into owner_tenant
  from public.staff s
  where lower(trim(coalesce(s.email,'')))=e
    and coalesce(s.is_active,s.active,true) is true
    and lower(coalesce(s.normalized_role,s.role,'')) in ('organizer_owner','owner')
  order by s.created_at asc nulls last
  limit 1;

  if owner_tenant is not null then
    select coalesce((ts.module_flags_json->'workModules'->>requested_system)::boolean,false)
      into enabled
    from public.tenant_settings ts
    where ts.tenant_id=owner_tenant;
    if coalesce(enabled,false) then
      raise exception using errcode='23505', message='這個營運帳號已開通所選系統，不需要重複申請。';
    end if;
  end if;

  select exists(
    select 1 from public.tenant_apply_logs a
    where a.id is distinct from new.id
      and lower(trim(coalesce(a.contact_email,'')))=e
      and lower(coalesce(a.status,'')) in ('pending','line_verification_pending','supplement_required')
      and public.doing_application_system(coalesce(a.application_json,'{}'::jsonb))=requested_system
  ) into pending_exists;

  if pending_exists then
    raise exception using errcode='23505', message='這套系統已有進行中的申請，請直接查看原申請進度。';
  end if;
  return new;
end;
$$;

-- LINE 驗證後：已有自有租戶就「加系統」；沒有租戶才建立第一個租戶。
create or replace function public.doing_auto_activate_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  app jsonb := coalesce(new.application_json,'{}'::jsonb);
  member_id text := nullif(trim(coalesce(app->>'memberId','')),'');
  requested_system text := public.doing_application_system(app);
  public_links jsonb := coalesce(app->'publicLinks','[]'::jsonb);
  owner_email text := lower(trim(coalesce(new.contact_email,'')));
  owner_name text := trim(coalesce(new.contact_name,''));
  owner_tenants text[];
  target_tenant_id text;
  new_tenant_id text := 'tn_' || substr(md5(new.id),1,16);
  module_flags jsonb := coalesce(app->'needFlags','{}'::jsonb);
  current_flags jsonb := '{}'::jsonb;
  tenant_cfg jsonb := '{}'::jsonb;
  system_profiles jsonb := '{}'::jsonb;
  enabled_systems jsonb := '[]'::jsonb;
  activated_at timestamptz := now();
  next_timeline jsonb;
  billing_id uuid;
  entity_key text;
  kv record;
begin
  if lower(coalesce(new.status,'')) <> 'pending' or lower(coalesce(old.status,''))='pending' then return new; end if;

  if member_id is null or owner_email='' or owner_name='' or coalesce(new.contact_phone,'')=''
     or requested_system not in ('market','project','booking')
     or coalesce(app->>'identityResolutionRequired','false')='true'
     or jsonb_typeof(public_links)<>'array' or jsonb_array_length(public_links)=0 then
    update public.tenant_apply_logs set status='manual_review',note='自動開通暫停：身分、系統分類或必要資料需人工確認',updated_at=activated_at where id=new.id;
    insert into public.platform_risk_cases(id,source_tenant_id,platform_member_id,severity,status,reason,evidence_json,platform_restriction_json,created_at,updated_at)
    values(gen_random_uuid()::text,null,member_id,'review','pending','營運系統申請自動開通前置檢查未通過',jsonb_build_array(jsonb_build_object('applicationId',new.id,'requestedSystem',requested_system)),jsonb_build_object('autoActivationBlocked',true),activated_at,activated_at);
    return new;
  end if;

  select array_agg(distinct lower(trim(s.tenant_id))) into owner_tenants
  from public.staff s
  where s.platform_member_id=member_id
    and coalesce(s.is_active,s.active,true) is true
    and lower(coalesce(s.normalized_role,s.role,'')) in ('organizer_owner','owner');

  if coalesce(array_length(owner_tenants,1),0)=0 then
    select array_agg(distinct lower(trim(s.tenant_id))) into owner_tenants
    from public.staff s
    where lower(trim(coalesce(s.email,'')))=owner_email
      and coalesce(s.is_active,s.active,true) is true
      and lower(coalesce(s.normalized_role,s.role,'')) in ('organizer_owner','owner');
  end if;

  if coalesce(array_length(owner_tenants,1),0)>1 then
    update public.tenant_apply_logs set status='manual_review',note='自動開通暫停：此會員有多個自有營運帳號，需確認要加到哪一個',updated_at=activated_at where id=new.id;
    insert into public.platform_risk_cases(id,source_tenant_id,platform_member_id,severity,status,reason,evidence_json,platform_restriction_json,created_at,updated_at)
    values(gen_random_uuid()::text,null,member_id,'review','pending','多自有租戶的系統申請需要指定目標租戶',jsonb_build_array(jsonb_build_object('applicationId',new.id,'requestedSystem',requested_system)),jsonb_build_object('autoActivationBlocked',true),activated_at,activated_at);
    return new;
  end if;

  begin
    if coalesce(array_length(owner_tenants,1),0)=1 then
      target_tenant_id := owner_tenants[1];

      select coalesce(module_flags_json,'{}'::jsonb) into current_flags
      from public.tenant_settings where tenant_id=target_tenant_id for update;
      current_flags := coalesce(current_flags,'{}'::jsonb);
      if jsonb_typeof(current_flags->'workModules')<>'object' or current_flags->'workModules' is null then
        current_flags := jsonb_set(current_flags,'{workModules}','{}'::jsonb,true);
      end if;
      for kv in select key,value from jsonb_each(module_flags) loop
        if jsonb_typeof(kv.value)='boolean' and kv.value='true'::jsonb then
          current_flags := jsonb_set(current_flags,array[kv.key],'true'::jsonb,true);
        end if;
      end loop;
      current_flags := jsonb_set(current_flags,array['workModules',requested_system],'true'::jsonb,true);
      update public.tenant_settings set module_flags_json=current_flags,updated_at=activated_at where tenant_id=target_tenant_id;

      select coalesce(config_json,'{}'::jsonb) into tenant_cfg from public.tenants where id=target_tenant_id for update;
      tenant_cfg := coalesce(tenant_cfg,'{}'::jsonb);
      enabled_systems := case when jsonb_typeof(tenant_cfg->'enabledSystems')='array' then tenant_cfg->'enabledSystems' else '[]'::jsonb end;
      if not enabled_systems ? requested_system then enabled_systems := enabled_systems || jsonb_build_array(requested_system); end if;
      system_profiles := case when jsonb_typeof(tenant_cfg->'systemProfiles')='object' then tenant_cfg->'systemProfiles' else '{}'::jsonb end;
      system_profiles := system_profiles || jsonb_build_object(requested_system,coalesce(app->'moduleProfile','{}'::jsonb));
      tenant_cfg := jsonb_set(tenant_cfg,'{enabledSystems}',enabled_systems,true);
      tenant_cfg := jsonb_set(tenant_cfg,'{systemProfiles}',system_profiles,true);
      update public.tenants set config_json=tenant_cfg,updated_at=activated_at where id=target_tenant_id;

      next_timeline := coalesce(app->'timeline','[]'::jsonb) || jsonb_build_array(jsonb_build_object('key','system_entitlement_activated','label','LINE 驗證完成，已在原營運帳號開通系統','system',requested_system,'at',activated_at));
      update public.tenant_apply_logs set status='approved',tenant_id=target_tenant_id,approved_at=activated_at,approved_by='system:auto',note='LINE 驗證完成，已在既有營運帳號開通系統',application_json=app || jsonb_build_object('autoActivated',true,'activatedAt',activated_at,'requestedSystem',requested_system,'targetTenantId',target_tenant_id,'timeline',next_timeline),updated_at=activated_at where id=new.id;
      return new;
    end if;

    -- 第一套系統：建立唯一自有租戶。
    target_tenant_id := new_tenant_id;
    current_flags := module_flags;
    if jsonb_typeof(current_flags)<>'object' then current_flags := '{}'::jsonb; end if;
    current_flags := jsonb_set(current_flags,'{workModules}',jsonb_build_object(requested_system,true),true);
    enabled_systems := jsonb_build_array(requested_system);
    system_profiles := jsonb_build_object(requested_system,coalesce(app->'moduleProfile','{}'::jsonb));

    insert into public.tenants(id,slug,name,status,config_json,plan_type,contact_name,contact_phone,notify_email,tenant_type,legal_name,responsible_name,responsible_phone,responsible_email,created_at,updated_at)
    values(target_tenant_id,target_tenant_id,new.brand_name,'active',jsonb_build_object('sourceApplicationId',new.id,'autoActivated',true,'moduleProfile',coalesce(app->'moduleProfile','{}'::jsonb),'enabledSystems',enabled_systems,'systemProfiles',system_profiles),'trial',owner_name,new.contact_phone,owner_email,coalesce(nullif(new.tenant_type,''),'personal'),nullif(new.legal_name,''),owner_name,new.contact_phone,owner_email,activated_at,activated_at)
    on conflict (id) do nothing;

    insert into public.tenant_settings(tenant_id,organizer_name,module_flags_json,created_at,updated_at)
    values(target_tenant_id,new.brand_name,current_flags,activated_at,activated_at)
    on conflict (tenant_id) do update set organizer_name=excluded.organizer_name,module_flags_json=excluded.module_flags_json,updated_at=excluded.updated_at;

    insert into public.staff(id,tenant_id,email,name,display_name,role,normalized_role,perms_json,limit_sessions,scope_type,active,is_active,platform_member_id,created_at,updated_at)
    values('stf_'||substr(md5(new.id||member_id),1,20),target_tenant_id,owner_email,owner_name,owner_name,'organizer_owner','organizer_owner','{"events":true,"sessions":true,"review":true,"finance":true,"checkin":true,"announce":true,"members":true,"settings":true}'::jsonb,'','all',true,true,member_id,activated_at,activated_at)
    on conflict (tenant_id,email) do update set platform_member_id=excluded.platform_member_id,name=excluded.name,display_name=excluded.display_name,role='organizer_owner',normalized_role='organizer_owner',active=true,is_active=true,updated_at=excluded.updated_at;

    entity_key := 'member:'||member_id;
    insert into public.billing_entities(entity_type,identity_key,legal_name,responsible_name,responsible_phone,responsible_email,created_at,updated_at)
    values(case when coalesce(new.tenant_type,'')='company' then 'company' else 'personal' end,entity_key,coalesce(nullif(new.legal_name,''),new.brand_name),owner_name,new.contact_phone,owner_email,activated_at,activated_at)
    on conflict (identity_key) do update set updated_at=excluded.updated_at returning id into billing_id;
    insert into public.billing_entity_tenants(tenant_id,billing_entity_id,linked_at) values(target_tenant_id,billing_id,activated_at)
    on conflict (tenant_id) do update set billing_entity_id=excluded.billing_entity_id,linked_at=excluded.linked_at;
    update public.tenants set billing_entity_id=billing_id,updated_at=activated_at where id=target_tenant_id;

    next_timeline := coalesce(app->'timeline','[]'::jsonb) || jsonb_build_array(jsonb_build_object('key','workspace_auto_activated','label','LINE 驗證完成，建立營運帳號並開通系統','system',requested_system,'at',activated_at));
    update public.tenant_apply_logs set status='approved',tenant_id=target_tenant_id,approved_at=activated_at,approved_by='system:auto',note='LINE 驗證完成，已建立營運帳號並開通系統',application_json=app || jsonb_build_object('autoActivated',true,'activatedAt',activated_at,'requestedSystem',requested_system,'targetTenantId',target_tenant_id,'timeline',next_timeline),updated_at=activated_at where id=new.id;

  exception when others then
    update public.tenant_apply_logs set status='manual_review',note='自動開通未完成，已安全轉人工複核',updated_at=activated_at where id=new.id;
    insert into public.platform_risk_cases(id,source_tenant_id,platform_member_id,severity,status,reason,evidence_json,platform_restriction_json,created_at,updated_at)
    values(gen_random_uuid()::text,target_tenant_id,member_id,'high','pending','營運系統申請自動開通失敗',jsonb_build_array(jsonb_build_object('applicationId',new.id,'requestedSystem',requested_system,'databaseError',left(sqlerrm,500))),jsonb_build_object('autoActivationBlocked',true),activated_at,activated_at);
  end;
  return new;
end;
$$;

comment on function public.doing_application_system(jsonb) is 'DOING CURRENT：把正式申請解析成 market/project/booking 系統分類。';
comment on function public.doing_guard_workspace_application() is 'DOING CURRENT：一會員一自有租戶，可加開不同系統；同一系統不可重複申請。';
comment on function public.doing_auto_activate_workspace() is 'DOING CURRENT：LINE 驗證後，既有租戶加系統；只有首套系統才建立租戶。';
