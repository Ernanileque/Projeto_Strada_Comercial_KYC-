import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";
import { PRODUTO_LABEL, type ProdutoCredenciamento } from "@/lib/estados";

export default async function JuridicoPage() {
  const supabase = await createClient();

  const { data: credenciamentos } = await supabase
    .from("credenciamento")
    .select("id, status, produto, criado_em, cliente:cliente_id(razao_social, cnpj)")
    .in("status", ["VALIDADO", "EM_CONTRATO", "AGUARDANDO_ASSINATURA"])
    .order("criado_em", { ascending: true });

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Jurídico</h2>
      <p className="mb-4 text-sm text-strada-cinza">
        Geração de contrato a partir do modelo e assinatura em lote.
      </p>

      <div className="overflow-x-auto rounded border border-black/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs text-strada-cinza">
              <th className="px-4 py-2 font-medium">Cliente</th>
              <th className="px-4 py-2 font-medium">CNPJ</th>
              <th className="px-4 py-2 font-medium">Produto</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {credenciamentos?.map((c) => {
              const cliente = c.cliente as unknown as { razao_social: string; cnpj: string };
              return (
                <tr key={c.id} className="border-b border-black/5 last:border-0">
                  <td className="px-4 py-2">{cliente?.razao_social}</td>
                  <td className="px-4 py-2">{cliente?.cnpj}</td>
                  <td className="px-4 py-2">{PRODUTO_LABEL[c.produto as ProdutoCredenciamento]}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/juridico/${c.id}`}
                      className="font-medium text-strada-laranja hover:underline"
                    >
                      Abrir
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!credenciamentos?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-strada-cinza">
                  Nenhum credenciamento validado aguardando contrato.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
