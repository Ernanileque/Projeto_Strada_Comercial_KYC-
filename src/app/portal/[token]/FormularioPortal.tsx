"use client";

import { useActionState, useMemo, useState } from "react";
import { enviarFichaKyc, prepararUpload } from "./actions";
import { createClient } from "@/lib/supabase/client";
import { LogoStrada } from "@/components/LogoStrada";
import {
  analisar,
  conferir,
  montarChecklist,
  textoDoPdf,
  textoPdfViaOcr,
  textoImagemViaOcr,
  type SocioExtraido,
  type AdministradorExtraido,
  type DadosEmpresaExtraidos,
  type ResultadoAnalise,
} from "@/lib/portal/extracao";
import { formatarMoeda, formatarPercentual } from "@/lib/formatacao";

const classeInput =
  "w-full rounded border border-black/10 px-3 py-2 text-sm focus:border-strada-laranja focus:outline-none";
const classeInputAuto =
  "w-full rounded border-l-2 border-emerald-500 bg-emerald-50 px-3 py-2 text-sm focus:border-strada-laranja focus:outline-none";

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
          ✓ extraído do documento
        </div>
      )}
    </div>
  );
}

function Secao({
  numero,
  titulo,
  children,
}: {
  numero: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded border border-black/10 bg-white">
      <h3 className="bg-strada-laranja px-4 py-2 text-xs font-bold uppercase tracking-wide text-white">
        <span className="opacity-70">{numero}</span> {titulo}
      </h3>
      <div className="space-y-3 p-4">{children}</div>
    </section>
  );
}

type Assinante = { nome: string; cpf: string; email: string; cargo: string; auto?: boolean };
type SocioForm = {
  pessoa: "PF" | "PJ";
  nome: string;
  doc: string;
  nasc: string;
  nac: string;
  pais: string;
  renda: string;
  quotas: string;
  pct: string;
  pep: string;
  endereco: string;
  obs: string;
  auto?: boolean;
};
type Arquivo = {
  nome: string;
  tipo: string;
  aviso?: string;
  resultado?: ResultadoAnalise;
  viaOcr?: boolean;
  caminho?: string;
  enviando?: boolean;
};

const socioVazio = (): SocioForm => ({
  pessoa: "PF",
  nome: "",
  doc: "",
  nasc: "",
  nac: "Brasileira",
  pais: "Brasil",
  renda: "",
  quotas: "",
  pct: "",
  pep: "",
  endereco: "",
  obs: "",
});

const assinanteVazio = (): Assinante => ({ nome: "", cpf: "", email: "", cargo: "" });

const ROTULO_TIPO: Record<string, string> = {
  contrato: "Contrato social",
  cartaoCnpj: "Cartão CNPJ",
  qsa: "Quadro de sócios",
  sintegra: "Cadastro estadual",
  cnh: "Documento pessoal",
  procuracao: "Procuração",
  proposta: "Proposta comercial",
  imagem: "Imagem",
  outro: "Documento",
};

type EstadoEnvio = { erro: string } | { sucesso: true } | null;

export function FormularioPortal({
  token,
  cnpjRegistrado,
  motivoDevolucao,
}: {
  token: string;
  cnpjRegistrado?: string;
  motivoDevolucao?: string;
}) {
  const [processando, setProcessando] = useState(false);
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [supabase] = useState(() => createClient());

  const [empresa, setEmpresa] = useState({
    cnpj: "",
    razao: "",
    fantasia: "",
    cnae: "",
    filiais: "0",
    fatMes: "",
    fatAno: "",
    objeto: "",
  });
  const [autoEmpresa, setAutoEmpresa] = useState<Record<string, boolean>>({});

  const [endereco, setEndereco] = useState({
    tipo: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    municipio: "",
    uf: "",
    cep: "",
  });
  const [mesmoEndereco, setMesmoEndereco] = useState(true);
  const [entrega, setEntrega] = useState({ ...endereco });

  const [assinantes, setAssinantes] = useState<Assinante[]>([assinanteVazio()]);
  const [testemunha, setTestemunha] = useState({ nome: "", cpf: "", email: "" });

  const [contatos, setContatos] = useState({
    financeiro: { nome: "", email: "", telefone: "", cargo: "", setor: "" },
    juridico: { nome: "", email: "", telefone: "", cargo: "", setor: "" },
    operacional: { nome: "", email: "", telefone: "", cargo: "", setor: "" },
  });

  const [conta, setConta] = useState({ tipo: "", redeStradaBank: "", saldoMinimo: "", modoFinal: "" });
  const [capital, setCapital] = useState({ valor: "", valorQuota: "", totalQuotas: "" });
  const [socios, setSocios] = useState<SocioForm[]>([socioVazio()]);
  const [declaracoes, setDeclaracoes] = useState({ pep: false, procuracoes: false, veracidade: false });

  const arquivosSemUpload = arquivos.some((a) => !a.caminho);

  const checklist = useMemo(
    () => montarChecklist(arquivos.map((a) => a.tipo as Parameters<typeof montarChecklist>[0][number])),
    [arquivos],
  );

  const conferencia = useMemo(
    () =>
      conferir({
        empresa: { cnpj: empresa.cnpj, fatMes: empresa.fatMes, fatAno: empresa.fatAno },
        capital: { totalQuotas: capital.totalQuotas },
        socios: socios.map((s) => ({
          pessoa: s.pessoa,
          nome: s.nome,
          doc: s.doc,
          pct: s.pct,
          quotas: s.quotas,
          pep: s.pep,
        })),
        assinantes: assinantes.map((a) => ({ nome: a.nome, cpf: a.cpf })),
        testemunha,
        arquivos: arquivos.map((a) => ({
          tipo: a.tipo as Parameters<typeof montarChecklist>[0][number],
          resultado: a.resultado,
        })),
        cnpjRegistrado,
      }),
    [empresa, capital, socios, assinantes, testemunha, arquivos, cnpjRegistrado],
  );

  async function acao(_estadoAnterior: EstadoEnvio, formData: FormData) {
    formData.set(
      "dados_json",
      JSON.stringify({
        empresa,
        endereco,
        entrega: mesmoEndereco ? "mesmo-da-sede" : entrega,
        assinantes,
        testemunha,
        contatos,
        conta,
        capital,
        socios,
        declaracoes,
        arquivos: arquivos
          .filter((a) => a.caminho)
          .map((a) => ({ caminho: a.caminho, tipoDetectado: a.tipo })),
      }),
    );
    return enviarFichaKyc(token, formData);
  }

  const [estado, formAction, enviando] = useActionState<EstadoEnvio, FormData>(acao, null);

  async function receberArquivos(lista: FileList | null) {
    if (!lista) return;
    setProcessando(true);
    for (const file of Array.from(lista)) {
      setArquivos((prev) => [...prev, { nome: file.name, tipo: "outro" }]);

      const ehPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      let tipo = ehPdf ? "outro" : "imagem";
      let aviso: string | undefined;
      let resultado: ResultadoAnalise | undefined;
      let viaOcr = false;

      try {
        let r: ResultadoAnalise | undefined;

        if (ehPdf) {
          const texto = await textoDoPdf(file);
          r = analisar(texto, file.name);
        }

        if (!r || !r.temTexto) {
          setArquivos((prev) =>
            prev.map((a) =>
              a.nome === file.name
                ? { ...a, aviso: "Documento sem texto — lendo por OCR (pode levar alguns segundos)…" }
                : a,
            ),
          );
          const textoOcr = ehPdf ? await textoPdfViaOcr(file) : await textoImagemViaOcr(file);
          const rOcr = analisar(textoOcr, file.name);
          if (rOcr.temTexto) {
            r = rOcr;
            viaOcr = true;
          }
        }

        if (r && r.temTexto) {
          tipo = r.tipo;
          resultado = r;
          aviso = viaOcr ? "Lido por OCR — confira os dados preenchidos." : undefined;
          aplicarExtracao(r.empresa, r.socios, r.admins);
        } else {
          tipo = ehPdf ? "outro" : "imagem";
          aviso = "Não foi possível ler este documento (nem por OCR) — preencha os campos manualmente.";
        }
      } catch {
        aviso = "Não foi possível ler este arquivo — preencha os campos manualmente.";
      }

      // Envia o arquivo direto pro Storage via URL assinada — fora do
      // corpo da Server Action, que tem limite de 1MB e estoura fácil
      // com vários PDFs reais anexados juntos.
      let caminho: string | undefined;
      try {
        const preparo = await prepararUpload(token, file.name);
        if ("erro" in preparo) {
          aviso = `Falha ao preparar o envio: ${preparo.erro}`;
        } else {
          const { error: erroUpload } = await supabase.storage
            .from("documentos")
            .uploadToSignedUrl(preparo.caminho, preparo.signedToken, file);
          if (erroUpload) {
            aviso = `Falha ao enviar o arquivo: ${erroUpload.message}`;
          } else {
            caminho = preparo.caminho;
          }
        }
      } catch {
        aviso = "Falha ao enviar o arquivo — tente anexar novamente.";
      }

      setArquivos((prev) =>
        prev.map((a) =>
          a.nome === file.name ? { nome: file.name, tipo, aviso, resultado, viaOcr, caminho } : a,
        ),
      );
    }
    setProcessando(false);
  }

  function aplicarExtracao(
    dadosEmpresa: DadosEmpresaExtraidos,
    sociosExtraidos: SocioExtraido[],
    adminsExtraidos: AdministradorExtraido[],
  ) {
    setEmpresa((atual) => {
      const novo = { ...atual };
      const marcados: Record<string, boolean> = { ...autoEmpresa };
      (["cnpj", "razao", "fantasia", "cnae", "objeto"] as const).forEach((campo) => {
        const valor = dadosEmpresa[campo] as string | undefined;
        if (valor && !atual[campo]) {
          novo[campo] = valor;
          marcados[campo] = true;
        }
      });
      setAutoEmpresa(marcados);
      return novo;
    });

    setEndereco((atual) => {
      if (atual.logradouro) return atual;
      const logradouro = (dadosEmpresa.sedeLogradouro || dadosEmpresa.logradouro) as string | undefined;
      if (!logradouro) return atual;
      return {
        tipo: "",
        logradouro,
        numero: (dadosEmpresa.numero as string) || "",
        complemento: (dadosEmpresa.complemento as string) || "",
        bairro: (dadosEmpresa.bairro as string) || "",
        municipio: ((dadosEmpresa.sedeMunicipio || dadosEmpresa.municipio) as string) || "",
        uf: ((dadosEmpresa.sedeUf || dadosEmpresa.uf) as string) || "",
        cep: ((dadosEmpresa.sedeCep || dadosEmpresa.cep) as string) || "",
      };
    });

    if (dadosEmpresa.quotasTotal || dadosEmpresa.capital) {
      setCapital((atual) => ({
        valor: atual.valor || ((dadosEmpresa.capital as string) ?? ""),
        valorQuota: atual.valorQuota || ((dadosEmpresa.quotaValor as string) ?? ""),
        totalQuotas: atual.totalQuotas || ((dadosEmpresa.quotasTotal as string) ?? ""),
      }));
    }

    if (sociosExtraidos.length) {
      setSocios((atual) => {
        const jaTemDados = atual.some((s) => s.nome.trim());
        if (jaTemDados) return atual;
        return sociosExtraidos.map((s) => ({
          pessoa: s.pessoa,
          nome: s.nome,
          doc: s.doc,
          nasc: s.nasc,
          nac: s.nac,
          pais: s.pais,
          renda: "",
          quotas: s.quotas || "",
          pct: s.pct || "",
          pep: "",
          endereco: s.endereco,
          obs: s.obs || "",
          auto: true,
        }));
      });
    }

    if (adminsExtraidos.length) {
      setAssinantes((atual) => {
        const jaTemDados = atual.some((a) => a.nome.trim());
        if (jaTemDados) return atual;
        return adminsExtraidos.map((a) => ({
          nome: a.nome,
          cpf: a.cpf,
          email: "",
          cargo: a.cargo,
          auto: true,
        }));
      });
    }
  }

  if (estado && "sucesso" in estado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md rounded-lg bg-white p-8 text-center shadow-sm">
          <div className="mb-6 flex justify-center">
            <LogoStrada className="h-8" />
          </div>
          <h1 className="mb-2 text-lg font-semibold text-strada-vinho">Enviado com sucesso</h1>
          <p className="text-sm text-strada-cinza">
            Recebemos sua ficha e os documentos. Nossa equipe de Compliance vai
            analisar e, se precisar de algo, entraremos em contato pelo e-mail
            informado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="border-b border-black/10 bg-strada-vinho px-6 py-6 text-white">
        <div className="mx-auto max-w-3xl">
          <LogoStrada className="h-7" />
          <h1 className="mt-3 text-xl font-semibold">Ficha Cadastral e Declaração KYC</h1>
          <p className="mt-1 max-w-xl text-sm text-white/80">
            Comece subindo os documentos da empresa. A ficha se preenche
            automaticamente com o que estiver no contrato social e no cartão
            CNPJ.
          </p>
        </div>
      </div>

      <form action={formAction} className="mx-auto max-w-3xl space-y-4 p-6">
        {motivoDevolucao && (
          <div className="rounded border border-amber-300 bg-amber-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
              Sua ficha foi devolvida — revise antes de reenviar
            </p>
            <p className="mt-1 text-sm text-amber-900">{motivoDevolucao}</p>
          </div>
        )}

        <Secao numero="00" titulo="Documentos">
          <p className="text-xs text-strada-cinza">
            Contrato social ou última alteração, cartão CNPJ, quadro de sócios
            (QSA), documento pessoal dos sócios, comprovante de endereço,
            procuração e proposta comercial. Aceita PDF e imagens.
          </p>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed border-black/15 bg-gray-50 px-6 py-8 text-center hover:border-strada-laranja">
            <span className="text-sm font-semibold">Arraste os arquivos aqui</span>
            <span className="mt-1 text-xs text-strada-cinza">
              ou clique para escolher do computador
            </span>
            <input
              type="file"
              multiple
              hidden
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={(e) => receberArquivos(e.target.files)}
            />
          </label>
          {processando && (
            <p className="text-xs text-strada-cinza">Lendo documentos…</p>
          )}
          {arquivos.length > 0 && (
            <ul className="divide-y divide-black/5 rounded border border-black/10">
              {arquivos.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="truncate">{a.nome}</span>
                  <span className="shrink-0 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-800">
                    {ROTULO_TIPO[a.tipo] ?? a.tipo}
                  </span>
                  {a.viaOcr && (
                    <span className="shrink-0 rounded bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-800">
                      OCR
                    </span>
                  )}
                  {a.aviso && <span className="text-[11px] text-amber-700">{a.aviso}</span>}
                  <button
                    type="button"
                    onClick={() => setArquivos((prev) => prev.filter((x) => x.nome !== a.nome))}
                    className="shrink-0 text-[11px] text-strada-cinza hover:text-strada-vinho"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Secao>

        <Secao numero="00b" titulo="Checklist de documentos">
          <ul className="space-y-1.5">
            {checklist.map((item) => (
              <li key={item.tipo} className="flex items-center gap-2 text-sm">
                <span
                  className={
                    item.presente
                      ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
                      : item.obrigatorio
                        ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700"
                        : "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
                  }
                >
                  {item.presente ? "✓" : item.obrigatorio ? "!" : "·"}
                </span>
                <span className={item.presente ? "text-strada-cinza line-through" : ""}>
                  {item.rotulo}
                </span>
                {!item.obrigatorio && !item.presente && (
                  <span className="text-[10px] uppercase tracking-wide text-amber-700">recomendado</span>
                )}
              </li>
            ))}
          </ul>
        </Secao>

        <Secao numero="01" titulo="Dados da empresa">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="CNPJ *" auto={autoEmpresa.cnpj}>
              <input
                required
                value={empresa.cnpj}
                onChange={(e) => setEmpresa({ ...empresa, cnpj: e.target.value })}
                className={autoEmpresa.cnpj ? classeInputAuto : classeInput}
              />
            </Campo>
            <Campo label="Razão social *" auto={autoEmpresa.razao}>
              <input
                required
                value={empresa.razao}
                onChange={(e) => setEmpresa({ ...empresa, razao: e.target.value })}
                className={autoEmpresa.razao ? classeInputAuto : classeInput}
              />
            </Campo>
            <Campo label="Nome fantasia" auto={autoEmpresa.fantasia}>
              <input
                value={empresa.fantasia}
                onChange={(e) => setEmpresa({ ...empresa, fantasia: e.target.value })}
                className={autoEmpresa.fantasia ? classeInputAuto : classeInput}
              />
            </Campo>
            <Campo label="CNAE principal *" auto={autoEmpresa.cnae}>
              <input
                required
                value={empresa.cnae}
                onChange={(e) => setEmpresa({ ...empresa, cnae: e.target.value })}
                className={autoEmpresa.cnae ? classeInputAuto : classeInput}
              />
            </Campo>
            <Campo label="Quantidade de filiais">
              <input
                type="number"
                min="0"
                value={empresa.filiais}
                onChange={(e) => setEmpresa({ ...empresa, filiais: e.target.value })}
                className={classeInput}
              />
            </Campo>
            <Campo label="Faturamento mensal (R$) *">
              <input
                required
                inputMode="numeric"
                value={empresa.fatMes}
                onChange={(e) => setEmpresa({ ...empresa, fatMes: formatarMoeda(e.target.value) })}
                className={classeInput}
              />
            </Campo>
            <Campo label="Faturamento anual (R$) *">
              <input
                required
                inputMode="numeric"
                value={empresa.fatAno}
                onChange={(e) => setEmpresa({ ...empresa, fatAno: formatarMoeda(e.target.value) })}
                className={classeInput}
              />
            </Campo>
            <div className="col-span-2">
              <Campo label="Objeto social" auto={autoEmpresa.objeto}>
                <textarea
                  rows={2}
                  value={empresa.objeto}
                  onChange={(e) => setEmpresa({ ...empresa, objeto: e.target.value })}
                  className={autoEmpresa.objeto ? classeInputAuto : classeInput}
                />
              </Campo>
            </div>
          </div>
        </Secao>

        <Secao numero="02" titulo="Endereço da sede e de entrega">
          <div className="grid grid-cols-4 gap-3">
            <Campo label="Tipo *">
              <input required value={endereco.tipo} onChange={(e) => setEndereco({ ...endereco, tipo: e.target.value })} className={classeInput} />
            </Campo>
            <div className="col-span-2">
              <Campo label="Logradouro *">
                <input required value={endereco.logradouro} onChange={(e) => setEndereco({ ...endereco, logradouro: e.target.value })} className={classeInput} />
              </Campo>
            </div>
            <Campo label="Nº *">
              <input required value={endereco.numero} onChange={(e) => setEndereco({ ...endereco, numero: e.target.value })} className={classeInput} />
            </Campo>
            <Campo label="Complemento">
              <input value={endereco.complemento} onChange={(e) => setEndereco({ ...endereco, complemento: e.target.value })} className={classeInput} />
            </Campo>
            <Campo label="Bairro *">
              <input required value={endereco.bairro} onChange={(e) => setEndereco({ ...endereco, bairro: e.target.value })} className={classeInput} />
            </Campo>
            <Campo label="Município *">
              <input required value={endereco.municipio} onChange={(e) => setEndereco({ ...endereco, municipio: e.target.value })} className={classeInput} />
            </Campo>
            <Campo label="UF *">
              <input required maxLength={2} value={endereco.uf} onChange={(e) => setEndereco({ ...endereco, uf: e.target.value })} className={classeInput} />
            </Campo>
            <Campo label="CEP *">
              <input required value={endereco.cep} onChange={(e) => setEndereco({ ...endereco, cep: e.target.value })} className={classeInput} />
            </Campo>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={mesmoEndereco} onChange={(e) => setMesmoEndereco(e.target.checked)} />
            O endereço de entrega dos cartões e materiais é o mesmo da sede
          </label>
          {!mesmoEndereco && (
            <div className="grid grid-cols-4 gap-3 border-t border-black/5 pt-3">
              <Campo label="Tipo">
                <input value={entrega.tipo} onChange={(e) => setEntrega({ ...entrega, tipo: e.target.value })} className={classeInput} />
              </Campo>
              <div className="col-span-2">
                <Campo label="Logradouro">
                  <input value={entrega.logradouro} onChange={(e) => setEntrega({ ...entrega, logradouro: e.target.value })} className={classeInput} />
                </Campo>
              </div>
              <Campo label="Nº">
                <input value={entrega.numero} onChange={(e) => setEntrega({ ...entrega, numero: e.target.value })} className={classeInput} />
              </Campo>
              <Campo label="Bairro">
                <input value={entrega.bairro} onChange={(e) => setEntrega({ ...entrega, bairro: e.target.value })} className={classeInput} />
              </Campo>
              <Campo label="Município">
                <input value={entrega.municipio} onChange={(e) => setEntrega({ ...entrega, municipio: e.target.value })} className={classeInput} />
              </Campo>
              <Campo label="UF">
                <input maxLength={2} value={entrega.uf} onChange={(e) => setEntrega({ ...entrega, uf: e.target.value })} className={classeInput} />
              </Campo>
              <Campo label="CEP">
                <input value={entrega.cep} onChange={(e) => setEntrega({ ...entrega, cep: e.target.value })} className={classeInput} />
              </Campo>
            </div>
          )}
        </Secao>

        <Secao numero="03" titulo="Quem assina pela empresa">
          <p className="text-xs text-strada-cinza">
            Vêm do contrato social os administradores e a forma de
            assinatura. Confirme e informe o e-mail nominal de cada
            assinante.
          </p>
          {assinantes.map((a, i) => (
            <div key={i} className="grid grid-cols-2 gap-3 border-t border-black/5 pt-3 first:border-0 first:pt-0">
              <Campo label="Nome completo *" auto={a.auto}>
                <input
                  required
                  value={a.nome}
                  onChange={(e) => setAssinantes(assinantes.map((x, xi) => (xi === i ? { ...x, nome: e.target.value } : x)))}
                  className={a.auto ? classeInputAuto : classeInput}
                />
              </Campo>
              <Campo label="CPF *" auto={a.auto}>
                <input
                  required
                  value={a.cpf}
                  onChange={(e) => setAssinantes(assinantes.map((x, xi) => (xi === i ? { ...x, cpf: e.target.value } : x)))}
                  className={a.auto && a.cpf ? classeInputAuto : classeInput}
                />
              </Campo>
              <Campo label="E-mail nominal *">
                <input
                  type="email"
                  required
                  value={a.email}
                  onChange={(e) => setAssinantes(assinantes.map((x, xi) => (xi === i ? { ...x, email: e.target.value } : x)))}
                  className={classeInput}
                />
              </Campo>
              <Campo label="Cargo / forma de assinatura *" auto={a.auto}>
                <input
                  required
                  value={a.cargo}
                  onChange={(e) => setAssinantes(assinantes.map((x, xi) => (xi === i ? { ...x, cargo: e.target.value } : x)))}
                  className={a.auto ? classeInputAuto : classeInput}
                />
              </Campo>
              {assinantes.length > 1 && (
                <button
                  type="button"
                  onClick={() => setAssinantes(assinantes.filter((_, xi) => xi !== i))}
                  className="col-span-2 justify-self-start text-xs text-strada-cinza hover:text-strada-vinho"
                >
                  Remover assinante
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setAssinantes([...assinantes, assinanteVazio()])}
            className="text-xs text-strada-laranja hover:underline"
          >
            + adicionar assinante
          </button>
        </Secao>

        <Secao numero="04" titulo="Testemunha">
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Nome completo *">
              <input required value={testemunha.nome} onChange={(e) => setTestemunha({ ...testemunha, nome: e.target.value })} className={classeInput} />
            </Campo>
            <Campo label="CPF *">
              <input required value={testemunha.cpf} onChange={(e) => setTestemunha({ ...testemunha, cpf: e.target.value })} className={classeInput} />
            </Campo>
            <Campo label="E-mail *">
              <input type="email" required value={testemunha.email} onChange={(e) => setTestemunha({ ...testemunha, email: e.target.value })} className={classeInput} />
            </Campo>
          </div>
        </Secao>

        <Secao numero="05" titulo="Contatos">
          {(
            [
              ["financeiro", "Financeiro — responsável pelos aportes"],
              ["juridico", "Jurídico"],
              ["operacional", "Operacional — quem receberá o treinamento"],
            ] as const
          ).map(([chave, titulo]) => (
            <div key={chave} className="rounded border-l-2 border-strada-laranja bg-gray-50 p-3">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-strada-vinho">{titulo}</h4>
              {chave !== "operacional" && (
                <label className="mb-2 flex items-center gap-2 text-xs text-strada-cinza">
                  Preencher com os dados de um assinante:
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const assinante = assinantes[Number(e.target.value)];
                      if (!assinante) return;
                      setContatos((atual) => ({
                        ...atual,
                        [chave]: {
                          ...atual[chave],
                          nome: assinante.nome,
                          email: assinante.email,
                          cargo: assinante.cargo,
                        },
                      }));
                      e.target.value = "";
                    }}
                    className="rounded border border-black/10 px-2 py-1 text-xs"
                  >
                    <option value="">selecionar…</option>
                    {assinantes.map(
                      (a, idx) =>
                        a.nome && (
                          <option key={idx} value={idx}>
                            {a.nome}
                          </option>
                        ),
                    )}
                  </select>
                </label>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Nome *">
                  <input
                    required
                    value={contatos[chave].nome}
                    onChange={(e) => setContatos({ ...contatos, [chave]: { ...contatos[chave], nome: e.target.value } })}
                    className={classeInput}
                  />
                </Campo>
                <Campo label="E-mail *">
                  <input
                    type="email"
                    required
                    value={contatos[chave].email}
                    onChange={(e) => setContatos({ ...contatos, [chave]: { ...contatos[chave], email: e.target.value } })}
                    className={classeInput}
                  />
                </Campo>
                <Campo label="Telefone *">
                  <input
                    required
                    value={contatos[chave].telefone}
                    onChange={(e) => setContatos({ ...contatos, [chave]: { ...contatos[chave], telefone: e.target.value } })}
                    className={classeInput}
                  />
                </Campo>
                <Campo label="Cargo *">
                  <input
                    required
                    value={contatos[chave].cargo}
                    onChange={(e) => setContatos({ ...contatos, [chave]: { ...contatos[chave], cargo: e.target.value } })}
                    className={classeInput}
                  />
                </Campo>
              </div>
            </div>
          ))}
        </Secao>

        <Secao numero="06" titulo="Conta de pagamento pré-paga">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Tipo de conta *">
              <select
                required
                value={conta.tipo}
                onChange={(e) => setConta({ ...conta, tipo: e.target.value })}
                className={classeInput}
              >
                <option value="">Selecione…</option>
                <option>Padrão (FSV) — Frete pré-pago + Sem Parar + Visa Cargo</option>
                <option>Frete + Sem Parar (FS)</option>
                <option>Frete + Visa Cargo (FV)</option>
                <option>Sem Parar + Visa Cargo (SV)</option>
                <option>Frete pré-pago (F)</option>
                <option>VPO Sem Parar (S)</option>
                <option>VPO Visa Pedágio (V)</option>
              </select>
            </Campo>
            <Campo label="Usará a rede credenciada Strada Bank? *">
              <select
                required
                value={conta.redeStradaBank}
                onChange={(e) => setConta({ ...conta, redeStradaBank: e.target.value })}
                className={classeInput}
              >
                <option value="">Selecione…</option>
                <option>Não</option>
                <option>Sim</option>
              </select>
            </Campo>
            <Campo label="Saldo mínimo para aviso de aporte *">
              <input
                required
                value={conta.saldoMinimo}
                onChange={(e) => setConta({ ...conta, saldoMinimo: formatarMoeda(e.target.value) })}
                className={classeInput}
              />
            </Campo>
            <Campo label="Modo de finalização das viagens">
              <input
                value={conta.modoFinal}
                onChange={(e) => setConta({ ...conta, modoFinal: e.target.value })}
                className={classeInput}
              />
            </Campo>
          </div>
        </Secao>

        <Secao numero="07" titulo="Capital social">
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Capital social (R$) *">
              <input
                required
                value={capital.valor}
                onChange={(e) => setCapital({ ...capital, valor: formatarMoeda(e.target.value) })}
                className={classeInput}
              />
            </Campo>
            <Campo label="Valor unitário da quota (R$) *">
              <input
                required
                value={capital.valorQuota}
                onChange={(e) => setCapital({ ...capital, valorQuota: formatarMoeda(e.target.value) })}
                className={classeInput}
              />
            </Campo>
            <Campo label="Total de quotas *">
              <input required value={capital.totalQuotas} onChange={(e) => setCapital({ ...capital, totalQuotas: e.target.value })} className={classeInput} />
            </Campo>
          </div>
        </Secao>

        <Secao numero="08" titulo="Sócios, beneficiários finais e declaração KYC">
          <div className="rounded border border-black/10 bg-gray-50 p-3 text-xs text-strada-cinza">
            <strong className="text-strada-vinho">Pessoa Exposta Politicamente (PEP).</strong> Conforme
            a Circular BACEN nº 3.978, é PEP quem exerce ou exerceu nos
            últimos cinco anos cargo, emprego ou função pública relevante no
            Brasil ou no exterior.
          </div>
          {socios.map((s, i) => (
            <div key={i} className="grid grid-cols-3 gap-3 border-t border-black/5 pt-3 first:border-0 first:pt-0">
              <Campo label="Pessoa *">
                <select
                  required
                  value={s.pessoa}
                  onChange={(e) => setSocios(socios.map((x, xi) => (xi === i ? { ...x, pessoa: e.target.value as "PF" | "PJ" } : x)))}
                  className={classeInput}
                >
                  <option value="PF">Física</option>
                  <option value="PJ">Jurídica</option>
                </select>
              </Campo>
              <div className="col-span-2">
                <Campo label="Nome completo ou razão social *" auto={s.auto}>
                  <input
                    required
                    value={s.nome}
                    onChange={(e) => setSocios(socios.map((x, xi) => (xi === i ? { ...x, nome: e.target.value } : x)))}
                    className={s.auto ? classeInputAuto : classeInput}
                  />
                </Campo>
              </div>
              <Campo label="CPF ou CNPJ *" auto={s.auto}>
                <input
                  required
                  value={s.doc}
                  onChange={(e) => setSocios(socios.map((x, xi) => (xi === i ? { ...x, doc: e.target.value } : x)))}
                  className={s.auto ? classeInputAuto : classeInput}
                />
              </Campo>
              {s.pessoa === "PF" && (
                <Campo label="Data de nascimento *">
                  <input
                    type="date"
                    required
                    value={s.nasc}
                    onChange={(e) => setSocios(socios.map((x, xi) => (xi === i ? { ...x, nasc: e.target.value } : x)))}
                    className={classeInput}
                  />
                </Campo>
              )}
              <Campo label="Renda mensal (R$) *">
                <input
                  required
                  value={s.renda}
                  onChange={(e) =>
                    setSocios(socios.map((x, xi) => (xi === i ? { ...x, renda: formatarMoeda(e.target.value) } : x)))
                  }
                  className={classeInput}
                />
              </Campo>
              <Campo label="Quantidade de quotas *" auto={s.auto && !!s.quotas}>
                <input
                  required
                  value={s.quotas}
                  onChange={(e) => setSocios(socios.map((x, xi) => (xi === i ? { ...x, quotas: e.target.value } : x)))}
                  className={s.auto && s.quotas ? classeInputAuto : classeInput}
                />
              </Campo>
              <Campo label="% do capital social *" auto={s.auto && !!s.pct}>
                <input
                  required
                  value={s.pct}
                  onChange={(e) =>
                    setSocios(socios.map((x, xi) => (xi === i ? { ...x, pct: formatarPercentual(e.target.value) } : x)))
                  }
                  className={s.auto && s.pct ? classeInputAuto : classeInput}
                />
              </Campo>
              <Campo label="É Pessoa Exposta Politicamente? *">
                <select
                  required
                  value={s.pep}
                  onChange={(e) => setSocios(socios.map((x, xi) => (xi === i ? { ...x, pep: e.target.value } : x)))}
                  className={classeInput}
                >
                  <option value="">Selecione…</option>
                  <option value="Não">Não</option>
                  <option value="Sim">Sim</option>
                </select>
              </Campo>
              <div className="col-span-3">
                <Campo label="Endereço residencial completo *" auto={s.auto && !!s.endereco}>
                  <input
                    required
                    value={s.endereco}
                    onChange={(e) => setSocios(socios.map((x, xi) => (xi === i ? { ...x, endereco: e.target.value } : x)))}
                    className={s.auto && s.endereco ? classeInputAuto : classeInput}
                  />
                </Campo>
              </div>
              {socios.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSocios(socios.filter((_, xi) => xi !== i))}
                  className="col-span-3 justify-self-start text-xs text-strada-cinza hover:text-strada-vinho"
                >
                  Remover sócio
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setSocios([...socios, socioVazio()])}
            className="text-xs text-strada-laranja hover:underline"
          >
            + adicionar sócio ou beneficiário final
          </button>
        </Secao>

        <Secao numero="09" titulo="Declarações">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              required
              checked={declaracoes.pep}
              onChange={(e) => setDeclaracoes({ ...declaracoes, pep: e.target.checked })}
              className="mt-0.5"
            />
            Li e compreendi a definição de Pessoa Exposta Politicamente e
            respondi a autodeclaração de cada sócio.
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              required
              checked={declaracoes.procuracoes}
              onChange={(e) => setDeclaracoes({ ...declaracoes, procuracoes: e.target.checked })}
              className="mt-0.5"
            />
            Declaro que os únicos com poderes para representar a empresa são
            os assinantes indicados nesta ficha.
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              required
              checked={declaracoes.veracidade}
              onChange={(e) => setDeclaracoes({ ...declaracoes, veracidade: e.target.checked })}
              className="mt-0.5"
            />
            Declaro que todas as informações prestadas são verdadeiras e me
            responsabilizo por elas.
          </label>
        </Secao>

        <Secao numero="10" titulo="Conferência automática">
          {conferencia.erros.length === 0 && conferencia.alertas.length === 0 && (
            <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Nenhuma inconsistência encontrada até o momento.
            </p>
          )}
          {conferencia.erros.length > 0 && (
            <div className="rounded border border-red-200 bg-red-50 p-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-red-800">
                Erros — impedem o envio
              </p>
              <ul className="list-inside list-disc space-y-0.5 text-sm text-red-800">
                {conferencia.erros.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {conferencia.alertas.length > 0 && (
            <div className="rounded border border-amber-200 bg-amber-50 p-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-800">
                Alertas — revisar, mas não impedem o envio
              </p>
              <ul className="list-inside list-disc space-y-0.5 text-sm text-amber-800">
                {conferencia.alertas.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </Secao>

        {estado && "erro" in estado && (
          <p className="rounded border border-strada-vinho/30 bg-red-50 p-3 text-sm text-strada-vinho">
            {estado.erro}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando || processando || arquivosSemUpload || conferencia.erros.length > 0}
          className="w-full rounded bg-strada-laranja py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {enviando
            ? "Enviando…"
            : arquivosSemUpload
              ? "Aguarde o envio dos arquivos ou remova os que falharam"
              : conferencia.erros.length > 0
                ? "Corrija os erros da conferência automática para enviar"
                : "Enviar para análise"}
        </button>
      </form>
    </div>
  );
}
