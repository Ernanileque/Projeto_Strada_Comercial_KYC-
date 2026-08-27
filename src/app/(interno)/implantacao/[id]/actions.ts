"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function exigirUsuarioImplantacao() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Faça login novamente.");

  const { data: usuario } = await supabase
    .from("usuario")
    .select("ativo, area")
    .eq("id", user.id)
    .maybeSingle();
  if (!usuario?.ativo) throw new Error("Usuário inativo.");

  return { supabase, userId: user.id };
}

export async function iniciarImplantacao(credenciamentoId: string): Promise<{ erro?: string }> {
  try {
    const { supabase } = await exigirUsuarioImplantacao();

    const { data: existente } = await supabase
      .from("implantacao")
      .select("id")
      .eq("credenciamento_id", credenciamentoId)
      .maybeSingle();

    if (existente) {
      const { error } = await supabase
        .from("implantacao")
        .update({ iniciada_em: new Date().toISOString() })
        .eq("id", existente.id);
      if (error) return { erro: error.message };
    } else {
      const { error } = await supabase.from("implantacao").insert({
        credenciamento_id: credenciamentoId,
        iniciada_em: new Date().toISOString(),
      });
      if (error) return { erro: error.message };
    }

    const { error: erroStatus } = await supabase
      .from("credenciamento")
      .update({ status: "EM_IMPLANTACAO" })
      .eq("id", credenciamentoId);
    if (erroStatus) return { erro: erroStatus.message };

    revalidatePath(`/implantacao/${credenciamentoId}`);
    revalidatePath("/implantacao");
    return {};
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao iniciar a implantação." };
  }
}

export async function marcarOperando(credenciamentoId: string): Promise<{ erro?: string }> {
  try {
    const { supabase } = await exigirUsuarioImplantacao();

    const { error: erroImplantacao } = await supabase
      .from("implantacao")
      .update({ operando_em: new Date().toISOString() })
      .eq("credenciamento_id", credenciamentoId);
    if (erroImplantacao) return { erro: erroImplantacao.message };

    const { error: erroStatus } = await supabase
      .from("credenciamento")
      .update({ status: "OPERANDO" })
      .eq("id", credenciamentoId);
    if (erroStatus) return { erro: erroStatus.message };

    revalidatePath(`/implantacao/${credenciamentoId}`);
    revalidatePath("/implantacao");
    return {};
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao marcar como operando." };
  }
}
