"use server";

import { createAdminClient } from "@/lib/supabase/admin";

type ResultadoEnvio = { erro: string } | { sucesso: true };

interface AssinanteEnviado {
  nome: string;
  cpf: string;
  email: string;
  cargo: string;
}

interface SocioEnviado {
  pessoa: "PF" | "PJ";
  nome: string;
  doc: string;
  pct?: string;
  pep?: string;
}

interface TestemunhaEnviada {
  nome: string;
  cpf?: string;
  email: string;
}

interface ArquivoEnviado {
  caminho: string;
  tipoDetectado: string;
}

interface DadosFichaEnviados {
  assinantes?: AssinanteEnviado[];
  socios?: SocioEnviado[];
  testemunha?: TestemunhaEnviada;
  arquivos?: ArquivoEnviado[];
  [chave: string]: unknown;
}

type ResultadoUpload = { caminho: string; signedToken: string } | { erro: string };

/**
 * Remove acentos e troca qualquer caractere fora de [a-zA-Z0-9._-] por "_".
 * Nomes de documentos reais costumam ter "°", "Ã", espaços etc., que o
 * Storage rejeita na chave do objeto ("Invalid key").
 */
function sanitizarNomeArquivo(nomeArquivo: string): string {
  return nomeArquivo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Gera uma URL assinada de upload direto pro Storage (o navegador manda o
 * arquivo direto pro Supabase, sem passar pelo corpo da Server Action —
 * que tem limite de 1MB e estourava fácil com vários PDFs reais).
 */
export async function prepararUpload(
  token: string,
  nomeArquivo: string,
): Promise<ResultadoUpload> {
  const admin = createAdminClient();

  const { data: credenciamento } = await admin
    .from("credenciamento")
    .select("id, status")
    .eq("token", token)
    .single();

  if (!credenciamento || !["AGUARDANDO_CLIENTE", "DEVOLVIDO"].includes(credenciamento.status)) {
    return { erro: "Link inválido ou já utilizado." };
  }

  const caminho = `${credenciamento.id}/${Date.now()}-${sanitizarNomeArquivo(nomeArquivo)}`;
  const { data, error } = await admin.storage.from("documentos").createSignedUploadUrl(caminho);

  if (error || !data) {
    return { erro: error?.message ?? "Não foi possível preparar o upload." };
  }

  return { caminho: data.path, signedToken: data.token };
}

const MAPA_TIPO_DOCUMENTO: Record<string, string> = {
  contrato: "contrato_social",
  cartaoCnpj: "cartao_cnpj_qsa",
  qsa: "cartao_cnpj_qsa",
  sintegra: "outro",
  cnh: "rg_cnh_representante",
  procuracao: "outro",
  proposta: "proposta_comercial",
  imagem: "outro",
  outro: "outro",
};

function soDigitos(v?: string): string {
  return String(v || "").replace(/\D/g, "");
}

export async function enviarFichaKyc(
  token: string,
  formData: FormData,
): Promise<ResultadoEnvio> {
  const admin = createAdminClient();

  const { data: credenciamento, error: erroBusca } = await admin
    .from("credenciamento")
    .select("id, status, expira_em")
    .eq("token", token)
    .single();

  if (erroBusca || !credenciamento) {
    return { erro: "Link inválido." };
  }

  if (!["AGUARDANDO_CLIENTE", "DEVOLVIDO"].includes(credenciamento.status)) {
    return { erro: "Este link já foi utilizado ou não está mais disponível." };
  }

  if (credenciamento.expira_em && new Date(credenciamento.expira_em) < new Date()) {
    return { erro: "Este link expirou. Peça ao seu contato comercial um novo link." };
  }

  const credenciamentoId = credenciamento.id;
  const eraDevolucao = credenciamento.status === "DEVOLVIDO";

  try {
    if (eraDevolucao) {
      // Reenvio depois de devolvido: substitui a submissão anterior por
      // completo, em vez de acumular documentos/sócios duplicados.
      const { error: erroLimpaDocumento } = await admin
        .from("documento")
        .delete()
        .eq("credenciamento_id", credenciamentoId);
      if (erroLimpaDocumento) throw new Error(`Falha ao limpar documentos antigos: ${erroLimpaDocumento.message}`);

      const { error: erroLimpaSocio } = await admin
        .from("socio")
        .delete()
        .eq("credenciamento_id", credenciamentoId);
      if (erroLimpaSocio) throw new Error(`Falha ao limpar sócios antigos: ${erroLimpaSocio.message}`);

      const { error: erroLimpaTestemunha } = await admin
        .from("testemunha")
        .delete()
        .eq("credenciamento_id", credenciamentoId);
      if (erroLimpaTestemunha) throw new Error(`Falha ao limpar testemunha antiga: ${erroLimpaTestemunha.message}`);

      const { error: erroLimpaFicha } = await admin
        .from("ficha_kyc")
        .delete()
        .eq("credenciamento_id", credenciamentoId);
      if (erroLimpaFicha) throw new Error(`Falha ao limpar ficha antiga: ${erroLimpaFicha.message}`);
    }

    const dados: DadosFichaEnviados = JSON.parse(String(formData.get("dados_json") ?? "{}"));

    const arquivosEnviados = dados.arquivos ?? [];

    if (!arquivosEnviados.length) {
      return { erro: "Anexe ao menos o contrato social e o cartão CNPJ/QSA." };
    }

    for (const arquivo of arquivosEnviados) {
      if (!arquivo.caminho || !arquivo.caminho.startsWith(`${credenciamentoId}/`)) continue;

      const tipoDocumento = MAPA_TIPO_DOCUMENTO[arquivo.tipoDetectado] ?? "outro";
      const { error: erroInsert } = await admin.from("documento").insert({
        credenciamento_id: credenciamentoId,
        tipo: tipoDocumento,
        arquivo_url: arquivo.caminho,
      });
      if (erroInsert) throw new Error(erroInsert.message);
    }

    const assinantes = dados.assinantes ?? [];
    const socios = (dados.socios ?? []).filter((s) => s.nome?.trim());

    if (!socios.length) {
      return { erro: "Informe ao menos um sócio ou beneficiário final." };
    }

    const sociosParaInserir = socios.map((s) => {
      const assinanteCorrespondente = assinantes.find(
        (a) => soDigitos(a.cpf) && soDigitos(a.cpf) === soDigitos(s.doc),
      );
      return {
        credenciamento_id: credenciamentoId,
        nome: s.nome,
        cpf: s.doc || null,
        participacao: s.pct ? Number(String(s.pct).replace(",", ".")) || null : null,
        pep_flag: s.pep === "Sim",
        email: assinanteCorrespondente?.email || null,
      };
    });

    const { error: erroSocios } = await admin.from("socio").insert(sociosParaInserir);
    if (erroSocios) throw new Error(erroSocios.message);

    const testemunha = dados.testemunha;
    if (!testemunha?.nome || !testemunha?.email) {
      return { erro: "Informe nome e e-mail da testemunha." };
    }

    const { error: erroTestemunha } = await admin.from("testemunha").insert({
      credenciamento_id: credenciamentoId,
      nome: testemunha.nome,
      cpf: testemunha.cpf || null,
      email: testemunha.email,
    });
    if (erroTestemunha) throw new Error(erroTestemunha.message);

    const { error: erroFicha } = await admin.from("ficha_kyc").insert({
      credenciamento_id: credenciamentoId,
      dados_json: dados as never,
    });
    if (erroFicha) throw new Error(erroFicha.message);

    const { error: erroStatus } = await admin
      .from("credenciamento")
      .update({ status: "EM_ANALISE", entrou_em_analise_em: new Date().toISOString() })
      .eq("id", credenciamentoId);
    if (erroStatus) throw new Error(erroStatus.message);

    return { sucesso: true };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao enviar a documentação." };
  }
}
