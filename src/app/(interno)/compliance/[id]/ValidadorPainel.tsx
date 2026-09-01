"use client";

import { useState } from "react";
import { analisarCredenciamento, analisarReputacional, aprovarCredenciamento, negarCredenciamento } from "./actions";
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

export function ValidadorPainel({
  credenciamentoId,
  status,
  validacoesIniciais,
}: {
  credenciamentoId: string;
  status: string;
  validacoesIniciais: ValidacaoRegistro[];
}) {
  // validacoesIniciais já vem ordenado por validado_em desc — pega a
  // análise de IA mais recente, seja ela do Comercial (pré-análise) ou
  // uma rodada aqui mesmo pelo Compliance. Evita rodar de novo (e pagar
  // de novo) uma análise que o Comercial já fez.
  const registroInicial = validacoesIniciais.find(
    (v) => v.validador === "ia_validador_cadastral" || v.validador === "comercial_pre_analise",
  );

  const [resultado, setResultado] = useState<ResultadoValidador | null>(
    (registroInicial?.alertas_json as ResultadoValidador) ?? null,
  );
  const [origemResultado, setOrigemResultado] = useState<string | null>(registroInicial?.validador ?? null);
  const [incluirReputacional, setIncluirReputacional] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [analisandoReputacional, setAnalisandoReputacional] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [mostrarNegar, setMostrarNegar] = useState(false);
  const [motivoNegativa, setMotivoNegativa] = useState("");
  const [enviandoDecisao, setEnviandoDecisao] = useState(false);
  const [decisaoTomada, setDecisaoTomada] = useState(false);

  async function rodarAnalise() {
    setAnalisando(true);
    setErro(null);
    try {
      const resposta = await analisarCredenciamento(credenciamentoId);
      if ("erro" in resposta) {
        setErro(resposta.erro);
        return;
      }
      // Cadastral/compliance já aparecem na tela aqui — a reputacional
      // (mais lenta, busca na web) roda depois, sem travar essa parte.
      setResultado(resposta.resultado);
      setOrigemResultado("ia_validador_cadastral");
      setAnalisando(false);

      if (incluirReputacional) {
        setAnalisandoReputacional(true);
        try {
          const respostaRep = await analisarReputacional(credenciamentoId, resposta.validacaoId);
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
      // Falha de rede/timeout na chamada da Server Action em si (não um
      // erro tratado dentro dela) — sem isso o botão ficava travado em
      // "Analisando..." pra sempre, sem nunca mostrar erro.
      setErro("A análise demorou demais ou perdeu a conexão. Tente novamente.");
    } finally {
      setAnalisando(false);
      setAnalisandoReputacional(false);
    }
  }

  async function aprovar() {
    setEnviandoDecisao(true);
    const resposta = await aprovarCredenciamento(credenciamentoId);
    setEnviandoDecisao(false);
    if (resposta.erro) {
      setErro(resposta.erro);
      return;
    }
    setDecisaoTomada(true);
  }

  async function confirmarNegativa() {
    setEnviandoDecisao(true);
    const resposta = await negarCredenciamento(credenciamentoId, motivoNegativa);
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
          <>
            {origemResultado === "comercial_pre_analise" && (
              <p className="rounded border border-sky-200 bg-sky-50 p-2 text-xs text-sky-800">
                Análise já rodada pelo Comercial antes de encaminhar — não precisa rodar de novo, a menos que
                queira uma segunda opinião.
              </p>
            )}
            <ResultadoValidadorDisplay resultado={resultado} />
          </>
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

      {status === "EM_ANALISE" && !decisaoTomada && (
        <Bloco titulo="Decisão do Compliance">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={aprovar}
              disabled={enviandoDecisao}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Aprovar (enviar ao Jurídico)
            </button>
            <button
              type="button"
              onClick={() => setMostrarNegar(true)}
              disabled={enviandoDecisao}
              className="rounded border border-red-700 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
            >
              Negar (devolver ao Comercial)
            </button>
          </div>
          {mostrarNegar && (
            <div className="space-y-2 border-t border-black/5 pt-3">
              <textarea
                value={motivoNegativa}
                onChange={(e) => setMotivoNegativa(e.target.value)}
                rows={2}
                placeholder="Motivo da negativa (o Comercial vai ver isso, o cliente não)"
                className="w-full rounded border border-black/10 px-3 py-2 text-sm focus:border-strada-laranja focus:outline-none"
              />
              <button
                type="button"
                onClick={confirmarNegativa}
                disabled={enviandoDecisao}
                className="rounded bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Confirmar negativa
              </button>
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
