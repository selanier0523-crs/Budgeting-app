create schema if not exists app_private;

create table if not exists public.budget_households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budget_household_members (
  household_id uuid not null references public.budget_households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index if not exists budget_households_owner_id_idx on public.budget_households(owner_id);
create index if not exists budget_household_members_user_id_idx on public.budget_household_members(user_id);

alter table public.budget_households enable row level security;
alter table public.budget_household_members enable row level security;

grant usage on schema app_private to authenticated;
grant select, insert, update, delete on public.budget_households to authenticated;
grant select, insert, update, delete on public.budget_household_members to authenticated;

create or replace function app_private.is_budget_household_member(target_household_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.budget_household_members members
    where members.household_id = target_household_id
      and members.user_id = target_user_id
  );
$$;

create or replace function app_private.users_share_budget_household(profile_user_id uuid, viewer_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.budget_household_members viewer_member
    join public.budget_household_members profile_member
      on profile_member.household_id = viewer_member.household_id
    where viewer_member.user_id = viewer_user_id
      and profile_member.user_id = profile_user_id
  );
$$;

grant execute on function app_private.is_budget_household_member(uuid, uuid) to authenticated;
grant execute on function app_private.users_share_budget_household(uuid, uuid) to authenticated;

create policy "Household members can read households"
on public.budget_households for select
to authenticated
using ((select auth.uid()) = owner_id or app_private.is_budget_household_member(id, (select auth.uid())));

create policy "Users can create owned households"
on public.budget_households for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Owners can update households"
on public.budget_households for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Owners can delete households"
on public.budget_households for delete
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Household members can read memberships"
on public.budget_household_members for select
to authenticated
using (app_private.is_budget_household_member(household_id, (select auth.uid())));

create policy "Users can join households with a code"
on public.budget_household_members for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    role = 'member'
    or exists (
      select 1 from public.budget_households households
      where households.id = household_id
        and households.owner_id = (select auth.uid())
    )
  )
);

create policy "Users and owners can update memberships"
on public.budget_household_members for update
to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1 from public.budget_households households
    where households.id = budget_household_members.household_id
      and households.owner_id = (select auth.uid())
  )
)
with check (
  role in ('owner', 'member')
  and (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.budget_households households
      where households.id = budget_household_members.household_id
        and households.owner_id = (select auth.uid())
    )
  )
);

create policy "Users can leave households"
on public.budget_household_members for delete
to authenticated
using ((select auth.uid()) = user_id or exists (
  select 1 from public.budget_households households
  where households.id = budget_household_members.household_id
    and households.owner_id = (select auth.uid())
));

drop policy if exists "Users can read their own budget profile" on public.budget_profiles;

create policy "Users can read profiles shared with their household"
on public.budget_profiles for select
to authenticated
using ((select auth.uid()) = user_id or app_private.users_share_budget_household(user_id, (select auth.uid())));

create trigger set_budget_households_updated_at
before update on public.budget_households
for each row execute function public.set_budget_profiles_updated_at();
