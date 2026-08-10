import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente com service role — ignora RLS. Uso restrito a rotas de
 * servidor (server actions / route handlers), nunca importado em
 * código que roda no browser (é o que garante o isolamento do
 * portal externo do cliente das áreas internas).
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
