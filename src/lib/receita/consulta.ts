/**
 * Consulta determinística à Receita Federal via BrasilAPI — mesmo
 * endpoint já usado em comercial/novo/page.tsx pra preencher a razão
 * social automaticamente. Aqui vai além: cruza os dados oficiais
 * contra o que o cliente declarou na ficha, como uma fonte
 * independente do que foi só extraído dos documentos anexados.
 *
 * PENDÊNCIA DE PRODUÇÃO: a BrasilAPI é um projeto open source/comunitário,
 * sem SLA nem suporte contratual — adequado para a fase de testes, mas
 * deve ser avaliado antes de virar produção (ver docs/pendencias-producao.md).
 */

export interface DadosOficiaisReceitaFederal {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  situacaoCadastral: string | null;
  dataSituacaoCadastral: string | null;
  dataInicioAtividade: string | null;
  capitalSocial: number | null;
  cnaeFiscalDescricao: string | null;
  porte: string | null;
  municipio: string | null;
  uf: string | null;
}

interface RespostaBrasilApi {
  razao_social?: string;
  nome_fantasia?: string;
  descricao_situacao_cadastral?: string;
  data_situacao_cadastral?: string;
  data_inicio_atividade?: string;
  capital_social?: number;
  cnae_fiscal_descricao?: string;
  porte?: string;
  municipio?: string;
  uf?: string;
}

/** Best-effort: qualquer falha (CNPJ não encontrado, rede, timeout) retorna null, nunca lança. */
export async function consultarCnpjReceitaFederal(cnpj: string): Promise<DadosOficiaisReceitaFederal | null> {
  const digitos = cnpj.replace(/\D/g, "");
  if (digitos.length !== 14) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digitos}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resposta.ok) return null;
    const dados: RespostaBrasilApi = await resposta.json();
    if (!dados.razao_social) return null;

    return {
      cnpj: digitos,
      razaoSocial: dados.razao_social,
      nomeFantasia: dados.nome_fantasia || null,
      situacaoCadastral: dados.descricao_situacao_cadastral || null,
      dataSituacaoCadastral: dados.data_situacao_cadastral || null,
      dataInicioAtividade: dados.data_inicio_atividade || null,
      capitalSocial: dados.capital_social ?? null,
      cnaeFiscalDescricao: dados.cnae_fiscal_descricao || null,
      porte: dados.porte || null,
      municipio: dados.municipio || null,
      uf: dados.uf || null,
    };
  } catch {
    return null;
  }
}

export interface ItemReceitaFederal {
  campo: string;
  descricao: string;
  gravidade: "atencao" | "ok";
}

export interface DadosDeclaradosEmpresa {
  cnpj?: string;
  razaoSocial?: string;
  municipio?: string;
  uf?: string;
}

function normalizarTexto(v?: string | null): string {
  return (v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\bLTDA\b/g, "LIMITADA")
    .replace(/\bS\/A\b|\bS\.A\.?\b/g, "SOCIEDADE ANONIMA")
    .replace(/\bME\b/g, "MICROEMPRESA")
    .replace(/\bEPP\b/g, "EMPRESA DE PEQUENO PORTE")
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatarCapital(valor: number | null): string | null {
  if (valor == null) return null;
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Compara os dados oficiais com o que o cliente declarou — só o essencial, pra evitar falso positivo por formatação. */
export function compararComReceitaFederal(
  oficial: DadosOficiaisReceitaFederal,
  declarado: DadosDeclaradosEmpresa,
): ItemReceitaFederal[] {
  const itens: ItemReceitaFederal[] = [];

  const situacao = oficial.situacaoCadastral?.toUpperCase() ?? "DESCONHECIDA";
  const ativa = situacao === "ATIVA";
  itens.push({
    campo: "Situação cadastral",
    descricao: ativa
      ? "CNPJ está ativo na Receita Federal."
      : `CNPJ consta como "${situacao}" na Receita Federal${oficial.dataSituacaoCadastral ? ` desde ${oficial.dataSituacaoCadastral}` : ""} — não está ativo.`,
    gravidade: ativa ? "ok" : "atencao",
  });

  if (declarado.razaoSocial) {
    const bate = normalizarTexto(oficial.razaoSocial) === normalizarTexto(declarado.razaoSocial);
    itens.push({
      campo: "Razão social",
      descricao: bate
        ? "Razão social confere com o cadastro oficial."
        : `Razão social declarada ("${declarado.razaoSocial}") diverge da oficial ("${oficial.razaoSocial}").`,
      gravidade: bate ? "ok" : "atencao",
    });
  }

  if (declarado.municipio && declarado.uf && oficial.municipio && oficial.uf) {
    const bate =
      normalizarTexto(oficial.municipio) === normalizarTexto(declarado.municipio) &&
      normalizarTexto(oficial.uf) === normalizarTexto(declarado.uf);
    itens.push({
      campo: "Município/UF",
      descricao: bate
        ? "Município e UF conferem com o cadastro oficial."
        : `Endereço declarado (${declarado.municipio}/${declarado.uf}) diverge do oficial (${oficial.municipio}/${oficial.uf}).`,
      gravidade: bate ? "ok" : "atencao",
    });
  }

  // Itens informativos — só pra dar contexto ao analista, não pesam no veredicto.
  if (oficial.dataInicioAtividade) {
    itens.push({
      campo: "Início de atividade",
      descricao: `Empresa aberta em ${oficial.dataInicioAtividade}, conforme Receita Federal.`,
      gravidade: "ok",
    });
  }
  const capitalFormatado = formatarCapital(oficial.capitalSocial);
  if (capitalFormatado) {
    itens.push({
      campo: "Capital social (oficial)",
      descricao: `${capitalFormatado}, conforme Receita Federal.`,
      gravidade: "ok",
    });
  }
  if (oficial.cnaeFiscalDescricao) {
    itens.push({
      campo: "CNAE principal (oficial)",
      descricao: oficial.cnaeFiscalDescricao,
      gravidade: "ok",
    });
  }
  if (oficial.porte) {
    itens.push({ campo: "Porte", descricao: oficial.porte, gravidade: "ok" });
  }

  return itens;
}
