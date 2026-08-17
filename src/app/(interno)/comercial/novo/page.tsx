"use client";

import { useState } from "react";
import { criarCredenciamento } from "./actions";
import { validarCnpj } from "@/lib/portal/extracao";

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
