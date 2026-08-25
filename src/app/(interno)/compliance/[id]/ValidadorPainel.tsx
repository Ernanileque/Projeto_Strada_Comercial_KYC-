"use client";

import { useState } from "react";
import {
  analisarCredenciamento,
  aprovarCredenciamento,
  devolverAoCliente,
  negarCredenciamento,
} from "./actions";
import type { ResultadoValidador } from "@/lib/compliance/validador";

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

function corResultado(resultado: string): string {
  if (resultado === "APTO") return "bg-emerald-100 text-emerald-800";
  if (resultado === "NÃO APTO" || resultado === "NAO_APTO") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
}

function ResultadoDisplay({ resultado }: { resultado: ResultadoValidador }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className={`rounded px-3 py-1 text-sm font-bold ${corResultado(resultado.veredicto.resultado)}`}>
          {resultado.veredicto.resultado}
        </span>
        <p className="text-sm text-strada-cinza">{resultado.veredicto.justificativa}</p>
      </div>

      {resultado.erros && resultado.erros.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          {resultado.erros.map((e, i) => (
            <p key={i}>
              Falha na etapa &quot;{e.etapa}&quot;: {e.mensagem}
            </p>
          ))}
        </div>
      )}

      {resultado.analiseCadastral && (
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-strada-vinho">
            Análise cadastral
          </h4>
          <ul className="divide-y divide-black/5 rounded border border-black/10">
            {resultado.analiseCadastral.inconsistencias.map((item, i) => (
              <li key={i} className="p-2 text-sm">
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      item.gravidade === "atencao" ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {item.gravidade === "atencao" ? "Atenção" : "OK"}
                  </span>
                  <div>
                    <p>
                      <span className="font-medium">{item.documento}</span> — {item.campo}: {item.descricao}
                    </p>
                    {item.gravidade === "atencao" && item.acao && item.acao !== "Nenhuma" && (
                      <p className="text-xs text-strada-cinza">Ação sugerida: {item.acao}</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {resultado.analiseCompliance && (
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-strada-vinho">
            Dossiê e beneficiários finais
          </h4>
          <p className="mb-3 whitespace-pre-wrap rounded border border-black/10 bg-gray-50 p-3 text-sm">
            {resultado.analiseCompliance.dossie}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left text-xs text-strada-cinza">
                  <th className="py-1.5 pr-3 font-medium">Nome</th>
                  <th className="py-1.5 pr-3 font-medium">CPF/CNPJ</th>
                  <th className="py-1.5 pr-3 font-medium">Participação</th>
                  <th className="py-1.5 pr-3 font-medium">Benef. final?</th>
                  <th className="py-1.5 font-medium">Recomendação</th>
                </tr>
              </thead>
              <tbody>
                {resultado.analiseCompliance.beneficiarios.map((b, i) => (
                  <tr key={i} className="border-b border-black/5 last:border-0">
                    <td className="py-1.5 pr-3">{b.nome}</td>
                    <td className="py-1.5 pr-3">{b.cpf_cnpj}</td>
                    <td className="py-1.5 pr-3">{b.participacao}</td>
                    <td className="py-1.5 pr-3">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          b.gravidade === "atencao" ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {b.beneficiario_final === "sim" ? "Sim" : "Não"}
                      </span>
                    </td>
                    <td className="py-1.5 text-xs text-strada-cinza">{b.recomendacao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {resultado.analiseReputacional && (
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-strada-vinho">
            Análise reputacional
          </h4>
          <p className="mb-1 text-sm">
            <span className="font-medium">Empresa: </span>
            {resultado.analiseReputacional.empresa_sintese}
          </p>
          <p className="mb-3 text-sm">
            <span className="font-medium">Sócios/administradores: </span>
            {resultado.analiseReputacional.socios_sintese}
          </p>
          <ul className="space-y-1.5">
            {[...resultado.analiseReputacional.empresa_achados, ...resultado.analiseReputacional.socios_achados].map(
              (a, i) => (
                <li key={i} className="rounded border border-black/10 p-2 text-xs">
                  <span
                    className={`mr-2 rounded px-1.5 py-0.5 font-bold uppercase ${
                      a.gravidade === "atencao" ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {a.tipo}
                  </span>
                  <span className="font-medium">{a.nome}</span> — {a.resumo} ({a.fonte}, {a.data})
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </div>
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
  const registroInicial = validacoesIniciais.find((v) => v.validador === "ia_validador_cadastral");

  const [resultado, setResultado] = useState<ResultadoValidador | null>(
    (registroInicial?.alertas_json as ResultadoValidador) ?? null,
  );
  const [incluirReputacional, setIncluirReputacional] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [mostrarDevolver, setMostrarDevolver] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [mostrarNegar, setMostrarNegar] = useState(false);
  const [motivoNegativa, setMotivoNegativa] = useState("");
  const [enviandoDecisao, setEnviandoDecisao] = useState(false);
  const [decisaoTomada, setDecisaoTomada] = useState(false);

  async function rodarAnalise() {
    setAnalisando(true);
    setErro(null);
    try {
      const resposta = await analisarCredenciamento(credenciamentoId, incluirReputacional);
      if ("erro" in resposta) {
        setErro(resposta.erro);
        return;
      }
      setResultado(resposta.resultado);
    } catch {
      // Falha de rede/timeout na chamada da Server Action em si (não um
      // erro tratado dentro dela) — sem isso o botão ficava travado em
      // "Analisando..." pra sempre, sem nunca mostrar erro.
      setErro("A análise demorou demais ou perdeu a conexão. Tente novamente.");
    } finally {
      setAnalisando(false);
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

  async function confirmarDevolucao() {
    setEnviandoDecisao(true);
    const resposta = await devolverAoCliente(credenciamentoId, motivo);
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
            disabled={analisando}
            className="rounded bg-strada-laranja px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {analisando ? "Analisando… (pode levar até 2 minutos)" : "Analisar com IA"}
          </button>
          <label className="flex items-center gap-2 text-xs text-strada-cinza">
            <input
              type="checkbox"
              checked={incluirReputacional}
              onChange={(e) => setIncluirReputacional(e.target.checked)}
              disabled={analisando}
            />
            Incluir análise reputacional (busca notícias na web, mais lenta)
          </label>
        </div>

        {erro && (
          <p className="rounded border border-strada-vinho/30 bg-red-50 p-3 text-sm text-strada-vinho">{erro}</p>
        )}

        {resultado ? (
          <ResultadoDisplay resultado={resultado} />
        ) : (
          !analisando && <p className="text-sm text-strada-cinza">Nenhuma análise rodada ainda.</p>
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
              onClick={() => setMostrarDevolver(true)}
              disabled={enviandoDecisao}
              className="rounded border border-strada-vinho px-4 py-2 text-sm font-medium text-strada-vinho disabled:opacity-60"
            >
              Devolver ao cliente
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
          {mostrarDevolver && (
            <div className="space-y-2 border-t border-black/5 pt-3">
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                placeholder="Motivo da devolução (o que o cliente precisa corrigir)"
                className="w-full rounded border border-black/10 px-3 py-2 text-sm focus:border-strada-laranja focus:outline-none"
              />
              <button
                type="button"
                onClick={confirmarDevolucao}
                disabled={enviandoDecisao}
                className="rounded bg-strada-vinho px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Confirmar devolução
              </button>
            </div>
          )}
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
