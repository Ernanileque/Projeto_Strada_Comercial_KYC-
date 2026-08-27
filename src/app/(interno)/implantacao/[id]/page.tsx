import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";
import { PRODUTO_LABEL, type ProdutoCredenciamento } from "@/lib/estados";
import { ImplantacaoPainel } from "./ImplantacaoPainel";

export default async function CredenciamentoImplantacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: credenciamento } = await supabase
    .from("credenciamento")
    .select(
      "id, status, produto, cliente:cliente_id(razao_social, cnpj, contato_nome, contato_email, contato_fone)",
    )
    .eq("id", id)
    .single();

  if (!credenciamento) notFound();

  const { data: implantacao } = await supabase
    .from("implantacao")
    .select("iniciada_em, operando_em")
    .eq("credenciamento_id", id)
    .maybeSingle();

  const cliente = credenciamento.cliente as unknown as {
    razao_social: string;
    cnpj: string;
    contato_nome: string | null;
    contato_email: string | null;
    contato_fone: string | null;
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">{cliente?.razao_social}</h2>
          <p className="text-sm text-strada-cinza">
            {cliente?.cnpj} — {PRODUTO_LABEL[credenciamento.produto as ProdutoCredenciamento]}
          </p>
        </div>
        <StatusBadge status={credenciamento.status} />
      </div>

      <ImplantacaoPainel
        credenciamentoId={credenciamento.id}
        status={credenciamento.status}
        implantacao={implantacao ?? null}
      />

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
