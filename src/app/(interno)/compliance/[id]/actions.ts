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

async function exigirUsuarioCompliance() {
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
 * Roda só cadastral + compliance (rápido, os dois em paralelo) e já
 * salva o resultado. A reputacional (lenta, busca na web) fica pro
 * analisarReputacional() de baixo, chamada em paralelo pelo cliente —
 * assim a tela mostra o resultado cadastral/compliance sem esperar a
 * parte mais demorada.
 */
export async function analisarCredenciamento(
  credenciamentoId: string,
): Promise<{ sucesso: true; validacaoId: string; resultado: ResultadoValidador } | { erro: string }> {
  try {
    const { supabase, userId } = await exigirUsuarioCompliance();

    const dados = await buscarDadosParaAnalise(supabase, credenciamentoId);
    if ("erro" in dados) return dados;

    const { cadastral, compliance, analiseReceitaFederal, erros } = await rodarAnaliseCadastralCompliance(dados);
    const resultado = montarResultadoValidador(cadastral, compliance, null, analiseReceitaFederal, erros);

    const { data: inserida, error: erroInsert } = await supabase
      .from("validacao")
      .insert({
        credenciamento_id: credenciamentoId,
        validador: "ia_validador_cadastral",
        resultado: resultadoParaEnum(resultado),
        alertas_json: resultado as never,
        validado_por: userId,
      })
      .select("id")
      .single();
    if (erroInsert || !inserida) {
      return { erro: `Análise concluída, mas falhou ao salvar: ${erroInsert?.message ?? "erro desconhecido"}` };
    }

    revalidatePath(`/compliance/${credenciamentoId}`);
    return { sucesso: true, validacaoId: inserida.id, resultado };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao rodar a análise." };
  }
}

/** Roda a análise reputacional (mais lenta) e atualiza a validacao já salva por analisarCredenciamento. */
export async function analisarReputacional(
  credenciamentoId: string,
  validacaoId: string,
): Promise<{ sucesso: true; resultado: ResultadoValidador } | { erro: string }> {
  try {
    await exigirUsuarioCompliance();
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

    // Não precisa reler os documentos — a cadastral/compliance já
    // extraiu os nomes, que é só o que a reputacional precisa pra
    // pesquisar. Isso mantém a chamada leve e rápida.
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

    revalidatePath(`/compliance/${credenciamentoId}`);
    return { sucesso: true, resultado };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao rodar a análise reputacional." };
  }
}

export async function aprovarCredenciamento(credenciamentoId: string): Promise<{ erro?: string }> {
  try {
    const { supabase, userId } = await exigirUsuarioCompliance();

    // Registra a decisão do Compliance (mesmo padrão de Devolver/Negar) —
    // sem isso, o histórico mostrava só o resultado bruto da última análise
    // de IA, mesmo quando o analista aprovou manualmente por cima dela.
    const { error: erroValidacao } = await supabase.from("validacao").insert({
      credenciamento_id: credenciamentoId,
      validador: "compliance_aprovacao",
      resultado: "APTO",
      alertas_json: {},
      validado_por: userId,
    });
    if (erroValidacao) return { erro: erroValidacao.message };

    const { error } = await supabase
      .from("credenciamento")
      .update({ status: "VALIDADO" })
      .eq("id", credenciamentoId);
    if (error) return { erro: error.message };
    revalidatePath(`/compliance/${credenciamentoId}`);
    revalidatePath("/compliance");
    return {};
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao aprovar." };
  }
}

export async function negarCredenciamento(
  credenciamentoId: string,
  motivo: string,
): Promise<{ erro?: string }> {
  try {
    const { supabase, userId } = await exigirUsuarioCompliance();

    if (!motivo.trim()) return { erro: "Informe o motivo da negativa." };

    const { error: erroValidacao } = await supabase.from("validacao").insert({
      credenciamento_id: credenciamentoId,
      validador: "compliance_negacao",
      resultado: "NAO_APTO",
      alertas_json: { motivo } as never,
      validado_por: userId,
    });
    if (erroValidacao) return { erro: erroValidacao.message };

    const { error: erroStatus } = await supabase
      .from("credenciamento")
      .update({ status: "REPROVADO" })
      .eq("id", credenciamentoId);
    if (erroStatus) return { erro: erroStatus.message };

    revalidatePath(`/compliance/${credenciamentoId}`);
    revalidatePath("/compliance");
    return {};
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao negar o credenciamento." };
  }
}
