"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  rodarAnaliseCadastralCompliance,
  rodarAnaliseReputacional,
  montarResultadoValidador,
  type DocumentoParaAnalise,
  type ResultadoValidador,
} from "@/lib/compliance/validador";

const CATEGORIA_POR_TIPO: Record<string, string> = {
  contrato_social: "Contrato social",
  cartao_cnpj_qsa: "Cartão CNPJ/QSA",
  estatuto_social: "Estatuto social",
  ata_eleicao: "Ata de eleição",
  comprovante_bancario: "Comprovante bancário",
  comprovante_endereco: "Comprovante de endereço",
  rg_cpf_socio: "RG/CPF de sócio",
  rg_cnh_representante: "RG/CPF de sócio",
  ficha_cadastral: "Ficha cadastral",
  proposta_comercial: "Outro",
  outro: "Outro",
};

function mediaTypeDoArquivo(nome: string): DocumentoParaAnalise["mediaType"] | null {
  const n = nome.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".webp")) return "image/webp";
  return null;
}

function montarFichaResumo(dados: Record<string, unknown>): string {
  const linhas: string[] = [];
  const empresa = (dados.empresa ?? {}) as Record<string, string>;
  const endereco = (dados.endereco ?? {}) as Record<string, string>;
  const capital = (dados.capital ?? {}) as Record<string, string>;
  const socios = (dados.socios ?? []) as Record<string, string>[];
  const assinantes = (dados.assinantes ?? []) as Record<string, string>[];

  linhas.push(`CNPJ: ${empresa.cnpj ?? "—"}`);
  linhas.push(`Razão social: ${empresa.razao ?? "—"}`);
  if (empresa.fantasia) linhas.push(`Nome fantasia: ${empresa.fantasia}`);
  linhas.push(`CNAE: ${empresa.cnae ?? "—"}`);
  if (empresa.objeto) linhas.push(`Objeto social: ${empresa.objeto}`);
  if (empresa.fatMes) linhas.push(`Faturamento mensal informado: R$ ${empresa.fatMes}`);
  if (empresa.fatAno) linhas.push(`Faturamento anual informado: R$ ${empresa.fatAno}`);
  linhas.push(
    `Endereço: ${[endereco.logradouro, endereco.numero, endereco.bairro, endereco.municipio, endereco.uf, endereco.cep]
      .filter(Boolean)
      .join(", ") || "—"}`,
  );
  if (capital.valor) linhas.push(`Capital social informado: R$ ${capital.valor}`);

  linhas.push("");
  linhas.push("Sócios/beneficiários informados pelo cliente:");
  socios.forEach((s) => {
    linhas.push(
      `- ${s.nome ?? "—"} (${s.pessoa ?? "PF"}), doc ${s.doc ?? "—"}, participação ${s.pct ?? "—"}%, PEP: ${s.pep ?? "—"}`,
    );
  });

  linhas.push("");
  linhas.push("Assinantes/administradores informados pelo cliente:");
  assinantes.forEach((a) => {
    linhas.push(`- ${a.nome ?? "—"}, CPF ${a.cpf ?? "—"}, cargo: ${a.cargo ?? "—"}`);
  });

  return linhas.join("\n");
}

async function buscarDadosParaAnalise(
  supabase: Awaited<ReturnType<typeof createClient>>,
  credenciamentoId: string,
): Promise<{ documentos: DocumentoParaAnalise[]; fichaResumo: string } | { erro: string }> {
  const admin = createAdminClient();

  const { data: ficha } = await supabase
    .from("ficha_kyc")
    .select("dados_json")
    .eq("credenciamento_id", credenciamentoId)
    .maybeSingle();

  const { data: documentosDb } = await supabase
    .from("documento")
    .select("tipo, arquivo_url")
    .eq("credenciamento_id", credenciamentoId);

  if (!documentosDb?.length) {
    return { erro: "Não há documentos anexados para analisar." };
  }

  const documentos: DocumentoParaAnalise[] = [];
  for (const doc of documentosDb) {
    const mediaType = mediaTypeDoArquivo(doc.arquivo_url);
    if (!mediaType) continue;

    const { data: arquivo, error: erroDownload } = await admin.storage
      .from("documentos")
      .download(doc.arquivo_url);
    if (erroDownload || !arquivo) continue;

    const buffer = Buffer.from(await arquivo.arrayBuffer());
    documentos.push({
      nomeArquivo: doc.arquivo_url.split("/").pop() ?? doc.arquivo_url,
      categoriaDocumento: CATEGORIA_POR_TIPO[doc.tipo] ?? "Outro",
      base64: buffer.toString("base64"),
      mediaType,
    });
  }

  if (!documentos.length) {
    return { erro: "Não foi possível baixar nenhum documento do Storage pra análise." };
  }

  const fichaResumo = montarFichaResumo((ficha?.dados_json ?? {}) as Record<string, unknown>);
  return { documentos, fichaResumo };
}

function resultadoParaEnum(resultado: ResultadoValidador): "APTO" | "NAO_APTO" | "EM_ANALISE" {
  if (resultado.veredicto.resultado === "APTO") return "APTO";
  if (resultado.veredicto.resultado === "NÃO APTO") return "NAO_APTO";
  return "EM_ANALISE";
}

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

    const { cadastral, compliance, erros } = await rodarAnaliseCadastralCompliance(dados);
    const resultado = montarResultadoValidador(cadastral, compliance, null, erros);

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
