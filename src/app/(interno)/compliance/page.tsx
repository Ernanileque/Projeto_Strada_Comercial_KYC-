import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { estourouSla, horasEmAberto } from "@/lib/estados";

export default async function CompliancePage() {
  const supabase = await createClient();

  const { data: credenciamentos } = await supabase
    .from("credenciamento")
    .select("id, status, criado_em, entrou_em_analise_em, cliente:cliente_id(razao_social, cnpj)")
    .eq("status", "EM_ANALISE")
    .order("entrou_em_analise_em", { ascending: true });

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Compliance</h2>
      <p className="mb-4 text-sm text-strada-cinza">
        Fila de análise cadastral e KYC — SLA de 24h.
      </p>

      <div className="overflow-x-auto rounded border border-black/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs text-strada-cinza">
              <th className="px-4 py-2 font-medium">Cliente</th>
              <th className="px-4 py-2 font-medium">CNPJ</th>
              <th className="px-4 py-2 font-medium">Recebido em</th>
              <th className="px-4 py-2 font-medium">Tempo em aberto</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {credenciamentos?.map((c) => {
              const cliente = c.cliente as unknown as { razao_social: string; cnpj: string };
              const desde = c.entrou_em_analise_em ?? c.criado_em;
              const horas = horasEmAberto(desde);
              const estourou = estourouSla(desde);
              return (
                <tr key={c.id} className="border-b border-black/5 last:border-0">
                  <td className="px-4 py-2">{cliente?.razao_social}</td>
                  <td className="px-4 py-2">{cliente?.cnpj}</td>
                  <td className="px-4 py-2 text-strada-cinza">
                    {new Date(desde).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-2">
                    <span className={estourou ? "font-semibold text-red-700" : "text-strada-cinza"}>
                      {Math.floor(horas)}h{estourou ? " — SLA estourado" : ""}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/compliance/${c.id}`}
                      className="font-medium text-strada-laranja hover:underline"
                    >
                      Analisar
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!credenciamentos?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-strada-cinza">
                  Nenhum credenciamento em análise.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
