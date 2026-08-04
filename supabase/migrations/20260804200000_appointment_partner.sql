alter table public.appointments
  add column if not exists with_partner boolean not null default false;

alter table public.appointments
  add column if not exists partner_name text;

alter table public.appointments
  add column if not exists partner_reason text;

create index if not exists appointments_with_partner_idx
  on public.appointments(user_id, with_partner)
  where with_partner = true;
