"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  rodarAnaliseCadastralCompliance,
  rodarAnaliseReputacional,
  montarResultadoValidador,
  type ResultadoValidador,
} from "@/lib/compliance/validador";
import { buscarDadosParaAnalise, resultadoParaEnum } from "@/lib/compliance/coleta";
import { sanitizarNomeArquivo } from "@/lib/storageNomes";

async function exigirUsuarioComercial() {
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

/**
 * Mesma análise que o Compliance roda, só que chamada uma etapa antes —
 * o Comercial usa a exata mesma ferramenta (não é uma versão mais barata)
 * pra triar o cliente antes de escalar ao Compliance.
 */
export async function rodarAnaliseComercial(
  credenciamentoId: string,
): Promise<{ sucesso: true; validacaoId: string; resultado: ResultadoValidador } | { erro: string }> {
  try {
    const { supabase, userId } = await exigirUsuarioComercial();

    const dados = await buscarDadosParaAnalise(supabase, credenciamentoId);
    if ("erro" in dados) return dados;

    const { cadastral, compliance, analiseReceitaFederal, erros } = await rodarAnaliseCadastralCompliance(dados);
    const resultado = montarResultadoValidador(cadastral, compliance, null, analiseReceitaFederal, erros);

    const { data: inserida, error: erroInsert } = await supabase
      .from("validacao")
      .insert({
        credenciamento_id: credenciamentoId,
        validador: "comercial_pre_analise",
        resultado: resultadoParaEnum(resultado),
        alertas_json: resultado as never,
        validado_por: userId,
      })
      .select("id")
      .single();
    if (erroInsert || !inserida) {
      return { erro: `Análise concluída, mas falhou ao salvar: ${erroInsert?.message ?? "erro desconhecido"}` };
    }

    revalidatePath(`/comercial/${credenciamentoId}`);
    return { sucesso: true, validacaoId: inserida.id, resultado };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao rodar a análise." };
  }
}

/** Espelha analisarReputacional do Compliance — mesma etapa, chamada pelo Comercial. */
export async function rodarAnaliseComercialReputacional(
  credenciamentoId: string,
  validacaoId: string,
): Promise<{ sucesso: true; resultado: ResultadoValidador } | { erro: string }> {
  try {
    await exigirUsuarioComercial();
    const admin = createAdminClient();

    const { data: registro, error: erroBusca } = await admin
      .from("validacao")
      .select("alertas_json")
      .eq("id", validacaoId)
      .single();
    if (erroBusca || !registro) {
      return { erro: "Não encontrei a análise original pra anexar o resultado reputacional." };
    }

    const anterior = registro.alertas_json as ResultadoValidador;
    const erros = anterior.erros ? [...anterior.erros] : [];
    const pessoas = (anterior.analiseCompliance?.beneficiarios ?? []).map((b) => b.nome).filter(Boolean);

    let reputacional = null;
    try {
      reputacional = await rodarAnaliseReputacional({ empresa: anterior.empresa, pessoas });
    } catch (e) {
      erros.push({ codigo: "ANALISE_REPUTACIONAL_FALHOU", mensagem: String(e), etapa: "reputacional" });
    }

    const resultado = montarResultadoValidador(
      anterior.analiseCadastral,
      anterior.analiseCompliance,
      reputacional,
      anterior.analiseReceitaFederal,
      erros,
    );

    const { error: erroUpdate } = await admin
      .from("validacao")
      .update({ resultado: resultadoParaEnum(resultado), alertas_json: resultado as never })
      .eq("id", validacaoId);
    if (erroUpdate) {
      return { erro: `Análise reputacional concluída, mas falhou ao salvar: ${erroUpdate.message}` };
    }

    revalidatePath(`/comercial/${credenciamentoId}`);
    return { sucesso: true, resultado };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao rodar a análise reputacional." };
  }
}

export async function encaminharParaCompliance(
  formData: FormData,
): Promise<{ erro?: string }> {
  try {
    const { supabase, userId } = await exigirUsuarioComercial();

    const credenciamentoId = String(formData.get("credenciamentoId") ?? "");
    const texto = String(formData.get("texto") ?? "").trim();
    const arquivo = formData.get("arquivo");

    if (!credenciamentoId) return { erro: "Credenciamento não informado." };

    // Precisa ter rodado a pré-análise do Comercial antes de encaminhar —
    // é ela que decide se a justificativa é obrigatória ou não.
    const { data: ultimaAnalise } = await supabase
      .from("validacao")
      .select("alertas_json")
      .eq("credenciamento_id", credenciamentoId)
      .eq("validador", "comercial_pre_analise")
      .order("validado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!ultimaAnalise) {
      return { erro: "Rode a análise com IA antes de encaminhar ao Compliance." };
    }

    const resultado = ultimaAnalise.alertas_json as ResultadoValidador;
    const precisaJustificativa = resultado.veredicto.resultado !== "APTO";
    if (precisaJustificativa && !texto) {
      return { erro: "A IA sinalizou atenção — informe a justificativa antes de encaminhar." };
    }

    let evidenciaUrl: string | null = null;
    if (arquivo instanceof File && arquivo.size > 0) {
      const admin = createAdminClient();
      const caminho = `${credenciamentoId}/justificativa-${Date.now()}-${sanitizarNomeArquivo(arquivo.name)}`;
      const buffer = Buffer.from(await arquivo.arrayBuffer());
      const { error: erroUpload } = await admin.storage
        .from("documentos")
        .upload(caminho, buffer, { contentType: arquivo.type || undefined });
      if (erroUpload) return { erro: `Falha ao anexar a evidência: ${erroUpload.message}` };
      evidenciaUrl = caminho;
    }

    const { error: erroJustificativa } = await supabase.from("justificativa_comercial").insert({
      credenciamento_id: credenciamentoId,
      tipo: "encaminhamento",
      texto: texto || null,
      evidencia_url: evidenciaUrl,
      criado_por: userId,
    });
    if (erroJustificativa) return { erro: erroJustificativa.message };

    const { error: erroStatus } = await supabase
      .from("credenciamento")
      .update({ status: "EM_ANALISE", entrou_em_analise_em: new Date().toISOString() })
      .eq("id", credenciamentoId);
    if (erroStatus) return { erro: erroStatus.message };

    revalidatePath(`/comercial/${credenciamentoId}`);
    revalidatePath("/comercial");
    revalidatePath("/compliance");
    return {};
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao encaminhar ao Compliance." };
  }
}

export async function devolverAoCliente(
  credenciamentoId: string,
  motivo: string,
): Promise<{ erro?: string }> {
  try {
    const { supabase, userId } = await exigirUsuarioComercial();

    const { error: erroJustificativa } = await supabase.from("justificativa_comercial").insert({
      credenciamento_id: credenciamentoId,
      tipo: "devolucao_cliente",
      texto: motivo || null,
      criado_por: userId,
    });
    if (erroJustificativa) return { erro: erroJustificativa.message };

    const { error: erroStatus } = await supabase
      .from("credenciamento")
      .update({ status: "DEVOLVIDO" })
      .eq("id", credenciamentoId);
    if (erroStatus) return { erro: erroStatus.message };

    revalidatePath(`/comercial/${credenciamentoId}`);
    revalidatePath("/comercial");
    return {};
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao devolver ao cliente." };
  }
}
