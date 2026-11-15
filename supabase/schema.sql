-- Huishoudboekje: database voor Supabase.
-- Plak dit volledig in Supabase > SQL Editor > New query en klik op Run.
-- Je mag het opnieuw uitvoeren: bestaande tabellen en gegevens blijven staan.

-- ───────────── Tabellen ─────────────

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique
    default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 40),
  role text not null default 'lid' check (role in ('eigenaar', 'lid')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  book text not null check (book in ('gezin', 'zaak')),
  type text not null check (type in ('uit', 'in')),
  amount_cents integer not null check (amount_cents > 0 and amount_cents < 100000000),
  category text not null check (char_length(category) <= 40),
  note text check (note is null or char_length(note) <= 300),
  date date not null default current_date,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists entries_household_date on public.entries (household_id, date);

create table if not exists public.budgets (
  household_id uuid not null references public.households(id) on delete cascade,
  book text not null check (book in ('gezin', 'zaak')),
  category text not null check (char_length(category) <= 40),
  amount_cents integer not null check (amount_cents > 0 and amount_cents < 100000000),
  primary key (household_id, book, category)
);

-- ───────────── Hulpfuncties voor de toegangsregels ─────────────

create or replace function public.is_member(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_members where household_id = h and user_id = auth.uid());
$$;

create or replace function public.is_owner(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_members where household_id = h and user_id = auth.uid() and role = 'eigenaar');
$$;

-- Het zaakboekje is enkel zichtbaar voor de eigenaar, het gezinsboekje voor iedereen in het gezin.
create or replace function public.can_see(h uuid, b text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when b = 'zaak' then public.is_owner(h) else public.is_member(h) end;
$$;

-- ───────────── Toegangsregels (Row Level Security) ─────────────

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.entries enable row level security;
alter table public.budgets enable row level security;

drop policy if exists "leden zien hun gezin" on public.households;
create policy "leden zien hun gezin" on public.households
  for select to authenticated using (public.is_member(id));

drop policy if exists "eigenaar wijzigt gezin" on public.households;
create policy "eigenaar wijzigt gezin" on public.households
  for update to authenticated using (public.is_owner(id)) with check (public.is_owner(id));

drop policy if exists "leden zien elkaar" on public.household_members;
create policy "leden zien elkaar" on public.household_members
  for select to authenticated using (public.is_member(household_id));

drop policy if exists "eigen naam wijzigen" on public.household_members;
create policy "eigen naam wijzigen" on public.household_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "vertrekken of verwijderen" on public.household_members;
create policy "vertrekken of verwijderen" on public.household_members
  for delete to authenticated using (user_id = auth.uid() or public.is_owner(household_id));

-- Leden mogen alleen hun naam aanpassen, niet hun rol.
revoke update on public.household_members from authenticated;
grant update (display_name) on public.household_members to authenticated;

drop policy if exists "boekingen lezen" on public.entries;
create policy "boekingen lezen" on public.entries
  for select to authenticated using (public.can_see(household_id, book));

drop policy if exists "boekingen toevoegen" on public.entries;
create policy "boekingen toevoegen" on public.entries
  for insert to authenticated with check (public.can_see(household_id, book) and created_by = auth.uid());

drop policy if exists "boekingen wijzigen" on public.entries;
create policy "boekingen wijzigen" on public.entries
  for update to authenticated using (public.can_see(household_id, book)) with check (public.can_see(household_id, book));

drop policy if exists "boekingen verwijderen" on public.entries;
create policy "boekingen verwijderen" on public.entries
  for delete to authenticated using (public.can_see(household_id, book));

drop policy if exists "budgetten" on public.budgets;
create policy "budgetten" on public.budgets
  for all to authenticated using (public.can_see(household_id, book)) with check (public.can_see(household_id, book));

-- ───────────── Gezin aanmaken en aansluiten ─────────────

create or replace function public.create_household(p_name text, p_display_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into households (name) values (coalesce(nullif(trim(p_name), ''), 'Ons gezin')) returning id into hid;
  insert into household_members (household_id, user_id, display_name, role)
    values (hid, auth.uid(), left(coalesce(p_display_name, ''), 40), 'eigenaar');
  return hid;
end;
$$;

create or replace function public.join_household(p_code text, p_display_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id into hid from households where invite_code = upper(trim(p_code));
  if hid is null then raise exception 'invalid invite code'; end if;
  insert into household_members (household_id, user_id, display_name, role)
    values (hid, auth.uid(), left(coalesce(p_display_name, ''), 40), 'lid')
    on conflict (household_id, user_id) do nothing;
  return hid;
end;
$$;

revoke execute on function public.create_household(text, text) from public, anon;
revoke execute on function public.join_household(text, text) from public, anon;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;

-- ───────────── Live bijwerken ─────────────

do $$
begin
  begin alter publication supabase_realtime add table public.entries; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.budgets; exception when duplicate_object then null; end;
end $$;
