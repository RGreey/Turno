export const MODULES = {
  bookings: {
    label: 'Reservas y calendario',
    description: 'Citas, agenda y asignación de personal',
  },
  crm: {
    label: 'CRM y clientes',
    description: 'Fichas de clientes, historial de visitas, etiquetas y notas',
  },
  pos: {
    label: 'TPV y cobros',
    description: 'Ventas, pagos y recibos',
  },
  inventory: {
    label: 'Inventario',
    description: 'Existencias, productos y alertas de stock bajo',
  },
  notifications: {
    label: 'Notificaciones',
    description: 'Recordatorios por Telegram, WhatsApp, Viber y correo electrónico',
  },
} as const

export type ModuleKey = keyof typeof MODULES

export function isModuleEnabled(enabledModules: string[], module: ModuleKey): boolean {
  return enabledModules.includes(module)
}
