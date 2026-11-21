-- First-party usage analytics (kept in our own database; never sold or shared) + admin dashboards.
create table if not exists events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid() references auth.users on delete cascade,
  household_id uuid default my_household() references households on delete cascade,
  name text not null check (name ~ '^[a-z_]{2,40}$'),
  props jsonb not null default '{}'::jsonb check (pg_column_size(props) < 2000),
  app_version text check (app_version is null or length(app_version) <= 40)
);
create index if not exists events_time on events (created_at);
create index if not exists events_name_time on events (name, created_at);
alter table events enable row level security;
drop policy if exists "log own events" on events;
create policy "log own events" on events for insert to authenticated with check (user_id = auth.uid());
grant insert on events to authenticated;
revoke select, update, delete, truncate on events from anon, authenticated;
grant all on events to service_role;

create table if not exists admins (user_id uuid primary key references auth.users on delete cascade);
alter table admins enable row level security;
revoke all on admins from anon, authenticated;
grant all on admins to service_role;
-- the app owner (first account) is the admin
insert into admins(user_id) select id from auth.users order by created_at limit 1 on conflict do nothing;

create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;
grant execute on function is_admin() to authenticated;

-- everything the dashboards need, in one call (admins only)
create or replace function admin_stats(days int default 30) returns json
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => greatest(1, least(days, 365))); out json;
begin
  if not is_admin() then raise exception 'admins only'; end if;
  select json_build_object(
    'users_total', (select count(*) from auth.users),
    'users_new', (select count(*) from auth.users where created_at >= since),
    'households_total', (select count(*) from households),
    'members_avg', (select round(avg(c)::numeric, 1) from (select count(*) c from members group by household_id) x),
    'active_users', (select count(distinct user_id) from events where created_at >= since),
    'active_7d', (select count(distinct user_id) from events where created_at >= now() - interval '7 days'),
    'active_1d', (select count(distinct user_id) from events where created_at >= now() - interval '1 day'),
    'plus_members', (select count(*) from entitlements where plus),
    'feedback_total', (select count(*) from feedback),
    'feedback_new', (select count(*) from feedback where created_at >= since),
    'signups_by_day', (select coalesce(json_agg(json_build_object('d', d, 'n', n) order by d), '[]') from (select created_at::date d, count(*) n from auth.users where created_at >= since group by 1) x),
    'active_by_day', (select coalesce(json_agg(json_build_object('d', d, 'n', n) order by d), '[]') from (select created_at::date d, count(distinct user_id) n from events where created_at >= since group by 1) x),
    'events_by_name', (select coalesce(json_agg(json_build_object('k', name, 'n', n) order by n desc), '[]') from (select name, count(*) n from events where created_at >= since group by 1) x),
    'orders_by_store', (select coalesce(json_agg(json_build_object('k', k, 'n', n) order by n desc), '[]') from (select props->>'store' k, count(*) n from events where name = 'order_click' and created_at >= since group by 1) x),
    'prep_style', (select coalesce(json_agg(json_build_object('k', k, 'n', n) order by n desc), '[]') from (select coalesce(props->>'style', '?') k, count(*) n from events where name = 'prep_open' and created_at >= since group by 1) x),
    'recipe_sources', (select coalesce(json_agg(json_build_object('k', k, 'n', n) order by n desc), '[]') from (select coalesce(props->>'via', '?') k, count(*) n from events where name = 'recipe_saved' and created_at >= since group by 1) x),
    'top_recipes', (select coalesce(json_agg(json_build_object('k', title, 'n', n) order by n desc), '[]') from (select r.title, count(distinct r.household_id) n from recipes r where r.active group by r.title order by 2 desc limit 10) x),
    'ad_impressions', (select count(*) from events where name = 'ad_impression' and created_at >= since),
    'ad_clicks', (select count(*) from events where name = 'ad_click' and created_at >= since),
    'ads_by_slot', (select coalesce(json_agg(json_build_object('k', k, 'imp', imp, 'clk', clk) order by imp desc), '[]') from (select props->>'slot' k, count(*) filter (where name = 'ad_impression') imp, count(*) filter (where name = 'ad_click') clk from events where name in ('ad_impression', 'ad_click') and created_at >= since group by 1) x),
    'ads_by_day', (select coalesce(json_agg(json_build_object('d', d, 'n', n) order by d), '[]') from (select created_at::date d, count(*) n from events where name = 'ad_impression' and created_at >= since group by 1) x),
    'db_bytes', pg_database_size(current_database()),
    'tables', (select coalesce(json_agg(json_build_object('k', relname, 'rows', n_live_tup, 'bytes', pg_total_relation_size(relid)) order by pg_total_relation_size(relid) desc), '[]') from pg_stat_user_tables where schemaname = 'public'),
    'storage_by_household', (select coalesce(json_agg(json_build_object('k', h.name, 'recipes', (select count(*) from recipes r where r.household_id = h.id), 'items', (select count(*) from items i where i.household_id = h.id), 'pantry', (select count(*) from pantry p where p.household_id = h.id), 'purchases', (select count(*) from purchases p where p.household_id = h.id)) order by h.created_at), '[]') from households h),
    'feedback_recent', (select coalesce(json_agg(json_build_object('at', created_at, 'kind', kind, 'msg', left(message, 300), 'reply', reply_to, 'v', app_version) order by created_at desc), '[]') from (select * from feedback order by created_at desc limit 20) f)
  ) into out;
  return out;
end $$;
revoke execute on function admin_stats(int) from public, anon;
grant execute on function admin_stats(int) to authenticated;
