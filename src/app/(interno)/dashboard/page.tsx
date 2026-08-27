import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";
import { AREA_RESPONSAVEL, STATUS_LABEL, type StatusCredenciamento } from "@/lib/estados";
import { AREAS } from "@/lib/areas";

function horasDesde(data: string): number {
  return (Date.now() - new Date(data).getTime()) / (1000 * 60 * 60);
}

// implantação ainda não tem tela de detalhe (Fase 5 não construída ainda)
const AREAS_COM_DETALHE = new Set(["comercial", "compliance", "juridico", "implantacao"]);

function formatarDuracao(horas: number): string {
  if (horas < 24) return `${Math.floor(horas)}h`;
  const dias = Math.floor(horas / 24);
  const horasRestantes = Math.floor(horas % 24);
  return `${dias}d ${horasRestantes}h`;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: credenciamentos }, { data: eventos }] = await Promise.all([
    supabase
      .from("credenciamento")
      .select("id, status, criado_em, cliente:cliente_id(razao_social, cnpj)")
      .order("criado_em", { ascending: false }),
    supabase.from("evento").select("credenciamento_id, para_status, em").order("em", { ascending: false }),
  ]);

  // Só a entrada mais recente por credenciamento marca desde quando ele está no status atual.
  const entradaNoStatusAtual = new Map<string, string>();
  for (const e of eventos ?? []) {
    if (!entradaNoStatusAtual.has(e.credenciamento_id)) {
      entradaNoStatusAtual.set(e.credenciamento_id, e.em);
    }
  }

  const linhas = (credenciamentos ?? []).map((c) => {
    const cliente = c.cliente as unknown as { razao_social: string; cnpj: string };
    const status = c.status as StatusCredenciamento;
    const desde = entradaNoStatusAtual.get(c.id) ?? c.criado_em;
    return {
      id: c.id,
      cliente: cliente?.razao_social ?? "—",
      cnpj: cliente?.cnpj ?? "—",
      status,
      area: AREA_RESPONSAVEL[status],
      horasNaEtapa: horasDesde(desde),
      criadoEm: c.criado_em,
    };
  });

  const emAndamento = linhas.filter((l) => l.status !== "OPERANDO" && l.status !== "REPROVADO");
  const contagemPorStatus = new Map<string, number>();
  for (const l of linhas) {
    contagemPorStatus.set(l.status, (contagemPorStatus.get(l.status) ?? 0) + 1);
  }

  const linhasOrdenadas = [...emAndamento].sort((a, b) => b.horasNaEtapa - a.horasNaEtapa);

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Dashboard de Gestão</h2>
      <p className="mb-4 text-sm text-strada-cinza">
        Visão única de todos os credenciamentos, etapa atual e tempo parado em cada uma.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {Object.entries(STATUS_LABEL).map(([status, label]) => (
          <div key={status} className="rounded border border-black/10 bg-white p-3">
            <p className="text-2xl font-semibold text-strada-vinho">{contagemPorStatus.get(status) ?? 0}</p>
            <p className="text-xs text-strada-cinza">{label}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded border border-black/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs text-strada-cinza">
              <th className="px-4 py-2 font-medium">Cliente</th>
              <th className="px-4 py-2 font-medium">CNPJ</th>
              <th className="px-4 py-2 font-medium">Status atual</th>
              <th className="px-4 py-2 font-medium">Responsável</th>
              <th className="px-4 py-2 font-medium">Tempo na etapa</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {linhasOrdenadas.map((l) => (
              <tr key={l.id} className="border-b border-black/5 last:border-0">
                <td className="px-4 py-2">{l.cliente}</td>
                <td className="px-4 py-2">{l.cnpj}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={l.status} />
                </td>
                <td className="px-4 py-2 text-strada-cinza">{l.area ? AREAS[l.area].label : "—"}</td>
                <td className="px-4 py-2">
                  <span className={l.horasNaEtapa > 48 ? "font-semibold text-red-700" : "text-strada-cinza"}>
                    {formatarDuracao(l.horasNaEtapa)}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  {(!l.area || AREAS_COM_DETALHE.has(l.area)) && (
                    <Link
                      href={`${l.area ? AREAS[l.area].rota : "/comercial"}/${l.id}`}
                      className="font-medium text-strada-laranja hover:underline"
                    >
                      Ver
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {!linhasOrdenadas.length && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-strada-cinza">
                  Nenhum credenciamento em andamento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
