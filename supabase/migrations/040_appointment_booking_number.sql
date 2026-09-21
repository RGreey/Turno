-- Human-readable sequential reservation number.
create sequence if not exists public.booking_number_seq start 1;

alter table public.appointments
  add column if not exists booking_number bigint;

-- Backfill existing appointments deterministically by creation time.
with numbered as (
  select id, row_number() over (order by created_at, id)::bigint as number
  from public.appointments
  where booking_number is null
)
update public.appointments a
set booking_number = numbered.number
from numbered
where a.id = numbered.id;

-- Keep the sequence ahead of the backfilled values.
select setval(
  'public.booking_number_seq',
  greatest(coalesce((select max(booking_number) from public.appointments), 0), 1),
  true
);

create or replace function public.set_booking_number()
returns trigger language plpgsql as $$
begin
  if new.booking_number is null then
    new.booking_number = nextval('public.booking_number_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_appointments_booking_number on public.appointments;
create trigger trg_appointments_booking_number
before insert on public.appointments
for each row execute function public.set_booking_number();

create unique index if not exists appointments_booking_number_idx
  on public.appointments (business_id, booking_number);
