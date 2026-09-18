import { register } from './actions'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { PasswordInput } from '@/components/ui/password-input'

export default async function RegisterPage(
  props: {
    searchParams: Promise<{ error?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const t = await getTranslations('auth.register')

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-2">{t('heading')}</h1>
      <p className="text-sm text-gray-500 mb-6">{t('subheading')}</p>

      {searchParams.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          {searchParams.error}
        </div>
      )}

      <form action={register} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="business_name">
            {t('businessNameLabel')}
          </label>
          <input
            id="business_name" name="business_name" type="text" required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={t('businessNamePlaceholder')}
          />
        </div>
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
        <PasswordInput
          id="password"
          name="password"
          label={t('passwordLabel')}
          placeholder={t('passwordPlaceholder')}
          required
          minLength={8}
          autoComplete="new-password"
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="invite_code">
            {t('inviteCodeLabel')}
          </label>
          <input
            id="invite_code" name="invite_code" type="text" required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={t('inviteCodePlaceholder')}
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          {t('submitButton')}
        </button>
      </form>

      <p className="text-sm text-gray-500 text-center mt-4">
        {t('alreadyHaveAccount')}{' '}
        <Link href="/login" className="text-blue-600 hover:underline">{t('signIn')}</Link>
      </p>
    </div>
  )
}