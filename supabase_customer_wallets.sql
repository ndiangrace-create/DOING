-- DOING canonical customer stored-value / pass accounts.
-- One account table covers money and visit passes; the immutable ledger is the audit source.
create table if not exists public.customer_wallets (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  platform_member_id text null references public.platform_members(id) on delete set null,
  owner_email text not null default '',
  shared_group_key text null,
  account_type text not null check (account_type in ('money','pass')),
  name text not null,
  unit text not null check (unit in ('twd','times')),
  balance numeric not null default 0 check (balance >= 0),
  operation_unit_id text null references public.operation_units(id) on delete set null,
  service_item_id text null references public.service_items(id) on delete set null,
  status text not null default 'active' check (status in ('active','suspended','expired')),
  expires_at timestamptz null,
  config_json jsonb not null default '{}'::jsonb,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,id)
);

create table if not exists public.customer_wallet_ledger (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  wallet_id text not null references public.customer_wallets(id) on delete cascade,
  registration_id text null references public.registrations(id) on delete set null,
  entry_type text not null check (entry_type in ('topup','purchase','redeem','refund','adjustment','share')),
  amount numeric not null check (amount <> 0),
  balance_after numeric not null default 0,
  note text not null default '',
  idempotency_key text null,
  meta_json jsonb not null default '{}'::jsonb,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  unique (tenant_id,id)
);
create unique index if not exists customer_wallet_ledger_idempotency_idx
  on public.customer_wallet_ledger(tenant_id,idempotency_key) where idempotency_key is not null;
create index if not exists customer_wallet_owner_idx on public.customer_wallets(tenant_id,platform_member_id,owner_email);
create index if not exists customer_wallet_ledger_lookup_idx on public.customer_wallet_ledger(tenant_id,wallet_id,created_at desc);

create or replace function public.apply_customer_wallet_ledger()
returns trigger language plpgsql security invoker set search_path=public as $$
declare current_balance numeric; wallet_tenant text;
begin
  select balance,tenant_id into current_balance,wallet_tenant from public.customer_wallets where id=new.wallet_id for update;
  if wallet_tenant is null or wallet_tenant <> new.tenant_id then raise exception 'wallet tenant mismatch'; end if;
  if new.registration_id is not null and not exists(select 1 from public.registrations where id=new.registration_id and tenant_id=new.tenant_id) then raise exception 'registration tenant mismatch'; end if;
  new.balance_after := current_balance + new.amount;
  if new.balance_after < 0 then raise exception 'insufficient wallet balance'; end if;
  update public.customer_wallets set balance=new.balance_after,updated_at=now() where id=new.wallet_id;
  return new;
end $$;
revoke all on function public.apply_customer_wallet_ledger() from public,anon,authenticated;
drop trigger if exists customer_wallet_ledger_apply on public.customer_wallet_ledger;
create trigger customer_wallet_ledger_apply before insert on public.customer_wallet_ledger
for each row execute function public.apply_customer_wallet_ledger();

create or replace function public.guard_customer_wallet_tenant()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.operation_unit_id is not null and not exists(select 1 from public.operation_units where id=new.operation_unit_id and tenant_id=new.tenant_id) then raise exception 'operation unit tenant mismatch'; end if;
  if new.service_item_id is not null and not exists(select 1 from public.service_items where id=new.service_item_id and tenant_id=new.tenant_id) then raise exception 'service tenant mismatch'; end if;
  return new;
end $$;
drop trigger if exists customer_wallet_tenant_guard on public.customer_wallets;
create trigger customer_wallet_tenant_guard before insert or update on public.customer_wallets
for each row execute function public.guard_customer_wallet_tenant();

alter table public.customer_wallets enable row level security;
alter table public.customer_wallet_ledger enable row level security;
revoke all on table public.customer_wallets from anon,authenticated;
revoke all on table public.customer_wallet_ledger from anon,authenticated;
