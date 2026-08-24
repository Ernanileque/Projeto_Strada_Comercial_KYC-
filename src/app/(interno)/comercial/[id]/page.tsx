import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";

export default async function CredenciamentoComercialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: credenciamento } = await supabase
    .from("credenciamento")
    .select(
      "id, status, criado_em, cliente:cliente_id(razao_social, cnpj, contato_nome, contato_email, contato_fone)",
    )
    .eq("id", id)
    .single();

  if (!credenciamento) notFound();

  const cliente = credenciamento.cliente as unknown as {
    razao_social: string;
    cnpj: string;
    contato_nome: string | null;
    contato_email: string | null;
    contato_fone: string | null;
  };

  const { data: ultimaValidacaoComMotivo } = await supabase
    .from("validacao")
    .select("validador, alertas_json, validado_em")
    .eq("credenciamento_id", id)
    .in("validador", ["compliance_negacao", "compliance_manual"])
    .order("validado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  const alertas = ultimaValidacaoComMotivo?.alertas_json as { motivo?: string } | null;
  const motivo = alertas?.motivo;
  const foiNegado = ultimaValidacaoComMotivo?.validador === "compliance_negacao";

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">{cliente?.razao_social}</h2>
          <p className="text-sm text-strada-cinza">{cliente?.cnpj}</p>
        </div>
        <StatusBadge status={credenciamento.status} />
      </div>

      {motivo && (
        <div
          className={`rounded border p-4 ${
            foiNegado ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
          }`}
        >
          <p
            className={`text-xs font-bold uppercase tracking-wide ${
              foiNegado ? "text-red-800" : "text-amber-800"
            }`}
          >
            {foiNegado ? "Negado pelo Compliance — devolvido ao Comercial" : "Devolvido ao cliente pelo Compliance"}
          </p>
          <p className={`mt-1 text-sm ${foiNegado ? "text-red-900" : "text-amber-900"}`}>{motivo}</p>
        </div>
      )}

      <section className="overflow-hidden rounded border border-black/10 bg-white">
        <h3 className="bg-strada-vinho px-4 py-2 text-xs font-bold uppercase tracking-wide text-white">
          Contato comercial (registrado na abertura)
        </h3>
        <dl className="grid grid-cols-3 gap-3 p-4">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-strada-cinza">Nome</dt>
            <dd className="text-sm">{cliente?.contato_nome || "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-strada-cinza">E-mail</dt>
            <dd className="text-sm">{cliente?.contato_email || "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-strada-cinza">Telefone</dt>
            <dd className="text-sm">{cliente?.contato_fone || "—"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
