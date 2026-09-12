/**
 * lib/email.ts
 *
 * Funciones de alto nivel para enviar correos + plantillas HTML.
 * El transporte (Resend / SMTP) se define en lib/mailer.ts vía variables de entorno.
 */

import { sendMail, getFromAddress } from './mailer'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ─── Shared layout ────────────────────────────────────────────────────────────

function layout(businessName: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${businessName}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
          <tr>
            <td style="background:#2563eb;padding:20px 32px;">
              <span style="color:#ffffff;font-size:20px;font-weight:700;">${businessName}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Desarrollado con <a href="${APP_URL}" style="color:#2563eb;text-decoration:none;">Turno</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function btn(text: string, href: string) {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#2563eb;color:#fff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">${text}</a>`
}

function h1(text: string) {
  return `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">${text}</h1>`
}

function p(text: string) {
  return `<p style="margin:8px 0;font-size:15px;color:#374151;line-height:1.6;">${text}</p>`
}

function info(rows: [string, string][]) {
  const cells = rows
    .map(
      ([label, value]) => `
    <tr>
      <td style="padding:8px 12px;font-size:14px;color:#6b7280;width:140px;border-bottom:1px solid #f3f4f6;">${label}</td>
      <td style="padding:8px 12px;font-size:14px;color:#111827;font-weight:500;border-bottom:1px solid #f3f4f6;">${value}</td>
    </tr>`
    )
    .join('')
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">${cells}</table>`
}

// ─── Booking confirmation ─────────────────────────────────────────────────────

export async function sendBookingConfirmation(opts: {
  to: string
  clientName: string
  businessName: string
  serviceName: string
  date: string
  time: string
  employeeName?: string
  address?: string
  calendarUrl?: string
}) {
  const body = `
    ${h1('¡Reserva confirmada!')}
    ${p(`Hola ${firstName(opts.clientName)}, tu cita quedó confirmada.`)}
    ${info([
      ['Servicio', opts.serviceName],
      ['Fecha', opts.date],
      ['Hora', opts.time],
      ...(opts.employeeName ? [['Atiende', opts.employeeName] as [string, string]] : []),
      ...(opts.address ? [['Dirección', opts.address] as [string, string]] : []),
    ])}
    ${p('¡Nos vemos pronto!')}
    ${opts.calendarUrl ? p(`<a href="${opts.calendarUrl}" style="color:#2563eb;">Agregar a Google Calendar</a>`) : ''}
  `
  return sendMail({
    from: getFromAddress(opts.businessName),
    to: opts.to,
    subject: `Reserva confirmada — ${opts.serviceName} a las ${opts.time}`,
    html: layout(opts.businessName, body),
  })
}

// ─── Reminder ─────────────────────────────────────────────────────────────────

export async function sendReminder(opts: {
  to: string
  clientName: string
  businessName: string
  serviceName: string
  date: string
  time: string
  employeeName?: string
  address?: string
  isOneHour?: boolean
}) {
  const when = opts.isOneHour ? 'en 1 hora' : 'mañana'
  const body = `
    ${h1(`Recordatorio: tu cita es ${when}`)}
    ${p(`Hola ${firstName(opts.clientName)}, este es un recordatorio de tu próxima cita.`)}
    ${info([
      ['Servicio', opts.serviceName],
      ['Fecha', opts.date],
      ['Hora', opts.time],
      ...(opts.employeeName ? [['Atiende', opts.employeeName] as [string, string]] : []),
      ...(opts.address ? [['Dirección', opts.address] as [string, string]] : []),
    ])}
    ${p('¡Te esperamos!')}
  `
  return sendMail({
    from: getFromAddress(opts.businessName),
    to: opts.to,
    subject: `Recordatorio: ${opts.serviceName} ${when} a las ${opts.time}`,
    html: layout(opts.businessName, body),
  })
}

// ─── Thank-you ────────────────────────────────────────────────────────────────

export async function sendThankYou(opts: {
  to: string
  clientName: string
  businessName: string
  serviceName: string
  bookingUrl?: string
}) {
  const body = `
    ${h1('¡Gracias por tu visita!')}
    ${p(`Hola ${firstName(opts.clientName)}, gracias por elegir a ${opts.businessName}. ¡Esperamos verte pronto de nuevo!`)}
    ${p(`Servicio realizado: <strong>${opts.serviceName}</strong>`)}
    ${opts.bookingUrl ? btn('Agenda tu próxima cita', opts.bookingUrl) : ''}
  `
  return sendMail({
    from: getFromAddress(opts.businessName),
    to: opts.to,
    subject: `¡Gracias por visitar ${opts.businessName}!`,
    html: layout(opts.businessName, body),
  })
}

// ─── Re-activation ────────────────────────────────────────────────────────────

export async function sendReactivation(opts: {
  to: string
  clientName: string
  businessName: string
  bookingUrl?: string
}) {
  const body = `
    ${h1('¡Te extrañamos!')}
    ${p(`Hola ${firstName(opts.clientName)}, ha pasado un tiempo desde tu última visita a ${opts.businessName}.`)}
    ${p('Nos encantaría verte de nuevo. Agenda tu próxima cita cuando quieras, solo toma un minuto.')}
    ${opts.bookingUrl ? btn('Agendar ahora', opts.bookingUrl) : ''}
  `
  return sendMail({
    from: getFromAddress(opts.businessName),
    to: opts.to,
    subject: `${opts.businessName} te extraña — agenda tu próxima visita`,
    html: layout(opts.businessName, body),
  })
}

// ─── Birthday ─────────────────────────────────────────────────────────────────

export async function sendBirthday(opts: {
  to: string
  clientName: string
  businessName: string
  bookingUrl?: string
}) {
  const body = `
    ${h1('🎂 ¡Feliz cumpleaños!')}
    ${p(`Hola ${firstName(opts.clientName)}, todo el equipo de ${opts.businessName} te desea un feliz cumpleaños!`)}
    ${p('Para celebrar, ven y date un gusto.')}
    ${opts.bookingUrl ? btn('Agendar una visita', opts.bookingUrl) : ''}
  `
  return sendMail({
    from: getFromAddress(opts.businessName),
    to: opts.to,
    subject: `¡Feliz cumpleaños de parte de ${opts.businessName}! 🎂`,
    html: layout(opts.businessName, body),
  })
}

// ─── Low-stock alert ──────────────────────────────────────────────────────────

export async function sendLowStockAlert(opts: {
  to: string
  businessName: string
  items: { name: string; quantity: number; unit: string; threshold: number }[]
}) {
  const rows = opts.items.map(
    (i) => [i.name, `${i.quantity} ${i.unit} (mínimo: ${i.threshold})`] as [string, string]
  )
  const body = `
    ${h1('Alerta de stock bajo')}
    ${p(`Los siguientes productos en ${opts.businessName} se están agotando:`)}
    ${info(rows)}
    ${btn('Ir a Inventario', `${APP_URL}/inventory`)}
  `
  return sendMail({
    from: getFromAddress(opts.businessName),
    to: opts.to,
    subject: `Alerta de stock bajo — ${opts.items.length} producto${opts.items.length > 1 ? 's' : ''} agotándose`,
    html: layout(opts.businessName, body),
  })
}

// ─── Name helpers ─────────────────────────────────────────────────────────────

/** "KONSTANTIN UMNOV" → "Konstantin Umnov", "kostya" → "Kostya" */
function toTitleCase(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** "Konstantin Umnov" → "Konstantin", "kostya" → "Kostya" */
function firstName(name: string): string {
  return toTitleCase(name).split(/\s+/)[0]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatEmailDate(iso: string, timezone = 'UTC') {
  return new Date(iso).toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: timezone,
  })
}

export function formatEmailTime(iso: string, timezone = 'UTC') {
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  })
}