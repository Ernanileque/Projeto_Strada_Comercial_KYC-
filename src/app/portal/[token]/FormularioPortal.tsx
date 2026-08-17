"use client";

import { useActionState, useState } from "react";
import { enviarFichaKyc } from "./actions";
import { LogoStrada } from "@/components/LogoStrada";

const classeInput =
  "w-full rounded border border-black/10 px-3 py-2 text-sm focus:border-strada-laranja focus:outline-none";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-strada-cinza">
        {label}
      </label>
      {children}
    </div>
  );
}

type EstadoEnvio = { erro: string } | { sucesso: true } | null;

export function FormularioPortal({ token }: { token: string }) {
  const [numSocios, setNumSocios] = useState(1);

  async function acao(_estadoAnterior: EstadoEnvio, formData: FormData) {
    return enviarFichaKyc(token, formData);
  }

  const [estado, formAction, enviando] = useActionState<EstadoEnvio, FormData>(
    acao,
    null,
  );

  if (estado && "sucesso" in estado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md rounded-lg bg-white p-8 text-center shadow-sm">
          <div className="mb-6 flex justify-center">
            <LogoStrada className="h-8" />
          </div>
          <h1 className="mb-2 text-lg font-semibold text-strada-vinho">
            Enviado com sucesso
          </h1>
          <p className="text-sm text-strada-cinza">
            Recebemos seus documentos e informações. Nossa equipe de
            Compliance vai analisar e, se precisar de algo, entraremos em
            contato pelo e-mail informado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex justify-center">
          <LogoStrada className="h-8" />
        </div>

        <form action={formAction} className="space-y-6">
          <section className="space-y-3 rounded border border-black/10 bg-white p-4">
            <h3 className="text-sm font-semibold text-strada-vinho">
              Documentos
            </h3>
            <Campo label="Contrato social / Estatuto social *">
              <input
                type="file"
                name="contrato_social"
                required
                className="text-sm"
              />
            </Campo>
            <Campo label="Cartão CNPJ / QSA *">
              <input
                type="file"
                name="cartao_cnpj_qsa"
                required
                className="text-sm"
              />
            </Campo>
            <Campo label="RG/CNH do representante legal *">
              <input
                type="file"
                name="rg_cnh_representante"
                required
                className="text-sm"
              />
            </Campo>
            <Campo label="Comprovante bancário (opcional)">
              <input type="file" name="comprovante_bancario" className="text-sm" />
            </Campo>
            <Campo label="Comprovante de endereço (opcional)">
              <input type="file" name="comprovante_endereco" className="text-sm" />
            </Campo>
          </section>

          <section className="space-y-3 rounded border border-black/10 bg-white p-4">
            <h3 className="text-sm font-semibold text-strada-vinho">
              Ficha KYC
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Faturamento mensal (R$) *">
                <input
                  type="number"
                  name="faturamento_mensal"
                  step="0.01"
                  required
                  className={classeInput}
                />
              </Campo>
              <Campo label="Renda do representante (R$) *">
                <input
                  type="number"
                  name="renda_representante"
                  step="0.01"
                  required
                  className={classeInput}
                />
              </Campo>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="pep_representante" />
              O representante é Pessoa Politicamente Exposta (PEP)?
            </label>
            <Campo label="E-mail de contato *">
              <input
                type="email"
                name="email_contato"
                required
                className={classeInput}
              />
            </Campo>
          </section>

          <section className="space-y-4 rounded border border-black/10 bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-strada-vinho">
                Sócios / representantes assinantes
              </h3>
              <button
                type="button"
                onClick={() => setNumSocios((n) => n + 1)}
                className="text-xs text-strada-laranja hover:underline"
              >
                + adicionar sócio
              </button>
            </div>
            {Array.from({ length: numSocios }).map((_, i) => (
              <div key={i} className="grid grid-cols-2 gap-3 border-t border-black/5 pt-3 first:border-0 first:pt-0">
                <Campo label="Nome completo *">
                  <input name="socio_nome" required className={classeInput} />
                </Campo>
                <Campo label="CPF">
                  <input name="socio_cpf" className={classeInput} />
                </Campo>
                <Campo label="Participação (%)">
                  <input
                    type="number"
                    name="socio_participacao"
                    step="0.01"
                    className={classeInput}
                  />
                </Campo>
                <Campo label="E-mail *">
                  <input
                    type="email"
                    name="socio_email"
                    required
                    className={classeInput}
                  />
                </Campo>
                <label className="col-span-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" name="socio_pep" />
                  É Pessoa Politicamente Exposta (PEP)?
                </label>
              </div>
            ))}
          </section>

          <section className="space-y-3 rounded border border-black/10 bg-white p-4">
            <h3 className="text-sm font-semibold text-strada-vinho">
              Testemunha
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Nome completo *">
                <input name="testemunha_nome" required className={classeInput} />
              </Campo>
              <Campo label="CPF">
                <input name="testemunha_cpf" className={classeInput} />
              </Campo>
              <Campo label="E-mail *">
                <input
                  type="email"
                  name="testemunha_email"
                  required
                  className={classeInput}
                />
              </Campo>
            </div>
          </section>

          {estado && "erro" in estado && (
            <p className="text-sm text-strada-vinho">{estado.erro}</p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded bg-strada-laranja py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {enviando ? "Enviando…" : "Enviar documentação"}
          </button>
        </form>
      </div>
    </div>
  );
}
