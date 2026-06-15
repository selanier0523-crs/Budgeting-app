create table if not exists public.budget_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.budget_profiles enable row level security;

create policy "Users can read their own budget profile"
  on public.budget_profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own budget profile"
  on public.budget_profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own budget profile"
  on public.budget_profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own budget profile"
  on public.budget_profiles
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.budget_profiles to authenticated;

create or replace function public.set_budget_profiles_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_budget_profiles_updated_at
  before update on public.budget_profiles
  for each row
  execute function public.set_budget_profiles_updated_at();
