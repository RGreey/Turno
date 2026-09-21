import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { POSTerminal } from './pos-terminal'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { History } from 'lucide-react'
import { formatInBusinessTimezone } from '@/lib/utils'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner } from '@/lib/business'

interface SearchParams {
  bookingId?: string
  serviceId?: string
  staffId?: string
  chargeClientIds?: string
  split?: string
}

export default async function POSPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const supabase = await createClient()
  const user = await getAuthUser()

  const business = await getBusinessForOwner(user!.id)

  if (!business) redirect('/onboarding')

  const [{ data: services }, { data: products }, { data: employees }, { data: clients }] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, price, duration_min, category')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('inventory_items')
      .select('id, name, sell_price, quantity, unit, category')
      .eq('business_id', business.id)
      .gt('quantity', 0)
      .not('sell_price', 'is', null)
      .order('name'),
    supabase
      .from('employees')
      .select('id, name')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('clients')
      .select('id, name, phone')
      .eq('business_id', business.id)
      .order('name')
      .limit(200),
  ])

  // ── Booking context: prefill POS from an appointment ──────────────────────
  let bookingContext: {
    bookingId: string
    bookingNumber: number | null
    clientId: string
    clientIds: string[]
    clientNames: string[]
    chargeClientIds: string[]
    chargeItemIds: string[]
    split: boolean
    serviceId: string
    staffId: string
    label: string
  } | undefined

  if (searchParams.bookingId) {
    const { data: appt } = await supabase
      .from('appointments')
      .select('id, booking_number, starts_at, clients(id, name), services(name), employees(id, name)')
      .eq('id', searchParams.bookingId)
      .eq('business_id', business.id) // security: only own business
      .maybeSingle()

    if (appt) {
      const { data: participantRows } = await supabase
        .from('appointment_clients')
        .select('client_id, clients(name)')
        .eq('appointment_id', appt.id)

      const participants = (participantRows ?? []).map((row) => ({
        id: row.client_id,
        name: (row.clients as { name: string } | null)?.name ?? 'Cliente',
      }))
      const legacyClient = appt.clients as { id?: string; name: string } | null
      const clientIds = participants.length > 0
        ? participants.map((participant) => participant.id)
        : (legacyClient?.id ? [legacyClient.id] : [])
      const clientNames = participants.length > 0
        ? participants.map((participant) => participant.name)
        : [legacyClient?.name ?? 'Walk-in']
      const clientName = clientNames[0] ?? 'Walk-in'
      const selectedClientIds = searchParams.chargeClientIds?.split(',').filter(Boolean)
      const chargeRows = await supabase
        .from('appointment_charge_items')
        .select('id, client_id, status')
        .eq('appointment_id', appt.id)
      const pendingChargeRows = ((chargeRows.data ?? []) as Array<{ id: string; client_id: string; status: string }>)
        .filter((item) => !selectedClientIds || selectedClientIds.includes(item.client_id))
        .filter((item) => item.status === 'pending')
      const pendingByClient = new Map(pendingChargeRows.map((item) => [item.client_id, item]))
      const orderedPendingRows = clientIds.filter((clientId) => pendingByClient.has(clientId)).map((clientId) => pendingByClient.get(clientId)!)
      const chargeClientIds = orderedPendingRows.map((item) => item.client_id)
      const chargeItemIds = orderedPendingRows.map((item) => item.id)
      const serviceName = (appt.services as { name: string } | null)?.name ?? ''
      const tz = business.timezone ?? 'UTC'
      bookingContext = {
        bookingId: appt.id,
        bookingNumber: appt.booking_number,
        clientId: clientIds[0] ?? '',
        clientIds,
        clientNames,
        chargeClientIds,
        chargeItemIds,
        split: searchParams.split === '1',
        serviceId: searchParams.serviceId ?? '',
        staffId: searchParams.staffId ?? (appt.employees as { id: string; name: string } | null)?.id ?? '',
        label: `${clientName} — ${serviceName} — ${formatInBusinessTimezone(appt.starts_at, tz, 'time')}`,
      }
    }
  }

  const t = await getTranslations('pos')

  return (
    <>
      <Header
        title={t('title')}
        actions={
          <Link href="/pos/history" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors">
            <History className="w-4 h-4" /> Sales history
          </Link>
        }
      />
      <POSTerminal
        businessId={business.id}
        currency={business.currency}
        services={services ?? []}
        products={(products ?? []).map((product) => ({
          id: product.id,
          name: product.name,
          price: product.sell_price ?? 0,
          stock: product.quantity,
          unit: product.unit,
          category: product.category,
        }))}
        employees={employees ?? []}
        clients={clients ?? []}
        bookingContext={bookingContext}
      />
    </>
  )
}
