-- Invite codes by household: the app asks for the code of the household it's showing (not "whatever my
-- current one is"), every household gets its own, and any duplicates or blanks are replaced.

-- give every household a code, and make sure no two share one
update households h set join_code = null
  where join_code is not null and exists (select 1 from households o where o.join_code = h.join_code and o.id < h.id);
update households set join_code = new_join_code() where join_code is null;

create or replace function get_household_code(hid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text; begin
  if not exists (select 1 from members where user_id = auth.uid() and household_id = hid) then raise exception 'You''re not in that household.'; end if;
  select join_code into c from households where id = hid;
  if c is null then c := new_join_code(); update households set join_code = c where id = hid; end if;
  return c;
end $$;

create or replace function reset_household_code(hid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text; begin
  if not exists (select 1 from members where user_id = auth.uid() and household_id = hid) then raise exception 'You''re not in that household.'; end if;
  c := new_join_code(); update households set join_code = c where id = hid;
  return c;
end $$;

-- new households get their code straight away
create or replace function households_code() returns trigger language plpgsql as $$
begin if new.join_code is null then new.join_code := new_join_code(); end if; return new; end $$;
drop trigger if exists households_code on households;
create trigger households_code before insert on households for each row execute function households_code();

grant execute on function get_household_code(uuid), reset_household_code(uuid) to authenticated;

-- check: how many households, how many distinct codes (should match)
select count(*) as households, count(distinct join_code) as distinct_codes, count(*) filter (where join_code is null) as missing from households;
