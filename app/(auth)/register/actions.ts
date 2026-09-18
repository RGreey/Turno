'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { slugify } from '@/lib/utils'
import { getOrCreateBusiness, insertOwnerAsEmployee } from '@/lib/create-business'
import { redirect } from 'next/navigation'

export async function register(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const businessName = (formData.get('business_name') as string).trim()
  const inviteCode = (formData.get('invite_code') as string ?? '').trim()

  if (!businessName) {
    redirect('/register?error=Business+name+is+required')
  }

  // Puerta de acceso: solo se puede crear cuenta con un código válido.
  // Controla el valor esperado en la variable de entorno SIGNUP_INVITE_CODE
  // (en Vercel → Environment Variables). Cámbialo cuando quieras "cerrar"
  // el registro a nuevos negocios, o compártelo cuando quieras invitar a uno.
  const expectedCode = process.env.SIGNUP_INVITE_CODE
  if (expectedCode && inviteCode !== expectedCode) {
    redirect(`/register?error=${encodeURIComponent('Invalid or expired invite code.')}`)
  }

  // Sign up
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { business_name: businessName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (signUpError || !authData.user) {
    redirect(`/register?error=${encodeURIComponent(signUpError?.message ?? 'Sign up failed')}`)
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const baseSlug = slugify(businessName)
  let slug = baseSlug
  let attempt = 0

  while (true) {
    const { data: existing } = await admin
      .from('businesses')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!existing) break
    attempt++
    slug = `${baseSlug}-${attempt}`
  }

  const business = await getOrCreateBusiness(admin, {
    owner_id: authData.user.id,
    name: businessName,
    slug,
  })

  if (!business) {
    redirect(`/register?error=${encodeURIComponent("We couldn't finish setting up your account. Please try again.")}`)
  }

  await insertOwnerAsEmployee(admin, business.id, authData.user)

  if (process.env.NEXT_PUBLIC_DEPLOYMENT_MODE === 'selfhosted' && !authData.session) {
    const { data: signInData } = await supabase.auth.signInWithPassword({ email, password })
    if (signInData.session) {
      redirect('/onboarding')
    }
  }

  if (authData.session) {
    redirect('/onboarding')
  } else {
    redirect('/check-email')
  }
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
    redirect(`/login?error=${encodeURIComponent('Google sign-in failed')}`)
  }

  redirect(data.url)
}