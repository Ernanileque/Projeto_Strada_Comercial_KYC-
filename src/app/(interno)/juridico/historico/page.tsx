import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";
import { PRODUTO_LABEL, type ProdutoCredenciamento } from "@/lib/estados";

export default async function HistoricoJuridicoPage() {
  const supabase = await createClient();

  const { data: contratos } = await supabase
    .from("contrato")
    .select(
      "credenciamento_id, status, gerado_em, assinado_em, credenciamento:credenciamento_id(id, status, produto, cliente:cliente_id(razao_social, cnpj))",
    )
    .order("gerado_em", { ascending: false });

  const vistos = new Set<string>();
  const linhas: {
    credenciamentoId: string;
    status: string;
    produto: string;
    razaoSocial: string;
    cnpj: string;
    geradoEm: string | null;
    assinadoEm: string | null;
  }[] = [];

  for (const c of contratos ?? []) {
    if (vistos.has(c.credenciamento_id)) continue;
    vistos.add(c.credenciamento_id);
    const cred = c.credenciamento as unknown as {
      id: string;
      status: string;
      produto: string;
      cliente: { razao_social: string; cnpj: string } | null;
    };
    if (!cred) continue;
    linhas.push({
      credenciamentoId: cred.id,
      status: cred.status,
      produto: cred.produto,
      razaoSocial: cred.cliente?.razao_social ?? "—",
      cnpj: cred.cliente?.cnpj ?? "—",
      geradoEm: c.gerado_em,
      assinadoEm: c.assinado_em,
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Histórico do Jurídico</h2>
          <p className="text-sm text-strada-cinza">
            Tudo que já teve contrato gerado, independente do estágio atual.
          </p>
        </div>
        <Link href="/juridico" className="text-sm font-medium text-strada-laranja hover:underline">
          ← Voltar à fila
        </Link>
      </div>

      <div className="overflow-x-auto rounded border border-black/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs text-strada-cinza">
              <th className="px-4 py-2 font-medium">Cliente</th>
              <th className="px-4 py-2 font-medium">CNPJ</th>
              <th className="px-4 py-2 font-medium">Produto</th>
              <th className="px-4 py-2 font-medium">Status atual</th>
              <th className="px-4 py-2 font-medium">Contrato gerado em</th>
              <th className="px-4 py-2 font-medium">Assinado em</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.credenciamentoId} className="border-b border-black/5 last:border-0">
                <td className="px-4 py-2">{l.razaoSocial}</td>
                <td className="px-4 py-2">{l.cnpj}</td>
                <td className="px-4 py-2">{PRODUTO_LABEL[l.produto as ProdutoCredenciamento]}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={l.status as never} />
                </td>
                <td className="px-4 py-2 text-strada-cinza">
                  {l.geradoEm ? new Date(l.geradoEm).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-2 text-strada-cinza">
                  {l.assinadoEm ? new Date(l.assinadoEm).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/juridico/${l.credenciamentoId}`}
                    className="font-medium text-strada-laranja hover:underline"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
            {!linhas.length && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-strada-cinza">
                  Nenhum contrato gerado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
