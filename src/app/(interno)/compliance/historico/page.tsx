import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";

const RESULTADO_LABEL: Record<string, string> = {
  APTO: "Apto",
  NAO_APTO: "Não apto",
  EM_ANALISE: "Em análise",
};

const RESULTADO_COR: Record<string, string> = {
  APTO: "bg-emerald-100 text-emerald-800",
  NAO_APTO: "bg-red-100 text-red-800",
  EM_ANALISE: "bg-amber-100 text-amber-800",
};

export default async function HistoricoCompliancePage() {
  const supabase = await createClient();

  const { data: validacoes } = await supabase
    .from("validacao")
    .select(
      "credenciamento_id, validador, resultado, validado_em, credenciamento:credenciamento_id(id, status, cliente:cliente_id(razao_social, cnpj))",
    )
    .order("validado_em", { ascending: false });

  const vistos = new Set<string>();
  const linhas: {
    credenciamentoId: string;
    status: string;
    razaoSocial: string;
    cnpj: string;
    ultimoValidador: string;
    ultimoResultado: string;
    ultimaAnalise: string;
  }[] = [];

  for (const v of validacoes ?? []) {
    if (vistos.has(v.credenciamento_id)) continue;
    vistos.add(v.credenciamento_id);
    const cred = v.credenciamento as unknown as {
      id: string;
      status: string;
      cliente: { razao_social: string; cnpj: string } | null;
    };
    if (!cred) continue;
    linhas.push({
      credenciamentoId: cred.id,
      status: cred.status,
      razaoSocial: cred.cliente?.razao_social ?? "—",
      cnpj: cred.cliente?.cnpj ?? "—",
      ultimoValidador: v.validador,
      ultimoResultado: v.resultado,
      ultimaAnalise: v.validado_em,
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Histórico do Compliance</h2>
          <p className="text-sm text-strada-cinza">
            Tudo que já passou por análise, independente do estágio atual.
          </p>
        </div>
        <Link href="/compliance" className="text-sm font-medium text-strada-laranja hover:underline">
          ← Voltar à fila
        </Link>
      </div>

      <div className="overflow-x-auto rounded border border-black/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs text-strada-cinza">
              <th className="px-4 py-2 font-medium">Cliente</th>
              <th className="px-4 py-2 font-medium">CNPJ</th>
              <th className="px-4 py-2 font-medium">Status atual</th>
              <th className="px-4 py-2 font-medium">Última análise</th>
              <th className="px-4 py-2 font-medium">Resultado</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.credenciamentoId} className="border-b border-black/5 last:border-0">
                <td className="px-4 py-2">{l.razaoSocial}</td>
                <td className="px-4 py-2">{l.cnpj}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={l.status as never} />
                </td>
                <td className="px-4 py-2 text-strada-cinza">
                  {new Date(l.ultimaAnalise).toLocaleDateString("pt-BR")}
                  {l.ultimoValidador === "compliance_negacao" && " (negado)"}
                  {l.ultimoValidador === "compliance_manual" && " (devolvido ao cliente)"}
                  {l.ultimoValidador === "compliance_aprovacao" && " (aprovado manualmente)"}
                  {l.ultimoValidador === "ia_validador_cadastral" && " (IA)"}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${RESULTADO_COR[l.ultimoResultado] ?? "bg-gray-100 text-gray-700"}`}
                  >
                    {RESULTADO_LABEL[l.ultimoResultado] ?? l.ultimoResultado}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/compliance/${l.credenciamentoId}`}
                    className="font-medium text-strada-laranja hover:underline"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
            {!linhas.length && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-strada-cinza">
                  Nenhum credenciamento analisado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
