import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";
import { CopiarLink } from "@/components/CopiarLink";
import { headers } from "next/headers";

export default async function ComercialPage() {
  const supabase = await createClient();
  const headersList = await headers();
  const origem = `https://${headersList.get("host")}`;

  const { data: credenciamentos } = await supabase
    .from("credenciamento")
    .select("id, status, criado_em, token, cliente:cliente_id(razao_social, cnpj)")
    .order("criado_em", { ascending: false });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Comercial</h2>
        <Link
          href="/comercial/novo"
          className="rounded bg-strada-laranja px-4 py-2 text-sm font-medium text-white"
        >
          Novo credenciamento
        </Link>
      </div>

      <div className="overflow-x-auto rounded border border-black/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs text-strada-cinza">
              <th className="px-4 py-2 font-medium">Cliente</th>
              <th className="px-4 py-2 font-medium">CNPJ</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Criado em</th>
              <th className="px-4 py-2 font-medium">Link</th>
            </tr>
          </thead>
          <tbody>
            {credenciamentos?.map((c) => (
              <tr key={c.id} className="border-b border-black/5 last:border-0">
                <td className="px-4 py-2">
                  {(c.cliente as unknown as { razao_social: string })?.razao_social}
                </td>
                <td className="px-4 py-2">
                  {(c.cliente as unknown as { cnpj: string })?.cnpj}
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-2 text-strada-cinza">
                  {new Date(c.criado_em).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-2">
                  {(c.status === "AGUARDANDO_CLIENTE" || c.status === "DEVOLVIDO") && (
                    <CopiarLink texto={`${origem}/portal/${c.token}`} />
                  )}
                </td>
              </tr>
            ))}
            {!credenciamentos?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-strada-cinza">
                  Nenhum credenciamento ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
