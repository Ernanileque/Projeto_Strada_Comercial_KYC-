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

interface DadosFichaEnviados {
  assinantes?: AssinanteEnviado[];
  socios?: SocioEnviado[];
  testemunha?: TestemunhaEnviada;
  [chave: string]: unknown;
}

const MAPA_TIPO_DOCUMENTO: Record<string, string> = {
  contrato: "contrato_social",
  cartaoCnpj: "cartao_cnpj_qsa",
  qsa: "cartao_cnpj_qsa",
  sintegra: "outro",
  cnh: "rg_cnh_representante",
  procuracao: "outro",
  proposta: "outro",
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

  if (credenciamento.status !== "AGUARDANDO_CLIENTE") {
    return { erro: "Este link já foi utilizado ou não está mais disponível." };
  }

  if (credenciamento.expira_em && new Date(credenciamento.expira_em) < new Date()) {
    return { erro: "Este link expirou. Peça ao seu contato comercial um novo link." };
  }

  const credenciamentoId = credenciamento.id;

  try {
    const dados: DadosFichaEnviados = JSON.parse(String(formData.get("dados_json") ?? "{}"));

    const arquivos = formData.getAll("arquivo") as File[];
    const tipos = formData.getAll("arquivo_tipo").map(String);
    const arquivosValidos = arquivos.filter((a) => a instanceof File && a.size > 0);

    if (!arquivosValidos.length) {
      return { erro: "Anexe ao menos o contrato social e o cartão CNPJ/QSA." };
    }

    for (let i = 0; i < arquivos.length; i++) {
      const arquivo = arquivos[i];
      if (!(arquivo instanceof File) || !arquivo.size) continue;

      const tipoDetectado = tipos[i] || "outro";
      const tipoDocumento = MAPA_TIPO_DOCUMENTO[tipoDetectado] ?? "outro";
      const caminho = `${credenciamentoId}/${tipoDocumento}-${Date.now()}-${arquivo.name}`;

      const { error: erroUpload } = await admin.storage.from("documentos").upload(caminho, arquivo);
      if (erroUpload) {
        throw new Error(`Falha ao enviar ${arquivo.name}: ${erroUpload.message}`);
      }

      const { error: erroInsert } = await admin.from("documento").insert({
        credenciamento_id: credenciamentoId,
        tipo: tipoDocumento,
        arquivo_url: caminho,
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
      .update({ status: "EM_ANALISE" })
      .eq("id", credenciamentoId);
    if (erroStatus) throw new Error(erroStatus.message);

    return { sucesso: true };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao enviar a documentação." };
  }
}
