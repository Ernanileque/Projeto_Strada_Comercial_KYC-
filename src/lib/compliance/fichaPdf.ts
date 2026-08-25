import CloudConvert from "cloudconvert";

interface Assinante {
  nome?: string;
  cpf?: string;
  email?: string;
  cargo?: string;
}

interface SocioLinha {
  nome: string;
  cpf?: string | null;
  participacao?: number | null;
  pep_flag: boolean;
  email?: string | null;
}

interface Testemunha {
  nome?: string;
  cpf?: string;
  email?: string;
}

interface Contato {
  nome?: string;
  email?: string;
  telefone?: string;
  cargo?: string;
}

export interface DadosFichaParaPdf {
  empresa?: Record<string, string>;
  endereco?: Record<string, string>;
  entrega?: string | Record<string, string>;
  assinantes?: Assinante[];
  contatos?: { financeiro?: Contato; juridico?: Contato; operacional?: Contato };
  conta?: Record<string, string>;
  capital?: Record<string, string>;
  declaracoes?: { pep?: boolean; procuracoes?: boolean; veracidade?: boolean };
}

function escaparHtml(valor: unknown): string {
  return String(valor ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function campo(label: string, valor: unknown): string {
  return `<div class="campo"><div class="rotulo">${escaparHtml(label)}</div><div class="valor">${escaparHtml(valor)}</div></div>`;
}

function bloco(titulo: string, conteudoHtml: string): string {
  return `<section class="bloco"><h2>${escaparHtml(titulo)}</h2>${conteudoHtml}</section>`;
}

/** Monta o HTML da ficha KYC preenchida, no mesmo conteúdo exibido na tela do Compliance. */
export function montarFichaHtml(
  dados: DadosFichaParaPdf,
  socios: SocioLinha[],
  testemunha: Testemunha | null,
  razaoSocial: string,
): string {
  const empresa = dados.empresa ?? {};
  const endereco = dados.endereco ?? {};
  const capital = dados.capital ?? {};
  const conta = dados.conta ?? {};
  const declaracoes = dados.declaracoes ?? {};
  const contatos = dados.contatos ?? {};
  const entrega = dados.entrega;

  const linhaEntrega =
    entrega === "mesmo-da-sede"
      ? "Mesmo endereço da sede"
      : entrega && typeof entrega === "object"
        ? [entrega.logradouro, entrega.numero, entrega.municipio, entrega.uf].filter(Boolean).join(", ")
        : "";

  const assinantesHtml = (dados.assinantes ?? []).length
    ? (dados.assinantes ?? [])
        .map(
          (a) => `<tr><td>${escaparHtml(a.nome)}</td><td>${escaparHtml(a.cpf)}</td><td>${escaparHtml(a.email)}</td><td>${escaparHtml(a.cargo)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="4">Nenhum assinante informado.</td></tr>`;

  const sociosHtml = socios.length
    ? socios
        .map(
          (s) =>
            `<tr><td>${escaparHtml(s.nome)}</td><td>${escaparHtml(s.cpf)}</td><td>${s.participacao != null ? `${s.participacao}%` : "—"}</td><td>${escaparHtml(s.email)}</td><td>${s.pep_flag ? "Sim" : "Não"}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="5">Nenhum sócio informado.</td></tr>`;

  const contatosHtml = (
    [
      ["financeiro", "Financeiro"],
      ["juridico", "Jurídico"],
      ["operacional", "Operacional"],
    ] as const
  )
    .map(
      ([chave, titulo]) =>
        `<div class="contato-card"><h3>${titulo}</h3>${campo("Nome", contatos[chave]?.nome)}${campo("E-mail", contatos[chave]?.email)}${campo("Telefone", contatos[chave]?.telefone)}${campo("Cargo", contatos[chave]?.cargo)}</div>`,
    )
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1a1a1a; padding: 32px 44px; }
  h1 { font-size: 16pt; margin: 0 0 4px; color: #6d1a2b; }
  .subtitulo { color: #666; margin: 0 0 20px; font-size: 10pt; }
  .bloco { border: 1px solid #ddd; border-radius: 4px; margin-bottom: 14px; page-break-inside: avoid; }
  .bloco h2 { background: #6d1a2b; color: #fff; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.05em; margin: 0; padding: 8px 14px; }
  .grade { display: flex; flex-wrap: wrap; gap: 12px; padding: 14px; }
  .campo { min-width: 140px; flex: 1; }
  .rotulo { font-size: 8pt; text-transform: uppercase; color: #888; letter-spacing: 0.03em; }
  .valor { font-size: 10.5pt; }
  table { width: 100%; border-collapse: collapse; margin: 0; }
  table th, table td { border-bottom: 1px solid #eee; padding: 6px 14px; text-align: left; font-size: 10pt; }
  table th { color: #888; font-size: 8pt; text-transform: uppercase; }
  .contatos-grade { display: flex; gap: 12px; padding: 14px; flex-wrap: wrap; }
  .contato-card { flex: 1; min-width: 180px; border-left: 2px solid #d9531e; background: #fafafa; padding: 10px; border-radius: 2px; }
  .contato-card h3 { font-size: 8pt; text-transform: uppercase; color: #6d1a2b; margin: 0 0 6px; }
  ul.declaracoes { list-style: none; margin: 0; padding: 14px; }
  ul.declaracoes li { padding: 3px 0; font-size: 10.5pt; }
</style></head><body>
  <h1>Ficha Cadastral e Declaração KYC</h1>
  <p class="subtitulo">${escaparHtml(razaoSocial)}</p>

  ${bloco(
    "Dados da empresa",
    `<div class="grade">${campo("CNPJ", empresa.cnpj)}${campo("Razão social", empresa.razao)}${campo("Nome fantasia", empresa.fantasia)}${campo("CNAE principal", empresa.cnae)}${campo("Quantidade de filiais", empresa.filiais)}${campo("Faturamento mensal", empresa.fatMes && `R$ ${empresa.fatMes}`)}${campo("Faturamento anual", empresa.fatAno && `R$ ${empresa.fatAno}`)}${campo("Objeto social", empresa.objeto)}</div>`,
  )}

  ${bloco(
    "Endereço",
    `<div class="grade">${campo("Tipo", endereco.tipo)}${campo("Logradouro", endereco.logradouro)}${campo("Nº", endereco.numero)}${campo("Complemento", endereco.complemento)}${campo("Bairro", endereco.bairro)}${campo("Município", endereco.municipio)}${campo("UF", endereco.uf)}${campo("CEP", endereco.cep)}${linhaEntrega ? campo("Endereço de entrega", linhaEntrega) : ""}</div>`,
  )}

  ${bloco(
    "Quem assina pela empresa",
    `<table><thead><tr><th>Nome</th><th>CPF</th><th>E-mail</th><th>Cargo / assinatura</th></tr></thead><tbody>${assinantesHtml}</tbody></table>`,
  )}

  ${bloco(
    "Testemunha",
    `<div class="grade">${campo("Nome", testemunha?.nome)}${campo("CPF", testemunha?.cpf)}${campo("E-mail", testemunha?.email)}</div>`,
  )}

  ${bloco(
    "Sócios, beneficiários finais e PEP",
    `<table><thead><tr><th>Nome</th><th>CPF/CNPJ</th><th>Participação</th><th>E-mail</th><th>PEP</th></tr></thead><tbody>${sociosHtml}</tbody></table>`,
  )}

  ${bloco("Contatos", `<div class="contatos-grade">${contatosHtml}</div>`)}

  ${bloco(
    "Conta de pagamento e capital social",
    `<div class="grade">${campo("Tipo de conta", conta.tipo)}${campo("Usará a rede Strada Bank?", conta.redeStradaBank)}${campo("Saldo mínimo p/ aviso", conta.saldoMinimo)}${campo("Capital social", capital.valor && `R$ ${capital.valor}`)}${campo("Valor unitário da quota", capital.valorQuota && `R$ ${capital.valorQuota}`)}${campo("Total de quotas", capital.totalQuotas)}</div>`,
  )}

  ${bloco(
    "Declarações do cliente",
    `<ul class="declaracoes">
      <li>${declaracoes.pep ? "✓" : "✗"} Leu a definição de PEP e respondeu a autodeclaração.</li>
      <li>${declaracoes.procuracoes ? "✓" : "✗"} Declarou que só os assinantes têm poderes de representação.</li>
      <li>${declaracoes.veracidade ? "✓" : "✗"} Declarou veracidade das informações.</li>
    </ul>`,
  )}
</body></html>`;
}

/** Converte o HTML da ficha em PDF via CloudConvert (mesmo provedor usado na proposta comercial). */
export async function converterHtmlParaPdf(html: string): Promise<Buffer> {
  const apiKey = process.env.CLOUDCONVERT_API_KEY;
  if (!apiKey) throw new Error("CLOUDCONVERT_API_KEY não configurada — a geração do PDF da ficha não está disponível.");

  const cloudConvert = new CloudConvert(apiKey);

  let job = await cloudConvert.jobs.create({
    tasks: {
      "importar-html": { operation: "import/upload" },
      "converter-pdf": {
        operation: "convert",
        input: "importar-html",
        input_format: "html",
        output_format: "pdf",
      },
      "exportar-pdf": { operation: "export/url", input: "converter-pdf" },
    },
  });

  const tarefaUpload = job.tasks.find((t) => t.name === "importar-html");
  if (!tarefaUpload) throw new Error("Falha ao iniciar conversão da ficha KYC para PDF.");
  await cloudConvert.tasks.upload(tarefaUpload, Buffer.from(html, "utf-8"), "ficha-kyc.html");

  job = await cloudConvert.jobs.wait(job.id);

  const tarefaExportar = job.tasks.find((t) => t.operation === "export/url" && t.status === "finished");
  const arquivoUrl = tarefaExportar?.result?.files?.[0]?.url;
  if (!arquivoUrl) {
    const tarefaComErro = job.tasks.find((t) => t.status === "error");
    throw new Error(`Falha ao converter ficha KYC para PDF: ${tarefaComErro?.message ?? "erro desconhecido"}`);
  }

  const resposta = await fetch(arquivoUrl);
  if (!resposta.ok) throw new Error("Falha ao baixar PDF convertido da ficha KYC.");
  return Buffer.from(await resposta.arrayBuffer());
}
