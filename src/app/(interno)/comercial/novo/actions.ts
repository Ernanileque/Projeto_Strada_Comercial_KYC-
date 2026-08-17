"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function numeroOuNulo(valor: FormDataEntryValue | null): number | null {
  if (!valor) return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

export async function criarCredenciamento(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const razaoSocial = String(formData.get("razao_social") ?? "").trim();
  const cnpj = String(formData.get("cnpj") ?? "").trim();
  const contatoNome = String(formData.get("contato_nome") ?? "").trim();
  const contatoEmail = String(formData.get("contato_email") ?? "").trim();
  const contatoFone = String(formData.get("contato_fone") ?? "").trim();

  const tipoContrato = String(formData.get("tipo_contrato") ?? "");
  const produtosLog = formData.getAll("produtos_log").map((p) => String(p));
  const taxaFrete = numeroOuNulo(formData.get("taxa_frete"));
  const taxaVpo = numeroOuNulo(formData.get("taxa_vpo"));
  const permanenciaMinimaMeses = numeroOuNulo(formData.get("permanencia_minima_meses"));

  const parteRelacionada = formData.get("parte_relacionada") === "on";
  const aprovadoConselho = formData.get("aprovado_conselho") === "on";
  const seguePoliticaConcorrencial = formData.get("segue_politica_concorrencial") === "on";

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

  let status: string;
  let motivoReprovacao: string | null = null;

  if (parteRelacionada && !aprovadoConselho) {
    status = "REPROVADO";
    motivoReprovacao = "Parte relacionada sem aprovação do conselho.";
  } else if (!seguePoliticaConcorrencial) {
    status = "REPROVADO";
    motivoReprovacao = "Não segue a política concorrencial da Strada.";
  } else {
    status = "AGUARDANDO_APROVACAO_DIRETORIA";
  }

  const expiraEm = new Date();
  expiraEm.setDate(expiraEm.getDate() + 30);

  const { error: erroCredenciamento } = await supabase.from("credenciamento").insert({
    cliente_id: cliente.id,
    status,
    tipo_contrato: tipoContrato || null,
    produtos_log: tipoContrato === "strada_log" ? produtosLog : null,
    taxa_frete: taxaFrete,
    taxa_vpo: taxaVpo,
    permanencia_minima_meses: permanenciaMinimaMeses,
    parte_relacionada: parteRelacionada,
    aprovado_conselho: parteRelacionada ? aprovadoConselho : null,
    segue_politica_concorrencial: seguePoliticaConcorrencial,
    motivo_reprovacao: motivoReprovacao,
    criado_por: user.id,
    expira_em: expiraEm.toISOString(),
  });

  if (erroCredenciamento) {
    throw new Error(erroCredenciamento.message);
  }

  redirect("/comercial");
}
