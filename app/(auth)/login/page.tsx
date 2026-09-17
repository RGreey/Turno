import { login, loginWithGoogle } from './actions'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { PasswordInput } from '@/components/ui/password-input'

export default async function LoginPage(
  props: {
    searchParams: Promise<{ redirectTo?: string; error?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const t = await getTranslations('auth.login')

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">{t('heading')}</h1>

      {searchParams.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          {searchParams.error}
        </div>
      )}

      <form action={loginWithGoogle}>
        <input type="hidden" name="redirectTo" value={searchParams.redirectTo ?? '/dashboard'} />
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-4"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {t('googleButton')}
        </button>
      </form>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs text-gray-400 uppercase">
          <span className="bg-white px-2">{t('divider')}</span>
        </div>
      </div>

      <form action={login} className="space-y-4">
        <input type="hidden" name="redirectTo" value={searchParams.redirectTo ?? '/dashboard'} />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
            {t('emailLabel')}
          </label>
          <input
            id="email" name="email" type="email" required autoComplete="email"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={t('emailPlaceholder')}
          />
        </div>
        <div>
          <PasswordInput
            id="password"
            name="password"
            label={t('passwordLabel')}
            placeholder={t('passwordPlaceholder')}
            required
            autoComplete="current-password"
          />
          <div className="text-right mt-1">
            <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline">
              {t('forgotPassword')}
            </Link>
          </div>
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          {t('submitButton')}
        </button>
      </form>

      <p className="text-sm text-gray-500 text-center mt-6">
        {t('noAccount')}{' '}
        <Link href="/register" className="text-blue-600 hover:underline">{t('createAccount')}</Link>
      </p>
    </div>
  )
}
