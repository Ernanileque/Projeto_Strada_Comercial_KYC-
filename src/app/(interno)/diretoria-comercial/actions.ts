"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function aprovarElaboracao(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = await createClient();

  const { error } = await supabase
    .from("credenciamento")
    .update({ status: "AGUARDANDO_CLIENTE", aprovado_diretoria: true })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/diretoria-comercial");
}

export async function reprovarElaboracao(formData: FormData) {
  const id = String(formData.get("id"));
  const motivo = String(formData.get("motivo") ?? "").trim();
  const supabase = await createClient();

  const { error } = await supabase
    .from("credenciamento")
    .update({
      status: "REPROVADO",
      aprovado_diretoria: false,
      motivo_reprovacao: motivo || "Reprovado pela Diretoria Comercial.",
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/diretoria-comercial");
}
