'use server'

// Esta función corre en el SERVIDOR aunque se llame desde un componente de
// cliente (booking-calendar.tsx). Por eso sí puede leer INTERNAL_API_SECRET
// de forma segura: esa variable nunca se envía al navegador.
//
// Reemplaza al fetch() directo que hacía el componente de cliente sin
// Authorization header, lo cual causaba un 401 permanente en /api/email/confirm.
export async function triggerBookingConfirmation(appointmentId: string) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/email/confirm`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.INTERNAL_API_SECRET ?? ''}`,
        },
        body: JSON.stringify({ appointmentId }),
      }
    )

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('[booking/actions] email/confirm failed:', res.status, text)
    }
  } catch (err) {
    console.error('[booking/actions] email/confirm fetch error:', err)
  }
}