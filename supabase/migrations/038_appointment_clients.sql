-- Multiple clients can share one appointment while keeping the legacy
-- appointments.client_id column as the primary client for CRM/POS compatibility.

create table if not exists public.appointment_clients (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  client_id      uuid not null references public.clients(id) on delete cascade,
  created_at     timestamptz not null default now(),
  unique (appointment_id, client_id)
);

create index if not exists appointment_clients_client_idx
  on public.appointment_clients (client_id);

insert into public.appointment_clients (appointment_id, client_id)
select id, client_id
from public.appointments
where client_id is not null
on conflict (appointment_id, client_id) do nothing;

grant all on table public.appointment_clients to anon, authenticated;

alter table public.appointment_clients enable row level security;

create policy "business_isolation" on public.appointment_clients
  using (appointment_id in (
    select a.id from public.appointments a where a.business_id in (select my_business_ids())
  ));

create policy "business_insert" on public.appointment_clients
  for insert with check (appointment_id in (
    select a.id from public.appointments a where a.business_id in (select my_business_ids())
  ));