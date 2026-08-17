begin;

-- DOING 智慧小幫手正式知識：只新增版本，不覆寫已發布內容。
create table if not exists public.doing_helper_knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  knowledge_key text not null,
  version integer not null check (version > 0),
  category text not null check (category in ('scope','application','data','billing','workflow','permissions','support')),
  title text not null,
  content text not null,
  keywords text[] not null default '{}'::text[],
  source_type text not null default 'product_rule' check (source_type in ('product_rule','platform_setting','approved_answer')),
  source_ref text not null default '',
  approval_status text not null default 'draft' check (approval_status in ('draft','published','rejected')),
  is_public boolean not null default true,
  supersedes_id uuid references public.doing_helper_knowledge_entries(id),
  created_by text not null default '',
  approved_by text not null default '',
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (knowledge_key, version),
  check (length(btrim(knowledge_key)) > 0),
  check (length(btrim(title)) > 0),
  check (length(btrim(content)) > 0),
  check (approval_status <> 'published' or (published_at is not null and length(btrim(approved_by)) > 0))
);

create index if not exists doing_helper_knowledge_status_category_idx
  on public.doing_helper_knowledge_entries (approval_status, is_public, category, version desc);
create index if not exists doing_helper_knowledge_key_version_idx
  on public.doing_helper_knowledge_entries (knowledge_key, version desc);
create index if not exists doing_helper_knowledge_keywords_gin_idx
  on public.doing_helper_knowledge_entries using gin (keywords);
create index if not exists doing_helper_knowledge_supersedes_idx
  on public.doing_helper_knowledge_entries (supersedes_id) where supersedes_id is not null;

-- 只有通過 DOING 會員驗證的對話才會建立。未登入對話不進資料庫。
create table if not exists public.member_helper_conversations (
  id uuid primary key default gen_random_uuid(),
  member_id text not null references public.platform_members(id) on delete cascade,
  status text not null default 'active' check (status in ('active','closed')),
  started_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index if not exists member_helper_conversations_member_time_idx
  on public.member_helper_conversations (member_id, last_message_at desc);
create index if not exists member_helper_conversations_active_idx
  on public.member_helper_conversations (member_id, last_message_at desc) where status = 'active';

create table if not exists public.member_helper_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.member_helper_conversations(id) on delete cascade,
  member_id text not null references public.platform_members(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  body text not null,
  reply_source text check (reply_source is null or reply_source in ('ai','rules')),
  knowledge_keys text[] not null default '{}'::text[],
  confidence text check (confidence is null or confidence in ('high','medium','low')),
  created_at timestamptz not null default now(),
  check (length(btrim(body)) > 0)
);

create index if not exists member_helper_messages_conversation_time_idx
  on public.member_helper_messages (conversation_id, created_at desc);
create index if not exists member_helper_messages_member_time_idx
  on public.member_helper_messages (member_id, created_at desc);
create index if not exists member_helper_messages_knowledge_gin_idx
  on public.member_helper_messages using gin (knowledge_keys);

-- 回答品質與改善候選。AI 可提出候選，但只有平台最高管理者能審核；不會直接發布成正式知識。
create table if not exists public.doing_helper_improvement_queue (
  id uuid primary key default gen_random_uuid(),
  member_id text not null references public.platform_members(id) on delete cascade,
  assistant_message_id uuid not null references public.member_helper_messages(id) on delete cascade,
  question text not null,
  answer text not null,
  rating text not null check (rating in ('helpful','not_helpful','low_confidence')),
  reason text not null default '',
  knowledge_keys text[] not null default '{}'::text[],
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected','applied')),
  review_note text not null default '',
  reviewed_by text not null default '',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (member_id, assistant_message_id, rating)
);

create index if not exists doing_helper_improvement_status_time_idx
  on public.doing_helper_improvement_queue (review_status, created_at desc);
create index if not exists doing_helper_improvement_member_time_idx
  on public.doing_helper_improvement_queue (member_id, created_at desc);
create index if not exists doing_helper_improvement_message_idx
  on public.doing_helper_improvement_queue (assistant_message_id);

alter table public.doing_helper_knowledge_entries enable row level security;
alter table public.member_helper_conversations enable row level security;
alter table public.member_helper_messages enable row level security;
alter table public.doing_helper_improvement_queue enable row level security;

revoke all on table public.doing_helper_knowledge_entries from public, anon, authenticated, service_role;
revoke all on table public.member_helper_conversations from public, anon, authenticated, service_role;
revoke all on table public.member_helper_messages from public, anon, authenticated, service_role;
revoke all on table public.doing_helper_improvement_queue from public, anon, authenticated, service_role;

grant select, insert on table public.doing_helper_knowledge_entries to service_role;
grant select, insert, update on table public.member_helper_conversations to service_role;
grant select, insert on table public.member_helper_messages to service_role;
grant select, insert, update on table public.doing_helper_improvement_queue to service_role;

insert into public.doing_helper_knowledge_entries
  (knowledge_key, version, category, title, content, keywords, source_type, source_ref, approval_status, is_public, created_by, approved_by, published_at)
values
  ('service_scope',1,'scope','DOING 智慧小幫手服務範圍','小幫手回答 DOING 的申請、活動、預約、資料安排、費用與使用問題。一般知識、生活建議、其他品牌或其他系統不在服務範圍。',array['DOING','可以問什麼','服務範圍','智慧小幫手','客服'],'product_rule','DOING_產品規則與更新紀錄.md','published',true,'system_seed','platform_super_admin',now()),
  ('organizer_application',1,'application','營運帳號申請方式','在智慧小幫手內按「開始申請」，依主題區段一起勾選或填寫，最後使用 LINE 驗證送出。申請不會先產生費用；審核通過後才建立正式營運帳號。',array['申請','開通','營運帳號','LINE','審核','怎麼申請'],'product_rule','DOING_產品規則與更新紀錄.md','published',true,'system_seed','platform_super_admin',now()),
  ('one_member_multiple_work',1,'data','同一會員與多重工作','一位使用者可用同一個 DOING 會員管理多種工作，不必為市集、課程、工作室或預約重複註冊。新增工作時優先新增工作空間、營運項目、角色或模組。',array['斜槓','多種工作','同一帳號','市集','課程','工作室','預約'],'product_rule','DOING_產品規則與更新紀錄.md','published',true,'system_seed','platform_super_admin',now()),
  ('brand_data_boundary',1,'data','品牌與工作資料邊界','同一品牌內可共用客人基本資料；不同工作的預約、報名、帳務與人員權限分開。不同品牌的營運、客戶與帳務資料彼此分開，只共用本人登入身分。',array['資料','客人資料','不同工作','不同品牌','會混在一起','共用'],'product_rule','DOING_產品規則與更新紀錄.md','published',true,'system_seed','platform_super_admin',now()),
  ('supported_work',1,'workflow','支援的工作情境','DOING 可支援市集、活動、課程、手作體驗、美類、一般服務預約、場地或資源預約、導覽與多元營運，並依實際需要組合通用功能。',array['市集','活動','課程','手作','美甲','美類','服務預約','場地','資源','導覽','支援'],'product_rule','DOING_產品規則與更新紀錄.md','published',true,'system_seed','platform_super_admin',now()),
  ('operation_flow',1,'workflow','營運流程','DOING 將建立內容、公開報名、審核收款、通知準備、現場報到與結案紀錄接在同一條流程，讓名單、金額、通知與現場狀態持續接續。',array['流程','建立活動','報名','審核','收款','通知','報到','結案'],'product_rule','DOING_產品規則與更新紀錄.md','published',true,'system_seed','platform_super_admin',now()),
  ('permission_boundary',1,'permissions','小幫手權限邊界','小幫手可以說明、整理與提出下一步，但不能自行核准帳號、改變權限、收款、開通功能或替平台作最終決定。',array['權限','核准','收款','開通','決定','自動'],'product_rule','DOING_產品規則與更新紀錄.md','published',true,'system_seed','platform_super_admin',now()),
  ('billing_authority',1,'billing','正式費用來源','費用必須即時讀取 DOING 平台正式計費設定；知識庫只說明計費原則，不複製金額。小幫手不得自行推算、修改或承諾費用。',array['費用','收費','價格','月費','多少錢','系統費'],'platform_setting','platform_settings.platform_billing_policy','published',true,'system_seed','platform_super_admin',now()),
  ('conversation_privacy',1,'support','對話記憶與改善','未登入對話只存在目前畫面，不寫入資料庫。登入會員的對話才可續接個人脈絡；低信心或「沒解決」的回答只會進入待審改善清單，不會直接變成正式知識。',array['對話','記住','紀錄','隱私','改善','學習','迭代'],'product_rule','DOING_產品規則與更新紀錄.md','published',true,'system_seed','platform_super_admin',now())
on conflict (knowledge_key, version) do nothing;

comment on table public.doing_helper_knowledge_entries is 'DOING 受控正式知識版本；Worker 只讀 published 且 is_public=true，AI 不可直接發布。';
comment on table public.member_helper_conversations is '通過會員驗證後才建立的 DOING 小幫手對話；未登入不留存。';
comment on table public.member_helper_messages is '登入會員的小幫手逐訊息紀錄，用於續接本人對話，不能跨會員讀取。';
comment on table public.doing_helper_improvement_queue is '低信心或會員回饋產生的待審改善候選；需平台最高管理者審核。';

commit;
