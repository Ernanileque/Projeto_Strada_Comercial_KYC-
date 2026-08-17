"use server";

import { createAdminClient } from "@/lib/supabase/admin";

type ResultadoEnvio = { erro: string } | { sucesso: true };

async function enviarDocumento(
  admin: ReturnType<typeof createAdminClient>,
  credenciamentoId: string,
  tipo: string,
  arquivo: File,
) {
  const caminho = `${credenciamentoId}/${tipo}-${Date.now()}-${arquivo.name}`;
  const { error: erroUpload } = await admin.storage
    .from("documentos")
    .upload(caminho, arquivo);

  if (erroUpload) {
    throw new Error(`Falha ao enviar ${tipo}: ${erroUpload.message}`);
  }

  const { error: erroInsert } = await admin.from("documento").insert({
    credenciamento_id: credenciamentoId,
    tipo,
    arquivo_url: caminho,
  });

  if (erroInsert) {
    throw new Error(erroInsert.message);
  }
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
    const contratoSocial = formData.get("contrato_social") as File | null;
    const cartaoCnpj = formData.get("cartao_cnpj_qsa") as File | null;
    const rgCnh = formData.get("rg_cnh_representante") as File | null;
    const comprovanteBancario = formData.get("comprovante_bancario") as File | null;
    const comprovanteEndereco = formData.get("comprovante_endereco") as File | null;

    if (!contratoSocial?.size || !cartaoCnpj?.size || !rgCnh?.size) {
      return { erro: "Contrato social, cartão CNPJ/QSA e RG/CNH são obrigatórios." };
    }

    await enviarDocumento(admin, credenciamentoId, "contrato_social", contratoSocial);
    await enviarDocumento(admin, credenciamentoId, "cartao_cnpj_qsa", cartaoCnpj);
    await enviarDocumento(admin, credenciamentoId, "rg_cnh_representante", rgCnh);

    if (comprovanteBancario?.size) {
      await enviarDocumento(admin, credenciamentoId, "comprovante_bancario", comprovanteBancario);
    }
    if (comprovanteEndereco?.size) {
      await enviarDocumento(admin, credenciamentoId, "comprovante_endereco", comprovanteEndereco);
    }

    const nomes = formData.getAll("socio_nome").map(String);
    const cpfs = formData.getAll("socio_cpf").map(String);
    const participacoes = formData.getAll("socio_participacao").map(String);
    const peps = formData.getAll("socio_pep").map(String);
    const emails = formData.getAll("socio_email").map(String);

    const socios = nomes
      .map((nome, i) => ({
        credenciamento_id: credenciamentoId,
        nome,
        cpf: cpfs[i] || null,
        participacao: participacoes[i] ? Number(participacoes[i]) : null,
        pep_flag: peps[i] === "on",
        email: emails[i] || null,
      }))
      .filter((s) => s.nome.trim().length > 0);

    if (!socios.length) {
      return { erro: "Informe ao menos um sócio/representante assinante." };
    }

    const { error: erroSocios } = await admin.from("socio").insert(socios);
    if (erroSocios) throw new Error(erroSocios.message);

    const testemunhaNome = String(formData.get("testemunha_nome") ?? "").trim();
    const testemunhaCpf = String(formData.get("testemunha_cpf") ?? "").trim();
    const testemunhaEmail = String(formData.get("testemunha_email") ?? "").trim();

    if (!testemunhaNome || !testemunhaEmail) {
      return { erro: "Informe nome e e-mail da testemunha." };
    }

    const { error: erroTestemunha } = await admin.from("testemunha").insert({
      credenciamento_id: credenciamentoId,
      nome: testemunhaNome,
      cpf: testemunhaCpf || null,
      email: testemunhaEmail,
    });
    if (erroTestemunha) throw new Error(erroTestemunha.message);

    const dadosJson = {
      faturamento_mensal: formData.get("faturamento_mensal"),
      renda_representante: formData.get("renda_representante"),
      pep_representante: formData.get("pep_representante") === "on",
      email_contato: formData.get("email_contato"),
    };

    const { error: erroFicha } = await admin.from("ficha_kyc").insert({
      credenciamento_id: credenciamentoId,
      dados_json: dadosJson,
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
