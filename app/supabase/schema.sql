-- Meal Prep Shopper — Supabase schema
-- Every row belongs to a household; you only see your own household's rows (row level security).

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our household',
  created_at timestamptz not null default now()
);

create table if not exists members (
  user_id uuid primary key references auth.users on delete cascade,
  household_id uuid not null references households on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

-- someone invited by email joins that household on first sign-in
create table if not exists invites (
  email text primary key,
  household_id uuid not null references households on delete cascade,
  invited_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create or replace function my_household() returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from members where user_id = auth.uid()
$$;

-- First sign-in: join the household you were invited to, or start a new one.
-- Returns { household_id, created } — created = true means the app should load starter data.
create or replace function ensure_household() returns json
language plpgsql security definer set search_path = public as $$
declare hid uuid; em text; inv uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select household_id into hid from members where user_id = auth.uid();
  if hid is not null then return json_build_object('household_id', hid, 'created', false); end if;
  select lower(email) into em from auth.users where id = auth.uid();
  select household_id into inv from invites where lower(email) = em;
  if inv is not null then
    insert into members(user_id, household_id, email) values (auth.uid(), inv, em);
    delete from invites where lower(email) = em;
    return json_build_object('household_id', inv, 'created', false);
  end if;
  insert into households default values returning id into hid;
  insert into members(user_id, household_id, email) values (auth.uid(), hid, em);
  return json_build_object('household_id', hid, 'created', true);
end $$;

create table if not exists settings (
  household_id uuid primary key references households on delete cascade default my_household(),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists stores (
  household_id uuid not null references households on delete cascade default my_household(),
  id text not null,
  name text, short text, address text, source text, merchant text, hours text, ad text,
  bulk boolean not null default false, enabled boolean not null default true, sort int not null default 0,
  primary key (household_id, id)
);

create table if not exists items (
  household_id uuid not null references households on delete cascade default my_household(),
  id text not null,
  cat text, name text, qty text, q text, must text[] not null default '{}', units numeric not null default 1,
  have_on date,
  primary key (household_id, id)
);

create table if not exists prices (
  household_id uuid not null references households on delete cascade default my_household(),
  item_id text not null, store_id text not null,
  price numeric, unit_price numeric, unit_needed numeric,
  source text, matched text, updated_at timestamptz default now(), checked_at timestamptz,
  locked boolean not null default false, not_found_on date,
  primary key (household_id, item_id, store_id)
);

create table if not exists recipes (
  household_id uuid not null references households on delete cascade default my_household(),
  id text not null,
  title text not null, active boolean not null default false, servings numeric, yield text, meal text,
  fridge text, "freeze" text, ing text[] not null default '{}', steps text[] not null default '{}', tip text,
  custom boolean not null default false, source text, items jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (household_id, id)
);

create table if not exists week_plan (
  household_id uuid primary key references households on delete cascade default my_household(),
  data jsonb not null default '{"days":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists purchases (
  id bigint generated always as identity primary key,
  household_id uuid not null references households on delete cascade default my_household(),
  day date not null default current_date,
  store_id text, store text, item_id text, item text,
  planned numeric, paid numeric, status text, receipt_line text,
  created_at timestamptz not null default now()
);
create index if not exists purchases_household_day on purchases(household_id, day desc);

-- SerpApi key: members can write it, nobody can read it back (only the server function can)
create table if not exists household_secrets (
  household_id uuid primary key references households on delete cascade default my_household(),
  serpapi_key text,
  updated_at timestamptz not null default now()
);

create table if not exists serp_usage (
  household_id uuid not null references households on delete cascade,
  month text not null,
  n int not null default 0,
  primary key (household_id, month)
);

-- Store locations found on the map are shared by everyone (they're public places)
create table if not exists store_locations (
  chain text not null, name text, label text, lat double precision not null, lng double precision not null,
  source text default 'OpenStreetMap', created_at timestamptz not null default now(),
  primary key (chain, lat, lng)
);
create table if not exists store_areas (
  cell text primary key, searched_at timestamptz not null default now(), found int not null default 0
);

-- ---------------- row level security ----------------
alter table households enable row level security;
alter table members enable row level security;
alter table invites enable row level security;
alter table settings enable row level security;
alter table stores enable row level security;
alter table items enable row level security;
alter table prices enable row level security;
alter table recipes enable row level security;
alter table week_plan enable row level security;
alter table purchases enable row level security;
alter table household_secrets enable row level security;
alter table serp_usage enable row level security;
alter table store_locations enable row level security;
alter table store_areas enable row level security;

drop policy if exists "own household" on households;
create policy "own household" on households for all using (id = my_household()) with check (id = my_household());
drop policy if exists "see household members" on members;
create policy "see household members" on members for select using (household_id = my_household());
drop policy if exists "manage invites" on invites;
create policy "manage invites" on invites for all using (household_id = my_household()) with check (household_id = my_household());

do $$
declare t text;
begin
  foreach t in array array['settings','stores','items','prices','recipes','week_plan','purchases'] loop
    execute format('drop policy if exists "household rows" on %I', t);
    execute format('create policy "household rows" on %I for all using (household_id = my_household()) with check (household_id = my_household())', t);
  end loop;
end $$;

drop policy if exists "write own secret" on household_secrets;
create policy "write own secret" on household_secrets for insert with check (household_id = my_household());
drop policy if exists "update own secret" on household_secrets;
create policy "update own secret" on household_secrets for update using (household_id = my_household()) with check (household_id = my_household());
drop policy if exists "see own usage" on serp_usage;
create policy "see own usage" on serp_usage for select using (household_id = my_household());

drop policy if exists "read locations" on store_locations;
create policy "read locations" on store_locations for select to authenticated using (true);
drop policy if exists "add locations" on store_locations;
create policy "add locations" on store_locations for insert to authenticated with check (true);
drop policy if exists "read areas" on store_areas;
create policy "read areas" on store_areas for select to authenticated using (true);
drop policy if exists "add areas" on store_areas;
create policy "add areas" on store_areas for insert to authenticated with check (true);
drop policy if exists "update areas" on store_areas;
create policy "update areas" on store_areas for update to authenticated using (true) with check (true);

-- does this household have a SerpApi key saved? (without revealing it)
create or replace function has_serp_key() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from household_secrets where household_id = my_household() and coalesce(serpapi_key,'') <> '')
$$;

-- save the SerpApi key without ever reading it back
create or replace function set_serp_key(k text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if my_household() is null then raise exception 'no household'; end if;
  insert into household_secrets(household_id, serpapi_key, updated_at) values (my_household(), k, now())
  on conflict (household_id) do update set serpapi_key = excluded.serpapi_key, updated_at = now();
end $$;

-- ---------------- live sync between phones ----------------
do $$
declare t text;
begin
  foreach t in array array['items','prices','recipes','week_plan','purchases','settings','stores'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------------- table access for signed-in users (row level security still applies) ----------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on households, members, invites, settings, stores, items, prices, recipes, week_plan, purchases to authenticated;
grant select on serp_usage to authenticated;
grant select, insert on store_locations to authenticated;
grant select, insert, update on store_areas to authenticated;
grant usage on all sequences in schema public to authenticated;
grant execute on function my_household(), ensure_household(), has_serp_key(), set_serp_key(text) to authenticated;
-- TRUNCATE ignores row level security, so nobody but the owner gets it
revoke truncate, trigger, references on all tables in schema public from authenticated, anon;
alter default privileges in schema public revoke truncate, trigger, references on tables from authenticated, anon;

-- ---------------- pantry: what's on hand ----------------
create table if not exists pantry (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade default my_household(),
  item_id text,
  name text not null,
  amount text,
  level text not null default 'plenty',
  place text not null default 'pantry',
  added_on date not null default current_date,
  use_by date
);
create index if not exists pantry_household on pantry(household_id);
alter table pantry enable row level security;
drop policy if exists "household rows" on pantry;
create policy "household rows" on pantry for all using (household_id = my_household()) with check (household_id = my_household());
grant select, insert, update, delete on pantry to authenticated;
alter table pantry replica identity full;
do $$ begin
  alter publication supabase_realtime add table pantry;
exception when duplicate_object then null; end $$;

-- ---------------- Instacart: one key per household, write-only like SerpApi ----------------
alter table household_secrets add column if not exists instacart_key text;
create or replace function set_instacart_key(k text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if my_household() is null then raise exception 'no household'; end if;
  insert into household_secrets(household_id, instacart_key, updated_at) values (my_household(), k, now())
  on conflict (household_id) do update set instacart_key = excluded.instacart_key, updated_at = now();
end $$;
create or replace function has_instacart_key() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from household_secrets where household_id = my_household() and coalesce(instacart_key,'') <> '')
$$;
grant execute on function set_instacart_key(text), has_instacart_key() to authenticated;
-- People can belong to up to 5 households; one is "current" and everything in the app shows that one.

-- membership: one row per person per household
alter table members drop constraint if exists members_pkey;
alter table members add primary key (user_id, household_id);

-- which household you're looking at right now
create table if not exists user_prefs (
  user_id uuid primary key references auth.users on delete cascade,
  current_household uuid references households on delete set null
);
alter table user_prefs enable row level security;
drop policy if exists "own prefs" on user_prefs;
create policy "own prefs" on user_prefs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on user_prefs to authenticated;
insert into user_prefs(user_id, current_household) select user_id, household_id from members on conflict (user_id) do nothing;

-- the current household (if you're still a member of it), else your first one
create or replace function my_household() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.current_household from user_prefs p join members m on m.user_id = p.user_id and m.household_id = p.current_household where p.user_id = auth.uid()),
    (select household_id from members where user_id = auth.uid() order by created_at limit 1))
$$;

-- at most 5 households each
create or replace function members_limit() returns trigger language plpgsql as $$
begin
  if (select count(*) from members where user_id = new.user_id) >= 5 then
    raise exception 'You can be in up to 5 households. Leave one first.';
  end if;
  return new;
end $$;
drop trigger if exists members_limit on members;
create trigger members_limit before insert on members for each row execute function members_limit();

-- several households can invite the same email
alter table invites drop constraint if exists invites_pkey;
alter table invites add primary key (email, household_id);

create or replace function set_current(hid uuid) returns void
language sql security definer set search_path = public as $$
  insert into user_prefs(user_id, current_household) values (auth.uid(), hid)
  on conflict (user_id) do update set current_household = excluded.current_household
$$;

-- first sign-in: join the household that invited you, or start your own
create or replace function ensure_household() returns json
language plpgsql security definer set search_path = public as $$
declare hid uuid; em text; inv uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  hid := my_household();
  if hid is not null then
    insert into user_prefs(user_id, current_household) values (auth.uid(), hid) on conflict (user_id) do nothing;
    return json_build_object('household_id', hid, 'created', false);
  end if;
  select lower(email) into em from auth.users where id = auth.uid();
  select household_id into inv from invites where lower(email) = em order by created_at limit 1;
  if inv is not null then
    insert into members(user_id, household_id, email) values (auth.uid(), inv, em);
    delete from invites where lower(email) = em and household_id = inv;
    perform set_current(inv);
    return json_build_object('household_id', inv, 'created', false);
  end if;
  insert into households default values returning id into hid;
  insert into members(user_id, household_id, email) values (auth.uid(), hid, em);
  perform set_current(hid);
  return json_build_object('household_id', hid, 'created', true);
end $$;

-- your households, with the current one marked
create or replace function list_households() returns table(id uuid, name text, members int, is_current boolean)
language sql stable security definer set search_path = public as $$
  select h.id, h.name, (select count(*)::int from members m2 where m2.household_id = h.id), h.id = my_household()
  from households h join members m on m.household_id = h.id and m.user_id = auth.uid()
  order by m.created_at
$$;

-- invites waiting for you from households you're not in yet
create or replace function my_invites() returns table(household_id uuid, name text, invited_by text)
language sql stable security definer set search_path = public as $$
  select i.household_id, h.name, (select email from members where user_id = i.invited_by limit 1)
  from invites i join households h on h.id = i.household_id
  where lower(i.email) = (select lower(email) from auth.users where id = auth.uid())
    and not exists (select 1 from members m where m.user_id = auth.uid() and m.household_id = i.household_id)
$$;

create or replace function switch_household(hid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from members where user_id = auth.uid() and household_id = hid) then raise exception 'You''re not in that household.'; end if;
  perform set_current(hid);
end $$;

create or replace function create_household(nm text) returns json
language plpgsql security definer set search_path = public as $$
declare hid uuid; em text;
begin
  if (select count(*) from members where user_id = auth.uid()) >= 5 then raise exception 'You can be in up to 5 households. Leave one first.'; end if;
  select lower(email) into em from auth.users where id = auth.uid();
  insert into households(name) values (coalesce(nullif(trim(nm), ''), 'New household')) returning id into hid;
  insert into members(user_id, household_id, email) values (auth.uid(), hid, em);
  perform set_current(hid);
  return json_build_object('household_id', hid, 'created', true);
end $$;

create or replace function accept_invite(hid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare em text;
begin
  select lower(email) into em from auth.users where id = auth.uid();
  if not exists (select 1 from invites where lower(email) = em and household_id = hid) then raise exception 'That invite is gone.'; end if;
  insert into members(user_id, household_id, email) values (auth.uid(), hid, em);
  delete from invites where lower(email) = em and household_id = hid;
  perform set_current(hid);
end $$;

create or replace function decline_invite(hid uuid) returns void
language sql security definer set search_path = public as $$
  delete from invites where household_id = hid and lower(email) = (select lower(email) from auth.users where id = auth.uid())
$$;

-- leave a household; the last one out deletes it. You must keep at least one.
create or replace function leave_household(hid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from members where user_id = auth.uid()) <= 1 then raise exception 'You need at least one household. Create or join another first.'; end if;
  delete from members where user_id = auth.uid() and household_id = hid;
  if not exists (select 1 from members where household_id = hid) then delete from households where id = hid; end if;
  update user_prefs set current_household = (select household_id from members where user_id = auth.uid() order by created_at limit 1)
    where user_id = auth.uid() and (current_household = hid or current_household is null);
end $$;

grant execute on function list_households(), my_invites(), switch_household(uuid), create_household(text), accept_invite(uuid), decline_invite(uuid), leave_household(uuid) to authenticated;
revoke execute on function set_current(uuid) from public, anon, authenticated;
-- Home codes: share a short code or link and people join your household with it.
alter table households add column if not exists join_code text unique;

-- 6 characters, no look-alikes (no 0/O, 1/I/L)
create or replace function new_join_code() returns text
language plpgsql as $$
declare a text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; c text; begin
  loop
    c := '';
    for i in 1..6 loop c := c || substr(a, 1 + floor(random() * length(a))::int, 1); end loop;
    exit when not exists (select 1 from households where join_code = c);
  end loop;
  return c;
end $$;

-- your current household's code (made the first time you ask)
create or replace function get_join_code() returns text
language plpgsql security definer set search_path = public as $$
declare hid uuid := my_household(); c text; begin
  if hid is null then raise exception 'no household'; end if;
  select join_code into c from households where id = hid;
  if c is null then c := new_join_code(); update households set join_code = c where id = hid; end if;
  return c;
end $$;

-- a new code; the old one stops working
create or replace function reset_join_code() returns text
language plpgsql security definer set search_path = public as $$
declare hid uuid := my_household(); c text; begin
  if hid is null then raise exception 'no household'; end if;
  c := new_join_code(); update households set join_code = c where id = hid;
  return c;
end $$;

-- which household a code belongs to (shown before you join)
create or replace function peek_join_code(code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('name', h.name, 'members', (select count(*) from members m where m.household_id = h.id),
    'already', exists (select 1 from members m where m.household_id = h.id and m.user_id = auth.uid()))
  from households h where h.join_code = right(upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')), 6)
$$;

create or replace function join_with_code(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid; em text; begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select id into hid from households where join_code = right(upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')), 6);
  if hid is null then raise exception 'That code doesn''t match a household. Check it, or ask for a new one.'; end if;
  if not exists (select 1 from members where user_id = auth.uid() and household_id = hid) then
    select lower(email) into em from auth.users where id = auth.uid();
    insert into members(user_id, household_id, email) values (auth.uid(), hid, em);  -- the 5-household limit applies here
    delete from invites where household_id = hid and lower(email) = em;
  end if;
  perform set_current(hid);
  return hid;
end $$;

revoke execute on function new_join_code() from public, anon, authenticated;
grant execute on function get_join_code(), reset_join_code(), peek_join_code(text), join_with_code(text) to authenticated;
-- Upcoming weeks: one row each, so saving this week's plan (or a checkmark) can never wipe them.
create table if not exists upcoming_weeks (
  household_id uuid not null references households on delete cascade default my_household(),
  start date not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (household_id, start)
);
-- bring over any weeks that were stored inside the weekly plan
insert into upcoming_weeks(household_id, start, data)
select w.household_id, (x->>'start')::date, x from week_plan w, jsonb_array_elements(coalesce(w.data->'weeks', '[]'::jsonb)) x
on conflict do nothing;

-- What you actually put in the cart: amount, unit and price per unit
alter table purchases add column if not exists qty numeric;
alter table purchases add column if not exists unit text;
alter table purchases add column if not exists unit_price numeric;

-- Carts for projects and one-off meals (a party, Thanksgiving, chili for 40)
create table if not exists carts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade default my_household(),
  name text not null,
  people int,
  event_date date,
  budget numeric,
  recipes jsonb not null default '[]'::jsonb,   -- [{ id, portions }]
  lines jsonb not null default '[]'::jsonb,     -- [{ key, item_id, name, qty, unit, unit_price, total, done, store, recipe }]
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['upcoming_weeks','carts'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "household rows" on %I', t);
    execute format('create policy "household rows" on %I for all using (household_id = my_household()) with check (household_id = my_household())', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('revoke truncate, trigger, references on %I from authenticated, anon', t);
    execute format('alter table %I replica identity full', t);
    begin execute format('alter publication supabase_realtime add table %I', t); exception when duplicate_object then null; end;
  end loop;
end $$;

-- 2026-11-20: recipes remember their cuisine
alter table recipes add column if not exists cuisine text;

-- 2026-11-20b
alter table recipes add column if not exists calories numeric;

-- 2026-11-20c: WFD Plus
-- WFD Plus (ad-free). One row per person; written only by the server (Stripe webhook / store receipts).
create table if not exists entitlements (
  user_id uuid primary key references auth.users on delete cascade,
  plus boolean not null default false,
  source text,                 -- 'stripe' | 'app_store' | 'play' | 'gift'
  stripe_customer text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table entitlements enable row level security;
drop policy if exists "read own entitlement" on entitlements;
create policy "read own entitlement" on entitlements for select using (user_id = auth.uid());
grant select on entitlements to authenticated;
revoke insert, update, delete, truncate on entitlements from authenticated, anon;

-- 2026-11-20d
alter table carts add column if not exists meta jsonb not null default '{}'::jsonb;

-- 2026-11-21: the app server (service_role) must be able to use every table; users stay limited by row security
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;

-- 2026-11-21b
alter table recipes add column if not exists image text;
-- feedback & contact messages (from the app and the support page). Anyone can send; only you read them (Table editor).
create table if not exists feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid() references auth.users on delete set null,
  kind text not null default 'feedback' check (kind in ('feedback', 'bug', 'idea', 'help')),
  message text not null check (length(message) between 2 and 4000),
  reply_to text check (reply_to is null or length(reply_to) <= 200),
  app_version text check (app_version is null or length(app_version) <= 40),
  page text check (page is null or length(page) <= 40)
);
alter table feedback enable row level security;
drop policy if exists "anyone can send feedback" on feedback;
create policy "anyone can send feedback" on feedback for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
grant insert on feedback to anon, authenticated;
revoke select, update, delete, truncate on feedback from anon, authenticated;
grant all on feedback to service_role;
