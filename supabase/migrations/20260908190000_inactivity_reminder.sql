alter table public.profiles
  add column if not exists last_activity_at timestamptz,
  add column if not exists inactivity_reminder_sent_at timestamptz;

update public.profiles
set last_activity_at = coalesce(last_activity_at, now())
where last_activity_at is null;
