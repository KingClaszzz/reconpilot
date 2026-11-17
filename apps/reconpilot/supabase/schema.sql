-- ReconPilot schema. Paste into the Supabase SQL editor and run once.
-- Users only see their own rows, and closed periods can't be edited.

create extension if not exists pgcrypto;

-- we only keep the last 4 digits of an account number
create table if not exists public.accounts (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  bank        text not null check (char_length(bank) between 1 and 60),
  last4       text not null check (last4 ~ '^[0-9]{4}$'),
  currency    text not null default 'IDR' check (currency ~ '^[A-Z]{3}$'),
  created_at  timestamptz not null default now()
);

create table if not exists public.runs (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id  uuid references public.accounts(id) on delete set null,
  name        text not null check (char_length(name) between 1 and 120),
  period      text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  bank_file   text not null default '' check (char_length(bank_file) <= 200),
  erp_file    text not null default '' check (char_length(erp_file) <= 200),
  bank_lines  int  not null default 0,
  erp_lines   int  not null default 0,
  counts      jsonb not null,
  totals      jsonb not null,
  exceptions  int  not null default 0,
  resolved    int  not null default 0,
  status      text not null default 'in_review' check (status in ('in_review', 'closed')),
  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);

create table if not exists public.run_items (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  run_id      uuid not null references public.runs(id) on delete cascade,
  position    int  not null,
  status      text not null check (status in ('matched', 'amount_mismatch', 'unmatched_a', 'unmatched_b', 'duplicate')),
  ref         text not null check (char_length(ref) <= 200),
  a           jsonb,
  b           jsonb,
  diff        numeric(20, 2),
  source      text check (source in ('A', 'B')),
  resolution  text not null check (resolution in ('auto', 'open', 'resolved', 'ignored')),
  note        text check (char_length(note) <= 1000),
  resolved_at timestamptz
);

create table if not exists public.activity (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  at          timestamptz not null default now(),
  actor       text not null check (char_length(actor) <= 200),
  action      text not null check (char_length(action) <= 80),
  target      text not null default '' check (char_length(target) <= 300),
  run_id      uuid references public.runs(id) on delete set null
);

create index if not exists runs_owner_period on public.runs (owner, period desc);
create index if not exists items_run on public.run_items (run_id, position);
create index if not exists items_open on public.run_items (owner, resolution) where resolution = 'open';
create index if not exists activity_owner_at on public.activity (owner, at desc);

-- keeps runs.resolved up to date
create or replace function public.sync_run_resolved() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.runs r
     set resolved = (select count(*) from public.run_items i
                      where i.run_id = r.id and i.resolution in ('resolved', 'ignored'))
   where r.id = new.run_id;
  return null;
end $$;

drop trigger if exists run_items_resolved on public.run_items;
create trigger run_items_resolved
  after update of resolution on public.run_items
  for each row execute function public.sync_run_resolved();

-- RLS
alter table public.accounts  enable row level security;
alter table public.runs      enable row level security;
alter table public.run_items enable row level security;
alter table public.activity  enable row level security;

drop policy if exists "own accounts" on public.accounts;
create policy "own accounts" on public.accounts for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

drop policy if exists "read own runs" on public.runs;
drop policy if exists "create own runs" on public.runs;
drop policy if exists "edit open runs" on public.runs;
drop policy if exists "delete own runs" on public.runs;
create policy "read own runs"   on public.runs for select to authenticated using (owner = (select auth.uid()));
create policy "create own runs" on public.runs for insert to authenticated with check (owner = (select auth.uid()));
create policy "edit open runs"  on public.runs for update to authenticated
  using (owner = (select auth.uid()) and status = 'in_review') with check (owner = (select auth.uid()));
create policy "delete own runs" on public.runs for delete to authenticated using (owner = (select auth.uid()));

drop policy if exists "read own items" on public.run_items;
drop policy if exists "create own items" on public.run_items;
drop policy if exists "resolve items of open runs" on public.run_items;
create policy "read own items"   on public.run_items for select to authenticated using (owner = (select auth.uid()));
create policy "create own items" on public.run_items for insert to authenticated with check (owner = (select auth.uid()));
create policy "resolve items of open runs" on public.run_items for update to authenticated
  using (owner = (select auth.uid())
         and exists (select 1 from public.runs r where r.id = run_id and r.status = 'in_review'))
  with check (owner = (select auth.uid()));

drop policy if exists "read own activity" on public.activity;
drop policy if exists "write own activity" on public.activity;
create policy "read own activity"  on public.activity for select to authenticated using (owner = (select auth.uid()));
create policy "write own activity" on public.activity for insert to authenticated with check (owner = (select auth.uid()));
-- no update/delete policy, so the audit log is append-only
