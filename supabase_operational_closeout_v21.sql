-- DOING v21 正式營運收尾：共用核心延伸，不建立第二套會員、報名、付款或計費資料。

create table if not exists public.vendor_sales_reports (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  session_id text not null references public.sessions(id) on delete cascade,
  registration_id text not null references public.registrations(id) on delete cascade,
  platform_member_id text null references public.platform_members(id) on delete set null,
  report_date date not null,
  gross_sales numeric not null check (gross_sales >= 0),
  note text not null default '',
  deposit_refund_status text not null default 'eligible'
    check (deposit_refund_status in ('not_applicable','eligible','requested','completed')),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, registration_id, report_date)
);

alter table public.tenant_domains add column if not exists verification_token text null;
alter table public.tenant_domains add column if not exists requested_by text not null default '';
alter table public.tenant_domains add column if not exists verified_at timestamptz null;
alter table public.tenant_domains add column if not exists last_checked_at timestamptz null;
alter table public.tenant_domains add column if not exists verification_error text null;
create unique index if not exists tenant_domains_domain_unique_idx on public.tenant_domains(lower(domain));

create table if not exists public.consignment_periods (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  operation_unit_id text null references public.operation_units(id) on delete set null,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  commission_percent numeric not null default 0 check (commission_percent between 0 and 100),
  status text not null default 'draft' check (status in ('draft','open','closed','settled')),
  config_json jsonb not null default '{}'::jsonb,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (tenant_id,id)
);

create table if not exists public.consignment_applications (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  period_id text not null references public.consignment_periods(id) on delete cascade,
  platform_member_id text null references public.platform_members(id) on delete set null,
  brand_id text null references public.brands(id) on delete set null,
  applicant_email text not null default '',
  brand_name text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn','settled')),
  note text not null default '',
  reviewed_by text null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,period_id,platform_member_id)
);

create table if not exists public.consignment_products (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  period_id text not null references public.consignment_periods(id) on delete cascade,
  application_id text not null references public.consignment_applications(id) on delete cascade,
  name text not null,
  sku text not null,
  barcode text null,
  unit_price numeric not null check (unit_price >= 0),
  opening_stock integer not null default 0 check (opening_stock >= 0),
  current_stock integer not null default 0 check (current_stock >= 0),
  status text not null default 'active' check (status in ('active','inactive','sold_out')),
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,period_id,sku),
  unique (tenant_id,period_id,barcode)
);

create table if not exists public.pos_sales (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  period_id text not null references public.consignment_periods(id) on delete restrict,
  total_amount numeric not null default 0 check (total_amount >= 0),
  payment_method text not null default 'other',
  status text not null default 'completed' check (status in ('completed','voided')),
  idempotency_key text not null,
  operator_email text not null default '',
  created_at timestamptz not null default now(),
  voided_at timestamptz null,
  unique (tenant_id,idempotency_key)
);

create table if not exists public.pos_sale_items (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  sale_id text not null references public.pos_sales(id) on delete restrict,
  product_id text not null references public.consignment_products(id) on delete restrict,
  application_id text not null references public.consignment_applications(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric not null check (unit_price >= 0),
  line_total numeric not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  product_id text not null references public.consignment_products(id) on delete restrict,
  sale_id text null references public.pos_sales(id) on delete restrict,
  movement_type text not null check (movement_type in ('opening','sale','adjustment','return','void')),
  quantity_delta integer not null check (quantity_delta <> 0),
  stock_after integer not null check (stock_after >= 0),
  note text not null default '',
  operator_email text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.membership_plans (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  operation_unit_id text null references public.operation_units(id) on delete set null,
  service_item_id text null references public.service_items(id) on delete set null,
  name text not null,
  plan_type text not null check (plan_type in ('bundle','visit_pass','membership')),
  included_quantity numeric not null default 0 check (included_quantity >= 0),
  valid_days integer null check (valid_days is null or valid_days > 0),
  price numeric not null default 0 check (price >= 0),
  sharing_mode text not null default 'owner_only' check (sharing_mode in ('owner_only','named_group')),
  status text not null default 'active' check (status in ('draft','active','archived')),
  config_json jsonb not null default '{}'::jsonb,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,id)
);

create table if not exists public.membership_subscriptions (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  plan_id text not null references public.membership_plans(id) on delete restrict,
  wallet_id text not null references public.customer_wallets(id) on delete restrict,
  platform_member_id text null references public.platform_members(id) on delete set null,
  owner_email text not null default '',
  status text not null default 'active' check (status in ('pending','active','expired','cancelled')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,plan_id,wallet_id)
);

create table if not exists public.service_visits (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  registration_id text not null references public.registrations(id) on delete cascade,
  operation_unit_id text null references public.operation_units(id) on delete set null,
  service_item_id text null references public.service_items(id) on delete set null,
  status text not null default 'booked' check (status in ('booked','arrived','in_service','completed','no_show','cancelled')),
  arrived_at timestamptz null,
  started_at timestamptz null,
  completed_at timestamptz null,
  updated_by text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,registration_id)
);

create table if not exists public.marketing_automations (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  operation_unit_id text null references public.operation_units(id) on delete set null,
  name text not null,
  trigger_type text not null check (trigger_type in ('before_booking','after_completion','birthday','inactive_customer')),
  offset_minutes integer not null default 0,
  audience text not null default 'eligible_customers' check (audience in ('eligible_customers','marketing_consented')),
  channel text not null default 'system' check (channel in ('system','email')),
  title_template text not null,
  body_template text not null,
  active boolean not null default true,
  config_json jsonb not null default '{}'::jsonb,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,id)
);

create table if not exists public.marketing_automation_runs (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  automation_id text not null references public.marketing_automations(id) on delete cascade,
  registration_id text null references public.registrations(id) on delete set null,
  member_email text not null default '',
  scheduled_for timestamptz not null,
  status text not null default 'queued' check (status in ('queued','created','skipped','failed')),
  notification_id text null references public.notifications(id) on delete set null,
  error_message text null,
  created_at timestamptz not null default now(),
  unique (tenant_id,automation_id,registration_id,scheduled_for)
);

create index if not exists vendor_sales_reports_session_idx on public.vendor_sales_reports(tenant_id,session_id,report_date desc);
create index if not exists consignment_applications_period_idx on public.consignment_applications(tenant_id,period_id,status);
create index if not exists consignment_products_period_idx on public.consignment_products(tenant_id,period_id,status);
create index if not exists pos_sales_period_idx on public.pos_sales(tenant_id,period_id,created_at desc);
create index if not exists pos_sale_items_sale_idx on public.pos_sale_items(tenant_id,sale_id);
create index if not exists inventory_movements_product_idx on public.inventory_movements(tenant_id,product_id,created_at desc);
create index if not exists membership_plans_active_idx on public.membership_plans(tenant_id,status,created_at desc);
create index if not exists service_visits_status_idx on public.service_visits(tenant_id,status,updated_at desc);
create index if not exists marketing_automations_active_idx on public.marketing_automations(tenant_id,active,trigger_type);

create or replace function public.guard_vendor_sales_amount()
returns trigger language plpgsql set search_path=public as $$
begin
  if old.gross_sales is distinct from new.gross_sales or old.registration_id is distinct from new.registration_id then
    raise exception '攤商營業額送出後不可由任何後台修改；如有爭議請保留原紀錄並由平台處理';
  end if;
  return new;
end $$;
drop trigger if exists vendor_sales_reports_immutable_amount on public.vendor_sales_reports;
create trigger vendor_sales_reports_immutable_amount before update on public.vendor_sales_reports
for each row execute function public.guard_vendor_sales_amount();

create or replace function public.record_consignment_pos_sale(
  p_tenant_id text, p_period_id text, p_operator_email text, p_payment_method text,
  p_idempotency_key text, p_items jsonb
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_sale_id text := 'POS_'||replace(gen_random_uuid()::text,'-','');
declare v_item jsonb; v_product public.consignment_products%rowtype;
declare v_qty integer; v_price numeric; v_total numeric := 0; v_after integer;
begin
  if coalesce(p_idempotency_key,'')='' or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then
    raise exception '銷售資料不完整';
  end if;
  select id into v_sale_id from public.pos_sales where tenant_id=p_tenant_id and idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('saleId',v_sale_id,'duplicate',true); end if;
  v_sale_id := 'POS_'||replace(gen_random_uuid()::text,'-','');
  insert into public.pos_sales(id,tenant_id,period_id,total_amount,payment_method,idempotency_key,operator_email)
  values(v_sale_id,p_tenant_id,p_period_id,0,coalesce(nullif(p_payment_method,''),'other'),p_idempotency_key,coalesce(p_operator_email,''));
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := greatest(1,coalesce((v_item->>'quantity')::integer,0));
    select * into v_product from public.consignment_products
      where tenant_id=p_tenant_id and period_id=p_period_id and id=v_item->>'productId' and status='active' for update;
    if not found then raise exception '商品不存在或未啟用'; end if;
    if v_product.current_stock < v_qty then raise exception '商品 % 庫存不足',v_product.name; end if;
    v_price := v_product.unit_price; v_after := v_product.current_stock-v_qty; v_total := v_total+(v_price*v_qty);
    insert into public.pos_sale_items(id,tenant_id,sale_id,product_id,application_id,quantity,unit_price,line_total)
    values('PSI_'||replace(gen_random_uuid()::text,'-',''),p_tenant_id,v_sale_id,v_product.id,v_product.application_id,v_qty,v_price,v_price*v_qty);
    update public.consignment_products set current_stock=v_after,status=case when v_after=0 then 'sold_out' else status end,updated_at=now() where id=v_product.id;
    insert into public.inventory_movements(id,tenant_id,product_id,sale_id,movement_type,quantity_delta,stock_after,note,operator_email)
    values('INV_'||replace(gen_random_uuid()::text,'-',''),p_tenant_id,v_product.id,v_sale_id,'sale',-v_qty,v_after,'POS 銷售',coalesce(p_operator_email,''));
  end loop;
  update public.pos_sales set total_amount=v_total where id=v_sale_id;
  insert into public.finance_ledger(id,tenant_id,entry_type,amount,direction,memo,meta_json,created_at)
  values('LED_'||replace(gen_random_uuid()::text,'-',''),p_tenant_id,'consignment_sale',v_total,'credit','寄賣 POS 銷售',jsonb_build_object('saleId',v_sale_id,'periodId',p_period_id),now());
  return jsonb_build_object('saleId',v_sale_id,'totalAmount',v_total,'duplicate',false);
end $$;

alter table public.vendor_sales_reports enable row level security;
alter table public.consignment_periods enable row level security;
alter table public.consignment_applications enable row level security;
alter table public.consignment_products enable row level security;
alter table public.pos_sales enable row level security;
alter table public.pos_sale_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.membership_plans enable row level security;
alter table public.membership_subscriptions enable row level security;
alter table public.service_visits enable row level security;
alter table public.marketing_automations enable row level security;
alter table public.marketing_automation_runs enable row level security;

revoke all on table public.vendor_sales_reports,public.consignment_periods,public.consignment_applications,
  public.consignment_products,public.pos_sales,public.pos_sale_items,public.inventory_movements,
  public.membership_plans,public.membership_subscriptions,public.service_visits,
  public.marketing_automations,public.marketing_automation_runs from anon,authenticated;
revoke all on function public.guard_vendor_sales_amount() from public,anon,authenticated;
revoke all on function public.record_consignment_pos_sale(text,text,text,text,text,jsonb) from public,anon,authenticated;

comment on table public.vendor_sales_reports is '攤商本人回報且金額不可覆寫；送出後只啟動保證金可退資格，不自動退款。';
comment on table public.inventory_movements is '寄賣商品不可變庫存流水；POS 銷售由單一資料庫交易寫入。';
