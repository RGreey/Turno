-- Per-participant payment state for group appointments.
create table if not exists public.appointment_charge_items (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid not null references public.appointments(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  amount          numeric(10,2) not null default 0,
  status          text not null default 'pending' check (status in ('pending', 'paid', 'exempt')),
  payment_method  text check (payment_method in ('cash', 'card', 'transfer', 'online')),
  paid_at        timestamptz,
  created_at      timestamptz not null default now(),
  unique (appointment_id, client_id)
);

alter table public.transactions
  add column if not exists charge_item_id uuid references public.appointment_charge_items(id) on delete set null;

grant all on table public.appointment_charge_items to anon, authenticated;
alter table public.appointment_charge_items enable row level security;

drop policy if exists "business_isolation_charge_items" on public.appointment_charge_items;
create policy "business_isolation_charge_items" on public.appointment_charge_items
  for all using (appointment_id in (
    select id from public.appointments where business_id in (select public.my_business_ids())
  ));

-- Existing group participants become payable items, and existing linked sales
-- are reflected as paid so the migration does not show false pending balances.
insert into public.appointment_charge_items (appointment_id, client_id, amount)
select ac.appointment_id, ac.client_id, coalesce(a.price, 0)
from public.appointment_clients ac
join public.appointments a on a.id = ac.appointment_id
on conflict (appointment_id, client_id) do nothing;

update public.appointment_charge_items item
set status = 'paid', paid_at = coalesce(tx.created_at, now()), payment_method = tx.payment_method
from public.transactions tx
where tx.appointment_id = item.appointment_id
  and tx.client_id = item.client_id
  and tx.status = 'completed';

-- New participants automatically get a charge item. The trigger is idempotent
-- and uses the appointment price as the default per-person service amount.
create or replace function public.create_appointment_charge_item()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.appointment_charge_items (appointment_id, client_id, amount)
  select new.appointment_id, new.client_id, coalesce(a.price, 0)
  from public.appointments a
  where a.id = new.appointment_id
  on conflict (appointment_id, client_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_create_appointment_charge_item on public.appointment_clients;
create trigger trg_create_appointment_charge_item
after insert on public.appointment_clients
for each row execute function public.create_appointment_charge_item();

create index if not exists appointment_charge_items_appointment_idx
  on public.appointment_charge_items (appointment_id, status);
create index if not exists transactions_charge_item_idx
  on public.transactions (charge_item_id);
