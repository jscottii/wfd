-- Owner dashboard: where people shop from and which stores they use. Areas only: home addresses are cut down
-- to "City, ST" here and never leave the database whole; trip starts are rounded to about 10 km (0.1°).
create or replace function admin_geo(days int default 30) returns json
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => greatest(1, least(days, 365))); out json;
begin
  if not is_admin() then raise exception 'admins only'; end if;
  select json_build_object(
    -- "1 Main St, Alameda, CA 94502" → "Alameda, CA" (also "…, Alameda, California 94502"); anything else is "Other", never the street
    'home_areas', (select coalesce(json_agg(json_build_object('k', k, 'n', n) order by n desc), '[]') from (
      select case when a ~ '^[-0-9., ]+$' then 'Shared location (no town)'
                  else coalesce(nullif(regexp_replace(a, '^(?:.*,)?\s*([^,]+),\s*([A-Za-z][A-Za-z ]*[A-Za-z])(?:\s+[0-9-]+)?\s*$', '\1, \2'), a), 'Other (couldn''t read the town)') end k, count(*) n
      from (select btrim(data->>'homeAddress') a from settings where coalesce(data->>'homeSet', 'false') = 'true' and coalesce(data->>'homeAddress', '') <> '') s
      group by 1 order by 2 desc limit 25) x),
    'homes_set', (select count(*) from settings where coalesce(data->>'homeSet', 'false') = 'true'),
    -- where trips start: home, here (current location) or a typed place
    'trip_starts', (select coalesce(json_agg(json_build_object('k', k, 'n', n) order by n desc), '[]') from (
      select coalesce(props->>'start', 'home (before Nov 28)') k, count(*) n from events where name = 'trip_planned' and created_at >= since group by 1) x),
    -- rounded points for the map
    'trip_points', (select coalesce(json_agg(json_build_object('lat', lat, 'lng', lng, 'n', n, 'away', away)), '[]') from (
      select (props->>'lat')::numeric lat, (props->>'lng')::numeric lng, count(*) n, bool_or(coalesce(props->>'start', 'home') <> 'home') away
      from events where name = 'trip_planned' and created_at >= since and props ? 'lat' group by 1, 2) x),
    -- stores households keep switched on, by chain
    'stores_saved', (select coalesce(json_agg(json_build_object('k', k, 'n', n) order by n desc), '[]') from (
      select coalesce(nullif(btrim(short), ''), name, id) k, count(distinct household_id) n from stores where enabled group by 1 order by 2 desc limit 25) x),
    -- stores that ended up on planned trips
    'stores_on_trips', (select coalesce(json_agg(json_build_object('k', k, 'n', n) order by n desc), '[]') from (
      select s k, count(*) n from events, jsonb_array_elements_text(case when jsonb_typeof(props->'stores') = 'array' then props->'stores' else '[]'::jsonb end) s
      where name = 'trip_planned' and created_at >= since group by 1 order by 2 desc limit 25) x)
  ) into out;
  return out;
end $$;
revoke execute on function admin_geo(int) from public, anon;
grant execute on function admin_geo(int) to authenticated;
