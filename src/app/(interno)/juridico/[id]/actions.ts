"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  gerarContratoDocx,
  formatarEnderecoCompleto,
  type ProdutoContrato,
} from "@/lib/juridico/contrato";

interface Assinante {
  nome: string;
  cpf: string;
  email: string;
  cargo: string;
}

interface Contato {
  nome: string;
  email: string;
}

async function exigirUsuarioJuridico() {
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

export async function gerarContrato(
  credenciamentoId: string,
  produto: ProdutoContrato,
): Promise<{ erro?: string }> {
  try {
    const { supabase } = await exigirUsuarioJuridico();
    const admin = createAdminClient();

    const { data: credenciamento } = await supabase
      .from("credenciamento")
      .select("id, status, cliente:cliente_id(razao_social, cnpj)")
      .eq("id", credenciamentoId)
      .single();
    if (!credenciamento) return { erro: "Credenciamento não encontrado." };

    const { data: ficha } = await supabase
      .from("ficha_kyc")
      .select("dados_json")
      .eq("credenciamento_id", credenciamentoId)
      .maybeSingle();

    const cliente = credenciamento.cliente as unknown as { razao_social: string; cnpj: string };
    const dados = (ficha?.dados_json ?? {}) as Record<string, unknown>;
    const endereco = (dados.endereco ?? {}) as Record<string, string>;
    const assinantes = (dados.assinantes ?? []) as Assinante[];
    const contatos = (dados.contatos ?? {}) as { juridico?: Contato };

    const contatoNome = contatos.juridico?.nome || assinantes[0]?.nome || "—";
    const contatoEmail = contatos.juridico?.email || assinantes[0]?.email || "—";

    const docxBuffer = await gerarContratoDocx(produto, {
      razaoSocial: cliente.razao_social,
      cnpj: cliente.cnpj,
      enderecoCompleto: formatarEnderecoCompleto(endereco) || "—",
      contatoNome,
      contatoEmail,
    });

    const caminho = `${credenciamentoId}/contrato-${produto.toLowerCase()}.docx`;
    const { error: erroUpload } = await admin.storage
      .from("documentos")
      .upload(caminho, docxBuffer, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });
    if (erroUpload) return { erro: `Falha ao salvar o contrato gerado: ${erroUpload.message}` };

    const { data: contratoExistente } = await supabase
      .from("contrato")
      .select("id")
      .eq("credenciamento_id", credenciamentoId)
      .eq("produto", produto)
      .maybeSingle();

    if (contratoExistente) {
      const { error: erroUpdate } = await supabase
        .from("contrato")
        .update({ arquivo_url: caminho, gerado_em: new Date().toISOString(), status: "RASCUNHO" })
        .eq("id", contratoExistente.id);
      if (erroUpdate) return { erro: erroUpdate.message };
    } else {
      const { error: erroInsert } = await supabase.from("contrato").insert({
        credenciamento_id: credenciamentoId,
        produto,
        arquivo_url: caminho,
        gerado_em: new Date().toISOString(),
        status: "RASCUNHO",
      });
      if (erroInsert) return { erro: erroInsert.message };
    }

    if (credenciamento.status === "VALIDADO") {
      await supabase.from("credenciamento").update({ status: "EM_CONTRATO" }).eq("id", credenciamentoId);
    }

    revalidatePath(`/juridico/${credenciamentoId}`);
    return {};
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao gerar o contrato." };
  }
}

export async function obterLinkContrato(caminho: string): Promise<string | null> {
  const { supabase } = await exigirUsuarioJuridico();
  void supabase;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("documentos").createSignedUrl(caminho, 300);
  if (error || !data) return null;
  return data.signedUrl;
}

/**
 * Envio manual "de bolso" enquanto a integração real com o DocuSign não
 * está pronta (conta sandbox ainda sendo criada) — assim já dá pra testar
 * o fluxo completo de status. Troca pelo envio real de envelope depois.
 */
export async function marcarEnviadoParaAssinatura(
  contratoId: string,
  credenciamentoId: string,
): Promise<{ erro?: string }> {
  try {
    const { supabase } = await exigirUsuarioJuridico();

    const { error: erroContrato } = await supabase
      .from("contrato")
      .update({ status: "ENVIADO_PARA_ASSINATURA" })
      .eq("id", contratoId);
    if (erroContrato) return { erro: erroContrato.message };

    const { error: erroStatus } = await supabase
      .from("credenciamento")
      .update({ status: "AGUARDANDO_ASSINATURA" })
      .eq("id", credenciamentoId);
    if (erroStatus) return { erro: erroStatus.message };

    revalidatePath(`/juridico/${credenciamentoId}`);
    revalidatePath("/juridico");
    return {};
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao marcar como enviado." };
  }
}

export async function marcarAssinado(
  contratoId: string,
  credenciamentoId: string,
): Promise<{ erro?: string }> {
  try {
    const { supabase } = await exigirUsuarioJuridico();

    const { error: erroContrato } = await supabase
      .from("contrato")
      .update({ status: "ASSINADO", assinado_em: new Date().toISOString() })
      .eq("id", contratoId);
    if (erroContrato) return { erro: erroContrato.message };

    const { data: contratos } = await supabase
      .from("contrato")
      .select("status")
      .eq("credenciamento_id", credenciamentoId);

    const todosAssinados = (contratos ?? []).every((c) => c.status === "ASSINADO");

    if (todosAssinados) {
      const { error: erroStatus } = await supabase
        .from("credenciamento")
        .update({ status: "ASSINADO" })
        .eq("id", credenciamentoId);
      if (erroStatus) return { erro: erroStatus.message };
    }

    revalidatePath(`/juridico/${credenciamentoId}`);
    revalidatePath("/juridico");
    return {};
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao marcar como assinado." };
  }
}
