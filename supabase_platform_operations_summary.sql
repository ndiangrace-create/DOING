-- DOING 平台營運中心：以資料庫聚合全量資料，避免租戶增加後受 REST 單頁筆數影響。
create or replace function public.doing_platform_operations_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with revenue as (
  select tenant_id, greatest(0, coalesce(total, amount, 0))::numeric as amount, created_at
  from public.billing_logs
  where status = 'confirmed'
    and (billing_type = 'booking_monthly'
      or billing_type like 'activity_publish:%'
      or billing_type like 'activity_rate:%'
      or billing_type like 'activity_unit:%'
      or billing_type like 'setup_feature:%'
      or billing_type like 'exposure:%')
), active_tenants as (
  select tenant_id from public.sessions where coalesce(updated_at, created_at) >= now() - interval '30 days'
  union
  select tenant_id from public.registrations where coalesce(updated_at, created_at) >= now() - interval '30 days'
), health as (
  select t.id as tenant_id,
    coalesce(t.name, '租戶名稱待設定') as tenant_name,
    coalesce(t.status, '') as status,
    coalesce(t.is_locked, false) as locked,
    (select count(*) from public.platform_issue_records i where i.tenant_id=t.id and i.status <> 'resolved') as issue_count,
    (select count(*) from public.sessions s where s.tenant_id=t.id) as session_count,
    (select count(*) from public.registrations r where r.tenant_id=t.id) as registration_count,
    coalesce((select sum(v.amount) from revenue v where v.tenant_id=t.id),0) as revenue,
    exists(select 1 from active_tenants a where a.tenant_id=t.id) as active_30d
  from public.tenants t
)
select jsonb_build_object(
  'summary', jsonb_build_object(
    'monthRevenue', coalesce((select sum(amount) from revenue where created_at >= now() - interval '30 days'),0),
    'allRevenue', coalesce((select sum(amount) from revenue),0),
    'openIssueCount', (select count(*) from public.platform_issue_records where status <> 'resolved'),
    'criticalIssueCount', (select count(*) from public.platform_issue_records where status <> 'resolved' and severity='critical'),
    'affectedTenantCount', (select count(distinct tenant_id) from public.platform_issue_records where status <> 'resolved' and tenant_id <> ''),
    'pendingApplicationCount', (select count(*) from public.tenant_apply_logs where status in ('pending','supplement_required')),
    'tenantCount', (select count(*) from public.tenants),
    'activeTenant30d', (select count(*) from active_tenants)
  ),
  'tenantHealth', coalesce((select jsonb_agg(jsonb_build_object(
    'tenantId',tenant_id,'tenantName',tenant_name,'status',status,'locked',locked,
    'issueCount',issue_count,'sessionCount',session_count,'registrationCount',registration_count,
    'revenue',revenue,'active30d',active_30d
  ) order by issue_count desc, revenue desc) from health),'[]'::jsonb)
);
$$;

revoke all on function public.doing_platform_operations_summary() from public, anon, authenticated;
grant execute on function public.doing_platform_operations_summary() to service_role;

comment on function public.doing_platform_operations_summary() is
  'DOING 平台總管全量營收、問題與租戶健康聚合；只允許 Worker service role 呼叫。';
