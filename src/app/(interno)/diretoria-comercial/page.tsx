import { createClient } from "@/lib/supabase/server";
import { TIPO_CONTRATO_LABEL, type TipoContrato } from "@/lib/contrato";
import { aprovarElaboracao, reprovarElaboracao } from "./actions";

export default async function DiretoriaComercialPage() {
  const supabase = await createClient();

  const { data: credenciamentos } = await supabase
    .from("credenciamento")
    .select(
      "id, tipo_contrato, taxa_frete, taxa_vpo, permanencia_minima_meses, criado_em, cliente:cliente_id(razao_social, cnpj)",
    )
    .eq("status", "AGUARDANDO_APROVACAO_DIRETORIA")
    .order("criado_em", { ascending: true });

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Diretoria Comercial</h2>
      <p className="mb-4 text-sm text-strada-cinza">
        Aprovação para elaboração — SLA de 1 dia.
      </p>

      <div className="space-y-3">
        {credenciamentos?.map((c) => {
          const cliente = c.cliente as unknown as {
            razao_social: string;
            cnpj: string;
          };
          return (
            <div
              key={c.id}
              className="rounded border border-black/10 bg-white p-4"
            >
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <p className="font-medium">{cliente?.razao_social}</p>
                  <p className="text-xs text-strada-cinza">{cliente?.cnpj}</p>
                </div>
                <span className="text-xs text-strada-cinza">
                  {new Date(c.criado_em).toLocaleDateString("pt-BR")}
                </span>
              </div>

              <dl className="mb-3 grid grid-cols-2 gap-2 text-xs text-strada-cinza sm:grid-cols-4">
                <div>
                  <dt className="font-medium">Tipo de contrato</dt>
                  <dd>{TIPO_CONTRATO_LABEL[c.tipo_contrato as TipoContrato] ?? "—"}</dd>
                </div>
                <div>
                  <dt className="font-medium">Taxa Frete</dt>
                  <dd>{c.taxa_frete != null ? `${c.taxa_frete}%` : "—"}</dd>
                </div>
                <div>
                  <dt className="font-medium">Taxa VPO</dt>
                  <dd>{c.taxa_vpo != null ? `${c.taxa_vpo}%` : "—"}</dd>
                </div>
                <div>
                  <dt className="font-medium">Permanência mínima</dt>
                  <dd>
                    {c.permanencia_minima_meses != null
                      ? `${c.permanencia_minima_meses} meses`
                      : "—"}
                  </dd>
                </div>
              </dl>

              <div className="flex items-center gap-3">
                <form action={aprovarElaboracao}>
                  <input type="hidden" name="id" value={c.id} />
                  <button
                    type="submit"
                    className="rounded bg-strada-laranja px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Aprovar para elaboração
                  </button>
                </form>
                <form
                  action={reprovarElaboracao}
                  className="flex items-center gap-2"
                >
                  <input type="hidden" name="id" value={c.id} />
                  <input
                    name="motivo"
                    placeholder="Motivo da reprovação"
                    className="rounded border border-black/10 px-2 py-1.5 text-xs"
                  />
                  <button
                    type="submit"
                    className="rounded border border-strada-vinho px-3 py-1.5 text-xs font-medium text-strada-vinho"
                  >
                    Reprovar
                  </button>
                </form>
              </div>
            </div>
          );
        })}

        {!credenciamentos?.length && (
          <p className="text-sm text-strada-cinza">
            Nenhum credenciamento aguardando aprovação.
          </p>
        )}
      </div>
    </div>
  );
}
