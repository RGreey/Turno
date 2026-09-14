/**
 * lib/telegram.ts
 * Telegram Bot API — отправка сообщений и регистрация вебхука.
 */

const BASE = 'https://api.telegram.org/bot'

// ─── Отправить текстовое сообщение ────────────────────────────────────────────

export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
  parseMode: 'HTML' | 'Markdown' = 'HTML'
): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    })
    const json = await res.json()
    if (!json.ok) {
      console.error('[telegram] sendMessage error:', json.description)
      return false
    }
    return true
  } catch (err) {
    console.error('[telegram] sendMessage exception:', err)
    return false
  }
}

// ─── Зарегистрировать вебхук ───────────────────────────────────────────────────

export async function setTelegramWebhook(
  token: string,
  webhookUrl: string
): Promise<{ ok: boolean; description?: string }> {
  try {
    const res = await fetch(`${BASE}${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    })
    return await res.json()
  } catch (err) {
    return { ok: false, description: String(err) }
  }
}

// ─── Получить информацию о боте ───────────────────────────────────────────────

export async function getTelegramBotInfo(
  token: string
): Promise<{ ok: boolean; result?: { username: string; first_name: string } }> {
  try {
    const res = await fetch(`${BASE}${token}/getMe`)
    return await res.json()
  } catch {
    return { ok: false }
  }
}

// ─── Шаблоны сообщений ────────────────────────────────────────────────────────

export function tplNewBooking(opts: {
  clientName: string
  serviceName: string
  date: string
  time: string
  employeeName?: string
  source?: string
}): string {
  const source = opts.source === 'online' ? ' 🌐 online' : ''
  return [
    `📅 <b>Nueva reserva${source}</b>`,
    ``,
    `👤 Cliente: ${opts.clientName}`,
    `✂️ Servicio: ${opts.serviceName}`,
    `🕐 ${opts.date} a las ${opts.time}`,
    opts.employeeName ? `👷 Profesional: ${opts.employeeName}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function tplReminder(opts: {
  clientName: string
  serviceName: string
  date: string
  time: string
  isOneHour?: boolean
}): string {
  const when = opts.isOneHour ? 'en 1 hora ⏰' : 'mañana 📅'
  return [
    `🔔 <b>Recordatorio de cita: ${when}</b>`,
    ``,
    `👤 ${opts.clientName}`,
    `✂️ ${opts.serviceName}`,
    `🕐 ${opts.date} a las ${opts.time}`,
  ].join('\n')
}

export function tplLowStock(opts: {
  itemName: string
  quantity: number
  unit: string
  threshold: number
}): string {
  return [
    `⚠️ <b>Alerta de stock bajo</b>`,
    ``,
    `📦 ${opts.itemName}`,
    `Actual: <b>${opts.quantity} ${opts.unit}</b> (mínimo: ${opts.threshold})`,
  ].join('\n')
}

export function tplThankYou(opts: {
  clientName: string
  serviceName: string
}): string {
  return [
    `✅ <b>Visita completada</b>`,
    ``,
    `👤 ${opts.clientName}`,
    `✂️ ${opts.serviceName}`,
    `Mensaje de agradecimiento enviado al cliente.`,
  ].join('\n')
}

export function tplReactivation(opts: {
  clientName: string
}): string {
  return [
    `📤 <b>Reactivación enviada</b>`,
    ``,
    `👤 ${opts.clientName}`,
    `Invitamos a este cliente a regresar después de 30 días de inactividad.`,
  ].join('\n')
}

export function tplBirthday(opts: {
  clientName: string
}): string {
  return [
    `🎂 <b>Mensaje de cumpleaños enviado</b>`,
    ``,
    `👤 ${opts.clientName}`,
    `Hoy le enviamos nuestros mejores deseos de cumpleaños.`,
  ].join('\n')
}

// ─── Шаблоны для клиентов ─────────────────────────────────────────────────────

export function tplReminderClient(opts: {
  clientName: string
  serviceName: string
  date: string
  time: string
  businessName: string
  address?: string
  isOneHour?: boolean
}): string {
  const when = opts.isOneHour ? 'en 1 hora ⏰' : 'mañana 📅'
  const lines = [
    `🔔 <b>Recordatorio de cita: ${when}</b>`,
    ``,
    `👤 ${opts.clientName}`,
    `✂️ ${opts.serviceName}`,
    `🕐 ${opts.date} a las ${opts.time}`,
    `🏠 ${opts.businessName}`,
  ]
  if (opts.address) lines.push(`📍 ${opts.address}`)
  return lines.join('\n')
}

export function tplThankYouClient(opts: {
  clientName: string
  serviceName: string
  businessName: string
  bookingUrl?: string
}): string {
  const lines = [
    `✅ <b>¡Gracias por tu visita, ${opts.clientName}!</b>`,
    ``,
    `✂️ ${opts.serviceName}`,
    `🏠 ${opts.businessName}`,
    ``,
    `¡Nos encantaría verte de nuevo!`,
  ]
  if (opts.bookingUrl) lines.push(``, `📅 Reserva de nuevo: ${opts.bookingUrl}`)
  return lines.join('\n')
}

export function tplReactivationClient(opts: {
  clientName: string
  businessName: string
  bookingUrl?: string
}): string {
  const lines = [
    `👋 <b>${opts.clientName}, ¡ha pasado tiempo!</b>`,
    ``,
    `Vuelve a ${opts.businessName}; ¡nos encantaría verte!`,
  ]
  if (opts.bookingUrl) lines.push(``, `📅 Reserva ahora: ${opts.bookingUrl}`)
  return lines.join('\n')
}

export function tplBirthdayClient(opts: {
  clientName: string
  businessName: string
  bookingUrl?: string
}): string {
  const lines = [
    `🎂 <b>¡Feliz cumpleaños, ${opts.clientName}!</b>`,
    ``,
    `¡El equipo de ${opts.businessName} te desea lo mejor! 🎉`,
  ]
  if (opts.bookingUrl) lines.push(``, `🎁 Date un gusto: ${opts.bookingUrl}`)
  return lines.join('\n')
}
