"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { criarCredenciamento } from "./actions";
import { validarCnpj } from "@/lib/portal/extracao";
import { formatarMoeda, formatarPercentual } from "@/lib/formatacao";

/**
 * useFormStatus só enxerga o estado do <form> a partir de um componente
 * filho dele — por isso não dá pra usar o hook direto na página que
 * renderiza o <form>. Sem isso, cliques repetidos enquanto a Server
 * Action ainda está rodando (busca CNPJ, geração de PDF, envio de
 * e-mail) criavam um credenciamento duplicado por clique.
 */
function BotaoEnviar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-strada-laranja px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
    >
      {pending ? "Enviando…" : "Abrir solicitação e enviar proposta por e-mail"}
    </button>
  );
}

function Campo({
  label,
  children,
  auto,
}: {
  label: string;
  children: React.ReactNode;
  auto?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-strada-cinza">
        {label}
      </label>
      {children}
      {auto && (
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
          ✓ preenchido automaticamente via Receita
        </div>
      )}
    </div>
  );
}

const classeInput =
  "w-full rounded border border-black/10 px-3 py-2 text-sm focus:border-strada-laranja focus:outline-none";
const classeInputAuto =
  "w-full rounded border-l-2 border-emerald-500 bg-emerald-50 px-3 py-2 text-sm focus:border-strada-laranja focus:outline-none";

interface DadosCnpjReceita {
  razao_social?: string;
}

export default function NovoCredenciamentoPage() {
  const [cnpj, setCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [razaoAuto, setRazaoAuto] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [avisoCnpj, setAvisoCnpj] = useState("");
  const [produto, setProduto] = useState("STRADA_PAY");
  const mostrarPay = produto === "STRADA_PAY" || produto === "AMBOS";
  const mostrarLog = produto === "STRADA_LOG" || produto === "AMBOS";

  const [vtf, setVtf] = useState("");
  const [taxaFrete, setTaxaFrete] = useState("");
  const [semParar, setSemParar] = useState("");
  const [moveMais, setMoveMais] = useState("");
  const [taggyStrada, setTaggyStrada] = useState("");

  async function buscarCnpj(valorDigitado: string) {
    const digitos = valorDigitado.replace(/\D/g, "");
    if (digitos.length !== 14) return;

    if (!validarCnpj(digitos)) {
      setAvisoCnpj("CNPJ inválido — confira os números digitados.");
      return;
    }

    setAvisoCnpj("");
    setBuscandoCnpj(true);
    try {
      const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digitos}`);
      if (!resposta.ok) throw new Error("CNPJ não encontrado na Receita.");
      const dados: DadosCnpjReceita = await resposta.json();
      if (dados.razao_social && !razaoSocial.trim()) {
        setRazaoSocial(dados.razao_social);
        setRazaoAuto(true);
      }
    } catch {
      setAvisoCnpj("Não foi possível buscar automaticamente — preencha a razão social manualmente.");
    } finally {
      setBuscandoCnpj(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="mb-4 text-lg font-semibold">Novo credenciamento</h2>

      <form action={criarCredenciamento} className="space-y-6">
        <section className="space-y-3 rounded border border-black/10 bg-white p-4">
          <h3 className="text-sm font-semibold text-strada-vinho">Cliente</h3>
          <Campo label="CNPJ *">
            <input
              name="cnpj"
              required
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              onBlur={(e) => buscarCnpj(e.target.value)}
              className={classeInput}
            />
            {buscandoCnpj && (
              <p className="mt-1 text-[11px] text-strada-cinza">Buscando na Receita…</p>
            )}
            {avisoCnpj && <p className="mt-1 text-[11px] text-amber-700">{avisoCnpj}</p>}
          </Campo>
          <Campo label="Razão social *" auto={razaoAuto}>
            <input
              name="razao_social"
              required
              value={razaoSocial}
              onChange={(e) => {
                setRazaoSocial(e.target.value);
                setRazaoAuto(false);
              }}
              className={razaoAuto ? classeInputAuto : classeInput}
            />
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
          <Campo label="Produto *">
            <select
              name="produto"
              required
              value={produto}
              onChange={(e) => setProduto(e.target.value)}
              className={classeInput}
            >
              <option value="STRADA_PAY">Strada Pay</option>
              <option value="STRADA_LOG">Strada Log</option>
              <option value="AMBOS">Strada Pay + Strada Log</option>
            </select>
          </Campo>
        </section>

        <section className="space-y-3 rounded border border-black/10 bg-white p-4">
          <h3 className="text-sm font-semibold text-strada-vinho">Condições negociadas</h3>
          <p className="text-xs text-strada-cinza">
            Esses valores vão preenchidos na Proposta Comercial enviada ao cliente por e-mail.
          </p>
          <Campo label="Estimativa de VTF transacionado por mês (R$)">
            <input
              name="vtf"
              placeholder="Ex.: 500.000,00"
              value={vtf}
              onChange={(e) => setVtf(formatarMoeda(e.target.value))}
              className={classeInput}
            />
          </Campo>

          {mostrarPay && (
            <div className="space-y-3 border-t border-black/5 pt-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-strada-cinza">Strada Pay</h4>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Taxa administrativa Frete (%)">
                  <input
                    name="pay_taxa_frete"
                    placeholder="Ex.: 0,20"
                    value={taxaFrete}
                    onChange={(e) => setTaxaFrete(formatarPercentual(e.target.value))}
                    className={classeInput}
                  />
                </Campo>
                <Campo label="Sem Parar (%)">
                  <input
                    name="pay_sem_parar"
                    placeholder="Ex.: 0,50"
                    value={semParar}
                    onChange={(e) => setSemParar(formatarPercentual(e.target.value))}
                    className={classeInput}
                  />
                </Campo>
                <Campo label="Move Mais (%)">
                  <input
                    name="pay_move_mais"
                    placeholder="Ex.: 0,50"
                    value={moveMais}
                    onChange={(e) => setMoveMais(formatarPercentual(e.target.value))}
                    className={classeInput}
                  />
                </Campo>
                <Campo label="Taggy Strada (%)">
                  <input
                    name="pay_taggy_strada"
                    placeholder="Ex.: 0,35"
                    value={taggyStrada}
                    onChange={(e) => setTaggyStrada(formatarPercentual(e.target.value))}
                    className={classeInput}
                  />
                </Campo>
              </div>
            </div>
          )}

          {mostrarLog && (
            <div className="space-y-3 border-t border-black/5 pt-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-strada-cinza">Strada Log</h4>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Gestão de Performance/lote">
                  <input name="log_gestao_performance" className={classeInput} />
                </Campo>
                <Campo label="Match de Cargas">
                  <input name="log_match_cargas" className={classeInput} />
                </Campo>
                <Campo label="Troca Nota">
                  <input name="log_troca_nota" className={classeInput} />
                </Campo>
                <Campo label="Gerenciamento de Risco">
                  <input name="log_gerenciamento_risco" className={classeInput} />
                </Campo>
                <Campo label="Módulo Portaria Tracking">
                  <input name="log_portaria_tracking" className={classeInput} />
                </Campo>
                <Campo label="BID">
                  <input name="log_bid" className={classeInput} />
                </Campo>
              </div>
            </div>
          )}
        </section>

        <BotaoEnviar />
      </form>
    </div>
  );
}
