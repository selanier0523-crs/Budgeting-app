create table if not exists public.budget_plaid_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plaid_item_id text not null,
  plaid_access_token text not null,
  institution_name text not null default '',
  sync_cursor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plaid_item_id)
);

create table if not exists public.budget_plaid_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plaid_item_id text not null,
  plaid_account_id text not null,
  name text not null default '',
  official_name text not null default '',
  type text not null default '',
  subtype text not null default '',
  mask text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plaid_account_id)
);

create table if not exists public.budget_imported_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plaid_transaction_id text not null,
  plaid_account_id text not null default '',
  account_name text not null default '',
  date date not null,
  authorized_date date,
  name text not null default '',
  merchant_name text not null default '',
  amount numeric(12, 2) not null default 0,
  iso_currency_code text not null default 'USD',
  is_pending boolean not null default false,
  plaid_category_primary text not null default '',
  plaid_category_detailed text not null default '',
  suggested_type text not null default 'unknown' check (suggested_type in ('expense', 'income', 'reimbursement', 'transfer', 'savings', 'unknown')),
  suggested_category text not null default 'Other',
  final_type text not null default '',
  final_category text not null default '',
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  app_record_type text not null default '',
  app_record_id text not null default '',
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plaid_transaction_id)
);

create index if not exists budget_plaid_items_user_id_idx on public.budget_plaid_items(user_id);
create index if not exists budget_plaid_accounts_user_id_idx on public.budget_plaid_accounts(user_id);
create index if not exists budget_imported_transactions_user_id_idx on public.budget_imported_transactions(user_id);
create index if not exists budget_imported_transactions_status_idx on public.budget_imported_transactions(user_id, approval_status, date desc);

alter table public.budget_plaid_items enable row level security;
alter table public.budget_plaid_accounts enable row level security;
alter table public.budget_imported_transactions enable row level security;

revoke all on public.budget_plaid_items from anon, authenticated;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.budget_plaid_accounts to authenticated;
grant select, insert, update, delete on public.budget_imported_transactions to authenticated;

drop policy if exists "Users can read their own Plaid accounts" on public.budget_plaid_accounts;
drop policy if exists "Users can insert their own Plaid accounts" on public.budget_plaid_accounts;
drop policy if exists "Users can update their own Plaid accounts" on public.budget_plaid_accounts;
drop policy if exists "Users can delete their own Plaid accounts" on public.budget_plaid_accounts;

create policy "Users can read their own Plaid accounts"
  on public.budget_plaid_accounts for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own Plaid accounts"
  on public.budget_plaid_accounts for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own Plaid accounts"
  on public.budget_plaid_accounts for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own Plaid accounts"
  on public.budget_plaid_accounts for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own imported transactions" on public.budget_imported_transactions;
drop policy if exists "Users can insert their own imported transactions" on public.budget_imported_transactions;
drop policy if exists "Users can update their own imported transactions" on public.budget_imported_transactions;
drop policy if exists "Users can delete their own imported transactions" on public.budget_imported_transactions;

create policy "Users can read their own imported transactions"
  on public.budget_imported_transactions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own imported transactions"
  on public.budget_imported_transactions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own imported transactions"
  on public.budget_imported_transactions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own imported transactions"
  on public.budget_imported_transactions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop trigger if exists set_budget_plaid_accounts_updated_at on public.budget_plaid_accounts;
create trigger set_budget_plaid_accounts_updated_at
  before update on public.budget_plaid_accounts
  for each row
  execute function public.set_budget_profiles_updated_at();

drop trigger if exists set_budget_imported_transactions_updated_at on public.budget_imported_transactions;
create trigger set_budget_imported_transactions_updated_at
  before update on public.budget_imported_transactions
  for each row
  execute function public.set_budget_profiles_updated_at();

drop trigger if exists set_budget_plaid_items_updated_at on public.budget_plaid_items;
create trigger set_budget_plaid_items_updated_at
  before update on public.budget_plaid_items
  for each row
  execute function public.set_budget_profiles_updated_at();
