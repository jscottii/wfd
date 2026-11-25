-- Guests (people who chose "Continue without an account") get a private, throwaway sign-in.
-- Guest data is deleted 14 days after the guest started, with their household, unless someone with a real account shares it.
create or replace function cleanup_guests() returns int
language plpgsql security definer set search_path = public, auth as $$
declare n int;
begin
  create temp table _old on commit drop as
    select u.id from auth.users u
    where u.is_anonymous
      and u.created_at < now() - interval '14 days';
  delete from households h
    where exists (select 1 from members m where m.household_id = h.id and m.user_id in (select id from _old))
      and not exists (select 1 from members m where m.household_id = h.id and m.user_id not in (select id from _old));
  delete from auth.users where id in (select id from _old);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function cleanup_guests() from public, anon, authenticated;

select cron.unschedule('wfd-guest-cleanup') where exists (select 1 from cron.job where jobname = 'wfd-guest-cleanup');
-- every day at 3:41 am Pacific
select cron.schedule('wfd-guest-cleanup', '41 11 * * *', $$ select cleanup_guests() $$);
-- try it once now (removes nothing today: guest mode only started today)
select cleanup_guests() as guests_removed;
