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

-- ───────────── Thuis: boodschappen, voorraad, recepten, weekmenu (stap 4) ─────────────
-- Dit deel is voor het hele gezin zichtbaar.

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  qty text check (qty is null or char_length(qty) <= 40),
  source text check (source is null or char_length(source) <= 120),
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists shopping_household on public.shopping_items (household_id);

create table if not exists public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  place text not null default 'kast' check (place in ('kast', 'koelkast', 'diepvries', 'andere')),
  status text not null default 'ok' check (status in ('ok', 'bijna', 'op')),
  updated_at timestamptz not null default now()
);
create index if not exists pantry_household on public.pantry_items (household_id);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  servings integer check (servings is null or servings between 1 and 99),
  ingredients jsonb not null default '[]'::jsonb check (jsonb_typeof(ingredients) = 'array' and pg_column_size(ingredients) < 50000),
  steps text check (steps is null or char_length(steps) <= 20000),
  photo text check (photo is null or char_length(photo) <= 150000),
  created_at timestamptz not null default now()
);
create index if not exists recipes_household on public.recipes (household_id);

create table if not exists public.menu_days (
  household_id uuid not null references public.households(id) on delete cascade,
  date date not null,
  meal text not null check (char_length(meal) between 1 and 120),
  recipe_id uuid references public.recipes(id) on delete set null,
  primary key (household_id, date)
);

alter table public.shopping_items enable row level security;
alter table public.pantry_items enable row level security;
alter table public.recipes enable row level security;
alter table public.menu_days enable row level security;

drop policy if exists "gezin boodschappen" on public.shopping_items;
create policy "gezin boodschappen" on public.shopping_items
  for all to authenticated using (public.is_member(household_id)) with check (public.is_member(household_id));

drop policy if exists "gezin voorraad" on public.pantry_items;
create policy "gezin voorraad" on public.pantry_items
  for all to authenticated using (public.is_member(household_id)) with check (public.is_member(household_id));

drop policy if exists "gezin recepten" on public.recipes;
create policy "gezin recepten" on public.recipes
  for all to authenticated using (public.is_member(household_id)) with check (public.is_member(household_id));

drop policy if exists "gezin weekmenu" on public.menu_days;
create policy "gezin weekmenu" on public.menu_days
  for all to authenticated using (public.is_member(household_id)) with check (public.is_member(household_id));

-- ───────────── Google Agenda (geheim iCal-adres) ─────────────
-- Het geheime adres staat alleen hier in de database, nooit in de code van de app.
-- Niemand kan het uitlezen: de app krijgt enkel de afspraken, via calendar_ics().

create extension if not exists http with schema extensions;

create table if not exists public.household_secrets (
  household_id uuid primary key references public.households(id) on delete cascade,
  ical_url text check (ical_url is null or ical_url ~ '^https://calendar\.google\.com/calendar/ical/[^\s]+\.ics$')
);
alter table public.household_secrets enable row level security;
-- Bewust geen policies: rechtstreeks lezen of schrijven kan niet.
revoke all on public.household_secrets from anon, authenticated;

create or replace function public.set_calendar_url(p_url text) returns void
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  select household_id into hid from household_members where user_id = auth.uid() and role = 'eigenaar' limit 1;
  if hid is null then raise exception 'only the owner can set the calendar'; end if;
  insert into household_secrets (household_id, ical_url) values (hid, nullif(trim(p_url), ''))
    on conflict (household_id) do update set ical_url = excluded.ical_url;
end;
$$;

create or replace function public.has_calendar() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from household_secrets s join household_members m on m.household_id = s.household_id
    where m.user_id = auth.uid() and s.ical_url is not null
  );
$$;

create or replace function public.calendar_ics() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare url text; r extensions.http_response;
begin
  select s.ical_url into url from household_secrets s join household_members m on m.household_id = s.household_id
    where m.user_id = auth.uid() and s.ical_url is not null limit 1;
  if url is null then return null; end if;
  r := extensions.http_get(url);
  if r.status <> 200 then raise exception 'calendar fetch failed (%)', r.status; end if;
  return r.content;
end;
$$;

revoke execute on function public.set_calendar_url(text) from public, anon;
revoke execute on function public.has_calendar() from public, anon;
revoke execute on function public.calendar_ics() from public, anon;
grant execute on function public.set_calendar_url(text) to authenticated;
grant execute on function public.has_calendar() to authenticated;
grant execute on function public.calendar_ics() to authenticated;

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
  begin alter publication supabase_realtime add table public.shopping_items; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.pantry_items; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.recipes; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.menu_days; exception when duplicate_object then null; end;
end $$;
