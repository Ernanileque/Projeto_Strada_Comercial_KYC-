"use client";

import { useState } from "react";
import { criarCredenciamento } from "./actions";
import { PRODUTOS_STRADA_LOG, TIPO_CONTRATO_LABEL } from "@/lib/contrato";

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-strada-cinza">
        {label}
      </label>
      {children}
    </div>
  );
}

const classeInput =
  "w-full rounded border border-black/10 px-3 py-2 text-sm focus:border-strada-laranja focus:outline-none";

export default function NovoCredenciamentoPage() {
  const [tipoContrato, setTipoContrato] = useState<string>("strada_pay");
  const [parteRelacionada, setParteRelacionada] = useState(false);

  return (
    <div className="max-w-2xl">
      <h2 className="mb-4 text-lg font-semibold">Novo credenciamento</h2>

      <form action={criarCredenciamento} className="space-y-6">
        <section className="space-y-3 rounded border border-black/10 bg-white p-4">
          <h3 className="text-sm font-semibold text-strada-vinho">Cliente</h3>
          <Campo label="Razão social *">
            <input name="razao_social" required className={classeInput} />
          </Campo>
          <Campo label="CNPJ *">
            <input name="cnpj" required className={classeInput} />
          </Campo>
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Contato — nome">
              <input name="contato_nome" className={classeInput} />
            </Campo>
            <Campo label="Contato — e-mail">
              <input name="contato_email" type="email" className={classeInput} />
            </Campo>
            <Campo label="Contato — telefone">
              <input name="contato_fone" className={classeInput} />
            </Campo>
          </div>
        </section>

        <section className="space-y-3 rounded border border-black/10 bg-white p-4">
          <h3 className="text-sm font-semibold text-strada-vinho">
            Proposta comercial
          </h3>
          <Campo label="Tipo de contrato *">
            <select
              name="tipo_contrato"
              required
              value={tipoContrato}
              onChange={(e) => setTipoContrato(e.target.value)}
              className={classeInput}
            >
              {Object.entries(TIPO_CONTRATO_LABEL).map(([valor, label]) => (
                <option key={valor} value={valor}>
                  {label}
                </option>
              ))}
            </select>
          </Campo>

          {tipoContrato === "strada_log" && (
            <Campo label="Produtos (Formulário de Pedido)">
              <div className="grid grid-cols-2 gap-1">
                {PRODUTOS_STRADA_LOG.map((produto) => (
                  <label key={produto} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="produtos_log" value={produto} />
                    {produto}
                  </label>
                ))}
              </div>
            </Campo>
          )}

          <div className="grid grid-cols-3 gap-3">
            <Campo label="Taxa administrativa Frete (%)">
              <input
                name="taxa_frete"
                type="number"
                step="0.01"
                min="0"
                className={classeInput}
              />
            </Campo>
            <Campo label="Taxa administrativa VPO (%)">
              <input
                name="taxa_vpo"
                type="number"
                step="0.01"
                min="0"
                className={classeInput}
              />
            </Campo>
            <Campo label="Permanência mínima (meses)">
              <input
                name="permanencia_minima_meses"
                type="number"
                min="0"
                className={classeInput}
              />
            </Campo>
          </div>
        </section>

        <section className="space-y-3 rounded border border-black/10 bg-white p-4">
          <h3 className="text-sm font-semibold text-strada-vinho">
            Governança (obrigatório antes da Diretoria Comercial)
          </h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="parte_relacionada"
              checked={parteRelacionada}
              onChange={(e) => setParteRelacionada(e.target.checked)}
            />
            É parte relacionada?
          </label>
          {parteRelacionada && (
            <label className="ml-6 flex items-center gap-2 text-sm">
              <input type="checkbox" name="aprovado_conselho" />
              Aprovado pelo conselho?
            </label>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="segue_politica_concorrencial"
              defaultChecked
            />
            Segue a política concorrencial?
          </label>
          <p className="text-xs text-strada-cinza">
            Se parte relacionada sem aprovação do conselho, ou não seguir a
            política concorrencial, o credenciamento já nasce reprovado.
          </p>
        </section>

        <button
          type="submit"
          className="rounded bg-strada-laranja px-4 py-2 text-sm font-medium text-white"
        >
          Abrir solicitação
        </button>
      </form>
    </div>
  );
}
