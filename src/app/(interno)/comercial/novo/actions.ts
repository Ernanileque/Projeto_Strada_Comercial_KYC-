"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gerarPropostaDocx, type DadosProposta } from "@/lib/comercial/proposta";
import { enviarPropostaPorEmail } from "@/lib/email/resend";

function campo(formData: FormData, nome: string): string {
  return String(formData.get(nome) ?? "").trim();
}

export async function criarCredenciamento(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const razaoSocial = campo(formData, "razao_social");
  const cnpj = campo(formData, "cnpj");
  const contatoNome = campo(formData, "contato_nome");
  const contatoEmail = campo(formData, "contato_email");
  const contatoFone = campo(formData, "contato_fone");
  const produto = campo(formData, "produto") || "STRADA_PAY";
  const vtf = campo(formData, "vtf");

  const condicoesComerciais = {
    vtf: vtf || null,
    pay:
      produto === "STRADA_PAY" || produto === "AMBOS"
        ? {
            taxaFrete: campo(formData, "pay_taxa_frete"),
            semParar: campo(formData, "pay_sem_parar"),
            moveMais: campo(formData, "pay_move_mais"),
            taggyStrada: campo(formData, "pay_taggy_strada"),
          }
        : null,
    log:
      produto === "STRADA_LOG" || produto === "AMBOS"
        ? {
            gestaoPerformance: campo(formData, "log_gestao_performance"),
            matchCargas: campo(formData, "log_match_cargas"),
            trocaNota: campo(formData, "log_troca_nota"),
            gerenciamentoRisco: campo(formData, "log_gerenciamento_risco"),
            portariaTracking: campo(formData, "log_portaria_tracking"),
            bid: campo(formData, "log_bid"),
          }
        : null,
  };

  const { data: cliente, error: erroCliente } = await supabase
    .from("cliente")
    .insert({
      razao_social: razaoSocial,
      cnpj,
      contato_nome: contatoNome || null,
      contato_email: contatoEmail || null,
      contato_fone: contatoFone || null,
    })
    .select("id")
    .single();

  if (erroCliente || !cliente) {
    throw new Error(erroCliente?.message ?? "Erro ao criar cliente.");
  }

  const expiraEm = new Date();
  expiraEm.setDate(expiraEm.getDate() + 30);

  const { data: credenciamento, error: erroCredenciamento } = await supabase
    .from("credenciamento")
    .insert({
      cliente_id: cliente.id,
      status: "AGUARDANDO_CLIENTE",
      criado_por: user.id,
      expira_em: expiraEm.toISOString(),
      produto,
      condicoes_comerciais: condicoesComerciais as never,
    })
    .select("id, token")
    .single();

  if (erroCredenciamento || !credenciamento) {
    throw new Error(erroCredenciamento?.message ?? "Erro ao criar credenciamento.");
  }

  // Geração e envio da proposta não devem impedir a abertura do
  // credenciamento — se falhar (ex.: e-mail não configurado ainda), o
  // Comercial ainda consegue copiar o link manualmente na listagem.
  let propostaFalhou = false;
  if (contatoEmail) {
    try {
      const validade = new Date();
      validade.setDate(validade.getDate() + 30);

      const dadosProposta: DadosProposta = {
        validade: validade.toLocaleDateString("pt-BR"),
        vtf: vtf || undefined,
        localData: `São Paulo, ${new Date().toLocaleDateString("pt-BR")}.`,
        pay: condicoesComerciais.pay ?? undefined,
        log: condicoesComerciais.log ?? undefined,
      };

      const propostaBuffer = await gerarPropostaDocx(dadosProposta);

      const admin = createAdminClient();
      const caminho = `${credenciamento.id}/proposta-comercial.docx`;
      const { error: erroUpload } = await admin.storage.from("documentos").upload(caminho, propostaBuffer, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });
      if (erroUpload) throw new Error(erroUpload.message);

      const headersList = await headers();
      const origem = `https://${headersList.get("host")}`;
      const portalUrl = `${origem}/portal/${credenciamento.token}`;

      await enviarPropostaPorEmail({
        destinatarioEmail: contatoEmail,
        destinatarioNome: contatoNome,
        razaoSocial,
        portalUrl,
        anexoBuffer: propostaBuffer,
        anexoNomeArquivo: `Proposta Comercial Strada - ${razaoSocial}.docx`,
      });

      await supabase.from("proposta").insert({
        credenciamento_id: credenciamento.id,
        arquivo_url: caminho,
        gerada_em: new Date().toISOString(),
        enviada_em: new Date().toISOString(),
        enviada_para: contatoEmail,
        criado_por: user.id,
      });
    } catch (e) {
      // Segue o fluxo mesmo se a proposta/e-mail falhar — só registra o
      // que conseguiu (se algo já tinha sido gerado) pra não travar o
      // Comercial. Ainda assim, avisa na listagem pra não parecer que foi
      // tudo enviado quando não foi.
      console.error("Falha ao gerar/enviar proposta:", e);
      propostaFalhou = true;
    }
  }

  redirect(propostaFalhou ? "/comercial?aviso=proposta_falhou" : "/comercial");
}
