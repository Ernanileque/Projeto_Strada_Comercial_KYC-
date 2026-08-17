/**
 * Extração de dados de atos societários e documentos fiscais a partir
 * do texto puro de PDFs, rodando inteiramente no navegador do cliente
 * (sem IA/LLM). Portado do protótipo HTML validado contra contratos
 * reais registrados em junta comercial.
 */

import type { Worker as TesseractWorker } from "tesseract.js";

export type TipoDocumentoDetectado =
  | "contrato"
  | "cartaoCnpj"
  | "qsa"
  | "sintegra"
  | "cnh"
  | "procuracao"
  | "proposta"
  | "outro";

export interface DadosEmpresaExtraidos {
  razao?: string;
  fantasia?: string;
  cnpj?: string;
  nire?: string;
  sedeLogradouro?: string;
  sedeMunicipio?: string;
  sedeUf?: string;
  sedeCep?: string;
  capital?: string;
  quotasTotal?: string;
  quotaValor?: string;
  objeto?: string;
  inicioAtividades?: string;
  foro?: string;
  cnae?: string;
  cnaeDescricao?: string;
  natureza?: string;
  situacao?: string;
  abertura?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  cep?: string;
  bairro?: string;
  municipio?: string;
  municipioIncerto?: boolean;
  uf?: string;
  email?: string;
  telefone?: string;
  porte?: string;
}

export interface SocioExtraido {
  pessoa: "PF" | "PJ";
  nome: string;
  doc: string;
  nasc: string;
  nac: string;
  pais: string;
  endereco: string;
  profissao?: string;
  quotas?: string;
  pct?: string;
  naoSocio?: boolean;
  anuente?: boolean;
  obs?: string;
}

export interface AdministradorExtraido {
  nome: string;
  cpf: string;
  cargo: string;
  email: string;
}

export interface QsaPessoa {
  nome: string;
  doc: string;
  mascarado: boolean;
  qualificacao: string;
}

export interface ResultadoAnalise {
  tipo: TipoDocumentoDetectado;
  arquivo: string;
  temTexto: boolean;
  empresa: DadosEmpresaExtraidos;
  socios: SocioExtraido[];
  admins: AdministradorExtraido[];
  vinculados: SocioExtraido[];
  qsa: QsaPessoa[] | null;
}

function norm(t: string): string {
  return t.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

function limpa(s: string): string {
  return norm(s).replace(/[;,.\s]+$/, "").trim();
}

/* ---------- classificação do documento ---------- */
export function classificar(texto: string, nomeArquivo?: string): TipoDocumentoDetectado {
  const t = texto.toUpperCase();
  const n = (nomeArquivo || "").toUpperCase();
  const ehContrato =
    /CONTRATO DE CONSTITUI..O|ALTERA..O E CONSOLIDA..O DO CONTRATO SOCIAL|CL(?:Á|A)USULA 1|ESTATUTO SOCIAL|JUNTA COMERCIAL DO ESTADO/.test(
      t,
    );
  if (
    !ehContrato &&
    (/SENATRAN|PERMISO DE CONDUCCI|1. HABILITA..O|CATEGORIA DE HABILITA/.test(t) ||
      /\bCNH\b/.test(n))
  )
    return "cnh";
  if (/COMPROVANTE DE INSCRI..O E DE SITUA..O CADASTRAL|CADASTRO NACIONAL DA PESSOA JUR/.test(t))
    return "cartaoCnpj";
  if (/QUADRO DE S..IOS E ADMINISTRADORES|QSA/.test(t) || /QSA/.test(n)) return "qsa";
  if (/CONSULTA P..LICA . REDESIM|SINTEGRA/.test(t)) return "sintegra";
  if (
    /CONTRATO DE CONSTITUI..O|ALTERA..O E CONSOLIDA..O DO CONTRATO SOCIAL|CONTRATO SOCIAL|ESTATUTO SOCIAL/.test(
      t,
    )
  )
    return "contrato";
  if (/PROCURA..O/.test(t)) return "procuracao";
  if (/PROPOSTA COMERCIAL/.test(t)) return "proposta";
  return "outro";
}

const RE_CPF = /\d{3}\.\d{3}\.\d{3}-\d{2}/;

function uf(estado: string): string {
  const mapa: Record<string, string> = {
    "MATO GROSSO": "MT",
    "MATO GROSSO DO SUL": "MS",
    RONDÔNIA: "RO",
    RONDONIA: "RO",
    "SÃO PAULO": "SP",
    "SAO PAULO": "SP",
    GOIÁS: "GO",
    GOIAS: "GO",
    "MINAS GERAIS": "MG",
    PARANÁ: "PR",
    PARANA: "PR",
    "SANTA CATARINA": "SC",
    "RIO GRANDE DO SUL": "RS",
    BAHIA: "BA",
    TOCANTINS: "TO",
    PARÁ: "PA",
    PARA: "PA",
    "ESPÍRITO SANTO": "ES",
    "ESPIRITO SANTO": "ES",
    "RIO DE JANEIRO": "RJ",
  };
  const k = estado.toUpperCase().replace(/^DO |^DE |^DA /, "").trim();
  return mapa[k] || (k.length === 2 ? k : "");
}

function cep(v: string): string {
  const n = (v || "").replace(/\D/g, "");
  return n.length === 8 ? `${n.slice(0, 2)}.${n.slice(2, 5)}-${n.slice(5)}` : (v || "").trim();
}

/* ---------- dados da empresa ---------- */
export function extrairEmpresa(t: string): DadosEmpresaExtraidos {
  const d: DadosEmpresaExtraidos = {};

  let m =
    t.match(
      /den(?:o|ó)mina(?:c|ç)(?:a|ã)o social de ([A-ZÀ-Ú0-9&.\-\s]{4,90}?(?:LTDA|S\.?A\.?|EIRELI|ME|EPP))\.?[,\s]/i,
    ) ||
    t.match(
      /adotar(?:á|a) o nome empresarial de\s+([A-ZÀ-Ú0-9&.\-\s]{4,90}?(?:LTDA|S\.?A\.?|EIRELI|ME|EPP))\.?[\s,]/i,
    ) ||
    t.match(
      /CONTRATO DE CONSTITUI(?:Ç|C)(?:Ã|A)O DE\s+([A-ZÀ-Ú0-9&.\-\s]{4,90}?(?:LTDA|S\.?A\.?|EIRELI))\s/i,
    );
  if (m) d.razao = limpa(m[1]).replace(/\s+/g, " ");
  const fant = t.match(/tem como nome fantasia\s+([A-ZÀ-Ú0-9&.\-\s]{3,60}?)\s*\.\s/i);
  if (fant) d.fantasia = limpa(fant[1]);
  if (!d.razao) {
    m = t.match(/([A-ZÀ-Ú][A-ZÀ-Ú0-9&.\-\s]{4,80}(?:LTDA|S\.A\.))\s+CONTRATO (?:DE CONSTITUI|SOCIAL)/);
    if (m) d.razao = limpa(m[1]);
  }

  m = t.match(/Empresa\s+[A-ZÀ-Ú0-9&.\-\s]{4,80},\s*CNPJ\s*(\d{14}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
  if (m) {
    const c = m[1].replace(/\D/g, "");
    d.cnpj = `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
  }
  if (!d.cnpj) {
    m = t.match(/CNPJ(?:\/MF)?[^\d]{0,30}(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
    if (m) d.cnpj = m[1];
  }

  m = t.match(/NIRE[^\d]{0,20}(\d[\d.\-]{6,})/i);
  if (m) d.nire = limpa(m[1]);

  m = t.match(
    /com sede(?: e foro)?(?: estabelecida)? n[ao] (.{10,190}?),\s*n[ao] cidade de ([A-ZÀ-Úa-zà-ú\s]{3,45}?),\s*Estado d[eo] ([A-ZÀ-Úa-zà-ú\s]{3,30}?),\s*CEP:?\s*([\d.]{2,6}-?\d{0,3})/i,
  );
  if (m) {
    d.sedeLogradouro = limpa(m[1]);
    d.sedeMunicipio = limpa(m[2]).toUpperCase();
    d.sedeUf = uf(limpa(m[3]));
    d.sedeCep = cep(m[4]);
  }

  if (!d.sedeLogradouro) {
    m = t.match(
      /sede da sociedade (?:é|e) n[ao]\s+(.{10,190}?),\s*(?:munic(?:í|i)pio|cidade)\s*(?:de\s*)?([A-ZÀ-Úa-zà-ú\s]{3,45}?)\s*[-–]\s*([A-Z]{2}),?\s*CEP:?\s*([\d.]{2,6}-?\d{0,3})/i,
    );
    if (m) {
      d.sedeLogradouro = limpa(m[1]);
      d.sedeMunicipio = limpa(m[2]).toUpperCase();
      d.sedeUf = limpa(m[3]).toUpperCase();
      d.sedeCep = cep(m[4]);
    }
  }

  m = t.match(/[Cc]apital [Ss]ocial (?:é|e)(?: de)? R\$ ?([\d.]+,\d{2})/);
  if (m) d.capital = m[1];
  m = t.match(/(?:dividido em|composto de) ([\d.]+)/i);
  if (m) d.quotasTotal = m[1];
  m = t.match(/valor nominal(?: de)? R\$ ?([\d.]+,\d{2}|\d+,\d{2})/i);
  if (m) d.quotaValor = m[1];

  m =
    t.match(/objeto social a (?:atividade de )?(.{15,320}?)\.\s*(?:Par(?:á|a)grafo|CL(?:Á|A)USULA)/i) ||
    t.match(/objeto social ser(?:á|a):?\s*(.{15,400}?)\.\s*(?:Cl(?:á|a)usula|Par(?:á|a)grafo|A sociedade passa)/i);
  if (m) d.objeto = limpa(m[1]);

  m = t.match(/iniciar(?:á|a) suas atividades em (\d{2}\/\d{2}\/\d{4})/i);
  if (m) d.inicioAtividades = m[1];
  m = t.match(/foro de ([A-ZÀ-Úa-zà-ú\s]{3,40}?)\s*[-–]\s*([A-Z]{2})/);
  if (m) d.foro = `${limpa(m[1])}/${m[2]}`;

  m =
    t.match(/ATIVIDADE ECON(?:Ô|O)MICA PRINCIPAL\s*([\d.\-\/]{7,12})/i) ||
    t.match(/C(?:ó|o)digo da Atividade Principal:?\s*(\d{7})/i);
  if (m) {
    const c = m[1].replace(/\D/g, "");
    if (c.length >= 7) d.cnae = `${c.slice(0, 2)}.${c.slice(2, 4)}-${c.slice(4, 5)}-${c.slice(5, 7)}`;
  }
  return d;
}

const STOP_NOME = new Set([
  "CONTRATO", "CONSTITUICAO", "CONSTITUIÇÃO", "SOCIEDADE", "EMPRESARIA", "EMPRESÁRIA", "LIMITADA",
  "ALTERACAO", "ALTERAÇÃO", "CONSOLIDACAO", "CONSOLIDAÇÃO", "SOCIAL", "LTDA", "PAGINA", "PÁGINA",
  "CAPITULO", "CAPÍTULO", "CLAUSULA", "CLÁUSULA", "PARAGRAFO", "PARÁGRAFO", "UNICO", "ÚNICO", "ATO",
  "DENOMINACAO", "DENOMINAÇÃO", "SEDE", "FORO", "OBJETO", "DURACAO", "DURAÇÃO", "CAPITAL", "QUOTAS",
  "ADMINISTRACAO", "ADMINISTRAÇÃO", "DIRETOR", "DIRETORA", "PRESIDENTE", "ADJUNTO", "ADJUNTA",
  "SOCIO", "SÓCIO", "SOCIA", "SÓCIA", "SOCIOS", "SÓCIOS", "QUALIFICADO", "QUALIFICADA",
  "ANTERIORMENTE", "E", "DAS", "DOS", "MF", "CNPJ", "SA", "S.A", "S.A.", "EIRELI", "EPP", "ME", "&",
  "REQUERIMENTO", "JUNTA", "COMERCIAL", "ESTADO", "MATO", "GROSSO", "REGISTRO", "DIGITAL",
  "IDENTIFICACAO", "IDENTIFICAÇÃO", "PROCESSO", "ASSINANTE", "ASSINANTES", "DATA", "NOME", "CPF",
  "TERMO", "AUTENTICACAO", "AUTENTICAÇÃO", "DISPOSICOES", "DISPOSIÇÕES", "FINAIS", "EXERCICIO",
  "EXERCÍCIO", "RESERVAS", "DISTRIBUICAO", "DISTRIBUIÇÃO", "LUCROS", "DISSOLUCAO", "DISSOLUÇÃO",
  "LIQUIDACAO", "LIQUIDAÇÃO", "EXCLUSAO", "EXCLUSÃO", "RETIRADA", "IMPEDIMENTO", "FALECIMENTO",
  "QUALQUER", "DELIBERACOES", "DELIBERAÇÕES", "REUNIOES", "REUNIÕES", "QUOTISTAS", "DECLARACOES",
  "DECLARAÇÕES",
]);

function recortarNome(bruto: string): string {
  const toks = norm(bruto).split(/\s+/).filter(Boolean);
  const nome: string[] = [];
  for (let i = toks.length - 1; i >= 0 && nome.length < 6; i--) {
    const limpo = toks[i].replace(/[^A-ZÀ-Úa-zà-ú'\-]/g, "");
    if (!limpo) break;
    const up = limpo.toUpperCase();
    const conector = ["DE", "DA", "DO", "DAS", "DOS"].includes(up);
    if (STOP_NOME.has(up) && !conector) break;
    if (limpo.toUpperCase() !== limpo && nome.length) break;
    nome.unshift(limpo);
  }
  while (nome.length && ["DE", "DA", "DO", "DAS", "DOS", "E"].includes(nome[0].toUpperCase()))
    nome.shift();
  return nome.join(" ");
}

function recortarRazao(bruto: string): string {
  const toks = norm(bruto).replace(/\.$/, "").split(/\s+/).filter(Boolean);
  const nome: string[] = [];
  for (let i = toks.length - 1; i >= 0 && nome.length < 7; i--) {
    const up = toks[i].toUpperCase().replace(/[^A-ZÀ-Ú0-9.&'\-]/g, "");
    if (!up) break;
    const sufixo = nome.length === 0 && /^(LTDA\.?|S\.?A\.?|EIRELI|ME|EPP)$/.test(up);
    if (!sufixo && STOP_NOME.has(up) && !["DE", "DA", "DO", "DAS", "DOS"].includes(up)) break;
    nome.unshift(toks[i].replace(/[^A-ZÀ-Úa-zà-ú0-9.&'\-]/g, ""));
  }
  while (nome.length && ["DE", "DA", "DO", "DAS", "DOS", "E"].includes(nome[0].toUpperCase()))
    nome.shift();
  return nome.join(" ");
}

function tituloNome(n: string): string {
  return n
    .toLowerCase()
    .split(/\s+/)
    .map((p) => (["de", "da", "do", "das", "dos", "e"].includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

/* ---------- sócios ---------- */
export function extrairSocios(t: string): SocioExtraido[] {
  const socios: SocioExtraido[] = [];
  const vistos = new Set<string>();

  const rePF =
    /([A-ZÀ-Ú][A-ZÀ-Ú'\s]{5,70}?),\s*brasileir[ao][^;]{0,700}?CPF (?:sob o|sob a)? ?n?[º°o.]* ?(\d{3}\.\d{3}\.\d{3}-\d{2})[^;]{0,400}?residente e domiciliad[oa] n[ao] (.{15,260}?)(?:;|\.\s*(?:[A-ZÀ-Ú]{2,}|Mediante|DA |CL(?:Á|A)USULA))/g;
  let m: RegExpExecArray | null;
  while ((m = rePF.exec(t)) !== null) {
    const cpfDoc = m[2];
    if (vistos.has(cpfDoc)) continue;
    vistos.add(cpfDoc);
    const bloco = m[0];
    const antes = t.slice(Math.max(0, m.index - 90), m.index);
    const naoSocio = /n(?:ã|a)o s(?:ó|o)cios?\s*(?:e\s*)?$|administrador(?:es)? n(?:ã|a)o s(?:ó|o)cios?/i.test(antes);
    const anuente = /anu(?:ê|e)ncia (?:de|da) sua? (?:esposa|c(?:ô|o)njuge|marido|companheir[ao])\s*$|anuente/i.test(
      antes,
    );
    const nasc = (bloco.match(/nascid[oa] em (\d{2}\/\d{2}\/\d{4})/i) || [])[1] || "";
    socios.push({
      pessoa: "PF",
      nome: tituloNome(recortarNome(m[1])),
      doc: cpfDoc,
      nasc: nasc ? nasc.split("/").reverse().join("-") : "",
      nac: /brasileira/i.test(bloco) ? "Brasileira" : "Brasileiro",
      pais: "Brasil",
      endereco: limpa(m[3]).replace(/\s*,?\s*Estado de\s*/i, ", "),
      profissao: (bloco.match(/bens,\s*([a-zà-ú\s]{4,40}?),\s*portador/i) || [])[1] || "",
      naoSocio,
      anuente,
      obs: anuente
        ? "Cônjuge anuente, não integra o quadro societário."
        : naoSocio
          ? "Administrador não sócio."
          : "",
    });
  }

  const rePF2 =
    /([A-ZÀ-Ú][A-ZÀ-Ú'&.\s]{5,80}?),\s*nacionalidade\s+([A-ZÀ-Ú]{4,20})[^;]{0,400}?CPF\s*(?:sob o )?n?[º°o.]*\s*(\d{3}\.\d{3}\.\d{3}-\d{2})[^;]{0,400}?(?:com domic(?:í|i)lio\s*\/?\s*resid(?:ê|e)ncia|residente e domiciliad[oa])\s*(?:[aà]|na|no|em)?\s*(.{15,260}?)(?=\.\s|;)/g;
  while ((m = rePF2.exec(t)) !== null) {
    const cpfDoc = m[3];
    if (vistos.has(cpfDoc)) continue;
    vistos.add(cpfDoc);
    const bloco = m[0];
    const nasc = (bloco.match(/(?:data de nascimento|nascid[oa] em)\s*(\d{2}\/\d{2}\/\d{4})/i) || [])[1] || "";
    const nac = m[2].toUpperCase().startsWith("BRASIL") ? "Brasileira" : tituloNome(m[2]);
    socios.push({
      pessoa: "PF",
      nome: tituloNome(recortarNome(m[1])),
      doc: cpfDoc,
      nasc: nasc ? nasc.split("/").reverse().join("-") : "",
      nac,
      pais: "Brasil",
      endereco: limpa(m[4])
        .replace(/\s*,?\s*munic(?:í|i)pio\s*/i, ", ")
        .replace(/\s*,?\s*Cidade\s*/i, ", "),
      naoSocio: false,
      anuente: false,
      obs: "",
    });
  }

  const rePJ =
    /([A-ZÀ-Ú][A-ZÀ-Ú0-9&.\-\s]{4,70}?(?:LTDA|S\.?A\.?)),?\s*pessoa jur(?:í|i)dica[^;]{0,500}?CNPJ (?:sob )?o? ?n?[º°o.]* ?(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})([^;]{0,400})/g;
  while ((m = rePJ.exec(t)) !== null) {
    const cnpjDoc = m[2];
    if (vistos.has(cnpjDoc)) continue;
    vistos.add(cnpjDoc);
    const resto = m[3] || "";
    const sede = (resto.match(/com sede (?:na |em )?(.{10,200}?)(?:,\s*neste ato|$)/i) || [])[1] || "";
    const rep =
      (resto.match(/representada por seu[a]? (?:Diretor[a]?|S(?:ó|o)ci[ao]|Administrador[a]?)\s+([A-ZÀ-Ú][A-ZÀ-Ú'\s]{5,60}?),/i) ||
        [])[1] || "";
    socios.push({
      pessoa: "PJ",
      nome: recortarRazao(m[1]),
      doc: cnpjDoc,
      nasc: "",
      nac: "Brasileira",
      pais: "Brasil",
      endereco: limpa(sede),
      obs: rep
        ? `Sócia pessoa jurídica, representada por ${tituloNome(limpa(rep))}. Confirmar o beneficiário final e anexar o contrato social da holding.`
        : "Sócia pessoa jurídica. Confirmar o beneficiário final e anexar o contrato social.",
    });
  }

  const blocoQuota =
    (t.match(
      /S(?:ó|o)cio[s]?\s+(?:N[º°o.]{0,2}\s*de\s*[Qq]uotas\s+)?(.{10,900}?)(?:DA ADMINISTRA|Par(?:á|a)grafo 1|CL(?:Á|A)USULA S(?:É|E)TIMA|Cl(?:á|a)usula S(?:é|e)tima)/i,
    ) || [])[1] || "";

  socios.forEach((s) => {
    if (s.quotas) return;
    const chave = s.nome.toUpperCase().replace(/[.]/g, "\\.").replace(/\s+/g, "\\s+");
    const re = new RegExp(chave + "\\.?[\\s,]+([\\d.]{2,})\\s*(?:R\\$\\s*)?([\\d.]+,\\d{2})(?:\\s+([\\d,.]+))?", "i");
    const q = t.match(re);
    if (q) {
      s.quotas = q[1];
      if (q[3]) s.pct = q[3];
    }
  });

  if (blocoQuota && socios.some((s) => !s.quotas)) {
    const posicoes = socios
      .map((s) => ({ s, pos: blocoQuota.toUpperCase().indexOf(s.nome.toUpperCase()) }))
      .filter((x) => x.pos >= 0)
      .sort((a, b) => a.pos - b.pos);
    if (posicoes.length) {
      const depoisDosNomes = blocoQuota.slice(posicoes[posicoes.length - 1].pos);
      const nums = (depoisDosNomes.match(/(?:R\$\s*)?[\d][\d.]*(?:,\d{2})?/g) || [])
        .map((x) => x.trim())
        .filter((x) => !/^R\$/.test(x));
      const temTotal = /\bTotal\b/i.test(blocoQuota);
      const candidatos = nums.filter((x) => !/,\d{2}$/.test(x));
      const usaveis =
        temTotal && candidatos.length > posicoes.length ? candidatos.slice(0, posicoes.length) : candidatos;
      if (usaveis.length >= posicoes.length) {
        posicoes.forEach((x, i) => {
          if (!x.s.quotas) x.s.quotas = usaveis[i];
        });
      }
    }
  }

  return socios;
}

export function completarPercentuais(socios: SocioExtraido[], quotasTotal?: string) {
  const numero = (v?: string) => parseFloat(String(v || "").replace(/\./g, "").replace(",", ".")) || 0;
  const formata = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  const total = numero(quotasTotal);

  if (total)
    socios.forEach((s) => {
      if (s.pct || !s.quotas) return;
      const pct = (numero(s.quotas) / total) * 100;
      s.pct = (Math.round(pct * 100) / 100).toString().replace(".", ",");
    });

  if (total)
    socios.forEach((s) => {
      if (s.quotas || !s.pct) return;
      s.quotas = formata(Math.round((total * numero(s.pct)) / 100));
    });

  if (total) {
    const semQuota = socios.filter((s) => !s.quotas);
    if (semQuota.length === 1 && socios.length > 1) {
      const soma = socios.reduce((acc, s) => acc + numero(s.quotas), 0);
      const resto = total - soma;
      if (resto > 0) {
        semQuota[0].quotas = formata(resto);
        semQuota[0].pct = (Math.round((resto / total) * 10000) / 100).toString().replace(".", ",");
      }
    }
  }
}

/* ---------- administradores / assinantes ---------- */
export function extrairAdministradores(t: string, socios: SocioExtraido[]): AdministradorExtraido[] {
  const out: AdministradorExtraido[] = [];
  const vistos = new Set<string>();

  const g = /administrada\s+(?:isoladamente|em conjunto)?\s*pel[oa]s?\s+(?:administrador(?:es)?(?: n(?:ã|a)o s(?:ó|o)cios?)?|s(?:ó|o)ci[oa]s?)\s+([A-ZÀ-Ú][A-ZÀ-Ú'\s]{5,70}?),/gi;
  let m: RegExpExecArray | null;
  while ((m = g.exec(t)) !== null) {
    const nome = tituloNome(limpa(m[1]));
    if (vistos.has(nome)) continue;
    vistos.add(nome);
    const pos = m.index;
    const janela = t.slice(pos, pos + 900);
    const cpfDoc = socios.find((s) => s.nome === nome)?.doc || (janela.match(RE_CPF) || [])[0] || "";
    const antes = t.slice(Math.max(0, pos - 200), pos);
    let cargo = "Administrador";
    if (/Diretor Presidente/i.test(janela)) cargo = "Diretor Presidente";
    else if (/qualidade de Diretor/i.test(janela)) cargo = "Diretor";
    if (/n(?:ã|a)o s(?:ó|o)cio/i.test(t.slice(Math.max(0, pos - 120), pos + 140))) cargo += " (não sócio)";
    if (/falecimento, interdi|incapacidade jur/i.test(antes))
      cargo = "Diretor substituto — assume em caso de impedimento";
    out.push({ nome, cpf: cpfDoc, cargo, email: "" });
  }

  const blocoAdm =
    (t.match(
      /administra(?:ç|c)(?:ã|a)o da sociedade ser(?:á|a) exercida:?\s*([\s\S]{0,4000}?)(?=DO BALAN|Par(?:á|a)grafo (?:Ú|U)nico\.\s*N(?:ã|a)o constituindo|CL(?:Á|A)USULA OITAVA)/i,
    ) || [])[1] || "";
  if (blocoAdm) {
    const reAdm = /Pel[oa]s?\s+s(?:ó|o)ci[oa]s?\s+([A-ZÀ-Ú][A-ZÀ-Ú'\s]{5,70}?),/g;
    let a: RegExpExecArray | null;
    while ((a = reAdm.exec(blocoAdm)) !== null) {
      const nome = tituloNome(recortarNome(a[1]));
      if (vistos.has(nome)) continue;
      vistos.add(nome);
      const s = socios.find((x) => x.nome === nome);
      out.push({ nome, cpf: s ? s.doc : "", email: "", cargo: "Sócio administrador — representa legalmente a sociedade" });
    }
  }

  const adj = t.match(/e pelos? s(?:ó|o)ci[oa]s?\s+(.{10,400}?),?\s*(?:todos|todas)\s+anteriormente qualificad/i);
  if (adj) {
    adj[1]
      .split(/,| e /)
      .map((x) => limpa(x))
      .filter((x) => /^[A-ZÀ-Ú][A-ZÀ-Ú'\s]{5,}$/.test(x))
      .forEach((nomeRaw) => {
        const nome = tituloNome(nomeRaw);
        if (vistos.has(nome)) return;
        vistos.add(nome);
        const s = socios.find((s2) => s2.nome === nome);
        out.push({ nome, cpf: s ? s.doc : "", cargo: "Diretor Adjunto — assina em conjunto", email: "" });
      });
  }
  return out;
}

/* ---------- cartão CNPJ (Receita Federal) ---------- */
export function extrairCartaoCnpj(t: string): DadosEmpresaExtraidos {
  const d: DadosEmpresaExtraidos = {};
  const mascarado = (v?: string) => !v || /^[*\s]+$/.test(String(v));
  const pega = (...res: RegExp[]): string[] | null => {
    for (const re of res) {
      const m = t.match(re);
      if (m) {
        const grupos = m.slice(1).filter((x) => x !== undefined).map((x) => limpa(x as string));
        if (grupos.length && !mascarado(grupos[0])) return grupos;
      }
    }
    return null;
  };

  let g = pega(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
  if (g) d.cnpj = g[0];

  g = pega(/NOME EMPRESARIAL\s*(.+?)(?=\s*T(?:Í|I)TULO DO ESTABELECIMENTO|\s*\bPORTE\b|\s*C(?:Ó|O)DIGO E DESCRI)/i);
  if (g) d.razao = g[0];

  g = pega(
    /\(NOME DE FANTASIA\)\s*\bPORTE\b\s*(.+?)\s+(DEMAIS|EPP|ME|MEI|MICROEMPRESA|EMPRESA DE PEQUENO PORTE)\s*(?=C(?:Ó|O)DIGO)/i,
    /\(NOME DE FANTASIA\)\s*(.+?)\s*\bPORTE\b\s*(DEMAIS|EPP|ME|MEI|MICROEMPRESA|EMPRESA DE PEQUENO PORTE)/i,
    /\(NOME DE FANTASIA\)\s*(.+?)(?=\s*\bPORTE\b|\s*C(?:Ó|O)DIGO)/i,
  );
  if (g) {
    d.fantasia = g[0];
    if (g[1]) d.porte = g[1];
  }
  if (!d.porte) {
    g = pega(/\bPORTE\b\s*(DEMAIS|EPP|ME|MEI|MICROEMPRESA|EMPRESA DE PEQUENO PORTE)\b/i);
    if (g) d.porte = g[0];
  }

  g = pega(/ATIVIDADE ECON(?:Ô|O)MICA PRINCIPAL\s*([\d.\-]{9,12})/i);
  if (g) d.cnae = g[0];
  g = pega(/ATIVIDADE ECON(?:Ô|O)MICA PRINCIPAL\s*[\d.\-]{9,12}\s*-\s*(.+?)(?=\s*C(?:Ó|O)DIGO E DESCRI)/i);
  if (g) d.cnaeDescricao = g[0];
  g = pega(/NATUREZA JUR(?:Í|I)DICA\s*(\d{3}-\d\s*-\s*[^,]{5,60}?)(?=\s*LOGRADOURO|\s*C(?:Ó|O)DIGO)/i);
  if (g) d.natureza = g[0];

  g = pega(/SITUA(?:Ç|C)(?:Ã|A)O CADASTRAL\s*(?:DATA DA SITUA(?:Ç|C)(?:Ã|A)O CADASTRAL\s*)?(ATIVA|BAIXADA|SUSPENSA|INAPTA|NULA)\b/i);
  if (g) d.situacao = g[0].toUpperCase();
  g = pega(/DATA DE ABERTURA\s*(\d{2}\/\d{2}\/\d{4})/i, /ABERTURA[^\d]{0,40}(\d{2}\/\d{2}\/\d{4})/i);
  if (g) d.abertura = g[0];

  g = pega(/LOGRADOURO\s*N(?:Ú|U)MERO\s*COMPLEMENTO\s*(.+?)(?=\s*\bCEP\b)/i);
  if (g) {
    const bloco = g[0];
    const mNum = bloco.match(/\s(\d{1,6}\s?[A-Z]?)(?=\s|$)/);
    if (mNum) {
      d.logradouro = limpa(bloco.slice(0, mNum.index));
      d.numero = limpa(mNum[1]);
      const resto = limpa(bloco.slice(mNum.index! + mNum[0].length));
      if (!mascarado(resto)) d.complemento = resto;
    } else {
      d.logradouro = bloco;
    }
  } else {
    const bloco = (t.match(/LOGRADOURO[\s\S]{0,400}/i) || [""])[0];
    const pegaBloco = (re: RegExp) => {
      const m2 = bloco.match(re);
      return m2 && !mascarado(m2[1]) ? limpa(m2[1]) : "";
    };
    d.logradouro = pegaBloco(/LOGRADOURO\s*(.+?)(?=\s*N(?:Ú|U)MERO)/i) || d.logradouro;
    const numero = pegaBloco(/N(?:Ú|U)MERO\s*(.+?)(?=\s*COMPLEMENTO|\s*\bCEP\b)/i);
    if (/^\d/.test(numero)) d.numero = numero;
    const compl = pegaBloco(/COMPLEMENTO\s*(.+?)(?=\s*\bCEP\b)/i);
    if (compl) d.complemento = compl;
  }

  g = pega(/\bCEP\b\s*BAIRRO\/DISTRITO\s*MUNIC(?:Í|I)PIO\s*UF\s*([\d.]{2,6}-?\d{0,3})\s+(.+?)\s+([A-Z]{2})\b/i);
  if (g) {
    d.cep = cep(g[0]);
    const meio = g[1].split(/\s+/);
    d.uf = g[2].toUpperCase();
    if (meio.length > 1) {
      d.municipio = meio.pop();
      d.bairro = meio.join(" ");
      d.municipioIncerto = true;
    } else {
      d.bairro = meio.join(" ");
    }
  } else {
    g = pega(/\bCEP\b\s*([\d.]{2,6}-?\d{0,3})/i);
    if (g) d.cep = cep(g[0]);
    g = pega(/BAIRRO\/DISTRITO\s*(.+?)(?=\s*MUNIC(?:Í|I)PIO)/i);
    if (g) d.bairro = g[0];
    g = pega(/MUNIC(?:Í|I)PIO\s*(.+?)(?=\s*\bUF\b)/i);
    if (g) d.municipio = g[0];
    g = pega(/\bUF\b\s*([A-Z]{2})\b/);
    if (g) d.uf = g[0].toUpperCase();
  }

  g = pega(/ENDERE(?:Ç|C)O ELETR(?:Ô|O)NICO\s*(?:TELEFONE\s*)?(\S+@\S+?)(?=\s)/i);
  if (g) d.email = g[0].toLowerCase();
  g = pega(/TELEFONE\s*(?:\S+@\S+\s*)?(\(?\d{2}\)?\s?\d{4,5}-?\d{4})/i, /(\(\d{2}\)\s?\d{4,5}-\d{4})/);
  if (g && !/^\(?0{2}/.test(g[0])) d.telefone = g[0];

  (Object.keys(d) as (keyof DadosEmpresaExtraidos)[]).forEach((k) => {
    const val = d[k];
    if (typeof val === "string" && mascarado(val)) delete d[k];
  });
  return d;
}

/* ---------- quadro de sócios e administradores (Receita) ---------- */
export function extrairQsa(t: string): QsaPessoa[] {
  const pessoas: QsaPessoa[] = [];
  const re =
    /Nome\/Nome Empresarial\s*(.+?)\s*CPF\/CNPJ\s*([\d*.\-\/]{11,20})\s*Qualifica(?:ç|c)(?:ã|a)o\s*(\d{2}\s*-\s*.{3,60}?)(?=\s*Nome\/Nome|\s*$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const doc = limpa(m[2]);
    pessoas.push({
      nome: tituloNome(limpa(m[1])),
      doc,
      mascarado: /\*/.test(doc),
      qualificacao: limpa(m[3]).replace(/\s+/g, " "),
    });
  }
  return pessoas;
}

/* ---------- orquestrador ---------- */
export function analisar(texto: string, nomeArquivo: string): ResultadoAnalise {
  const t = norm(texto);
  const tipo = classificar(t, nomeArquivo);
  const r: ResultadoAnalise = {
    tipo,
    arquivo: nomeArquivo,
    temTexto: t.length > 400,
    empresa: {},
    socios: [],
    admins: [],
    vinculados: [],
    qsa: null,
  };
  if (!r.temTexto) return r;

  if (tipo === "contrato") {
    r.empresa = extrairEmpresa(t);
    const todos = extrairSocios(t);
    r.admins = extrairAdministradores(t, todos);
    r.vinculados = todos.filter((s) => s.anuente || (s.naoSocio && !s.quotas));
    r.socios = todos.filter((s) => !r.vinculados.includes(s));

    const un = t.match(/subscrito e integralizado[^.]{0,90}?pel[oa] s(?:ó|o)ci[oa] ([A-ZÀ-Ú][A-ZÀ-Ú\s']{5,60}?),/i);
    if (un) {
      const unico = tituloNome(recortarNome(un[1]));
      const alvo = r.socios.find((s) => s.nome === unico);
      if (alvo) {
        alvo.quotas = alvo.quotas || r.empresa.quotasTotal || "";
        alvo.pct = alvo.pct || "100";
        r.socios
          .filter((s) => s !== alvo)
          .forEach((s) => {
            s.obs = s.obs || "Administrador não sócio indicado no contrato.";
            r.vinculados.push(s);
          });
        r.socios = [alvo];
      }
    }

    if (r.socios.some((s) => s.quotas)) {
      const semQuota = r.socios.filter((s) => !s.quotas && r.admins.some((a) => a.nome === s.nome));
      semQuota.forEach((s) => {
        s.obs = s.obs || "Administrador — confirmar se integra o quadro societário.";
        r.vinculados.push(s);
      });
      r.socios = r.socios.filter((s) => !semQuota.includes(s));
    }
    if (r.socios.length === 1 && r.empresa.quotasTotal && !r.socios[0].quotas) {
      r.socios[0].quotas = r.empresa.quotasTotal;
      r.socios[0].pct = "100";
    }
    completarPercentuais(r.socios, r.empresa.quotasTotal);
  } else if (tipo === "cartaoCnpj" || tipo === "sintegra" || tipo === "qsa") {
    r.empresa = extrairEmpresa(t);
    if (tipo === "cartaoCnpj" || /COMPROVANTE DE INSCRI/i.test(t)) {
      r.empresa = Object.assign(r.empresa, extrairCartaoCnpj(t));
    }
    if (/QUADRO DE S(?:Ó|O)CIOS E ADMINISTRADORES/i.test(t)) {
      r.qsa = extrairQsa(t);
      if (!r.empresa.cnpj) {
        const m = t.match(/N(?:Ú|U)MERO DE INSCRI(?:Ç|C)(?:Ã|A)O\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i);
        if (m) r.empresa.cnpj = m[1];
      }
    }
    if (tipo === "sintegra") {
      const m = t.match(/Raz(?:ã|a)o Social:?\s*([A-ZÀ-Ú0-9&.\-\s]{4,80}?(?:LTDA|S\.?A\.?|EIRELI))/i);
      if (m) r.empresa.razao = limpa(m[1]);
      const f = t.match(/Nome Fantasia:?\s*([A-ZÀ-Ú0-9&.\-\s]{3,70}?)\s*(?:Utiliza|ENDERE)/i);
      if (f) r.empresa.fantasia = limpa(f[1]);
    }
  }
  return r;
}

/* ---------- validadores ---------- */
export function soDigitos(v: string): string {
  return String(v || "").replace(/\D/g, "");
}

export function validarCpf(v: string): boolean {
  const c = soDigitos(v);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dig = (base: string, peso: number) => {
    let s = 0;
    for (let i = 0; i < base.length; i++) s += parseInt(base[i], 10) * (peso - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dig(c.slice(0, 9), 10) === +c[9] && dig(c.slice(0, 10), 11) === +c[10];
}

export function validarCnpj(v: string): boolean {
  const c = soDigitos(v);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let s = 0;
    for (let i = 0; i < base.length; i++) s += parseInt(base[i], 10) * pesos[i];
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(c.slice(0, 12)) === +c[12] && calc(c.slice(0, 13)) === +c[13];
}

export function validarEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(v || "").trim());
}

/* ---------- checklist de documentos ---------- */
export interface ItemChecklist {
  tipo: TipoDocumentoDetectado;
  rotulo: string;
  obrigatorio: boolean;
  presente: boolean;
}

const REQUISITOS_DOCUMENTOS: { tipo: TipoDocumentoDetectado; rotulo: string; obrigatorio: boolean }[] = [
  { tipo: "contrato", rotulo: "Contrato social ou última alteração", obrigatorio: true },
  { tipo: "cartaoCnpj", rotulo: "Cartão CNPJ", obrigatorio: true },
  { tipo: "cnh", rotulo: "Documento pessoal dos assinantes (RG/CNH)", obrigatorio: true },
  { tipo: "qsa", rotulo: "Quadro de sócios e administradores (QSA)", obrigatorio: false },
];

export function montarChecklist(tiposPresentes: TipoDocumentoDetectado[]): ItemChecklist[] {
  const presentes = new Set(tiposPresentes);
  return REQUISITOS_DOCUMENTOS.map((r) => ({ ...r, presente: presentes.has(r.tipo) }));
}

/* ---------- conferência automática ---------- */
export interface SocioConferencia {
  pessoa: "PF" | "PJ";
  nome: string;
  doc: string;
  pct: string;
  quotas: string;
  pep: string;
}

export interface AssinanteConferencia {
  nome: string;
  cpf: string;
}

export interface ConferenciaEntrada {
  empresa: { cnpj: string; fatMes: string; fatAno: string };
  capital: { totalQuotas: string };
  socios: SocioConferencia[];
  assinantes: AssinanteConferencia[];
  testemunha: { nome: string; cpf: string };
  arquivos: { tipo: TipoDocumentoDetectado; resultado?: ResultadoAnalise }[];
}

export interface ConferenciaResultado {
  erros: string[];
  alertas: string[];
}

function numeroBr(v?: string): number {
  return parseFloat(String(v || "").replace(/\./g, "").replace(",", ".")) || 0;
}

export function conferir(e: ConferenciaEntrada): ConferenciaResultado {
  const erros: string[] = [];
  const alertas: string[] = [];

  if (e.empresa.cnpj && !validarCnpj(e.empresa.cnpj)) {
    erros.push("CNPJ da empresa é inválido (dígito verificador não confere).");
  }

  e.socios.forEach((s) => {
    if (!s.doc) return;
    const valido = s.pessoa === "PF" ? validarCpf(s.doc) : validarCnpj(s.doc);
    if (!valido) {
      erros.push(
        `${s.pessoa === "PF" ? "CPF" : "CNPJ"} de ${s.nome || "sócio sem nome"} é inválido (dígito verificador não confere).`,
      );
    }
  });

  e.assinantes.forEach((a) => {
    if (a.cpf && !validarCpf(a.cpf)) {
      erros.push(`CPF de ${a.nome || "assinante sem nome"} é inválido (dígito verificador não confere).`);
    }
  });

  if (e.testemunha.cpf && !validarCpf(e.testemunha.cpf)) {
    erros.push("CPF da testemunha é inválido (dígito verificador não confere).");
  }

  const cpfTestemunha = soDigitos(e.testemunha.cpf);
  if (cpfTestemunha && e.assinantes.some((a) => soDigitos(a.cpf) === cpfTestemunha)) {
    erros.push("A testemunha não pode ser a mesma pessoa que um assinante.");
  }

  const somaPct = e.socios.reduce((acc, s) => acc + numeroBr(s.pct), 0);
  if (e.socios.some((s) => s.pct) && Math.abs(somaPct - 100) > 0.5) {
    erros.push(`A soma dos percentuais dos sócios é ${somaPct.toFixed(2)}%, deveria ser 100%.`);
  }

  const totalQuotas = numeroBr(e.capital.totalQuotas);
  const somaQuotas = e.socios.reduce((acc, s) => acc + numeroBr(s.quotas), 0);
  if (totalQuotas && somaQuotas && Math.abs(somaQuotas - totalQuotas) > 0.5) {
    erros.push(
      `A soma das quotas dos sócios (${somaQuotas.toLocaleString("pt-BR")}) não bate com o total de quotas informado (${totalQuotas.toLocaleString("pt-BR")}).`,
    );
  }

  e.socios.forEach((s) => {
    if (s.pep === "Sim") {
      alertas.push(
        `${s.nome || "Sócio"} foi declarado como Pessoa Exposta Politicamente — due diligence reforçada necessária.`,
      );
    }
  });

  const fatMes = numeroBr(e.empresa.fatMes);
  const fatAno = numeroBr(e.empresa.fatAno);
  if (fatMes && fatAno) {
    const divergencia = Math.abs(fatMes * 12 - fatAno) / fatAno;
    if (divergencia > 0.3) {
      alertas.push(
        "O faturamento mensal x 12 diverge bastante do faturamento anual informado — confirmar os valores.",
      );
    }
  }

  const cartao = e.arquivos.find((a) => a.tipo === "cartaoCnpj" && a.resultado)?.resultado;
  if (cartao?.empresa.situacao && cartao.empresa.situacao !== "ATIVA") {
    erros.push(`A situação cadastral da empresa no cartão CNPJ está ${cartao.empresa.situacao}, não ATIVA.`);
  }
  if (cartao?.empresa.cnpj && e.empresa.cnpj && soDigitos(cartao.empresa.cnpj) !== soDigitos(e.empresa.cnpj)) {
    erros.push("O CNPJ informado na ficha diverge do CNPJ do cartão CNPJ anexado.");
  }

  const qsaResultado = e.arquivos.find((a) => a.resultado?.qsa)?.resultado;
  if (qsaResultado?.qsa) {
    const docsFicha = new Set(
      [...e.socios.map((s) => soDigitos(s.doc)), ...e.assinantes.map((a) => soDigitos(a.cpf))].filter(Boolean),
    );
    qsaResultado.qsa.forEach((p) => {
      if (p.mascarado) return;
      const doc = soDigitos(p.doc);
      if (doc && !docsFicha.has(doc)) {
        alertas.push(
          `${p.nome} consta no quadro de sócios e administradores da Receita (QSA), mas não foi declarado na ficha.`,
        );
      }
    });
  }

  const checklist = montarChecklist(e.arquivos.map((a) => a.tipo));
  checklist
    .filter((item) => !item.presente)
    .forEach((item) => {
      const mensagem = `Documento obrigatório não anexado: ${item.rotulo}.`;
      if (item.obrigatorio) erros.push(mensagem);
      else alertas.push(`Documento recomendado não anexado: ${item.rotulo}.`);
    });

  return { erros, alertas };
}

/* ---------- leitura do PDF no navegador ---------- */
export async function textoDoPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let texto = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const pagina = await pdf.getPage(p);
    const conteudo = await pagina.getTextContent();
    texto += ` ${conteudo.items.map((i) => ("str" in i ? i.str : "")).join(" ")}`;
  }
  return texto;
}

/* ---------- OCR (fallback para digitalizados ou PDFs sem texto real) ---------- */
/**
 * Alguns documentos (ex.: página impressa como PDF via "Microsoft Print
 * to PDF", ou fotos/scans anexados como imagem) não têm nenhum texto
 * selecionável — só desenhos vetoriais ou pixels. Nesses casos caímos
 * pra OCR (Tesseract.js, roda no navegador, sem servidor).
 */
let workerOcrPromise: Promise<TesseractWorker> | null = null;

async function obterWorkerOcr(): Promise<TesseractWorker> {
  if (!workerOcrPromise) {
    const { createWorker } = await import("tesseract.js");
    workerOcrPromise = createWorker("por");
  }
  return workerOcrPromise;
}

const MAX_PAGINAS_OCR = 6;

export async function textoPdfViaOcr(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const worker = await obterWorkerOcr();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const paginas = Math.min(pdf.numPages, MAX_PAGINAS_OCR);

  let texto = "";
  for (let p = 1; p <= paginas; p++) {
    const pagina = await pdf.getPage(p);
    const viewport = pagina.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const contexto = canvas.getContext("2d");
    if (!contexto) continue;
    await pagina.render({ canvasContext: contexto, viewport, canvas }).promise;
    const resultado = await worker.recognize(canvas);
    texto += ` ${resultado.data.text}`;
  }
  return texto;
}

export async function textoImagemViaOcr(file: File): Promise<string> {
  const worker = await obterWorkerOcr();
  const resultado = await worker.recognize(file);
  return resultado.data.text;
}
