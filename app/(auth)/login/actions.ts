'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

export async function login(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const redirectTo = (formData.get('redirectTo') as string) || '/dashboard'

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    const t = await getTranslations('auth.login')
    redirect(`/login?error=${encodeURIComponent(t('errorInvalid'))}`)
  }

  redirect(redirectTo)
}

export async function loginWithGoogle(formData: FormData) {
  const supabase = await createClient()
  const redirectTo = (formData.get('redirectTo') as string) || '/dashboard'

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${redirectTo}`,
    },
  })

  if (error || !data.url) {
    const t = await getTranslations('auth.login')
    redirect(`/login?error=${encodeURIComponent(t('errorGoogle'))}`)
  }

  redirect(data.url)
}
