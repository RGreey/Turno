/**
 * POST /api/telegram/webhook?bid={businessId}
 *
 * Telegram присылает сюда все сообщения боту.
 *
 * Flows:
 *  /start               → owner connects, saves chat_id to businesses
 *  /start client_{uuid} → client opt-in, saves chat_id to clients.telegram_id
 *  /link {phone}        → fallback: client links by phone number
 *  /today               → owner: appointments today
 *  /help                → command list
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTelegramMessage } from '@/lib/telegram'

function toTitleCase(name: string): string {
  return name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

function businessDayBounds(timezone: string): { start: string; end: string } {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  const year = get('year')
  const month = get('month')
  const day = get('day')
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12))
  const localNoon = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
  }).formatToParts(noonUtc)
  const local = (type: string) => Number(localNoon.find((part) => part.type === type)?.value)
  const offset = Date.UTC(local('year'), local('month') - 1, local('day'), local('hour') % 24, local('minute'), local('second')) - noonUtc.getTime()
  const start = new Date(Date.UTC(year, month - 1, day) - offset)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

export async function POST(req: NextRequest) {
  try {
    const businessId = req.nextUrl.searchParams.get('bid')
    if (!businessId) return NextResponse.json({ ok: false }, { status: 400 })

    const body = await req.json()
    const message = body?.message
    if (!message) return NextResponse.json({ ok: true })

    const chatId = String(message.chat?.id)
    const text: string = message.text ?? ''
    const firstName: string = message.from?.first_name ?? 'there'

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const { data: biz } = await supabase
      .from('businesses')
      .select('id, name, timezone, telegram_bot_token, telegram_chat_id')
      .eq('id', businessId)
      .single()

    if (!biz?.telegram_bot_token) return NextResponse.json({ ok: true })

    // ── /start ────────────────────────────────────────────────────────────────
    if (text.startsWith('/start')) {
      const param = text.replace('/start', '').trim()

      // Client opt-in: /start client_{uuid}
      if (param.startsWith('client_')) {
        const clientId = param.replace('client_', '')
        // Basic UUID format check
        if (/^[0-9a-f-]{36}$/i.test(clientId)) {
          const { data: client } = await supabase
            .from('clients')
            .select('id, name, phone, email')
            .eq('id', clientId)
            .eq('business_id', businessId)
            .maybeSingle()

          if (client) {
            // Update this client and any duplicate records with the same phone/email
            // so one /start press covers all bookings made with the same contact info
            if (client.phone) {
              await supabase
                .from('clients')
                .update({ telegram_id: chatId })
                .eq('business_id', businessId)
                .eq('phone', client.phone)
            } else if (client.email) {
              await supabase
                .from('clients')
                .update({ telegram_id: chatId })
                .eq('business_id', businessId)
                .eq('email', client.email)
            } else {
              await supabase
                .from('clients')
                .update({ telegram_id: chatId })
                .eq('id', clientId)
            }

            await sendTelegramMessage(
              biz.telegram_bot_token,
              chatId,
              [
                `✅ ¡Hola ${toTitleCase(client.name)}!`,
                ``,
                `Ya estás conectado con <b>${biz.name}</b>.`,
                `Recibirás aquí los recordatorios de tus citas automáticamente.`,
                ``,
                `¡Nos vemos pronto! 👋`,
              ].join('\n')
            )
          } else {
            await sendTelegramMessage(
              biz.telegram_bot_token,
              chatId,
              `❌ No se encontró el enlace. Usa el enlace de tu confirmación de reserva.`
            )
          }
          return NextResponse.json({ ok: true })
        }
      }

      // Owner /start — connect business to this chat
      await supabase
        .from('businesses')
        .update({ telegram_chat_id: chatId })
        .eq('id', businessId)

      await sendTelegramMessage(
        biz.telegram_bot_token,
        chatId,
        [
          `👋 ¡Hola ${firstName}!`,
          ``,
          `Ya estás conectado con <b>${biz.name}</b> en Turno.`,
          ``,
          `Recibirás aquí estas notificaciones:`,
          `• 📅 Nuevas reservas`,
          `• 🔔 Recordatorios de citas`,
          `• ⚠️ Alertas de stock bajo`,
          `• ✅ Citas completadas`,
          ``,
          `Envía /help para ver los comandos disponibles.`,
        ].join('\n')
      )

      return NextResponse.json({ ok: true })
    }

    // ── /link {phone} — fallback client opt-in by phone number ────────────────
    if (text.startsWith('/link')) {
      const phone = text.replace('/link', '').trim()
      if (!phone) {
        await sendTelegramMessage(
          biz.telegram_bot_token,
          chatId,
          `Incluye tu número de teléfono.\nEjemplo: /link +573001234567`
        )
        return NextResponse.json({ ok: true })
      }

      const { data: clients } = await supabase
        .from('clients')
        .select('id, name')
        .eq('business_id', businessId)
        .eq('phone', phone)

      if (clients && clients.length > 0) {
        // Update all records with this phone (covers duplicate client entries)
        await supabase
          .from('clients')
          .update({ telegram_id: chatId })
          .eq('business_id', businessId)
          .eq('phone', phone)

        await sendTelegramMessage(
          biz.telegram_bot_token,
          chatId,
          `✅ ¡Hola ${toTitleCase(clients[0].name)}! Tu Telegram está vinculado. Recibirás aquí los recordatorios de tus citas.`
        )
      } else {
        await sendTelegramMessage(
          biz.telegram_bot_token,
          chatId,
          `❌ No se encontró el número de teléfono. Comprueba que coincida con el que usaste al reservar.`
        )
      }
      return NextResponse.json({ ok: true })
    }

    // ── /today — appointments today (owner only) ───────────────────────────────
    if (text.startsWith('/today')) {
      const timezone = biz.timezone ?? 'UTC'
      const { start, end } = businessDayBounds(timezone)

      const { data: appts } = await supabase
        .from('appointments')
        .select('starts_at, status, clients(name), services(name)')
        .eq('business_id', businessId)
        .gte('starts_at', start)
        .lte('starts_at', end)
        .order('starts_at')

      if (!appts || appts.length === 0) {
        await sendTelegramMessage(biz.telegram_bot_token, chatId, '📅 No hay citas para hoy.')
      } else {
        const statusEmoji: Record<string, string> = {
          confirmed: '🔵', pending: '🟡', completed: '🟢', paid: '💳', cancelled: '🔴', no_show: '❌',
        }
        const lines = appts.map((a) => {
          const time = new Date(a.starts_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: timezone })
          const rawName = (a.clients as unknown as { name: string } | null)?.name ?? 'Walk-in'
          const client = toTitleCase(rawName)
          const service = (a.services as unknown as { name: string } | null)?.name ?? '—'
          return `${statusEmoji[a.status] ?? '⚪'} ${time} — ${client} (${service})`
        })
        const statuses = new Set(appts.map((a) => a.status))
        const legend = [
          ...(statuses.has('pending') ? ['🟡 Pendiente'] : []),
          ...(statuses.has('confirmed') ? ['🔵 Confirmada'] : []),
          ...(statuses.has('completed') ? ['🟢 Completada'] : []),
          ...(statuses.has('paid') ? ['💳 Pagada'] : []),
          ...(statuses.has('cancelled') ? ['🔴 Cancelada'] : []),
          ...(statuses.has('no_show') ? ['❌ No se presentó'] : []),
        ].join('  ')
        await sendTelegramMessage(
          biz.telegram_bot_token,
          chatId,
          `📅 <b>Citas de hoy (${appts.length})</b>\n\n${lines.join('\n')}\n\n${legend}`
        )
      }
      return NextResponse.json({ ok: true })
    }

    // ── /help ─────────────────────────────────────────────────────────────────
    if (text.startsWith('/help')) {
      await sendTelegramMessage(
        biz.telegram_bot_token,
        chatId,
        [
          `<b>Bot de Turno — comandos disponibles:</b>`,
          ``,
          `/today — citas de hoy (solo para propietarios)`,
          `/link {teléfono} — vincula tu Telegram con tu perfil de cliente`,
          `  Ejemplo: /link +573001234567`,
          `/help — muestra este mensaje`,
        ].join('\n')
      )
      return NextResponse.json({ ok: true })
    }

    // Fallback
    if (biz.telegram_chat_id === chatId) {
      await sendTelegramMessage(biz.telegram_bot_token, chatId, 'Usa /help para ver los comandos disponibles.')
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[telegram/webhook]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
