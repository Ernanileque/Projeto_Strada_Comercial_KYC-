"use client";

import { useState } from "react";
import {
  gerarContrato,
  obterLinkContrato,
  marcarEnviadoParaAssinatura,
  marcarAssinado,
} from "./actions";
import { PRODUTO_LABEL, type ProdutoCredenciamento } from "@/lib/estados";
import type { ProdutoContrato } from "@/lib/juridico/contrato";

interface ContratoRegistro {
  id: string;
  produto: ProdutoContrato;
  arquivo_url: string | null;
  status: "RASCUNHO" | "ENVIADO_PARA_ASSINATURA" | "ASSINADO";
  gerado_em: string | null;
  assinado_em: string | null;
}

const STATUS_CONTRATO_LABEL: Record<ContratoRegistro["status"], string> = {
  RASCUNHO: "Rascunho gerado",
  ENVIADO_PARA_ASSINATURA: "Enviado para assinatura",
  ASSINADO: "Assinado",
};

const STATUS_CONTRATO_COR: Record<ContratoRegistro["status"], string> = {
  RASCUNHO: "bg-gray-100 text-gray-700",
  ENVIADO_PARA_ASSINATURA: "bg-amber-100 text-amber-800",
  ASSINADO: "bg-emerald-100 text-emerald-800",
};

function BlocoProduto({
  credenciamentoId,
  produto,
  contrato,
}: {
  credenciamentoId: string;
  produto: ProdutoContrato;
  contrato?: ContratoRegistro;
}) {
  const [gerando, setGerando] = useState(false);
  const [abrindo, setAbrindo] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    setGerando(true);
    setErro(null);
    const resposta = await gerarContrato(credenciamentoId, produto);
    setGerando(false);
    if (resposta.erro) setErro(resposta.erro);
  }

  async function abrir() {
    if (!contrato?.arquivo_url) return;
    setAbrindo(true);
    const url = await obterLinkContrato(contrato.arquivo_url);
    setAbrindo(false);
    if (!url) {
      alert("Não foi possível abrir o contrato.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function enviar() {
    if (!contrato) return;
    setAtualizando(true);
    setErro(null);
    const resposta = await marcarEnviadoParaAssinatura(contrato.id, credenciamentoId);
    setAtualizando(false);
    if (resposta.erro) setErro(resposta.erro);
  }

  async function assinar() {
    if (!contrato) return;
    setAtualizando(true);
    setErro(null);
    const resposta = await marcarAssinado(contrato.id, credenciamentoId);
    setAtualizando(false);
    if (resposta.erro) setErro(resposta.erro);
  }

  return (
    <div className="rounded border border-black/10 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-strada-vinho">{PRODUTO_LABEL[produto]}</h4>
        {contrato && (
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_CONTRATO_COR[contrato.status]}`}
          >
            {STATUS_CONTRATO_LABEL[contrato.status]}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={gerar}
          disabled={gerando}
          className="rounded bg-strada-laranja px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {gerando ? "Gerando…" : contrato ? "Gerar novamente" : "Gerar contrato"}
        </button>

        {contrato && (
          <button
            type="button"
            onClick={abrir}
            disabled={abrindo}
            className="rounded border border-black/10 px-4 py-2 text-sm font-medium text-strada-vinho disabled:opacity-60"
          >
            {abrindo ? "Abrindo…" : "Ver contrato"}
          </button>
        )}

        {contrato?.status === "RASCUNHO" && (
          <button
            type="button"
            onClick={enviar}
            disabled={atualizando}
            className="rounded border border-strada-vinho px-4 py-2 text-sm font-medium text-strada-vinho disabled:opacity-60"
          >
            Marcar como enviado para assinatura
          </button>
        )}

        {contrato?.status === "ENVIADO_PARA_ASSINATURA" && (
          <button
            type="button"
            onClick={assinar}
            disabled={atualizando}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Marcar como assinado
          </button>
        )}
      </div>

      {erro && <p className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">{erro}</p>}
    </div>
  );
}

export function ContratoPainel({
  credenciamentoId,
  produto,
  contratos,
}: {
  credenciamentoId: string;
  produto: ProdutoCredenciamento;
  contratos: ContratoRegistro[];
}) {
  const produtosParaGerar: ProdutoContrato[] =
    produto === "AMBOS" ? ["STRADA_PAY", "STRADA_LOG"] : [produto];

  return (
    <section className="space-y-3 rounded border border-black/10 bg-gray-50 p-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-strada-vinho">
        Geração de contrato e assinatura
      </h3>
      <p className="text-xs text-strada-cinza">
        Assina pela Strada: Priscilla Helena Martins de Souza (Gerente Jurídico, procuração) — testemunha
        Ernani Benedito Leque.
      </p>
      {produtosParaGerar.map((p) => (
        <BlocoProduto
          key={p}
          credenciamentoId={credenciamentoId}
          produto={p}
          contrato={contratos.find((c) => c.produto === p)}
        />
      ))}
    </section>
  );
}
