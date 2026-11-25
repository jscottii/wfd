-- Weekly price refresh: a scheduled job calls the "prices" Edge Function every Monday morning.
-- No keys are typed anywhere: the job's token is made here, inside the database, and only the
-- database and the Edge Function (which uses the service role) can read it.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists cron_token (id int primary key default 1 check (id = 1), token text not null);
alter table cron_token enable row level security;            -- no policies: app users can't read it
revoke all on cron_token from anon, authenticated;
insert into cron_token(token) values (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')) on conflict (id) do nothing;

create table if not exists price_runs (month text primary key, serp_used int not null default 0, last_run timestamptz, report jsonb);
alter table price_runs enable row level security;
revoke all on price_runs from anon, authenticated;
grant all on cron_token, price_runs to service_role;

create or replace function run_weekly_prices() returns bigint
language sql security definer set search_path = public as $$
  select net.http_post(
    url := 'https://osyhpifmegqotdfdlave.supabase.co/functions/v1/prices',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-token', (select token from cron_token)),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000)
$$;
revoke all on function run_weekly_prices() from public, anon, authenticated;

-- Mondays 5:17 am Pacific (13:17 UTC; 12:17 in summer time is fine either way)
select cron.unschedule('wfd-weekly-prices') where exists (select 1 from cron.job where jobname = 'wfd-weekly-prices');
select cron.schedule('wfd-weekly-prices', '17 13 * * 1', $$ select run_weekly_prices() $$);
