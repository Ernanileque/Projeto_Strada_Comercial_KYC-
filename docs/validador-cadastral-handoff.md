# Handoff Técnico — Validador Cadastral de Compliance/KYC
## Versão 1.0 | Strada Pay · Agosto 2026

---

## 1. VISÃO GERAL

O **Validador Cadastral de Compliance/KYC** é um agente de análise documental que verifica conformidade cadastral e perfil de risco de pessoas jurídicas. Opera em dois perfis:

- **Comercial:** Checklist cadastral, divergências, integridade documental.
- **Compliance:** Checklist cadastral + beneficiários finais (Circular BCB nº 3.978/2020) + dossiê de identificação + análise reputacional (opcional).

O validador executa três chamadas paralelas à API Claude (modelo `claude-sonnet-4-6`):
1. **Análise Cadastral:** inconsistências, campos obrigatórios, problemas de integridade.
2. **Análise Compliance** (se perfil=compliance): dossiê "Dados do Cliente" e beneficiários finais.
3. **Análise Reputacional** (se checkbox ativo): busca web de notícias e menções públicas da empresa e sócios.

---

## 2. FORMATO DE ENTRADA

### 2.1 Estrutura Principal

```json
{
  "perfil": "comercial" | "compliance",
  "incluirReputacional": boolean,
  "documentos": [
    {
      "id": string (único, ex: "doc-001"),
      "arquivo": {
        "nome": string,
        "tipo": "application/pdf" | "image/png" | "image/jpeg",
        "tamanho": number (bytes),
        "dataUpload": string (ISO 8601)
      },
      "categoriaDocumento": string,
      "base64": string
    }
  ],
  "metadados": {
    "usuarioId": string,
    "empresaId": string (opcional),
    "dataAnalise": string (ISO 8601),
    "origem": string (ex: "plataforma-web", "api-direta")
  }
}
```

### 2.2 Categorias de Documento Válidas

```
- Ficha cadastral
- Cartão CNPJ/QSA
- Contrato social
- Estatuto social
- Ata de eleição
- Comprovante bancário
- Comprovante de endereço
- RG/CPF de sócio
- Outro
```

### 2.3 Codificação de Documentos

- **PDFs:** base64-encoded, sem URI prefix
- **Imagens:** base64-encoded (PNG, JPG, JPEG), sem URI prefix
- **Limite:** até 10 documentos por requisição
- **Tamanho máximo por documento:** 10 MB

### 2.4 Exemplo de Entrada Completa

```json
{
  "perfil": "compliance",
  "incluirReputacional": true,
  "documentos": [
    {
      "id": "doc-001",
      "arquivo": {
        "nome": "cartao_cnpj_35043217.pdf",
        "tipo": "application/pdf",
        "tamanho": 245632,
        "dataUpload": "2026-08-07T14:32:00Z"
      },
      "categoriaDocumento": "Cartão CNPJ/QSA",
      "base64": "JVBERi0xLjQKJeLj..."
    },
    {
      "id": "doc-002",
      "arquivo": {
        "nome": "contrato_social_assinado.pdf",
        "tipo": "application/pdf",
        "tamanho": 512000,
        "dataUpload": "2026-08-07T14:32:15Z"
      },
      "categoriaDocumento": "Contrato social",
      "base64": "JVBERi0xLjQKJeLj..."
    }
  ],
  "metadados": {
    "usuarioId": "usr-12345",
    "empresaId": "emp-67890",
    "dataAnalise": "2026-08-07T14:33:00Z",
    "origem": "plataforma-web"
  }
}
```

---

## 3. PROMPTS COMPLETOS

### 3.1 Prompt Análise Cadastral (Ambos os Perfis)

```
Você é um analista cadastral sênior de uma instituição financeira brasileira. Analise os documentos anexados e produza uma validação cadastral objetiva. Trabalhe de forma objetiva, técnica e sucinta. Considere APENAS o conteúdo presente nos documentos enviados.

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
IMPORTANTE — LIMITE DE TAMANHO: liste no máximo 12 itens em "inconsistencias", priorizando nesta ordem: atenções (documentos obrigatórios ausentes, problemas de integridade, informações ausentes, divergências confirmadas) e por último os "ok" mais relevantes. Cada campo de texto deve ter no máximo 15 palavras. Respostas longas serão cortadas e invalidarão a análise.
```

### 3.2 Prompt Análise Compliance (Perfil = compliance)

```
Você é um analista de Compliance sênior de uma instituição financeira brasileira. Analise os documentos anexados. Considere APENAS o conteúdo presente nos documentos enviados — NUNCA invente, presuma ou complemente informação; se um dado não constar nos documentos, simplesmente omita-o.

TAREFA 1 — DOSSIÊ "DADOS DO CLIENTE" (campo "dossie"):
Dossiê de identificação do cliente em texto corrido, extraído EXCLUSIVAMENTE dos documentos anexados. Estruture assim (use \n para quebras de linha):
1º parágrafo — identificação da empresa: razão social, CNPJ, data de constituição, atividades sociais, nome fantasia (se houver), endereço, capital social (valor numérico e por extenso, se constar), faturamento informado (se constar) e filiais com CNPJs (se houver).
Depois, a seção "Sócios e beneficiários finais": para cada sócio pessoa natural, uma linha iniciando pelo percentual de participação, seguido de nome, profissão, naturalidade, data de nascimento, RG (número, órgão expedidor e data de expedição), CPF, endereço residencial completo e renda informada — SOMENTE os dados que constarem nos documentos. Se o sócio for pessoa jurídica, use o formato "Única Sócia:" (ou "Sócios:") com percentual, razão social e CNPJ.
Se houver, inclua a seção "Administradores" com nome e CPF de cada um, e a seção "Beneficiários Finais:" com nome e CPF de cada beneficiário final identificado.
Exemplo do formato esperado: "ASSANDRI & ROCHA TRANSPORTE E LOGISTICA LTDA, CNPJ 35.043.217/0001-63, empresa constituída em 01/10/2019, sob atividades sociais de transporte rodoviário de carga (...), endereço R SAO ROMAO 5 (...), capital social de R$ 20.000,00 (Vinte mil reais), faturamento informado R$ 310.920,00/ano.\n\nSócios e beneficiários finais\n50% - MARLON WILTON ROCHA NERIS, comerciante, data de nascimento 11/12/1983, carteira de identidade (RG) nº 0537971220147 expedida por SESP-MA em 02/09/2014 e CPF nº 003.223.301-90, residente e domiciliado (...), renda informada R$ 4.096,26/mês."

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
IMPORTANTE — LIMITE DE TAMANHO: o dossiê deve ser fiel aos documentos, porém conciso (sem repetições, no máximo 250 palavras). Liste no máximo 6 beneficiários (priorize as maiores participações). Respostas longas serão cortadas e invalidarão a análise.
```

### 3.3 Prompt Análise Reputacional (Opcional)

```
Você é um analista de due diligence reputacional de uma instituição financeira brasileira. Sua tarefa: pesquisar na web notícias e menções recentes da empresa e das pessoas identificadas nos documentos anexados.

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
IMPORTANTE — LIMITE DE TAMANHO: no máximo 4 achados por bloco (priorize os mais recentes). "resumo" com no máximo 20 palavras. Respostas longas serão cortadas e invalidarão a análise.
```

---

## 4. FORMATO DE SAÍDA

### 4.1 Estrutura Principal de Resposta

```json
{
  "status": "processamento_sucesso" | "processamento_erro",
  "dataAnalise": string (ISO 8601),
  "empresa": string,
  "perfil": "comercial" | "compliance",
  "veredicto": {
    "resultado": "APTO" | "NÃO APTO" | "EM ANÁLISE",
    "justificativa": string,
    "atencoesEncontradas": number,
    "itensConferidos": number
  },
  "analiseCadastral": {
    "empresa": string,
    "inconsistencias": [
      {
        "documento": string,
        "campo": string,
        "descricao": string,
        "gravidade": "atencao" | "ok",
        "acao": string
      }
    ]
  },
  "analisCompliance": null | {
    "empresa": string,
    "dossie": string,
    "beneficiarios": [
      {
        "documento": string,
        "nome": string,
        "cpf_cnpj": string,
        "participacao": string,
        "beneficiario_final": "sim" | "nao",
        "gravidade": "atencao" | "ok",
        "recomendacao": string
      }
    ]
  },
  "analiseReputacional": null | {
    "empresa": string,
    "empresa_sintese": string,
    "socios_sintese": string,
    "empresa_achados": [
      {
        "nome": string,
        "tipo": "direta" | "contextual" | "indireta",
        "resumo": string,
        "data": string,
        "periodo": string,
        "fonte": string,
        "gravidade": "atencao" | "ok"
      }
    ],
    "socios_achados": [
      {
        "nome": string,
        "tipo": "direta" | "contextual" | "indireta",
        "resumo": string,
        "data": string,
        "periodo": string,
        "fonte": string,
        "gravidade": "atencao" | "ok"
      }
    ]
  },
  "erros": null | [
    {
      "codigo": string,
      "mensagem": string,
      "campo": string (opcional)
    }
  ]
}
```

### 4.2 Exemplo de Resposta Completa (Comercial, APTO)

```json
{
  "status": "processamento_sucesso",
  "dataAnalise": "2026-08-07T15:30:45Z",
  "empresa": "LOGÍSTICA EXPRESS BRASIL LTDA",
  "perfil": "comercial",
  "veredicto": {
    "resultado": "APTO",
    "justificativa": "Documentação cadastral completa, sem atenções. 12 itens conferidos sem divergência.",
    "atencoesEncontradas": 0,
    "itensConferidos": 12
  },
  "analiseCadastral": {
    "empresa": "LOGÍSTICA EXPRESS BRASIL LTDA",
    "inconsistencias": [
      {
        "documento": "Cartão CNPJ/QSA",
        "campo": "Razão social",
        "descricao": "Razão social conferida e correspondente ao contrato social.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Contrato social",
        "campo": "Documento obrigatório",
        "descricao": "Contrato social registrado junto à junta comercial, presente e legível.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Ficha cadastral",
        "campo": "Campos obrigatórios",
        "descricao": "Todos os campos obrigatórios preenchidos: razão social, CNPJ, endereço, telefone, email.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Cartão CNPJ/QSA + Contrato social",
        "campo": "Razão social",
        "descricao": "Correspondência confirmada entre cartão CNPJ e contrato social.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Cartão CNPJ/QSA + Contrato social",
        "campo": "Endereço",
        "descricao": "Endereço normalizado e correspondente entre documentos.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Contrato social",
        "campo": "Forma de representação",
        "descricao": "Forma de representação indicada: administrador/sócio-gerente com poder individual.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Contrato social",
        "campo": "Quadro societário",
        "descricao": "Dois sócios identificados: João Silva (60%), Maria Santos (40%), ambos com qualificação presente.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Contrato social",
        "campo": "CNAE",
        "descricao": "CNAE 4921-800 (Serviços de transporte rodoviário) presente e validado.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Contrato social",
        "campo": "Capital social",
        "descricao": "Capital social de R$ 50.000,00 (cinquenta mil reais) registrado.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Ficha cadastral",
        "campo": "Telefone e email",
        "descricao": "Contatos preenchidos e válidos.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Contrato social",
        "campo": "Data de constituição",
        "descricao": "Constituída em 15/03/2015, com registro confirmado na junta comercial.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Documentação geral",
        "campo": "Integridade documental",
        "descricao": "Todos os documentos legíveis, com páginas completas e selos de autenticidade.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      }
    ]
  },
  "analisCompliance": null,
  "analiseReputacional": null,
  "erros": null
}
```

### 4.3 Exemplo de Resposta Completa (Compliance, NÃO APTO)

```json
{
  "status": "processamento_sucesso",
  "dataAnalise": "2026-08-07T16:15:20Z",
  "empresa": "COMERCIAL AMAZÔNIA DE PETRÓLEO LTDA",
  "perfil": "compliance",
  "veredicto": {
    "resultado": "NÃO APTO",
    "justificativa": "Documento obrigatório (ata de eleição) ausente. Quadro de beneficiários finais incompleto: sócia PJ sem documentação de cadeia societária. 3 atenções encontradas.",
    "atencoesEncontradas": 3,
    "itensConferidos": 8
  },
  "analiseCadastral": {
    "empresa": "COMERCIAL AMAZÔNIA DE PETRÓLEO LTDA",
    "inconsistencias": [
      {
        "documento": "Cartão CNPJ/QSA",
        "campo": "Razão social",
        "descricao": "Razão social conferida e correspondente ao estatuto social.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Estatuto social",
        "campo": "Documento obrigatório",
        "descricao": "Estatuto social presente, registrado e legível, contém razão social, CNAE, forma de representação.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Ata de eleição",
        "campo": "Documento obrigatório ausente",
        "descricao": "Ata de eleição de diretores/administradores em exercício não foi anexada. Impossível validar administradores em exercício.",
        "gravidade": "atencao",
        "acao": "Solicitar ata de eleição mais recente assinada e registrada junto à junta comercial."
      },
      {
        "documento": "Ficha cadastral",
        "campo": "Campos obrigatórios",
        "descricao": "Campos obrigatórios preenchidos: razão social, CNPJ, endereço, atividade principal.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Cartão CNPJ/QSA + Estatuto",
        "campo": "Endereço",
        "descricao": "Endereço correspondente entre cartão CNPJ e estatuto social.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Estatuto social",
        "campo": "CNAE",
        "descricao": "CNAE 4611-101 (Comércio a varejo de combustíveis para veículos automotores) validado.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Estatuto social + Cartão CNPJ",
        "campo": "Capital social",
        "descricao": "Capital social de R$ 150.000,00 (cento e cinquenta mil reais) correspondente entre documentos.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Documentação geral",
        "campo": "Integridade documental",
        "descricao": "Documentos legíveis, páginas completas, selos de autenticidade presentes.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      }
    ]
  },
  "analisCompliance": {
    "empresa": "COMERCIAL AMAZÔNIA DE PETRÓLEO LTDA",
    "dossie": "COMERCIAL AMAZÔNIA DE PETRÓLEO LTDA, CNPJ 35.043.217/0001-63, empresa constituída em 01/10/2019, sob atividades sociais de comércio a varejo de combustíveis para veículos automotores, endereço Rodovia BR-174, km 65, Manaus-AM, capital social de R$ 150.000,00 (cento e cinquenta mil reais).\n\nSócios e beneficiários finais\n50% - Marajo Empreendimentos Ltda, CNPJ 23.869.533/0001-00\n50% - João Carlos Rocha Silva, empresário, data de nascimento 12/05/1978, carteira de identidade (RG) nº 0845123456 expedida por SESP-AM em 15/03/2015 e CPF nº 123.456.789-00, residente e domiciliado em Manaus-AM, renda informada R$ 8.500,00/mês.",
    "beneficiarios": [
      {
        "documento": "Contrato social",
        "nome": "Marajo Empreendimentos Ltda",
        "cpf_cnpj": "23.869.533/0001-00",
        "participacao": "50%",
        "beneficiario_final": "nao",
        "gravidade": "atencao",
        "recomendacao": "Sócia PJ. Cadeia até pessoa natural não identificável com documentos presentes. Solicitar documento da empresa, para identificar beneficiário final."
      },
      {
        "documento": "Contrato social",
        "nome": "João Carlos Rocha Silva",
        "cpf_cnpj": "123.456.789-00",
        "participacao": "50%",
        "beneficiario_final": "sim",
        "gravidade": "ok",
        "recomendacao": "Beneficiário final identificado, pessoa natural com 50% de participação."
      }
    ]
  },
  "analiseReputacional": {
    "empresa": "COMERCIAL AMAZÔNIA DE PETRÓLEO LTDA",
    "empresa_sintese": "COMERCIAL AMAZÔNIA DE PETRÓLEO LTDA foi citada nominalmente em matéria jornalística da TOTVS em junho/2026 no contexto de parceria empresarial para adoção de soluções de Recursos Humanos.",
    "socios_sintese": "Não foram localizadas notícias com citação nominal direta ou contextual.",
    "empresa_achados": [
      {
        "nome": "COMERCIAL AMAZÔNIA DE PETRÓLEO LTDA",
        "tipo": "contextual",
        "resumo": "Parceria com TOTVS para otimizar gestão de colaboradores em rede de postos.",
        "data": "2026-06-15",
        "periodo": "últimos 30 dias",
        "fonte": "TOTVS | https://www.totvs.com/...",
        "gravidade": "ok"
      }
    ],
    "socios_achados": []
  },
  "erros": null
}
```

---

## 5. REGRAS DE DECISÃO

### 5.1 Critérios de Veredicto

| Condição | Resultado | Ação |
|----------|-----------|------|
| `inconsistencias.length > 0 AND atencoes === 0` | **APTO** | Cadastro aprovado, pode prosseguir |
| `inconsistencias.length > 0 AND atencoes > 0` | **NÃO APTO** | Devolver ao cliente; solicitar documentação faltante ou correção |
| `inconsistencias.length === 0` | **EM ANÁLISE** | Análise incompleta; requerer documentação mínima |
| `analisCompliance.beneficiarios` com `gravidade: "atencao"` | **NÃO APTO** (Compliance) | Cadeia societária pendente; abrir investigação de UBO |

### 5.2 Lógica de Contagem

```javascript
// Cálculo de atenções
const atencoes = inconsistencias
  .filter(i => i.gravidade === "atencao").length
  + (beneficiarios ? beneficiarios.filter(b => b.gravidade === "atencao").length : 0)
  + (reputacional ? [...reputacional.empresa_achados, ...reputacional.socios_achados]
    .filter(r => r.gravidade === "atencao").length : 0);

// Cálculo de itens conferidos (OK)
const conferidos = inconsistencias
  .filter(i => i.gravidade === "ok").length
  + (beneficiarios ? beneficiarios.filter(b => b.gravidade === "ok").length : 0)
  + (reputacional ? [...reputacional.empresa_achados, ...reputacional.socios_achados]
    .filter(r => r.gravidade === "ok").length : 0);

// Veredicto
const apto = inconsistencias.length > 0 && atencoes === 0;
```

### 5.3 Critérios por Tipo de Atenção

| Tipo | Exemplos | Ação | Bloqueia Cadastro? |
|------|----------|------|-------|
| **Documento obrigatório ausente** | Kit cadastral incompleto, ata de eleição ausente | Solicitar envio | **SIM** |
| **Problema de integridade** | Documento ilegível, páginas faltando, sem registro | Solicitar nova via | **SIM** |
| **Informação ausente** | Campo obrigatório em branco na ficha | Solicitar preenchimento | **SIM** |
| **Divergência confirmada** | CNPJ na ficha ≠ CNPJ do contrato (após normalização) | Esclarecer discrepância | **SIM** |
| **PJ com ≥25% sem cadeia** | Sócia jurídica, documentação da empresa não anexada | Solicitar CNPJ da PJ e sua composição | **SIM** |
| **Menção reputacional recente adversa** | Notícia de sanção, processo, crime nos últimos 30 dias | Investigação manual | **SIM** |

---

## 6. FONTES E INTEGRAÇÕES EXTERNAS

### 6.1 Fontes Consultadas

#### Análise Cadastral
- **Documentos anexados:** ficha cadastral, cartão CNPJ/QSA, contrato social, estatuto, ata de eleição
- **Sem acesso a APIs externas** — análise é 100% baseada em documentos fornecidos

#### Análise Compliance (Dossiê + Beneficiários)
- **Documentos anexados:** contrato social, estatuto, ata de eleição, ficha cadastral, RG/CPF de sócios
- **Sem acesso a APIs externas** — análise é 100% baseada em documentos fornecidos
- **Referência regulatória:** Circular BCB nº 3.978/2020 (definição de UBO e beneficiário final)

#### Análise Reputacional
- **Busca na web:** web search v20250305 (Claude web search tool)
- **Fontes validadas:** mídia nacional/regional, atos regulatórios, diários oficiais, comunicados públicos
- **Sem acesso a APIs de:** PEP (Banco Central), OFAC, CSNU, listas restritivas, tribunais, SERASA
- **Nota:** menções públicas a essas listas são capturadas via notícia, mas verificação oficial deve ser feita em sistemas internos

### 6.2 Integração com Sistemas Internos Esperados (Responsabilidade da Plataforma Maior)

Após a análise do validador, a plataforma deve executar internamente:

1. **Verificação em bases PEP:**
   - Banco Central do Brasil (PEP Nacional)
   - OFAC (Office of Foreign Assets Control)
   - CSNU (Conselho de Segurança das Nações Unidas)
   - EU Consolidated List
   - Listas de sanções bilaterais

2. **Verificação em base de processos judiciais:**
   - Consulta de ações civis e criminais em tribunais (CNJ, TJSP, TJ-UF)
   - Match exato de nome + CPF/CNPJ para confirmação

3. **Verificação cadastral complementar:**
   - Receita Federal (validação de CNPJ ativo, enquadramento)
   - Junta Comercial (confirmação de data de constituição, registros, cancelamentos)

4. **Consultas de risco transacional (opcional):**
   - COAF (Conselho de Controle de Atividades Financeiras) — se houver suspeita de movimentação anômala
   - SERASA/SPC — se houver análise de capacidade de pagamento

### 6.3 Exemplo de Fluxo Pós-Validador

```
[Validador entrega resposta JSON] 
    ↓
[Plataforma avalia veredicto]
    ├─ Se "APTO" → [Dispara verificações em PEP, OFAC, CSNU]
    ├─ Se "NÃO APTO" → [Notifica cliente, solicita documentação corrigida]
    └─ Se "EM ANÁLISE" → [Requer documentação mínima obrigatória]
    ↓
[Resultado das verificações externas é CONSOLIDADO com análise do validador]
    ↓
[Decisão final: APROVADO / REJEITADO / ANÁLISE MANUAL]
```

---

## 7. EXEMPLOS COMPLETOS (ENTRADA → SAÍDA)

### 7.1 Exemplo 1: Perfil Comercial, Documentação Completa, APTO

#### ENTRADA

```json
{
  "perfil": "comercial",
  "incluirReputacional": false,
  "documentos": [
    {
      "id": "doc-001",
      "arquivo": {
        "nome": "cartao_cnpj_29823456.pdf",
        "tipo": "application/pdf",
        "tamanho": 125000,
        "dataUpload": "2026-08-07T10:00:00Z"
      },
      "categoriaDocumento": "Cartão CNPJ/QSA",
      "base64": "[base64 do PDF do cartão CNPJ]"
    },
    {
      "id": "doc-002",
      "arquivo": {
        "nome": "contrato_social_assinado.pdf",
        "tipo": "application/pdf",
        "tamanho": 256000,
        "dataUpload": "2026-08-07T10:05:00Z"
      },
      "categoriaDocumento": "Contrato social",
      "base64": "[base64 do PDF do contrato social]"
    },
    {
      "id": "doc-003",
      "arquivo": {
        "nome": "ficha_cadastral_preenchida.pdf",
        "tipo": "application/pdf",
        "tamanho": 89000,
        "dataUpload": "2026-08-07T10:10:00Z"
      },
      "categoriaDocumento": "Ficha cadastral",
      "base64": "[base64 do PDF da ficha cadastral]"
    }
  ],
  "metadados": {
    "usuarioId": "usr-45821",
    "empresaId": "emp-78934",
    "dataAnalise": "2026-08-07T10:15:00Z",
    "origem": "plataforma-web"
  }
}
```

#### SAÍDA

```json
{
  "status": "processamento_sucesso",
  "dataAnalise": "2026-08-07T10:16:30Z",
  "empresa": "MECÂNICA SILVA & ASSOCIADOS LTDA",
  "perfil": "comercial",
  "veredicto": {
    "resultado": "APTO",
    "justificativa": "Documentação cadastral completa e consistente. 0 atenções. 10 itens verificados sem divergência.",
    "atencoesEncontradas": 0,
    "itensConferidos": 10
  },
  "analiseCadastral": {
    "empresa": "MECÂNICA SILVA & ASSOCIADOS LTDA",
    "inconsistencias": [
      {
        "documento": "Cartão CNPJ/QSA",
        "campo": "Razão social",
        "descricao": "Razão social conferida e correspondente ao contrato social registrado.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Contrato social",
        "campo": "Documento obrigatório",
        "descricao": "Contrato social completo, assinado e registrado na junta comercial (JUCESP).",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Ficha cadastral",
        "campo": "Campos obrigatórios",
        "descricao": "Todos os campos obrigatórios preenchidos: razão social, CNPJ, endereço, telefone, email, atividade principal.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Cartão CNPJ + Contrato social",
        "campo": "Razão social e CNPJ",
        "descricao": "Correspondência exata confirmada entre cartão CNPJ e contrato social.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Cartão CNPJ + Contrato + Ficha",
        "campo": "Endereço",
        "descricao": "Endereço normalizado (R. Paulista, 1500, apt. 202 → RUA PAULISTA 1500 AP 202) e correspondente entre todos os documentos.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Contrato social",
        "campo": "Forma de representação",
        "descricao": "Administrador único com poder individual identificado: Carlos Alberto da Silva.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Contrato social",
        "campo": "Quadro societário",
        "descricao": "Dois sócios identificados: Carlos Alberto da Silva (70%), Patricia Oliveira Silva (30%), ambos com CPF e qualificação.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Contrato social",
        "campo": "CNAE e atividade",
        "descricao": "CNAE 4511-803 (Comércio a varejo de peças e acessórios novos para veículos automotores) validado.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Contrato social",
        "campo": "Capital social",
        "descricao": "Capital social de R$ 80.000,00 (oitenta mil reais) integralizado, conforme termo de integralização.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Documentação geral",
        "campo": "Integridade e legibilidade",
        "descricao": "Todos os documentos legíveis, páginas completas, selos de registro da junta comercial presentes e validados.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      }
    ]
  },
  "analisCompliance": null,
  "analiseReputacional": null,
  "erros": null
}
```

---

### 7.2 Exemplo 2: Perfil Compliance, Com Reputacional, NÃO APTO

#### ENTRADA

```json
{
  "perfil": "compliance",
  "incluirReputacional": true,
  "documentos": [
    {
      "id": "doc-001",
      "arquivo": {
        "nome": "cartao_cnpj.pdf",
        "tipo": "application/pdf",
        "tamanho": 145000,
        "dataUpload": "2026-08-07T14:00:00Z"
      },
      "categoriaDocumento": "Cartão CNPJ/QSA",
      "base64": "[base64]"
    },
    {
      "id": "doc-002",
      "arquivo": {
        "nome": "estatuto_social.pdf",
        "tipo": "application/pdf",
        "tamanho": 356000,
        "dataUpload": "2026-08-07T14:05:00Z"
      },
      "categoriaDocumento": "Estatuto social",
      "base64": "[base64]"
    },
    {
      "id": "doc-003",
      "arquivo": {
        "nome": "ficha_cadastral.pdf",
        "tipo": "application/pdf",
        "tamanho": 98000,
        "dataUpload": "2026-08-07T14:10:00Z"
      },
      "categoriaDocumento": "Ficha cadastral",
      "base64": "[base64]"
    }
  ],
  "metadados": {
    "usuarioId": "usr-92847",
    "empresaId": "emp-34521",
    "dataAnalise": "2026-08-07T14:15:00Z",
    "origem": "api-direta"
  }
}
```

#### SAÍDA

```json
{
  "status": "processamento_sucesso",
  "dataAnalise": "2026-08-07T14:18:45Z",
  "empresa": "DISTRIBUIDORA NORDESTE COMÉRCIO S.A.",
  "perfil": "compliance",
  "veredicto": {
    "resultado": "NÃO APTO",
    "justificativa": "Ata de eleição (documento obrigatório) ausente. Beneficiários finais: 1 PJ sem documentação de cadeia societária. 2 atenções cadastrais, 1 atenção reputacional. Total 3 atenções.",
    "atencoesEncontradas": 3,
    "itensConferidos": 7
  },
  "analiseCadastral": {
    "empresa": "DISTRIBUIDORA NORDESTE COMÉRCIO S.A.",
    "inconsistencias": [
      {
        "documento": "Cartão CNPJ/QSA",
        "campo": "Razão social",
        "descricao": "Razão social conferida e correspondente ao estatuto social.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Estatuto social",
        "campo": "Documento obrigatório",
        "descricao": "Estatuto social presente, registrado na junta, contém razão social, endereço, forma de representação.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Ata de eleição",
        "campo": "Documento obrigatório ausente",
        "descricao": "Ata de eleição de diretores/administradores em exercício não foi anexada. Impossível identificar administradores atuais.",
        "gravidade": "atencao",
        "acao": "Solicitar ata de eleição mais recente, assinada e registrada em junta comercial."
      },
      {
        "documento": "Ficha cadastral",
        "campo": "Campos obrigatórios",
        "descricao": "Campos obrigatórios preenchidos: razão social, CNPJ, endereço, atividade principal, contatos.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Cartão CNPJ + Estatuto + Ficha",
        "campo": "Razão social",
        "descricao": "Correspondência entre documentos: DISTRIBUIDORA NORDESTE COMÉRCIO S.A. consistente.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Estatuto social",
        "campo": "CNAE",
        "descricao": "CNAE 4639-403 (Comércio a varejo de combustíveis para veículos automotores) validado.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Cartão CNPJ + Estatuto",
        "campo": "Endereço",
        "descricao": "Endereço normalizado e correspondente: Av. Getúlio Vargas, 2500, Fortaleza-CE, CEP 60050-161.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Estatuto social",
        "campo": "Capital social",
        "descricao": "Capital social de R$ 500.000,00 (quinhentos mil reais) integralizado conforme estatuto.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Documentação geral",
        "campo": "Integridade e registro",
        "descricao": "Documentos legíveis, páginas completas, selos de junta comercial presentes e validados.",
        "gravidade": "ok",
        "acao": "Nenhuma"
      },
      {
        "documento": "Cartão CNPJ/QSA",
        "campo": "Composição societária",
        "descricao": "Quadro societário com 2 sócias: NEXUS INVESTIMENTOS LTDA (60%) e Maria de Fátima Costa (40%).",
        "gravidade": "atencao",
        "acao": "Verificação de cadeia societária da PJ pendente (vide seção Beneficiários Finais)."
      }
    ]
  },
  "analisCompliance": {
    "empresa": "DISTRIBUIDORA NORDESTE COMÉRCIO S.A.",
    "dossie": "DISTRIBUIDORA NORDESTE COMÉRCIO S.A., CNPJ 12.345.678/0001-90, empresa constituída em 10/05/2010, sob atividades sociais de comércio a varejo de combustíveis para veículos automotores, endereço Avenida Getúlio Vargas, 2500, Fortaleza-CE, capital social de R$ 500.000,00 (quinhentos mil reais).\n\nSócios e beneficiários finais\n60% - Nexus Investimentos Ltda, CNPJ 98.765.432/0001-55\n40% - Maria de Fátima Costa, empresária, data de nascimento 22/08/1965, carteira de identidade (RG) nº 1234567 expedida por SSPDC-CE em 30/06/2010 e CPF nº 456.789.123-00, residente e domiciliada em Fortaleza-CE, na avenida Getúlio Vargas, 2500, apt. 1205, CEP 60050-161, renda informada R$ 6.500,00/mês.",
    "beneficiarios": [
      {
        "documento": "Cartão CNPJ/QSA",
        "nome": "Nexus Investimentos Ltda",
        "cpf_cnpj": "98.765.432/0001-55",
        "participacao": "60%",
        "beneficiario_final": "nao",
        "gravidade": "atencao",
        "recomendacao": "Sócia PJ. Cadeia até pessoa natural não identificável com documentos presentes. Solicitar documento da empresa, para identificar beneficiário final."
      },
      {
        "documento": "Cartão CNPJ/QSA",
        "nome": "Maria de Fátima Costa",
        "cpf_cnpj": "456.789.123-00",
        "participacao": "40%",
        "beneficiario_final": "sim",
        "gravidade": "ok",
        "recomendacao": "Beneficiário final identificado, pessoa natural com 40% de participação."
      }
    ]
  },
  "analiseReputacional": {
    "empresa": "DISTRIBUIDORA NORDESTE COMÉRCIO S.A.",
    "empresa_sintese": "DISTRIBUIDORA NORDESTE COMÉRCIO S.A. foi citada nominalmente em matéria do portal Ceará Notícias em maio/2026 no contexto adverso de investigação de irregularidades fiscais. A empresa aparece como alvo de operação da Receita Federal.",
    "socios_sintese": "Maria de Fátima Costa foi citada nominalmente em matéria do portal Regional Negócios em julho/2026 no contexto de sua atuação como sócia e responsável financeiro em empresa envolvida em processo administrativo de regularização fiscal.",
    "empresa_achados": [
      {
        "nome": "DISTRIBUIDORA NORDESTE COMÉRCIO S.A.",
        "tipo": "contextual",
        "resumo": "Alvo de operação da Receita Federal para verificação de irregularidades em escrituração fiscal de 2023-2024.",
        "data": "2026-05-12",
        "periodo": "até 6 meses",
        "fonte": "Ceará Notícias | https://ceara.noticia.com.br/...",
        "gravidade": "atencao"
      }
    ],
    "socios_achados": [
      {
        "nome": "Maria de Fátima Costa",
        "tipo": "contextual",
        "resumo": "Sócia e responsável financeiro, citada em contexto de processo administrativo de regularização fiscal na empresa.",
        "data": "2026-07-08",
        "periodo": "últimos 30 dias",
        "fonte": "Regional Negócios | https://regional.negocio.com.br/...",
        "gravidade": "atencao"
      }
    ]
  },
  "erros": null
}
```

---

## 8. TRATAMENTO DE ERROS

### 8.1 Códigos de Erro Possíveis

```json
{
  "erros": [
    {
      "codigo": "DOC_INVÁLIDO",
      "mensagem": "Arquivo base64 inválido ou corrompido",
      "campo": "documentos[0].base64"
    },
    {
      "codigo": "PERFIL_INVÁLIDO",
      "mensagem": "Perfil deve ser 'comercial' ou 'compliance'",
      "campo": "perfil"
    },
    {
      "codigo": "DOCUMENTOS_VAZIOS",
      "mensagem": "Nenhum documento foi anexado",
      "campo": "documentos"
    },
    {
      "codigo": "TAMANHO_MÁXIMO_EXCEDIDO",
      "mensagem": "Arquivo excede 10MB",
      "campo": "documentos[2]"
    },
    {
      "codigo": "ANÁLISE_TIMEOUT",
      "mensagem": "Análise expirou (> 60s). Tente novamente.",
      "campo": "geral"
    },
    {
      "codigo": "API_INDISPONÍVEL",
      "mensagem": "Serviço de análise indisponível temporariamente",
      "campo": "geral"
    }
  ]
}
```

---

## 9. NOTAS DE IMPLEMENTAÇÃO

1. **Modelagem de API:** integre as três chamadas em paralelo (cadastral, compliance, reputacional) usando `Promise.all()` ou equivalente.

2. **Codificação de documentos:** sempre valide base64 antes de enviar à Claude API; descarte arquivos corrompidos.

3. **Timeout:** defina timeout de 60 segundos por chamada. Se houver timeout, retorne resultado parcial com indicação de seção não concluída.

4. **Reputacional opcional:** a busca na web é lenta (20-30s); considere ativar apenas por padrão se a empresa atingir threshold de risco alto (ex.: se houver atenções cadastrais).

5. **Normalização de entrada:** antes de enviar à Claude, normalize:
   - Nomes de empresas: uppercase trimmed
   - CPF/CNPJ: apenas dígitos (sem pontos/barras)
   - Endereços: trimmed, múltiplos espaços reduzidos a um

6. **Armazenamento:** guarde as respostas completas (JSON) para auditoria de 2 anos.

---

**Fim do Documento de Handoff — Versão 1.0**

