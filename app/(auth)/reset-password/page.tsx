import { updatePassword } from './actions'
import { PasswordInput } from '@/components/ui/password-input'

export default async function ResetPasswordPage(
  props: {
    searchParams: Promise<{ error?: string }>
  }
) {
  const searchParams = await props.searchParams;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Establece una nueva contraseña</h1>

      {searchParams.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          {searchParams.error}
        </div>
      )}

      <form action={updatePassword} className="space-y-4">
        <PasswordInput
          id="password"
          name="password"
          label="Nueva contraseña"
          placeholder="Mín. 8 caracteres"
          required
          autoComplete="new-password"
        />
        <PasswordInput
          id="confirm"
          name="confirm"
          label="Confirmar contraseña"
          placeholder="Repite la nueva contraseña"
          required
          autoComplete="new-password"
        />
        <button
          type="submit"
          className="w-full bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Actualizar contraseña
        </button>
      </form>
    </div>
  )
}
