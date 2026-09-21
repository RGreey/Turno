'use server'

import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner } from '@/lib/business'
import { sendBookingConfirmations } from '@/lib/notifications/booking-confirmation'

// Corre en el SERVIDOR. Llama directamente a la lógica de envío: sin fetch a
// /api/email/confirm, sin secreto compartido y sin depender de NEXT_PUBLIC_APP_URL.
//
// Los server actions son endpoints públicos de facto, así que se verifica que
// quien llama sea el dueño del negocio al que pertenece la cita.
export async function triggerBookingConfirmation(appointmentId: string) {
  try {
    const user = await getAuthUser()
    if (!user) return { ok: false, error: 'unauthorized' }

    const business = await getBusinessForOwner(user.id)
    if (!business) return { ok: false, error: 'no_business' }

    const supabase = await createClient()
    const { data: appt } = await supabase
      .from('appointments')
      .select('id')
      .eq('id', appointmentId)
      .eq('business_id', business.id)
      .maybeSingle()
    if (!appt) return { ok: false, error: 'not_found' }

    const result = await sendBookingConfirmations(appointmentId)
    return { ok: result.sent, error: result.sent ? null : result.email }
  } catch (err) {
    console.error('[booking/actions] confirmation failed:', err)
    return { ok: false, error: 'internal' }
  }
}
