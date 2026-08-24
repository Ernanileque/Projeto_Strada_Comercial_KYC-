/**
 * Validador Cadastral de Compliance/KYC — implementação a partir do
 * handoff técnico da Dani (docs/validador-cadastral-handoff.md, v1.0).
 * Roda três análises via API da Claude: cadastral (sempre), dossiê +
 * beneficiário final/UBO (sempre, perfil compliance), e reputacional
 * (opcional, mais lenta e com busca na web).
 */

import Anthropic from "@anthropic-ai/sdk";

const MODELO = "claude-sonnet-5";

export interface DocumentoParaAnalise {
  nomeArquivo: string;
  categoriaDocumento: string;
  base64: string;
  mediaType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
}

export interface InconsistenciaCadastral {
  documento: string;
  campo: string;
  descricao: string;
  gravidade: "atencao" | "ok";
  acao: string;
}

export interface AnaliseCadastral {
  empresa: string;
  inconsistencias: InconsistenciaCadastral[];
}

export interface BeneficiarioFinal {
  documento: string;
  nome: string;
  cpf_cnpj: string;
  participacao: string;
  beneficiario_final: "sim" | "nao";
  gravidade: "atencao" | "ok";
  recomendacao: string;
}

export interface AnaliseCompliance {
  empresa: string;
  dossie: string;
  beneficiarios: BeneficiarioFinal[];
}

export interface AchadoReputacional {
  nome: string;
  tipo: "direta" | "contextual" | "indireta";
  resumo: string;
  data: string;
  periodo: string;
  fonte: string;
  gravidade: "atencao" | "ok";
}

export interface AnaliseReputacional {
  empresa: string;
  empresa_sintese: string;
  socios_sintese: string;
  empresa_achados: AchadoReputacional[];
  socios_achados: AchadoReputacional[];
}

export interface Veredicto {
  resultado: "APTO" | "NÃO APTO" | "EM ANÁLISE";
  justificativa: string;
  atencoesEncontradas: number;
  itensConferidos: number;
}

export interface ErroValidador {
  codigo: string;
  mensagem: string;
  etapa: "cadastral" | "compliance" | "reputacional";
}

export interface ResultadoValidador {
  status: "processamento_sucesso" | "processamento_erro";
  dataAnalise: string;
  empresa: string;
  veredicto: Veredicto;
  analiseCadastral: AnaliseCadastral | null;
  analiseCompliance: AnaliseCompliance | null;
  analiseReputacional: AnaliseReputacional | null;
  erros: ErroValidador[] | null;
}

/* ---------- prompts (handoff da Dani, verbatim) ---------- */

const PROMPT_CADASTRAL = `Você é um analista cadastral sênior de uma instituição financeira brasileira. Analise os documentos anexados e produza uma validação cadastral objetiva. Trabalhe de forma objetiva, técnica e sucinta. Considere APENAS o conteúdo presente nos documentos enviados.

# Como analisar

## Etapa 1 — Identificar o conjunto documental
1. Determine se o caso é de sociedade limitada ou de sociedade com estatuto.
2. Confirme quais documentos foram enviados.
3. KIT DOCUMENTAL MÍNIMO OBRIGATÓRIO (conforme o tipo societário):
   - Sociedade limitada: CNPJ/QSA + contrato social + ficha cadastral.
   - Sociedade com estatuto: CNPJ/QSA + estatuto social + ata de eleição + ficha cadastral.
4. Se QUALQUER documento do kit mínimo estiver faltante, o cadastro deve ser REPROVADO: registre uma linha com gravidade "atencao", campo "Documento obrigatório ausente", indicando qual documento falta, qual validação ficou prejudicada e a ação de solicitar o envio. Faça isso para CADA documento faltante do kit.
5. Documentos além do kit mínimo (ex.: comprovante bancário) seguem a regra geral de documento ausente, sem reprovar por si só o kit.

## Etapa 2 — Validar preenchimento e integridade
1. Revise a ficha cadastral e identifique campos obrigatórios em branco; liste os campos ausentes de forma direta.
2. Revise cada documento: legibilidade, todas as páginas presentes, indício de páginas faltando, e se os documentos societários possuem selo, registro ou autenticação da junta comercial ou órgão competente, quando aplicável.
3. Se houver qualquer problema de integridade (baixa legibilidade, páginas faltando, ausência de registro, informação incompleta), sinalize ANTES de comparar dados.
4. MARCA "SEM VALOR DE CERTIDÃO": quando o contrato social (ou outro documento societário) contiver essa marca d'água ou carimbo, NÃO considere divergência nem problema de integridade — é uma marcação padrão de vias digitais da junta comercial. Nesses casos, valide normalmente o selo/autenticação e a quantidade de páginas do documento.

## Etapa 3 — Validar conteúdo obrigatório por tipo societário
SOCIEDADE LIMITADA — documento societário obrigatório: CONTRATO SOCIAL. Verifique se contém: razão social; endereço; CNAE; forma de representação; quadro societário com nome dos sócios e quantidade de quotas ou percentual de participação; qualificação dos sócios; definição de quem administra a sociedade.
SOCIEDADE COM ESTATUTO — documento societário base: ESTATUTO SOCIAL. Quando houver estatuto, DEVE haver ata de eleição para identificar administradores ou diretores; estatuto sem ata de eleição é pendência obrigatória. Verifique se o estatuto contém: razão social; endereço; CNAE; forma de representação. Verifique se a ata de eleição informa os administradores ou diretores em exercício.
DIRETORES/ADMINISTRADORES NÃO REELEITOS: quando um diretor ou administrador que constava em documento anterior NÃO foi reeleito na ata mais recente, NÃO considere pendência nem divergência — a renovação da diretoria é situação normal. Identifique e liste os diretores/administradores ELEITOS em exercício conforme a ata mais recente, e use apenas esses como referência nas comparações com os demais documentos.

## Etapa 4 — Comparar convergência entre documentos
Compare: CNPJ/QSA × documento societário aplicável (contrato social OU estatuto + ata, conforme o caso) × ficha cadastral. Confira, sempre que disponíveis: razão social; endereço; CNAE; forma de representação; composição societária; nome dos sócios, acionistas, administradores ou diretores; percentuais de participação, quotas ou ações, quando aplicável.

REGRAS DE NORMALIZAÇÃO (aplique ANTES de apontar qualquer divergência):
- NÚMEROS DE DOCUMENTOS (CNPJ, CPF, RG, inscrições, números cadastrais): desconsidere pontuação, máscara e formatação; divergência APENAS quando a sequência numérica for diferente.
- TEXTOS E NOMES: desconsidere maiúsculas/minúsculas, acentuação, ausência de acentos e abreviações equivalentes; divergência APENAS quando o conteúdo efetivamente mudar.
- ABREVIAÇÕES SOCIETÁRIAS EQUIVALENTES: LTDA = LIMITADA; S.A. = SOCIEDADE ANÔNIMA; ME = MICROEMPRESA; EPP = EMPRESA DE PEQUENO PORTE, desde que o restante do conteúdo corresponda.
- ENDEREÇOS: normalize variações usuais de logradouro e complemento; R. = RUA; AV. = AVENIDA; AL. = ALAMEDA; TRAV. = TRAVESSA; ROD. = RODOVIA; EST. = ESTRADA; PÇA. = PC. = PRAÇA; VL. = VILA; JD. = JARDIM; APTO = APARTAMENTO; CJ = CONJUNTO; BL = BLOCO; SL = SALA; LT = LOTE; S/N = SEM NÚMERO — desde que CEP e demais elementos principais correspondam. Compare logradouro, número, complemento, bairro, cidade, UF e CEP após a normalização.
- FATURAMENTO ≠ CAPITAL SOCIAL: são informações diferentes, analise separadamente; NUNCA compare uma com a outra nem sinalize essa comparação como divergência.

CLASSIFICAÇÃO DE CADA APONTAMENTO (identifique a natureza na descrição):
- informação ausente (campo obrigatório em branco);
- informação divergente (conteúdo efetivamente diferente entre documentos presentes, após normalização);
- documento obrigatório ausente (não anexado — diga qual validação ficou prejudicada);
- problema de integridade (ilegível, páginas faltando, sem registro).

# Tratamento de limitações
- Trecho ilegível: diga que a conclusão depende de nova via legível.
- Páginas faltando: diga que a validação de conteúdo ficou parcial.
- Registro no órgão competente não confirmável: sinalize necessidade de confirmação documental.
- Conflito entre documentos: NÃO presuma qual está correto; apenas registre a divergência.
- NÃO presuma conteúdo de documentos não anexados; ausência de documento NUNCA é divergência.
- Ao apontar divergências, informe apenas o necessário para a decisão cadastral.

GRAVIDADES: use APENAS "ok" (item conferido, sem divergência) e "atencao" (informação ausente, informação divergente confirmada, documento obrigatório ausente ou problema de integridade).

RESPONDA APENAS COM JSON VÁLIDO, sem markdown, sem crases, sem texto antes ou depois, exatamente neste formato:
{
  "empresa": string,
  "inconsistencias": [
    {"documento": string, "campo": string, "descricao": string, "gravidade": "atencao" | "ok", "acao": string}
  ]
}
O campo "empresa" é OBRIGATÓRIO: informe a razão social da empresa analisada, conforme constar nos documentos (prefira o cartão CNPJ ou o documento societário). Se não for identificável, use "Empresa não identificada".
O array "inconsistencias" é OBRIGATÓRIO e NUNCA pode vir vazio: inclua linhas de "atencao" para os problemas e linhas "ok" para os itens conferidos e corretos, para servir de checklist. Seja objetivo e específico (cite o documento e o campo exato).
IMPORTANTE — LIMITE DE TAMANHO: liste no máximo 12 itens em "inconsistencias", priorizando nesta ordem: atenções (documentos obrigatórios ausentes, problemas de integridade, informações ausentes, divergências confirmadas) e por último os "ok" mais relevantes. Cada campo de texto deve ter no máximo 15 palavras. Respostas longas serão cortadas e invalidarão a análise.`;

const PROMPT_COMPLIANCE = `Você é um analista de Compliance sênior de uma instituição financeira brasileira. Analise os documentos anexados. Considere APENAS o conteúdo presente nos documentos enviados — NUNCA invente, presuma ou complemente informação; se um dado não constar nos documentos, simplesmente omita-o.

TAREFA 1 — DOSSIÊ "DADOS DO CLIENTE" (campo "dossie"):
Dossiê de identificação do cliente em texto corrido, extraído EXCLUSIVAMENTE dos documentos anexados. Estruture assim (use \\n para quebras de linha):
1º parágrafo — identificação da empresa: razão social, CNPJ, data de constituição, atividades sociais, nome fantasia (se houver), endereço, capital social (valor numérico e por extenso, se constar), faturamento informado (se constar) e filiais com CNPJs (se houver).
Depois, a seção "Sócios e beneficiários finais": para cada sócio pessoa natural, uma linha iniciando pelo percentual de participação, seguido de nome, profissão, naturalidade, data de nascimento, RG (número, órgão expedidor e data de expedição), CPF, endereço residencial completo e renda informada — SOMENTE os dados que constarem nos documentos. Se o sócio for pessoa jurídica, use o formato "Única Sócia:" (ou "Sócios:") com percentual, razão social e CNPJ.
Se houver, inclua a seção "Administradores" com nome e CPF de cada um, e a seção "Beneficiários Finais:" com nome e CPF de cada beneficiário final identificado.
Exemplo do formato esperado: "ASSANDRI & ROCHA TRANSPORTE E LOGISTICA LTDA, CNPJ 35.043.217/0001-63, empresa constituída em 01/10/2019, sob atividades sociais de transporte rodoviário de carga (...), endereço R SAO ROMAO 5 (...), capital social de R$ 20.000,00 (Vinte mil reais), faturamento informado R$ 310.920,00/ano.\\n\\nSócios e beneficiários finais\\n50% - MARLON WILTON ROCHA NERIS, comerciante, data de nascimento 11/12/1983, carteira de identidade (RG) nº 0537971220147 expedida por SESP-MA em 02/09/2014 e CPF nº 003.223.301-90, residente e domiciliado (...), renda informada R$ 4.096,26/mês."

TAREFA 2 — BENEFICIÁRIOS FINAIS (Circular BCB nº 3.978/2020) (array "beneficiarios"):
CONCEITO DE BENEFICIÁRIO FINAL (UBO), conforme a Circular BCB nº 3.978/2020: pessoa natural com participação, direta ou indireta, igual ou superior a 25% do capital, OU que exerça controle por outros meios (poder de eleger administradores, acordos de sócios/acionistas, preponderância nas deliberações sociais).
REGRA CRÍTICA: liste TODOS — sem exceção — os sócios/acionistas que se enquadrarem nesse conceito, um objeto por pessoa. Se dois sócios pessoa natural têm 50% cada, AMBOS são beneficiários finais e AMBOS devem constar no array. Se três sócios têm 33% cada, os TRÊS devem constar. NUNCA liste apenas um quando houver mais de um enquadrado. Percorra o quadro societário completo antes de responder e confira: todo sócio com 25% ou mais está no array?
Para cada um, informe:
- "documento": qual documento anexado foi utilizado para analisar o beneficiário (ex.: Contrato social, Cartão CNPJ/QSA);
- "nome": nome completo (pessoa natural) ou razão social (pessoa jurídica);
- "cpf_cnpj": CPF (pessoa natural) ou CNPJ (pessoa jurídica), conforme constar no documento; se não constar, informe "Não consta";
- "participacao": percentual de participação (ex.: "35%");
- "beneficiario_final": "sim" APENAS para pessoa natural com 25% ou mais; "nao" para pessoa jurídica ou quando não confirmável;
- "gravidade": "ok" para pessoa natural identificada como beneficiário final; "atencao" SEMPRE que o sócio com 25% ou mais for PESSOA JURÍDICA (será necessário abrir a cadeia societária) ou quando a identificação não for possível;
- "recomendacao": para pessoa natural identificada, algo como "Beneficiário final identificado"; para pessoa jurídica, use EXATAMENTE: "Sócia PJ. Cadeia até pessoa natural não identificável com documentos presentes. Solicitar documento da empresa, para identificar beneficiário final."
Inclua também, como beneficiário final, pessoa natural que exerça controle por outros meios ainda que com participação inferior a 25%, indicando o fundamento na recomendação (ex.: "Controle por acordo de sócios identificado no contrato social").
ANTES DE FINALIZAR, confira: a quantidade de objetos em "beneficiarios" corresponde à quantidade de sócios/acionistas enquadrados na regra? Se não, complete o array.

RESPONDA APENAS COM JSON VÁLIDO, sem markdown, sem crases, sem texto antes ou depois, exatamente neste formato E NESTA ORDEM:
{
  "empresa": string,
  "dossie": string,
  "beneficiarios": [
    {"documento": string, "nome": string, "cpf_cnpj": string, "participacao": string, "beneficiario_final": "sim" | "nao", "gravidade": "atencao" | "ok", "recomendacao": string}
  ]
}
O campo "empresa" é OBRIGATÓRIO: razão social conforme os documentos; se não identificável, "Empresa não identificada".
O campo "dossie" é OBRIGATÓRIO, NUNCA pode ser omitido e vem ANTES de "beneficiarios" no JSON. Se os documentos não permitirem montar o dossiê, preencha com "Não foi possível montar o dossiê com os documentos anexados." seguido do motivo.
O array "beneficiarios" é OBRIGATÓRIO: um objeto para CADA sócio/acionista com 25% ou mais. Se nenhum sócio atingir 25%, ou se o quadro societário não puder ser identificado, inclua UMA linha com nome "Não identificado", gravidade "atencao" e recomendação indicando o documento necessário. NUNCA omita o array.
IMPORTANTE — LIMITE DE TAMANHO: o dossiê deve ser fiel aos documentos, porém conciso (sem repetições, no máximo 250 palavras). Liste no máximo 6 beneficiários (priorize as maiores participações). Respostas longas serão cortadas e invalidarão a análise.`;

const PROMPT_REPUTACIONAL = `Você é um analista de due diligence reputacional de uma instituição financeira brasileira. Sua tarefa: pesquisar na web notícias e menções recentes da empresa e das pessoas identificadas nos documentos anexados.

# Passos de execução
1. LER A BASE: identifique nos documentos a empresa analisada e as pessoas físicas e jurídicas relevantes (sócios PF, sócias PJ, administradores/diretores).
2. BUSCAR CADA NOME na web: pesquise o nome completo e variações úteis para ampliar cobertura. Para a empresa, pesquise também notícias sobre ela e valide se há citação nominal de executivos, sócios ou administradores.
3. LER E VALIDAR: não se limite à manchete — leia o corpo do conteúdo e confirme o contexto da citação. Descarte resultados sem data clara, fonte confiável ou conteúdo suficiente.
4. TRABALHE COM MATCH EXATO DE NOME ao consolidar: diferencie fato confirmado, inferência e associação indireta. Não trate perfis públicos ou menções ambíguas como evidência conclusiva.
5. SEPARE as análises em dois blocos: EMPRESA e SÓCIOS/ADMINISTRADORES.

# Tipos de notícias a capturar
Capture TODAS as notícias recentes relevantes, independentemente do tom: notícias adversas (crime, sanções, processos, escândalos), neutras (transações, parcerias, mudanças), e positivas (prêmios, reconhecimentos, crescimento). Dê especial atenção a notícias nos últimos 30 dias.

# Fontes a priorizar
Mídia nacional e regional confiável; atos regulatórios e diários oficiais; menções públicas a processos judiciais; menções públicas a listas PEP, sanções e outras listas sensíveis; comunicados de imprensa e parcerias empresariais.

# Classificação obrigatória de cada achado (campo "tipo")
- "direta": Citação Nominal Direta — nome no título ou manchete.
- "contextual": Adverse Media Nominal (Contextual) OU Menção Contextual Recente — nome no corpo da matéria, especialmente como executivo, diretor, sócio ou administrador.
- "indireta": Adverse Media Indireta OU Menção Indireta — empresa citada sem nome nominal do alvo.
REGRA CRÍTICA: se a empresa aparece em notícia de qualquer tipo, leia o conteúdo e verifique se o nome de sócio/administrador aparece no corpo. Se aparecer, reclassifique o achado da pessoa como "contextual".

# Gravidade
- "atencao": achado adverso confirmado (direta ou contextual), OU menção contextual recente relevante da empresa ou pessoas (parcerias, transações significativas, etc.).
- "ok": menção neutra/positiva relevante confirmada, ou verificação concluída sem desabono.

# Campos de cada achado
"nome" (nome/razão social citado), "tipo" (direta|contextual|indireta), "resumo" (inclua função/cargo/papel quando houver, e o contexto real da matéria), "data" (da publicação), "periodo" ("últimos 30 dias" | "até 6 meses" | "6 a 12 meses" | "acima de 12 meses"), "fonte" (veículo e, se possível, link), "gravidade".

# Frases-padrão para as sínteses
- Ausência: "Não foram localizadas notícias com citação nominal direta ou contextual."
- Menção neutra/positiva: "NOME foi citado nominalmente no corpo de matéria jornalística no contexto de CONTEXTO (ex.: parceria empresarial, mudança de função, prêmio, etc.) em VEÍCULO em DATA."
- Achado adverso contextual: "NOME foi citado nominalmente no corpo de matéria jornalística no contexto de sua atuação pessoal ou de sua função executiva/administrativa em entidade envolvida em evento adverso."

RESPONDA APENAS COM JSON VÁLIDO, sem markdown, sem crases, sem texto antes ou depois, exatamente neste formato E NESTA ORDEM:
{
  "empresa": string,
  "empresa_sintese": string,
  "socios_sintese": string,
  "empresa_achados": [
    {"nome": string, "tipo": "direta" | "contextual" | "indireta", "resumo": string, "data": string, "periodo": string, "fonte": string, "gravidade": "atencao" | "ok"}
  ],
  "socios_achados": [
    {"nome": string, "tipo": "direta" | "contextual" | "indireta", "resumo": string, "data": string, "periodo": string, "fonte": string, "gravidade": "atencao" | "ok"}
  ]
}
As sínteses são OBRIGATÓRIAS: use as frases-padrão quando aplicável; declare SEMPRE qualquer menção recente relevante encontrada. Os arrays podem vir vazios quando não houver achado válido — a síntese cobre a ausência.
NÃO entregue relatório parcial, checklist vazio ou campos para preenchimento posterior. Se uma notícia não tiver data clara, fonte confiável ou conteúdo suficiente, descarte.
IMPORTANTE — LIMITE DE TAMANHO: no máximo 4 achados por bloco (priorize os mais recentes). "resumo" com no máximo 20 palavras. Respostas longas serão cortadas e invalidarão a análise.`;

/* ---------- chamadas à API ---------- */

function clienteAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada.");
  return new Anthropic({ apiKey });
}

function blocosDocumentos(documentos: DocumentoParaAnalise[]): Anthropic.Messages.ContentBlockParam[] {
  return documentos.map((d) =>
    d.mediaType === "application/pdf"
      ? {
          type: "document" as const,
          source: { type: "base64" as const, media_type: d.mediaType, data: d.base64 },
          title: d.nomeArquivo,
        }
      : {
          type: "image" as const,
          source: { type: "base64" as const, media_type: d.mediaType, data: d.base64 },
        },
  );
}

function tentarParsear<T>(texto: string): T | null {
  const limpo = texto
    .trim()
    .replace(/^```(json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(limpo) as T;
  } catch {
    // fallback: às vezes o modelo escreve um preâmbulo antes do JSON —
    // tenta isolar o trecho entre a primeira "{" e a última "}".
    const inicio = limpo.indexOf("{");
    const fim = limpo.lastIndexOf("}");
    if (inicio >= 0 && fim > inicio) {
      try {
        return JSON.parse(limpo.slice(inicio, fim + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Extrai o JSON de resposta — tenta o último bloco de texto que der parse. */
function extrairJson<T>(blocos: Anthropic.Messages.ContentBlock[]): T {
  const textos = blocos.filter((b): b is Anthropic.Messages.TextBlock => b.type === "text");
  for (let i = textos.length - 1; i >= 0; i--) {
    const resultado = tentarParsear<T>(textos[i].text);
    if (resultado) return resultado;
  }
  const ultimoTexto = textos[textos.length - 1]?.text ?? "";
  const amostra = ultimoTexto.slice(0, 300).replace(/\s+/g, " ");
  throw new Error(`A análise não retornou um JSON válido. Início da resposta: "${amostra}"`);
}

async function chamarAnaliseUmaVez<T>(
  client: Anthropic,
  documentos: DocumentoParaAnalise[],
  fichaResumo: string,
  prompt: string,
  ferramentas?: Anthropic.Messages.ToolUnion[],
): Promise<T> {
  const resposta = await client.messages.create({
    model: MODELO,
    max_tokens: 8192,
    tools: ferramentas,
    messages: [
      {
        role: "user",
        content: [
          ...blocosDocumentos(documentos),
          {
            type: "text",
            text: `Dados declarados na ficha cadastral preenchida pelo cliente (não é um documento anexado, mas texto informado por ele):\n${fichaResumo}`,
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });
  return extrairJson<T>(resposta.content);
}

/**
 * Volta e meia a API retorna uma resposta cortada bem no início (falha
 * pontual, não reprodutível com o mesmo prompt/documentos) — tenta de
 * novo uma vez antes de desistir, pra não obrigar o Compliance a clicar
 * em "Analisar com IA" manualmente de novo.
 */
async function chamarAnalise<T>(
  client: Anthropic,
  documentos: DocumentoParaAnalise[],
  fichaResumo: string,
  prompt: string,
  ferramentas?: Anthropic.Messages.ToolUnion[],
): Promise<T> {
  try {
    return await chamarAnaliseUmaVez<T>(client, documentos, fichaResumo, prompt, ferramentas);
  } catch {
    return await chamarAnaliseUmaVez<T>(client, documentos, fichaResumo, prompt, ferramentas);
  }
}

function contarGravidade(
  gravidade: "atencao" | "ok",
  cadastral: AnaliseCadastral,
  compliance: AnaliseCompliance,
  reputacional: AnaliseReputacional | null,
): number {
  let total = cadastral.inconsistencias.filter((i) => i.gravidade === gravidade).length;
  total += compliance.beneficiarios.filter((b) => b.gravidade === gravidade).length;
  if (reputacional) {
    total += [...reputacional.empresa_achados, ...reputacional.socios_achados].filter(
      (r) => r.gravidade === gravidade,
    ).length;
  }
  return total;
}

export interface OpcoesValidador {
  documentos: DocumentoParaAnalise[];
  fichaResumo: string;
  incluirReputacional: boolean;
}

export async function rodarValidadorCadastral(opcoes: OpcoesValidador): Promise<ResultadoValidador> {
  const client = clienteAnthropic();
  const erros: ErroValidador[] = [];

  let cadastral: AnaliseCadastral | null = null;
  let compliance: AnaliseCompliance | null = null;
  let reputacional: AnaliseReputacional | null = null;

  const [resultadoCadastral, resultadoCompliance] = await Promise.allSettled([
    chamarAnalise<AnaliseCadastral>(client, opcoes.documentos, opcoes.fichaResumo, PROMPT_CADASTRAL),
    chamarAnalise<AnaliseCompliance>(client, opcoes.documentos, opcoes.fichaResumo, PROMPT_COMPLIANCE),
  ]);

  if (resultadoCadastral.status === "fulfilled") {
    cadastral = resultadoCadastral.value;
  } else {
    erros.push({ codigo: "ANALISE_CADASTRAL_FALHOU", mensagem: String(resultadoCadastral.reason), etapa: "cadastral" });
  }

  if (resultadoCompliance.status === "fulfilled") {
    compliance = resultadoCompliance.value;
  } else {
    erros.push({ codigo: "ANALISE_COMPLIANCE_FALHOU", mensagem: String(resultadoCompliance.reason), etapa: "compliance" });
  }

  if (opcoes.incluirReputacional) {
    try {
      reputacional = await chamarAnalise<AnaliseReputacional>(
        client,
        opcoes.documentos,
        opcoes.fichaResumo,
        PROMPT_REPUTACIONAL,
        [{ type: "web_search_20260318", name: "web_search", max_uses: 8 }],
      );
    } catch (e) {
      erros.push({ codigo: "ANALISE_REPUTACIONAL_FALHOU", mensagem: String(e), etapa: "reputacional" });
    }
  }

  const empresa = cadastral?.empresa ?? compliance?.empresa ?? "Empresa não identificada";

  if (!cadastral || !compliance) {
    return {
      status: "processamento_erro",
      dataAnalise: new Date().toISOString(),
      empresa,
      veredicto: {
        resultado: "EM ANÁLISE",
        justificativa: "Não foi possível concluir a análise automática — revise manualmente.",
        atencoesEncontradas: 0,
        itensConferidos: 0,
      },
      analiseCadastral: cadastral,
      analiseCompliance: compliance,
      analiseReputacional: reputacional,
      erros,
    };
  }

  const atencoes = contarGravidade("atencao", cadastral, compliance, reputacional);
  const conferidos = contarGravidade("ok", cadastral, compliance, reputacional);

  let resultado: Veredicto["resultado"];
  if (atencoes > 0) resultado = "NÃO APTO";
  else if (cadastral.inconsistencias.length === 0) resultado = "EM ANÁLISE";
  else resultado = "APTO";

  const justificativa =
    atencoes > 0
      ? `${atencoes} ${atencoes === 1 ? "atenção encontrada" : "atenções encontradas"}. ${conferidos} ${conferidos === 1 ? "item conferido" : "itens conferidos"} sem divergência.`
      : `Nenhuma atenção encontrada. ${conferidos} ${conferidos === 1 ? "item conferido" : "itens conferidos"} sem divergência.`;

  return {
    status: "processamento_sucesso",
    dataAnalise: new Date().toISOString(),
    empresa,
    veredicto: { resultado, justificativa, atencoesEncontradas: atencoes, itensConferidos: conferidos },
    analiseCadastral: cadastral,
    analiseCompliance: compliance,
    analiseReputacional: reputacional,
    erros: erros.length ? erros : null,
  };
}
