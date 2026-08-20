-- DOING V20｜自動開通＋90 天暫存資料治理
-- 正式原則：LINE 身分驗證成功後自動建立工作空間；只有風險／衝突才轉人工複核。
-- 90 天只清除「未驗證／未完成、且未連到正式工作空間」的暫存資料及純匿名曝光事件。
-- registrations / payments / refunds / finance / tenant / staff / 已登入會員正式資料永不受此清理規則影響。

create or replace function public.doing_auto_activate_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  app jsonb := coalesce(new.application_json,'{}'::jsonb);
  member_id text := nullif(trim(coalesce(app->>'memberId','')),'');
  public_links jsonb := coalesce(app->'publicLinks','[]'::jsonb);
  new_tenant_id text := 'tn_' || substr(md5(new.id),1,16);
  owner_email text := lower(trim(coalesce(new.contact_email,'')));
  owner_name text := trim(coalesce(new.contact_name,''));
  billing_id uuid;
  entity_key text;
  module_flags jsonb := coalesce(app->'needFlags','{}'::jsonb);
  activated_at timestamptz := now();
  next_timeline jsonb;
begin
  -- 只處理「完成 OAuth 後」由既有 Worker 寫成 pending 的申請。
  if lower(coalesce(new.status,'')) <> 'pending'
     or lower(coalesce(old.status,'')) = 'pending' then
    return new;
  end if;

  -- 任何身分衝突／資料不完整都 fail closed，保留原申請並交平台人工複核。
  if member_id is null
     or owner_email = ''
     or owner_name = ''
     or coalesce(new.contact_phone,'') = ''
     or coalesce(app->>'identityResolutionRequired','false') = 'true'
     or jsonb_typeof(public_links) <> 'array'
     or jsonb_array_length(public_links) = 0 then
    update public.tenant_apply_logs
       set status='manual_review',
           note='自動開通暫停：身分或必要資料需人工確認',
           updated_at=activated_at
     where id=new.id;
    insert into public.platform_risk_cases(
      id,source_tenant_id,platform_member_id,severity,status,reason,evidence_json,platform_restriction_json,created_at,updated_at
    ) values (
      gen_random_uuid()::text,null,member_id,'review','pending','營運申請自動開通前置檢查未通過',
      jsonb_build_array(jsonb_build_object('applicationId',new.id,'reason','missing_or_conflicting_identity_or_public_link')),
      jsonb_build_object('autoActivationBlocked',true),activated_at,activated_at
    );
    return new;
  end if;

  begin
    -- 不建立第二套工作空間資料：沿用 tenants / tenant_settings / staff。
    insert into public.tenants(
      id,slug,name,status,config_json,plan_type,contact_name,contact_phone,notify_email,
      tenant_type,legal_name,responsible_name,responsible_phone,responsible_email,created_at,updated_at
    ) values (
      new_tenant_id,new_tenant_id,new.brand_name,'active',
      jsonb_build_object('sourceApplicationId',new.id,'autoActivated',true,'moduleProfile',coalesce(app->'moduleProfile','{}'::jsonb)),
      'trial',owner_name,new.contact_phone,owner_email,
      coalesce(nullif(new.tenant_type,''),'personal'),nullif(new.legal_name,''),owner_name,new.contact_phone,owner_email,
      activated_at,activated_at
    ) on conflict (id) do nothing;

    insert into public.tenant_settings(
      tenant_id,organizer_name,module_flags_json,created_at,updated_at
    ) values (
      new_tenant_id,new.brand_name,module_flags,activated_at,activated_at
    ) on conflict (tenant_id) do update
      set organizer_name=excluded.organizer_name,
          module_flags_json=excluded.module_flags_json,
          updated_at=excluded.updated_at;

    insert into public.staff(
      id,tenant_id,email,name,display_name,role,normalized_role,perms_json,limit_sessions,
      scope_type,active,is_active,platform_member_id,created_at,updated_at
    ) values (
      'stf_'||substr(md5(new.id||member_id),1,20),new_tenant_id,owner_email,owner_name,owner_name,
      'organizer_owner','organizer_owner',
      '{"events":true,"sessions":true,"review":true,"finance":true,"checkin":true,"announce":true,"members":true,"settings":true}'::jsonb,
      '','all',true,true,member_id,activated_at,activated_at
    ) on conflict (tenant_id,email) do update
      set platform_member_id=excluded.platform_member_id,
          name=excluded.name,display_name=excluded.display_name,
          role='organizer_owner',normalized_role='organizer_owner',active=true,is_active=true,updated_at=excluded.updated_at;

    -- 沿用既有 billing_entities，不新增另一套計費主檔；只在尚未有此會員計費實體時建立。
    entity_key := 'member:'||member_id;
    insert into public.billing_entities(
      entity_type,identity_key,legal_name,responsible_name,responsible_phone,responsible_email,created_at,updated_at
    ) values (
      case when coalesce(new.tenant_type,'')='company' then 'company' else 'personal' end,
      entity_key,coalesce(nullif(new.legal_name,''),new.brand_name),owner_name,new.contact_phone,owner_email,activated_at,activated_at
    ) on conflict (identity_key) do update set updated_at=excluded.updated_at
    returning id into billing_id;

    insert into public.billing_entity_tenants(tenant_id,billing_entity_id,linked_at)
    values(new_tenant_id,billing_id,activated_at)
    on conflict (tenant_id) do update set billing_entity_id=excluded.billing_entity_id,linked_at=excluded.linked_at;

    update public.tenants set billing_entity_id=billing_id,updated_at=activated_at where id=new_tenant_id;

    next_timeline := coalesce(app->'timeline','[]'::jsonb)
      || jsonb_build_array(jsonb_build_object('key','workspace_auto_activated','label','LINE 驗證完成，自動建立工作空間','at',activated_at));

    update public.tenant_apply_logs
       set status='approved',tenant_id=new_tenant_id,approved_at=activated_at,approved_by='system:auto',
           note='LINE 驗證完成，已自動開通工作空間',
           application_json=app || jsonb_build_object('autoActivated',true,'activatedAt',activated_at,'timeline',next_timeline),
           updated_at=activated_at
     where id=new.id;

  exception when others then
    -- 此區塊內的 provisioning 會回滾；申請本身仍保留並轉人工複核，不留下半套 workspace。
    update public.tenant_apply_logs
       set status='manual_review',
           note='自動開通未完成，已安全轉人工複核',updated_at=activated_at
     where id=new.id;
    insert into public.platform_risk_cases(
      id,source_tenant_id,platform_member_id,severity,status,reason,evidence_json,platform_restriction_json,created_at,updated_at
    ) values (
      gen_random_uuid()::text,null,member_id,'high','pending','營運申請自動開通失敗',
      jsonb_build_array(jsonb_build_object('applicationId',new.id,'databaseError',left(sqlerrm,500))),
      jsonb_build_object('autoActivationBlocked',true),activated_at,activated_at
    );
  end;
  return new;
end;
$$;

drop trigger if exists doing_auto_activate_workspace_after_verification on public.tenant_apply_logs;
create trigger doing_auto_activate_workspace_after_verification
after update of status on public.tenant_apply_logs
for each row execute function public.doing_auto_activate_workspace();

-- 90 天暫存清理：只清除尚未連到 tenant 的未驗證／被替代草稿；正式業務資料完全不碰。
create or replace function public.doing_cleanup_transient_data(p_batch integer default 500)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  batch_size integer := greatest(1,least(coalesce(p_batch,500),2000));
  application_count integer := 0;
  attribution_count integer := 0;
begin
  with doomed as (
    select id from public.tenant_apply_logs
     where tenant_id is null
       and status in ('line_verification_pending','google_verification_pending','replaced')
       and coalesce(updated_at,created_at) < now() - interval '90 days'
     order by coalesce(updated_at,created_at)
     limit batch_size
  )
  delete from public.tenant_apply_logs a using doomed d where a.id=d.id;
  get diagnostics application_count = row_count;

  with doomed as (
    select id from public.platform_attribution_events
     where registration_id is null
       and occurred_at < now() - interval '90 days'
     order by occurred_at
     limit batch_size
  )
  delete from public.platform_attribution_events a using doomed d where a.id=d.id;
  get diagnostics attribution_count = row_count;

  return jsonb_build_object(
    'applicationDraftsDeleted',application_count,
    'anonymousAttributionDeleted',attribution_count,
    'formalBusinessDataDeleted',0,
    'retentionDays',90
  );
end;
$$;

-- 刪除完全重複的索引，避免每次寫入多做一份無效索引維護。
drop index if exists public.idx_tenant_apply_logs_status_created_v2;

-- 清理／查詢用索引；只在不存在時建立。
create index if not exists idx_platform_attribution_events_occurred_anonymous
  on public.platform_attribution_events(occurred_at)
  where registration_id is null;
create index if not exists idx_tenant_apply_logs_transient_cleanup
  on public.tenant_apply_logs(status,updated_at)
  where tenant_id is null;

-- 名稱 SSOT 與保留政策也存入正式 platform_settings；不另開同功能資料表。
insert into public.platform_settings(setting_key,value_json,updated_by,updated_at)
values(
  'doing_naming_contract',
  '{"version":1,"myRegistrations":{"userFacingName":"我的報名","memberRoute":"member-panel.html#activities","primaryApi":"getMyRegsGlobal","primaryTable":"registrations","forbiddenAliases":["我的紀錄"]},"rule":"同一功能不得建立第二套資料表或第二個同義 API"}'::jsonb,
  'DOING-v20-migration',now()
)
on conflict(setting_key) do update set value_json=excluded.value_json,updated_by=excluded.updated_by,updated_at=excluded.updated_at;

insert into public.platform_settings(setting_key,value_json,updated_by,updated_at)
values(
  'doing_data_retention_policy',
  '{"version":1,"transientDays":90,"purgeOnly":["unverified_application_drafts","anonymous_attribution_without_registration"],"neverPurgeByThisRule":["registrations","payments","refunds","finance","tenants","staff","verified_member_data","active_work_records"],"batchMax":2000,"cleanupFunction":"doing_cleanup_transient_data"}'::jsonb,
  'DOING-v20-migration',now()
)
on conflict(setting_key) do update set value_json=excluded.value_json,updated_by=excluded.updated_by,updated_at=excluded.updated_at;

insert into public.platform_settings(setting_key,value_json,updated_by,updated_at)
values(
  'doing_workspace_activation_policy',
  '{"version":1,"normalFlow":"smart_helper>system_preview>formal_data>fb_ig>line_verify>auto_activate_workspace","manualReviewOnlyFor":["identity_collision","missing_required_data","risk_or_database_exception"],"applicationTable":"tenant_apply_logs","workspaceTables":["tenants","tenant_settings","staff"],"riskTable":"platform_risk_cases"}'::jsonb,
  'DOING-v20-migration',now()
)
on conflict(setting_key) do update set value_json=excluded.value_json,updated_by=excluded.updated_by,updated_at=excluded.updated_at;

-- 已存在的資料庫信件模板若含舊名稱，直接在原列修正，不建立第二份模板。
update public.email_templates
   set subject=replace(coalesce(subject,''),'我的紀錄','我的報名'),
       body=replace(coalesce(body,''),'我的紀錄','我的報名'),
       body_html=replace(coalesce(body_html,''),'我的紀錄','我的報名'),
       button_label=replace(coalesce(button_label,''),'我的紀錄','我的報名'),
       updated_at=now()
 where coalesce(subject,'') like '%我的紀錄%'
    or coalesce(body,'') like '%我的紀錄%'
    or coalesce(body_html,'') like '%我的紀錄%'
    or coalesce(button_label,'') like '%我的紀錄%';
