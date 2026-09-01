"use client";

import { useState } from "react";
import {
  gerarContrato,
  obterLinkContrato,
  marcarEnviadoParaAssinatura,
  marcarAssinaturaIndividual,
  enviarParaImplantacao,
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

type PapelAssinatura = "strada_signatario" | "strada_testemunha" | "cliente_signatario" | "cliente_testemunha";

interface AssinaturaRegistro {
  id: string;
  contrato_id: string;
  papel: PapelAssinatura;
  nome: string;
  assinado_em: string | null;
}

const ROTULO_PAPEL: Record<PapelAssinatura, string> = {
  strada_signatario: "Assina pela Strada",
  strada_testemunha: "Testemunha (Strada)",
  cliente_signatario: "Assina pelo cliente",
  cliente_testemunha: "Testemunha (cliente)",
};

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

function ListaAssinantes({
  credenciamentoId,
  contratoId,
  assinaturas,
}: {
  credenciamentoId: string;
  contratoId: string;
  assinaturas: AssinaturaRegistro[];
}) {
  const [marcando, setMarcando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function marcar(assinaturaId: string) {
    setMarcando(assinaturaId);
    setErro(null);
    const resposta = await marcarAssinaturaIndividual(assinaturaId, contratoId, credenciamentoId);
    setMarcando(null);
    if (resposta.erro) setErro(resposta.erro);
  }

  const assinados = assinaturas.filter((a) => a.assinado_em).length;

  return (
    <div className="mt-3 border-t border-black/5 pt-3">
      <p className="mb-2 text-xs font-medium text-strada-cinza">
        {assinados} de {assinaturas.length} assinaram
      </p>
      <ul className="divide-y divide-black/5 rounded border border-black/10">
        {assinaturas.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 p-2 text-sm">
            <div>
              <span className="text-xs uppercase tracking-wide text-strada-cinza">{ROTULO_PAPEL[a.papel]}</span>
              <p className="font-medium">{a.nome}</p>
            </div>
            {a.assinado_em ? (
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                Assinado
              </span>
            ) : (
              <button
                type="button"
                onClick={() => marcar(a.id)}
                disabled={marcando === a.id}
                className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
              >
                {marcando === a.id ? "Marcando…" : "Marcar como assinado"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {erro && <p className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">{erro}</p>}
    </div>
  );
}

function BlocoProduto({
  credenciamentoId,
  produto,
  contrato,
  assinaturas,
}: {
  credenciamentoId: string;
  produto: ProdutoContrato;
  contrato?: ContratoRegistro;
  assinaturas: AssinaturaRegistro[];
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
      </div>

      {erro && <p className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">{erro}</p>}

      {contrato && (contrato.status === "ENVIADO_PARA_ASSINATURA" || contrato.status === "ASSINADO") && (
        <ListaAssinantes credenciamentoId={credenciamentoId} contratoId={contrato.id} assinaturas={assinaturas} />
      )}
    </div>
  );
}

export function ContratoPainel({
  credenciamentoId,
  status,
  produto,
  contratos,
  assinaturas,
}: {
  credenciamentoId: string;
  status: string;
  produto: ProdutoCredenciamento;
  contratos: ContratoRegistro[];
  assinaturas: AssinaturaRegistro[];
}) {
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  const produtosParaGerar: ProdutoContrato[] =
    produto === "AMBOS" ? ["STRADA_PAY", "STRADA_LOG"] : [produto];

  const todosContratosGerados = produtosParaGerar.every((p) => contratos.some((c) => c.produto === p));
  const todosContratosAssinados =
    todosContratosGerados && produtosParaGerar.every((p) => contratos.find((c) => c.produto === p)?.status === "ASSINADO");

  async function enviar() {
    setEnviando(true);
    setErroEnvio(null);
    const resposta = await enviarParaImplantacao(credenciamentoId);
    setEnviando(false);
    if (resposta.erro) {
      setErroEnvio(resposta.erro);
      return;
    }
    setEnviado(true);
  }

  return (
    <section className="space-y-3 rounded border border-black/10 bg-gray-50 p-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-strada-vinho">
        Geração de contrato e assinatura
      </h3>
      {produtosParaGerar.map((p) => {
        const contrato = contratos.find((c) => c.produto === p);
        return (
          <BlocoProduto
            key={p}
            credenciamentoId={credenciamentoId}
            produto={p}
            contrato={contrato}
            assinaturas={contrato ? assinaturas.filter((a) => a.contrato_id === contrato.id) : []}
          />
        );
      })}

      {todosContratosAssinados && status === "AGUARDANDO_ASSINATURA" && !enviado && (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3">
          <p className="mb-2 text-sm text-emerald-900">
            Todos os contratos estão assinados. Confira a lista de assinantes acima antes de encaminhar.
          </p>
          <button
            type="button"
            onClick={enviar}
            disabled={enviando}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {enviando ? "Enviando…" : "Enviar para Implantação"}
          </button>
          {erroEnvio && <p className="mt-2 text-xs text-red-800">{erroEnvio}</p>}
        </div>
      )}

      {enviado && (
        <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Encaminhado para Implantação.
        </p>
      )}
    </section>
  );
}
