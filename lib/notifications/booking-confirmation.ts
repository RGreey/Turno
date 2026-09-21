import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendBookingConfirmation, formatEmailDate, formatEmailTime } from '@/lib/email'
import { buildGCalUrlFromISO } from '@/lib/gcal'
import { sendTelegramMessage, tplNewBooking, tplReminderClient as tgTplConfirmClient } from '@/lib/telegram'
import { sendViberMessage, tplNewBooking as viberTplNewBooking } from '@/lib/viber'
import { sendWhatsAppMessage, tplBookingConfirmation as waTplBookingConfirmation } from '@/lib/whatsapp'

// Telegram confirmation template for client
function tplConfirmClient(opts: {
  clientName: string
  serviceName: string
  date: string
  time: string
  businessName: string
  address?: string
}): string {
  const lines = [
    `✅ <b>Booking confirmed!</b>`,
    ``,
    `👤 ${opts.clientName}`,
    `📋 ${opts.serviceName}`,
    `🕐 ${opts.date} at ${opts.time}`,
    `🏠 ${opts.businessName}`,
  ]
  if (opts.address) lines.push(`📍 ${opts.address}`)
  lines.push(``, `We'll remind you before the appointment.`)
  return lines.join('\n')
}

function viberTplConfirmClient(opts: {
  clientName: string
  serviceName: string
  date: string
  time: string
  businessName: string
  address?: string
}): string {
  const lines = [
    `✅ Booking confirmed!`,
    ``,
    `👤 ${opts.clientName}`,
    `📋 ${opts.serviceName}`,
    `🕐 ${opts.date} at ${opts.time}`,
    `🏠 ${opts.businessName}`,
  ]
  if (opts.address) lines.push(`📍 ${opts.address}`)
  lines.push(``, `We'll remind you before the appointment.`)
  return lines.join('\n')
}

export interface BookingConfirmationResult {
  sent: boolean
  email: string
  emailCount?: number
  results?: Array<{ to: string; status: 'sent' | 'already_sent' | 'duplicate_email' | 'failed'; error?: string }>
}

function maskEmail(email: string): string {
  const [user, domain] = email.split('@')
  return `${user.slice(0, 2)}***@${domain ?? ''}`
}

/**
 * Sends every confirmation channel (Telegram / Viber / WhatsApp / email) for one
 * appointment. Called DIRECTLY by server code (/api/book and the dashboard
 * server action) — no HTTP hop and no shared secret, so it cannot 401.
 *
 * Uses the service-role client: the caller is responsible for having authorised
 * the request (public booking flow, or an authenticated owner of the business).
 */
export async function sendBookingConfirmations(
  appointmentId: string,
  formEmail?: string | null
): Promise<BookingConfirmationResult> {
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: appt, error: apptErr } = await supabase
    .from('appointments')
    .select('id, starts_at, business_id, source, services(name, duration_min), employees(name), clients(name, email, whatsapp_number, telegram_id, viber_user_id)')
    .eq('id', appointmentId)
    .single()

  if (apptErr) console.error('[email/confirm] appointment fetch error:', apptErr.message)
  if (!appt) return { sent: false, email: 'not_found' }

  const { data: participantRows } = await supabase
    .from('appointment_clients')
    .select('client_id, clients(name, email, whatsapp_number, telegram_id, viber_user_id)')
    .eq('appointment_id', appt.id)

  const participants = (participantRows ?? []).flatMap((row) =>
    Array.isArray(row.clients) ? row.clients : row.clients ? [row.clients] : []
  ) as Array<{
    name: string
    email: string | null
    whatsapp_number: string | null
    telegram_id: string | null
    viber_user_id: string | null
  }>

  const client = appt.clients as unknown as {
    name: string
    email: string | null
    whatsapp_number: string | null
    telegram_id: string | null
    viber_user_id: string | null
  } | null
  const service = appt.services as unknown as { name: string; duration_min: number } | null
  const employee = appt.employees as unknown as { name: string } | null

  const { data: biz } = await supabase
    .from('businesses')
    .select('name, address, slug, timezone, telegram_bot_token, telegram_chat_id, viber_bot_token, viber_chat_id, meta_whatsapp_phone_number_id, meta_whatsapp_access_token')
    .eq('id', appt.business_id)
    .single()

  const tz = biz?.timezone ?? 'UTC'
  const date = formatEmailDate(appt.starts_at, tz)
  const time = formatEmailTime(appt.starts_at, tz)

  // ── Telegram → владельцу ────────────────────────────────────────────────
  if (biz?.telegram_bot_token && biz?.telegram_chat_id) {
    await sendTelegramMessage(
      biz.telegram_bot_token,
      biz.telegram_chat_id,
      tplNewBooking({
        clientName: client?.name ?? 'Walk-in',
        serviceName: service?.name ?? '—',
        date,
        time,
        employeeName: employee?.name,
        source: appt.source ?? undefined,
      })
    )
  }

  // ── Telegram → клиенту (если уже подключён) ─────────────────────────────
  if (biz?.telegram_bot_token && client?.telegram_id) {
    await sendTelegramMessage(
      biz.telegram_bot_token,
      client.telegram_id,
      tplConfirmClient({
        clientName: client.name,
        serviceName: service?.name ?? '—',
        date,
        time,
        businessName: biz.name,
        address: biz.address ?? undefined,
      })
    )
  }

  // ── Viber → владельцу ───────────────────────────────────────────────────
  if (biz?.viber_bot_token && biz?.viber_chat_id) {
    await sendViberMessage(
      biz.viber_bot_token,
      biz.viber_chat_id,
      viberTplNewBooking({
        clientName: client?.name ?? 'Walk-in',
        serviceName: service?.name ?? '—',
        date,
        time,
        employeeName: employee?.name,
        source: appt.source ?? undefined,
      })
    )
  }

  // ── Viber → клиенту (если уже подключён) ────────────────────────────────
  if (biz?.viber_bot_token && client?.viber_user_id) {
    await sendViberMessage(
      biz.viber_bot_token,
      client.viber_user_id,
      viberTplConfirmClient({
        clientName: client.name,
        serviceName: service?.name ?? '—',
        date,
        time,
        businessName: biz.name,
        address: biz.address ?? undefined,
      })
    )
  }

  // ── WhatsApp → клиенту ──────────────────────────────────────────────────
  const waCredentials = biz?.meta_whatsapp_phone_number_id && biz?.meta_whatsapp_access_token
    ? { phoneNumberId: biz.meta_whatsapp_phone_number_id, accessToken: biz.meta_whatsapp_access_token }
    : undefined
  if (client?.whatsapp_number) {
    await sendWhatsAppMessage(
      client.whatsapp_number,
      waTplBookingConfirmation({
        clientName: client.name,
        serviceName: service?.name ?? '—',
        date,
        time,
        businessName: biz?.name ?? '',
        employeeName: employee?.name,
        address: biz?.address ?? undefined,
      }),
      waCredentials
    )
  }

  // ── Email → cada participante ───────────────────────────────────────────
  // Prefer the email submitted in the booking form (formEmail) over the one stored in DB
  // when there is no participants list (legacy single-client bookings).
  const emailRecipients = participants.length > 0
    ? participants
    : (client ? [{ ...client, email: formEmail || client.email }] : [])
  const recipientsWithEmail = emailRecipients.filter((participant) => participant.email)

  // Una línea que responde de inmediato: ¿se encontraron los participantes?
  console.log(
    `[confirm] appt=${appt.id} participants=${participants.length}` +
    `${participants.length === 0 ? ' (fallback: cliente principal)' : ''}` +
    ` withEmail=${recipientsWithEmail.length}`
  )

  if (recipientsWithEmail.length === 0) {
    return { sent: true, email: 'skipped: no client email' }
  }

  const calendarUrl = buildGCalUrlFromISO({
    businessName: biz?.name ?? '',
    serviceName: service?.name ?? '',
    employeeName: employee?.name ?? null,
    startsAt: appt.starts_at,
    durationMin: service?.duration_min ?? 60,
    timezone: tz,
    address: biz?.address ?? null,
  })

  const results: NonNullable<BookingConfirmationResult['results']> = []
  const seenEmails = new Set<string>()

  for (const recipient of recipientsWithEmail) {
    const to = recipient.email!
    const masked = maskEmail(to)
    const key = to.trim().toLowerCase()

    // Dos participantes con el mismo correo => un solo mensaje (y queda registrado por qué).
    if (seenEmails.has(key)) {
      results.push({ to: masked, status: 'duplicate_email' })
      continue
    }
    seenEmails.add(key)

    // Cada destinatario está aislado: si uno falla, los demás igual se envían.
    try {
      const recipientRef = `${appt.id}:${to}`
      const { data: alreadySent } = await supabase
        .from('notification_log')
        .select('id')
        .eq('business_id', appt.business_id)
        .eq('ref_id', recipientRef)
        .eq('type', 'confirm')
        .eq('channel', 'email')
        .maybeSingle()
      if (alreadySent) {
        results.push({ to: masked, status: 'already_sent' })
        continue
      }

      const mail = await sendBookingConfirmation({
        to,
        clientName: recipient.name ?? 'Guest',
        businessName: biz?.name ?? 'Your appointment',
        serviceName: service?.name ?? '—',
        date,
        time,
        employeeName: employee?.name ?? undefined,
        address: biz?.address ?? undefined,
        calendarUrl,
      })

      // sendMail() NUNCA lanza: devuelve { error }. Antes se ignoraba ese resultado,
      // así que un envío fallido quedaba registrado como enviado y no se reintentaba.
      if (mail?.error) {
        results.push({ to: masked, status: 'failed', error: mail.error })
        continue
      }

      // Se registra solo tras un envío aceptado por el proveedor
      const { error: logErr } = await supabase.from('notification_log').insert({
        business_id: appt.business_id,
        ref_id: recipientRef,
        type: 'confirm',
        channel: 'email',
      })
      if (logErr && logErr.code !== '23505') {
        console.error('[confirm] notification_log insert error:', logErr.message)
      }
      results.push({ to: masked, status: 'sent' })
    } catch (err) {
      results.push({ to: masked, status: 'failed', error: err instanceof Error ? err.message : String(err) })
    }
  }

  const sentCount = results.filter((r) => r.status === 'sent').length
  const failedCount = results.filter((r) => r.status === 'failed').length
  console.log(`[confirm] appt=${appt.id} email results: ${JSON.stringify(results)}`)
  if (failedCount > 0) console.error(`[confirm] appt=${appt.id} ${failedCount} email(s) FAILED`)

  return {
    sent: failedCount === 0,
    email: failedCount > 0 ? 'failed' : sentCount > 0 ? 'sent' : 'skipped: already sent',
    emailCount: sentCount,
    results,
  }
}
