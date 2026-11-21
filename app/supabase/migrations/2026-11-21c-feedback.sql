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
