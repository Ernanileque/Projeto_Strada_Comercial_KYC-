"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Gera uma URL assinada temporária pra visualizar um documento do
 * Storage. O bucket é privado (sem policies abertas), então quem
 * pede precisa estar logado e ser um usuário interno ativo — a
 * mesma regra de "todo usuário interno vê a jornada inteira" das
 * tabelas, só que aplicada aqui manualmente porque o Storage não
 * usa a RLS do Postgres.
 */
export async function obterLinkDocumento(caminho: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: usuario } = await supabase
    .from("usuario")
    .select("ativo")
    .eq("id", user.id)
    .maybeSingle();
  if (!usuario?.ativo) return null;

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("documentos").createSignedUrl(caminho, 300);
  if (error || !data) return null;

  return data.signedUrl;
}
