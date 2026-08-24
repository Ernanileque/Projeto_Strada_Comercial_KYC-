"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
  const produto = String(formData.get("produto") ?? "STRADA_PAY");

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

  const { error: erroCredenciamento } = await supabase.from("credenciamento").insert({
    cliente_id: cliente.id,
    status: "AGUARDANDO_CLIENTE",
    criado_por: user.id,
    expira_em: expiraEm.toISOString(),
    produto,
  });

  if (erroCredenciamento) {
    throw new Error(erroCredenciamento.message);
  }

  redirect("/comercial");
}
