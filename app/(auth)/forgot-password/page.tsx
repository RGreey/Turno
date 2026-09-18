import { requestPasswordReset } from './actions'
import Link from 'next/link'
import { SubmitButton } from './SubmitButton'

export default async function ForgotPasswordPage(
  props: {
    searchParams: Promise<{ sent?: string; email?: string }>
  }
) {
  const searchParams = await props.searchParams;
  if (searchParams.sent) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-3">Revisa tu correo electrónico</h1>
        <p className="text-sm text-gray-600 mb-6">
          Hemos enviado un enlace para restablecer la contraseña a <strong>{searchParams.email}</strong>.
          Haz clic en él para establecer una nueva contraseña.
        </p>
        <Link href="/login" className="text-sm text-blue-600 hover:underline">
          ← Volver a iniciar sesión
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-2">Restablece tu contraseña</h1>
      <p className="text-sm text-gray-500 mb-6">
        Introduce tu correo electrónico y te enviaremos un enlace para restablecerla.
      </p>

      <form action={requestPasswordReset} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
            Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="tu@ejemplo.com"
          />
        </div>
        <SubmitButton />
      </form>

      <div className="mt-6">
        <Link href="/login" className="text-sm text-blue-600 hover:underline">
          ← Volver a iniciar sesión
        </Link>
      </div>
    </div>
  )
}
