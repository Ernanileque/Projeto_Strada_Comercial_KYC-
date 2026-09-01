"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  gerarContratoDocx,
  formatarEnderecoCompleto,
  SIGNATARIO_DESIGNADO_STRADA,
  TESTEMUNHA_FIXA_STRADA,
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

interface TestemunhaRegistro {
  nome: string;
  cpf: string | null;
  email: string;
}

/**
 * Recria do zero (delete + insert) o conjunto de assinantes daquele
 * contrato — chamado toda vez que o contrato é gerado/regenerado, pra
 * manter a lista sempre consistente com os dados mais recentes da
 * ficha KYC/testemunha.
 */
async function recriarAssinaturas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contratoId: string,
  assinantes: Assinante[],
  testemunhaCliente: TestemunhaRegistro | null,
): Promise<{ erro?: string }> {
  const { error: erroLimpa } = await supabase.from("assinatura").delete().eq("contrato_id", contratoId);
  if (erroLimpa) return { erro: erroLimpa.message };

  const linhas = [
    {
      contrato_id: contratoId,
      papel: "strada_signatario",
      nome: SIGNATARIO_DESIGNADO_STRADA.nome,
      email: SIGNATARIO_DESIGNADO_STRADA.email,
    },
    {
      contrato_id: contratoId,
      papel: "strada_testemunha",
      nome: TESTEMUNHA_FIXA_STRADA.nome,
      email: TESTEMUNHA_FIXA_STRADA.email,
    },
    ...assinantes
      .filter((a) => a.nome?.trim())
      .map((a) => ({
        contrato_id: contratoId,
        papel: "cliente_signatario" as const,
        nome: a.nome,
        cpf: a.cpf || null,
        email: a.email || null,
      })),
    ...(testemunhaCliente
      ? [
          {
            contrato_id: contratoId,
            papel: "cliente_testemunha" as const,
            nome: testemunhaCliente.nome,
            cpf: testemunhaCliente.cpf,
            email: testemunhaCliente.email,
          },
        ]
      : []),
  ];

  const { error: erroInsert } = await supabase.from("assinatura").insert(linhas);
  if (erroInsert) return { erro: erroInsert.message };
  return {};
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

    const [{ data: ficha }, { data: testemunhaCliente }] = await Promise.all([
      supabase.from("ficha_kyc").select("dados_json").eq("credenciamento_id", credenciamentoId).maybeSingle(),
      supabase.from("testemunha").select("nome, cpf, email").eq("credenciamento_id", credenciamentoId).maybeSingle(),
    ]);

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

    let contratoId: string;
    if (contratoExistente) {
      const { error: erroUpdate } = await supabase
        .from("contrato")
        .update({ arquivo_url: caminho, gerado_em: new Date().toISOString(), status: "RASCUNHO" })
        .eq("id", contratoExistente.id);
      if (erroUpdate) return { erro: erroUpdate.message };
      contratoId = contratoExistente.id;
    } else {
      const { data: contratoInserido, error: erroInsert } = await supabase
        .from("contrato")
        .insert({
          credenciamento_id: credenciamentoId,
          produto,
          arquivo_url: caminho,
          gerado_em: new Date().toISOString(),
          status: "RASCUNHO",
        })
        .select("id")
        .single();
      if (erroInsert || !contratoInserido) return { erro: erroInsert?.message ?? "Falha ao criar o contrato." };
      contratoId = contratoInserido.id;
    }

    const resultadoAssinaturas = await recriarAssinaturas(supabase, contratoId, assinantes, testemunhaCliente);
    if (resultadoAssinaturas.erro) {
      return { erro: `Contrato gerado, mas falhou ao montar a lista de assinantes: ${resultadoAssinaturas.erro}` };
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

/**
 * Marca uma pessoa específica como tendo assinado. Quando todos os
 * assinantes daquele contrato já assinaram, o contrato inteiro vira
 * ASSINADO sozinho. O credenciamento NÃO muda de status aqui —
 * mesmo com todos os contratos assinados, o Jurídico precisa
 * conferir e clicar em "Enviar para Implantação" (enviarParaImplantacao)
 * pra de fato encaminhar. Isso evita que o handoff pra outra área
 * aconteça sem revisão, só porque o último assinante confirmou.
 */
export async function marcarAssinaturaIndividual(
  assinaturaId: string,
  contratoId: string,
  credenciamentoId: string,
): Promise<{ erro?: string }> {
  try {
    const { supabase } = await exigirUsuarioJuridico();

    const { error: erroAssinatura } = await supabase
      .from("assinatura")
      .update({ assinado_em: new Date().toISOString() })
      .eq("id", assinaturaId);
    if (erroAssinatura) return { erro: erroAssinatura.message };

    const { data: assinaturasDoContrato } = await supabase
      .from("assinatura")
      .select("assinado_em")
      .eq("contrato_id", contratoId);

    const todosAssinaram = (assinaturasDoContrato ?? []).every((a) => a.assinado_em !== null);

    if (todosAssinaram) {
      const { error: erroContrato } = await supabase
        .from("contrato")
        .update({ status: "ASSINADO", assinado_em: new Date().toISOString() })
        .eq("id", contratoId);
      if (erroContrato) return { erro: erroContrato.message };
    }

    revalidatePath(`/juridico/${credenciamentoId}`);
    revalidatePath("/juridico");
    return {};
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao marcar assinatura." };
  }
}

/**
 * Handoff explícito pra Implantação — o Jurídico confere que todos os
 * contratos do credenciamento já estão assinados e clica pra
 * encaminhar. Reconfere no servidor (não confia só na tela) antes de
 * mudar o status do credenciamento.
 */
export async function enviarParaImplantacao(credenciamentoId: string): Promise<{ erro?: string }> {
  try {
    const { supabase } = await exigirUsuarioJuridico();

    const { data: contratos } = await supabase
      .from("contrato")
      .select("status")
      .eq("credenciamento_id", credenciamentoId);

    const todosAssinados = !!contratos?.length && contratos.every((c) => c.status === "ASSINADO");
    if (!todosAssinados) {
      return { erro: "Ainda há contrato pendente de assinatura — confira a lista de assinantes." };
    }

    const { error } = await supabase
      .from("credenciamento")
      .update({ status: "ASSINADO" })
      .eq("id", credenciamentoId);
    if (error) return { erro: error.message };

    revalidatePath(`/juridico/${credenciamentoId}`);
    revalidatePath("/juridico");
    revalidatePath("/implantacao");
    return {};
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao enviar para implantação." };
  }
}
