-- AI 社群小編 V1 / Supabase PostgreSQL
-- 獨立 namespace，避免與既有 DOING 租戶資料表混用。
create schema if not exists social_ai;

create table if not exists social_ai.brands (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null,
  name text not null,
  description text,
  voice_guide text,
  visual_guide text,
  timezone text not null default 'Asia/Taipei',
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists social_ai.brand_members (
  brand_id uuid not null references social_ai.brands(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner','manager','editor','reviewer')),
  created_at timestamptz not null default now(),
  primary key (brand_id,user_id)
);

create table if not exists social_ai.campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references social_ai.brands(id) on delete cascade,
  title text not null,
  brief text not null,
  starts_on date,
  ends_on date,
  goals text[],
  source_notes text,
  status text not null default 'draft' check (status in ('draft','active','completed','archived')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists social_ai.posts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references social_ai.campaigns(id) on delete cascade,
  brand_id uuid not null references social_ai.brands(id) on delete cascade,
  angle text,
  master_copy text not null default '',
  facebook_copy text,
  instagram_copy text,
  image_prompt text,
  status text not null default 'draft' check (status in ('draft','review','approved','scheduled','publishing','published','failed','cancelled')),
  approved_by uuid,
  approved_at timestamptz,
  scheduled_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists social_ai.assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references social_ai.brands(id) on delete cascade,
  post_id uuid references social_ai.posts(id) on delete cascade,
  kind text not null check (kind in ('image','video','logo','reference')),
  storage_path text not null,
  prompt text,
  provider text,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists social_ai.social_connections (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references social_ai.brands(id) on delete cascade,
  provider text not null check (provider in ('facebook','instagram')),
  external_account_id text not null,
  display_name text,
  token_secret_ref text not null,
  token_expires_at timestamptz,
  status text not null default 'active' check (status in ('active','expired','revoked','error')),
  connected_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id,provider,external_account_id)
);

create table if not exists social_ai.publish_jobs (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references social_ai.posts(id) on delete cascade,
  connection_id uuid not null references social_ai.social_connections(id) on delete cascade,
  scheduled_at timestamptz not null,
  idempotency_key text not null unique,
  status text not null default 'queued' check (status in ('queued','running','published','failed','cancelled')),
  attempts int not null default 0,
  external_post_id text,
  last_error text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists social_ai.audit_log (
  id bigint generated always as identity primary key,
  brand_id uuid,
  actor_user_id uuid,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists social_ai_posts_brand_status_idx on social_ai.posts(brand_id,status);
create index if not exists social_ai_posts_schedule_idx on social_ai.posts(scheduled_at) where scheduled_at is not null;
create index if not exists social_ai_jobs_due_idx on social_ai.publish_jobs(status,scheduled_at);

-- RLS / policies 必須在接入實際 auth schema 時依 DOING 的 auth helper 綁定。
-- 在 auth helper 尚未核對前，禁止直接把本 schema 套入正式 DB。
