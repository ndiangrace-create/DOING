-- DOING Persistent Change Ledger / Incremental Verification
-- Additive only. No existing table, row, policy, function, trigger, or production data is changed.

create table if not exists public.platform_change_ledger (
  id uuid primary key default gen_random_uuid(),
  work_key text not null,
  record_type text not null,
  lifecycle_status text not null,
  project_key text not null default 'DOING',
  deployment_target text not null default 'tobeloved-api',
  goal text not null,
  module_key text not null,
  change_reason text not null default '',
  before_json jsonb not null default '{}'::jsonb,
  after_json jsonb not null default '{}'::jsonb,
  impact_json jsonb not null default '{}'::jsonb,
  affected_scopes text[] not null default '{}'::text[],
  core_layers text[] not null default '{}'::text[],
  dependency_keys text[] not null default '{}'::text[],
  dependency_json jsonb not null default '{}'::jsonb,
  git_json jsonb not null default '{}'::jsonb,
  deployment_json jsonb not null default '{}'::jsonb,
  recovery_json jsonb not null default '{}'::jsonb,
  outstanding_json jsonb not null default '[]'::jsonb,
  risk_json jsonb not null default '[]'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  supersedes_id uuid references public.platform_change_ledger(id),
  recorded_by text not null default '',
  recorded_at timestamptz not null default now(),
  constraint platform_change_ledger_record_type_check check (
    record_type in ('pending','decision','implementation','fix','deployment','production_verification','finalized')
  ),
  constraint platform_change_ledger_status_check check (
    lifecycle_status in ('Pending','Failed','Verified','Closed')
  ),
  constraint platform_change_ledger_project_check check (project_key = 'DOING'),
  constraint platform_change_ledger_target_check check (deployment_target = 'tobeloved-api'),
  constraint platform_change_ledger_goal_check check (length(btrim(goal)) > 0),
  constraint platform_change_ledger_module_check check (length(btrim(module_key)) > 0)
);

create table if not exists public.platform_feature_versions (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null,
  feature_name text not null,
  feature_status text not null,
  contract_json jsonb not null default '{}'::jsonb,
  state_json jsonb not null default '{}'::jsonb,
  source_change_id uuid not null references public.platform_change_ledger(id),
  supersedes_id uuid references public.platform_feature_versions(id),
  recorded_by text not null default '',
  recorded_at timestamptz not null default now(),
  constraint platform_feature_versions_status_check check (
    feature_status in ('未建置','已建置','已串接','已驗收','已停用')
  ),
  constraint platform_feature_versions_key_check check (length(btrim(feature_key)) > 0)
);

create table if not exists public.platform_dependency_versions (
  id uuid primary key default gen_random_uuid(),
  dependency_key text not null,
  upstream_key text not null,
  downstream_key text not null,
  dependency_type text not null,
  edge_status text not null default 'active',
  contract_json jsonb not null default '{}'::jsonb,
  source_change_id uuid not null references public.platform_change_ledger(id),
  supersedes_id uuid references public.platform_dependency_versions(id),
  recorded_by text not null default '',
  recorded_at timestamptz not null default now(),
  constraint platform_dependency_versions_status_check check (edge_status in ('active','retired')),
  constraint platform_dependency_versions_key_check check (length(btrim(dependency_key)) > 0),
  constraint platform_dependency_versions_nodes_check check (
    length(btrim(upstream_key)) > 0 and length(btrim(downstream_key)) > 0
  )
);

create table if not exists public.platform_verification_records (
  id uuid primary key default gen_random_uuid(),
  verification_key text not null,
  work_key text not null,
  verification_status text not null,
  environment text not null,
  test_type text not null,
  covered_scopes text[] not null default '{}'::text[],
  core_layers text[] not null default '{}'::text[],
  dependency_keys text[] not null default '{}'::text[],
  conditions_json jsonb not null default '{}'::jsonb,
  fingerprints_json jsonb not null default '{}'::jsonb,
  result_json jsonb not null default '{}'::jsonb,
  evidence_json jsonb not null default '[]'::jsonb,
  invalidation_reason text not null default '',
  source_change_id uuid not null references public.platform_change_ledger(id),
  supersedes_id uuid references public.platform_verification_records(id),
  recorded_by text not null default '',
  recorded_at timestamptz not null default now(),
  constraint platform_verification_records_status_check check (
    verification_status in ('Pending','Failed','Verified','Stale')
  ),
  constraint platform_verification_records_environment_check check (
    environment in ('local','ci','staging','production')
  ),
  constraint platform_verification_records_key_check check (length(btrim(verification_key)) > 0)
);

create table if not exists public.platform_verified_baselines (
  id uuid primary key default gen_random_uuid(),
  baseline_key text not null,
  project_key text not null default 'DOING',
  deployment_target text not null default 'tobeloved-api',
  source_change_id uuid not null references public.platform_change_ledger(id),
  production_verification_id uuid not null references public.platform_verification_records(id),
  git_commit text not null,
  deployment_version text not null,
  fingerprints_json jsonb not null default '{}'::jsonb,
  production_result_json jsonb not null default '{}'::jsonb,
  recovery_json jsonb not null default '{}'::jsonb,
  outstanding_json jsonb not null default '[]'::jsonb,
  risk_json jsonb not null default '[]'::jsonb,
  supersedes_id uuid references public.platform_verified_baselines(id),
  verified_by text not null default '',
  verified_at timestamptz not null default now(),
  constraint platform_verified_baselines_project_check check (project_key = 'DOING'),
  constraint platform_verified_baselines_target_check check (deployment_target = 'tobeloved-api'),
  constraint platform_verified_baselines_commit_check check (length(btrim(git_commit)) > 0),
  constraint platform_verified_baselines_deploy_check check (length(btrim(deployment_version)) > 0)
);

create index if not exists platform_change_ledger_work_time_idx
  on public.platform_change_ledger(work_key, recorded_at desc);
create index if not exists platform_change_ledger_status_time_idx
  on public.platform_change_ledger(lifecycle_status, recorded_at desc);
create index if not exists platform_change_ledger_scopes_gin_idx
  on public.platform_change_ledger using gin(affected_scopes);
create index if not exists platform_change_ledger_supersedes_idx
  on public.platform_change_ledger(supersedes_id) where supersedes_id is not null;
create index if not exists platform_feature_versions_key_time_idx
  on public.platform_feature_versions(feature_key, recorded_at desc);
create index if not exists platform_feature_versions_change_idx
  on public.platform_feature_versions(source_change_id);
create index if not exists platform_feature_versions_supersedes_idx
  on public.platform_feature_versions(supersedes_id) where supersedes_id is not null;
create index if not exists platform_dependency_versions_key_time_idx
  on public.platform_dependency_versions(dependency_key, recorded_at desc);
create index if not exists platform_dependency_versions_upstream_idx
  on public.platform_dependency_versions(upstream_key, recorded_at desc);
create index if not exists platform_dependency_versions_downstream_idx
  on public.platform_dependency_versions(downstream_key, recorded_at desc);
create index if not exists platform_dependency_versions_change_idx
  on public.platform_dependency_versions(source_change_id);
create index if not exists platform_dependency_versions_supersedes_idx
  on public.platform_dependency_versions(supersedes_id) where supersedes_id is not null;
create index if not exists platform_verification_records_key_time_idx
  on public.platform_verification_records(verification_key, recorded_at desc);
create index if not exists platform_verification_records_status_time_idx
  on public.platform_verification_records(verification_status, recorded_at desc);
create index if not exists platform_verification_records_scopes_gin_idx
  on public.platform_verification_records using gin(covered_scopes);
create index if not exists platform_verification_records_change_idx
  on public.platform_verification_records(source_change_id);
create index if not exists platform_verification_records_supersedes_idx
  on public.platform_verification_records(supersedes_id) where supersedes_id is not null;
create index if not exists platform_verified_baselines_time_idx
  on public.platform_verified_baselines(verified_at desc);
create index if not exists platform_verified_baselines_change_idx
  on public.platform_verified_baselines(source_change_id);
create index if not exists platform_verified_baselines_verification_idx
  on public.platform_verified_baselines(production_verification_id);
create index if not exists platform_verified_baselines_supersedes_idx
  on public.platform_verified_baselines(supersedes_id) where supersedes_id is not null;

alter table public.platform_change_ledger enable row level security;
alter table public.platform_feature_versions enable row level security;
alter table public.platform_dependency_versions enable row level security;
alter table public.platform_verification_records enable row level security;
alter table public.platform_verified_baselines enable row level security;

revoke all on table public.platform_change_ledger from public, anon, authenticated, service_role;
revoke all on table public.platform_feature_versions from public, anon, authenticated, service_role;
revoke all on table public.platform_dependency_versions from public, anon, authenticated, service_role;
revoke all on table public.platform_verification_records from public, anon, authenticated, service_role;
revoke all on table public.platform_verified_baselines from public, anon, authenticated, service_role;

grant select, insert on table public.platform_change_ledger to service_role;
grant select, insert on table public.platform_feature_versions to service_role;
grant select, insert on table public.platform_dependency_versions to service_role;
grant select, insert on table public.platform_verification_records to service_role;
grant select, insert on table public.platform_verified_baselines to service_role;

comment on table public.platform_change_ledger is
  'DOING 平台內部永久變更事件；append-only，只由 tobeloved-api service role 且通過平台最高管理者驗證後存取。';
comment on table public.platform_feature_versions is
  'DOING 功能／決策世界樹的不可變版本；新版本以 supersedes_id 取代舊版。';
comment on table public.platform_dependency_versions is
  'DOING 上下游依賴邊的不可變版本；active/retired 均以新列追加。';
comment on table public.platform_verification_records is
  'DOING 增量驗收紀錄與指紋；失效時追加 Stale 列，不覆寫原始證據。';
comment on table public.platform_verified_baselines is
  'DOING 通過正式環境驗證的基準快照；最新 verified_at 為目前 Verified Baseline。';
