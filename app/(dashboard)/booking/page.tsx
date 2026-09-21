import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { BookingCalendar, type ChargeItem } from './booking-calendar'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner } from '@/lib/business'

export default async function BookingPage() {
  const supabase = await createClient()
  const user = await getAuthUser()

  const business = await getBusinessForOwner(user!.id)

  if (!business) redirect('/onboarding')

  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay() + 1)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  const [{ data: appointments }, { data: employees }, { data: services }, { data: clients }, { data: businessHours }] =
    await Promise.all([
      supabase
        .from('appointments')
        .select('id, starts_at, ends_at, status, source, notes, clients(id, name), employees(id, name), services(id, name, price)')
        .eq('business_id', business.id)
        .gte('starts_at', weekStart.toISOString())
        .lt('starts_at', weekEnd.toISOString())
        .order('starts_at'),
      supabase
        .from('employees')
        .select('id, name')
        .eq('business_id', business.id)
        .eq('is_active', true),
      supabase
        .from('services')
        .select('id, name, duration_min, price')
        .eq('business_id', business.id)
        .eq('is_active', true),
      supabase
        .from('clients')
        .select('id, name, phone')
        .eq('business_id', business.id)
        .order('name')
        .limit(200),
      supabase
        .from('business_hours')
        .select('day_of_week, is_open, open_time, close_time')
        .eq('business_id', business.id),
    ])

  const { data: chargeItems } = await supabase
    .from('appointment_charge_items')
    .select('id, appointment_id, client_id, amount, status, payment_method, paid_at')

  return (
    <>
      <Header title="Booking" />
      <BookingCalendar
        businessId={business.id}
        slug={business.slug}
        timezone={business.timezone}
        appointments={appointments ?? []}
        employees={employees ?? []}
        services={services ?? []}
        clients={clients ?? []}
        chargeItems={(chargeItems ?? []) as ChargeItem[]}
        businessHours={businessHours ?? []}
      />
    </>
  )
}
