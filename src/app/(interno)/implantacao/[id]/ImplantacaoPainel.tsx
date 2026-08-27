"use client";

import { useState } from "react";
import { iniciarImplantacao, marcarOperando } from "./actions";

interface ImplantacaoRegistro {
  iniciada_em: string | null;
  operando_em: string | null;
}

export function ImplantacaoPainel({
  credenciamentoId,
  status,
  implantacao,
}: {
  credenciamentoId: string;
  status: string;
  implantacao: ImplantacaoRegistro | null;
}) {
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function iniciar() {
    setAtualizando(true);
    setErro(null);
    const resposta = await iniciarImplantacao(credenciamentoId);
    setAtualizando(false);
    if (resposta.erro) setErro(resposta.erro);
  }

  async function operar() {
    setAtualizando(true);
    setErro(null);
    const resposta = await marcarOperando(credenciamentoId);
    setAtualizando(false);
    if (resposta.erro) setErro(resposta.erro);
  }

  return (
    <section className="space-y-3 rounded border border-black/10 bg-gray-50 p-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-strada-vinho">
        Ativação do cliente
      </h3>

      <div className="space-y-2 rounded border border-black/10 bg-white p-3 text-sm">
        <div className="flex items-center justify-between">
          <span>Implantação iniciada</span>
          <span className={implantacao?.iniciada_em ? "text-emerald-700" : "text-strada-cinza"}>
            {implantacao?.iniciada_em
              ? new Date(implantacao.iniciada_em).toLocaleDateString("pt-BR")
              : "Pendente"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Operando (primeira viagem/uso confirmado)</span>
          <span className={implantacao?.operando_em ? "text-emerald-700" : "text-strada-cinza"}>
            {implantacao?.operando_em
              ? new Date(implantacao.operando_em).toLocaleDateString("pt-BR")
              : "Pendente"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {status === "ASSINADO" && (
          <button
            type="button"
            onClick={iniciar}
            disabled={atualizando}
            className="rounded bg-strada-laranja px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {atualizando ? "Iniciando…" : "Iniciar implantação"}
          </button>
        )}
        {status === "EM_IMPLANTACAO" && (
          <button
            type="button"
            onClick={operar}
            disabled={atualizando}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {atualizando ? "Marcando…" : "Marcar como operando"}
          </button>
        )}
        {status === "OPERANDO" && (
          <p className="text-sm font-medium text-emerald-700">
            Cliente operando — jornada de credenciamento concluída.
          </p>
        )}
      </div>

      {erro && <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">{erro}</p>}
    </section>
  );
}
