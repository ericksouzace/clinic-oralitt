alter table public.profiles
  add column if not exists last_activity_at timestamptz,
  add column if not exists inactivity_reminder_sent_at timestamptz;

update public.profiles
set last_activity_at = coalesce(last_activity_at, now())
where last_activity_at is null;

create or replace function public.touch_user_activity()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set
    last_activity_at = now(),
    inactivity_reminder_sent_at = null
  where id = auth.uid();
$$;

revoke all on function public.touch_user_activity() from public;
grant execute on function public.touch_user_activity() to authenticated;
