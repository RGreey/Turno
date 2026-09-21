import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { sendBookingConfirmations } from '@/lib/notifications/booking-confirmation'

/**
 * Thin HTTP wrapper kept for external callers only. Internal code
 * (/api/book, dashboard server action) calls sendBookingConfirmations()
 * directly and no longer goes through this route.
 */
function secretsMatch(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`)
  const received = Buffer.from((header ?? '').trim())
  return expected.length === received.length && timingSafeEqual(expected, received)
}

export async function POST(req: NextRequest) {
  try {
    // trim(): a trailing space/newline pasted into the env var must not lock us out.
    const secret = (process.env.INTERNAL_API_SECRET ?? '').trim()

    // Fail closed in production: no secret configured → nobody gets in.
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
      }
      console.warn('[email/confirm] INTERNAL_API_SECRET is not set — allowed only outside production.')
    } else if (!secretsMatch(req.headers.get('authorization'), secret)) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { appointmentId, formEmail } = await req.json()
    if (!appointmentId) return NextResponse.json({ error: 'missing appointmentId' }, { status: 400 })

    const result = await sendBookingConfirmations(appointmentId, formEmail)
    if (result.email === 'not_found') return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[email/confirm]', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
