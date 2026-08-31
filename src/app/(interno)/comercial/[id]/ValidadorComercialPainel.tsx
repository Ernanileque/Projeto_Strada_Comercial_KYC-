"use client";

import { useState } from "react";
import {
  rodarAnaliseComercial,
  rodarAnaliseComercialReputacional,
  encaminharParaCompliance,
  devolverAoCliente,
} from "./actions";
import type { ResultadoValidador } from "@/lib/compliance/validador";
import { ResultadoValidadorDisplay } from "@/components/ResultadoValidadorDisplay";

interface ValidacaoRegistro {
  id: string;
  validador: string;
  resultado: string;
  alertas_json: unknown;
  validado_em: string;
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded border border-black/10 bg-white">
      <h3 className="bg-strada-vinho px-4 py-2 text-xs font-bold uppercase tracking-wide text-white">
        {titulo}
      </h3>
      <div className="space-y-3 p-4">{children}</div>
    </section>
  );
}

export function ValidadorComercialPainel({
  credenciamentoId,
  status,
  validacoesIniciais,
}: {
  credenciamentoId: string;
  status: string;
  validacoesIniciais: ValidacaoRegistro[];
}) {
  const registroInicial = validacoesIniciais.find((v) => v.validador === "comercial_pre_analise");

  const [resultado, setResultado] = useState<ResultadoValidador | null>(
    (registroInicial?.alertas_json as ResultadoValidador) ?? null,
  );
  const [incluirReputacional, setIncluirReputacional] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [analisandoReputacional, setAnalisandoReputacional] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [justificativa, setJustificativa] = useState("");
  const [arquivoEvidencia, setArquivoEvidencia] = useState<File | null>(null);
  const [mostrarDevolver, setMostrarDevolver] = useState(false);
  const [motivoDevolucao, setMotivoDevolucao] = useState("");
  const [enviandoDecisao, setEnviandoDecisao] = useState(false);
  const [decisaoTomada, setDecisaoTomada] = useState(false);

  const precisaJustificativa = resultado ? resultado.veredicto.resultado !== "APTO" : false;

  async function rodarAnalise() {
    setAnalisando(true);
    setErro(null);
    try {
      const resposta = await rodarAnaliseComercial(credenciamentoId);
      if ("erro" in resposta) {
        setErro(resposta.erro);
        return;
      }
      setResultado(resposta.resultado);
      setAnalisando(false);

      if (incluirReputacional) {
        setAnalisandoReputacional(true);
        try {
          const respostaRep = await rodarAnaliseComercialReputacional(credenciamentoId, resposta.validacaoId);
          if ("erro" in respostaRep) {
            setErro(respostaRep.erro);
          } else {
            setResultado(respostaRep.resultado);
          }
        } finally {
          setAnalisandoReputacional(false);
        }
      }
    } catch {
      setErro("A análise demorou demais ou perdeu a conexão. Tente novamente.");
    } finally {
      setAnalisando(false);
      setAnalisandoReputacional(false);
    }
  }

  async function encaminhar() {
    setEnviandoDecisao(true);
    setErro(null);
    const fd = new FormData();
    fd.append("credenciamentoId", credenciamentoId);
    fd.append("texto", justificativa);
    if (arquivoEvidencia) fd.append("arquivo", arquivoEvidencia);
    const resposta = await encaminharParaCompliance(fd);
    setEnviandoDecisao(false);
    if (resposta.erro) {
      setErro(resposta.erro);
      return;
    }
    setDecisaoTomada(true);
  }

  async function confirmarDevolucao() {
    setEnviandoDecisao(true);
    setErro(null);
    const resposta = await devolverAoCliente(credenciamentoId, motivoDevolucao);
    setEnviandoDecisao(false);
    if (resposta.erro) {
      setErro(resposta.erro);
      return;
    }
    setDecisaoTomada(true);
  }

  return (
    <>
      <Bloco titulo="Validador Cadastral (IA)">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={rodarAnalise}
            disabled={analisando || analisandoReputacional}
            className="rounded bg-strada-laranja px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {analisando ? "Analisando…" : "Analisar com IA"}
          </button>
          <label className="flex items-center gap-2 text-xs text-strada-cinza">
            <input
              type="checkbox"
              checked={incluirReputacional}
              onChange={(e) => setIncluirReputacional(e.target.checked)}
              disabled={analisando || analisandoReputacional}
            />
            Incluir análise reputacional (busca notícias na web, mais lenta)
          </label>
        </div>

        {erro && (
          <p className="rounded border border-strada-vinho/30 bg-red-50 p-3 text-sm text-strada-vinho">{erro}</p>
        )}

        {resultado ? (
          <ResultadoValidadorDisplay resultado={resultado} />
        ) : (
          !analisando && <p className="text-sm text-strada-cinza">Nenhuma análise rodada ainda.</p>
        )}

        {analisandoReputacional && (
          <p className="flex items-center gap-2 rounded border border-black/10 bg-gray-50 p-3 text-sm text-strada-cinza">
            <span className="h-2 w-2 animate-pulse rounded-full bg-strada-laranja" />
            Buscando reputação na web (pode levar alguns minutos)… o restante da análise já está pronto acima.
          </p>
        )}
      </Bloco>

      {status === "EM_VALIDACAO_COMERCIAL" && !decisaoTomada && (
        <Bloco titulo="Decisão do Comercial">
          {!mostrarDevolver && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-strada-cinza">
                Justificativa pro Compliance
                {precisaJustificativa ? (
                  <span className="text-red-700"> (obrigatória — a IA sinalizou atenção)</span>
                ) : (
                  " (opcional)"
                )}
              </label>
              <textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                rows={3}
                placeholder="Explique o que foi verificado e por que pode seguir para o Compliance"
                className="w-full rounded border border-black/10 px-3 py-2 text-sm focus:border-strada-laranja focus:outline-none"
              />
              <label className="block text-xs font-medium text-strada-cinza">
                Anexar evidência de contestação (opcional)
              </label>
              <input
                type="file"
                onChange={(e) => setArquivoEvidencia(e.target.files?.[0] ?? null)}
                className="block w-full text-sm"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-black/5 pt-3">
            <button
              type="button"
              onClick={encaminhar}
              disabled={enviandoDecisao || mostrarDevolver}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Encaminhar ao Compliance
            </button>
            <button
              type="button"
              onClick={() => setMostrarDevolver(true)}
              disabled={enviandoDecisao || mostrarDevolver}
              className="rounded border border-strada-vinho px-4 py-2 text-sm font-medium text-strada-vinho disabled:opacity-60"
            >
              Devolver ao cliente
            </button>
          </div>

          {mostrarDevolver && (
            <div className="space-y-2 border-t border-black/5 pt-3">
              <textarea
                value={motivoDevolucao}
                onChange={(e) => setMotivoDevolucao(e.target.value)}
                rows={2}
                placeholder="O que o cliente precisa corrigir/reenviar (opcional)"
                className="w-full rounded border border-black/10 px-3 py-2 text-sm focus:border-strada-laranja focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmarDevolucao}
                  disabled={enviandoDecisao}
                  className="rounded bg-strada-vinho px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  Confirmar devolução
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarDevolver(false)}
                  disabled={enviandoDecisao}
                  className="rounded px-4 py-2 text-sm font-medium text-strada-cinza"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </Bloco>
      )}

      {decisaoTomada && (
        <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Decisão registrada. A página vai atualizar o status em instantes.
        </p>
      )}
    </>
  );
}
