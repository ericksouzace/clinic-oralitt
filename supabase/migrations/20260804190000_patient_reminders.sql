create table if not exists public.patient_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  clinical_record_id uuid references public.clinical_records(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  title text not null,
  description text,
  reminder_date date not null,
  priority text not null default 'normal'
    check (priority in ('baixa', 'normal', 'alta', 'urgente')),
  status text not null default 'pendente'
    check (status in ('pendente', 'agendado', 'concluído', 'cancelado')),
  responsible_name text,
  completed_at timestamptz,
  completion_reason text,
  postponed_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.patient_reminders enable row level security;

drop policy if exists "Users manage own patient reminders"
on public.patient_reminders;

create policy "Users manage own patient reminders"
on public.patient_reminders
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists patient_reminders_user_date_idx
on public.patient_reminders(user_id, reminder_date);

create index if not exists patient_reminders_patient_date_idx
on public.patient_reminders(patient_id, reminder_date);

create index if not exists patient_reminders_status_idx
on public.patient_reminders(user_id, status);

create index if not exists patient_reminders_clinical_record_idx
on public.patient_reminders(clinical_record_id);
