-- 037_grant_service_role_and_sequences.sql
--
-- Contexto: al desactivar "Automatically expose new tables" en la creación
-- del proyecto de Supabase (recomendado por seguridad), Supabase deja de
-- otorgar automáticamente privilegios a los roles anon/authenticated/service_role
-- sobre las tablas y secuencias del schema public.
--
-- Las migraciones anteriores (001, etc.) sí otorgan GRANT explícito a
-- "anon, authenticated" en cada tabla, pero nunca a "service_role" — que es
-- el rol que usa el cliente admin (createServiceClient) para operaciones que
-- deben saltarse RLS, como crear una reserva pública o cobrar en el POS.
--
-- Sin este GRANT, cualquier operación que dependa de service_role o de una
-- secuencia (como el contador de números de recibo, receipt_seq) falla con
-- "permission denied for table X" o "permission denied for sequence X".
--
-- Esta migración corrige eso de forma permanente y future-proof: cualquier
-- tabla o secuencia que se cree DESPUÉS de aplicar esto también queda
-- cubierta automáticamente, gracias a ALTER DEFAULT PRIVILEGES.

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;z