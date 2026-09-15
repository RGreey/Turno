export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'
import { PublicBookingForm } from './booking-form'
import { getTelegramBotInfo } from '@/lib/telegram'
import { getViberBotInfo } from '@/lib/viber'

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('businesses')
    .select('name')
    .eq('slug', params.slug)
    .maybeSingle()

  return {
    title: data ? `Book at ${data.name}` : 'Book appointment',
  }
}

export default async function PublicBookingPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const supabase = createServiceClient()

  // Public data — brand_color included for warm/premium design
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, type, phone, logo_url, currency, slug, timezone, address, brand_color')
    .eq('slug', params.slug)
    .maybeSingle()

  if (!business) notFound()

  // Tokens fetched server-side only — never serialised to the client
  const { data: bizTokens } = await supabase
    .from('businesses')
    .select('telegram_bot_token, viber_bot_token')
    .eq('id', business.id)
    .maybeSingle()

  const [
    { data: services },
    { data: employees },
    { data: businessHours },
    telegramInfo,
    viberInfo,
  ] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, description, price, duration_min, category, capacity')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('employees')
      .select('id, name')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('business_hours')
      .select('day_of_week, is_open, open_time, close_time, break_start, break_end')
      .eq('business_id', business.id)
      .order('day_of_week'),
    bizTokens?.telegram_bot_token
      ? getTelegramBotInfo(bizTokens.telegram_bot_token)
      : Promise.resolve({ ok: false as const }),
    bizTokens?.viber_bot_token
      ? getViberBotInfo(bizTokens.viber_bot_token)
      : Promise.resolve({ ok: false as const }),
  ])

  const telegramBotUsername = telegramInfo.ok ? (telegramInfo as { ok: true; result: { username: string } }).result?.username ?? null : null
  const viberBotUri = viberInfo.ok ? (viberInfo as { ok: true; uri?: string }).uri ?? null : null

  const brandColor = business.brand_color || '#6d4aff'

  return (
    <div
      style={{
        '--brand': brandColor,
        '--brand-light': `${brandColor}18`,
      } as React.CSSProperties}
    >
      {/* Header */}
      <header style={{ background: '#0d1b2e', borderBottom: '4px solid #8b5cf6', padding: '18px 16px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {business.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.logo_url} alt={business.name} style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 17 }}>
              {business.name[0]}
            </div>
          )}
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#ffffff' }}>{business.name}</div>
            <div style={{ fontSize: 12, color: '#a5b4fc', marginTop: 2 }}>Reserva tu cita</div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ background: '#eef0f8', minHeight: 'calc(100vh - 84px)', padding: '28px 16px 44px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ background: '#ffffff', border: '1px solid #dfe2f0', borderRadius: 16, boxShadow: '0 14px 36px rgba(24,32,57,.10)', overflow: 'hidden' }}>
            <div style={{ padding: '22px 28px 18px', borderBottom: '1px solid #e9eaf3', background: '#fbfbfe' }}>
              <div style={{ fontSize: 12, color: '#6d4aff', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Reserva online</div>
              <div style={{ fontSize: 22, color: '#182039', fontWeight: 700, marginTop: 5 }}>Elige cómo podemos atenderte</div>
              <div style={{ fontSize: 13, color: '#69738f', marginTop: 5 }}>Selecciona un servicio y encuentra el horario que mejor te convenga.</div>
            </div>
            <div style={{ padding: '24px 28px 28px' }}>
              <PublicBookingForm
                business={business}
                services={services ?? []}
                employees={employees ?? []}
                workingHours={businessHours ?? []}
                telegramBotUsername={telegramBotUsername}
                viberBotUri={viberBotUri}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
