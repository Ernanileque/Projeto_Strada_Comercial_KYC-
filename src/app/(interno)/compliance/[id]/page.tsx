import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";
import { VerDocumentoBotao } from "../VerDocumentoBotao";
import { ValidadorPainel } from "./ValidadorPainel";

const ROTULO_TIPO_DOCUMENTO: Record<string, string> = {
  contrato_social: "Contrato social",
  cartao_cnpj_qsa: "Cartão CNPJ / QSA",
  proposta_comercial: "Proposta comercial",
  rg_cnh_representante: "Documento pessoal (RG/CNH)",
  ficha_cadastral: "Ficha cadastral",
  estatuto_social: "Estatuto social",
  ata_eleicao: "Ata de eleição",
  comprovante_bancario: "Comprovante bancário",
  comprovante_endereco: "Comprovante de endereço",
  rg_cpf_socio: "RG/CPF de sócio",
  outro: "Outro",
};

interface Assinante {
  nome: string;
  cpf: string;
  email: string;
  cargo: string;
}

interface Contato {
  nome: string;
  email: string;
  telefone: string;
  cargo: string;
}

interface DadosFicha {
  empresa?: Record<string, string>;
  endereco?: Record<string, string>;
  entrega?: string | Record<string, string>;
  assinantes?: Assinante[];
  contatos?: { financeiro?: Contato; juridico?: Contato; operacional?: Contato };
  conta?: Record<string, string>;
  capital?: Record<string, string>;
  declaracoes?: { pep?: boolean; procuracoes?: boolean; veracidade?: boolean };
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded border border-black/10 bg-white">
      <h3 className="bg-strada-vinho px-4 py-2 text-xs font-bold uppercase tracking-wide text-white">
        {titulo}
      </h3>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Campo({ label, valor }: { label: string; valor?: string | number | null }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-strada-cinza">{label}</dt>
      <dd className="text-sm">{valor || valor === 0 ? valor : "—"}</dd>
    </div>
  );
}

export default async function CredenciamentoCompliancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: credenciamento } = await supabase
    .from("credenciamento")
    .select(
      "id, status, criado_em, cliente:cliente_id(razao_social, cnpj, contato_nome, contato_email, contato_fone)",
    )
    .eq("id", id)
    .single();

  if (!credenciamento) notFound();

  const [{ data: ficha }, { data: documentos }, { data: socios }, { data: testemunha }, { data: validacoes }] =
    await Promise.all([
      supabase.from("ficha_kyc").select("dados_json").eq("credenciamento_id", id).maybeSingle(),
      supabase
        .from("documento")
        .select("id, tipo, arquivo_url, enviado_em")
        .eq("credenciamento_id", id)
        .order("enviado_em"),
      supabase
        .from("socio")
        .select("id, nome, cpf, participacao, pep_flag, email")
        .eq("credenciamento_id", id),
      supabase.from("testemunha").select("nome, cpf, email").eq("credenciamento_id", id).maybeSingle(),
      supabase
        .from("validacao")
        .select("id, validador, resultado, alertas_json, validado_em")
        .eq("credenciamento_id", id)
        .order("validado_em", { ascending: false }),
    ]);

  const cliente = credenciamento.cliente as unknown as {
    razao_social: string;
    cnpj: string;
    contato_nome: string | null;
    contato_email: string | null;
    contato_fone: string | null;
  };
  const dados = (ficha?.dados_json ?? {}) as DadosFicha;
  const empresa = dados.empresa ?? {};
  const endereco = dados.endereco ?? {};
  const entrega = dados.entrega;
  const capital = dados.capital ?? {};
  const conta = dados.conta ?? {};
  const declaracoes = dados.declaracoes ?? {};
  const contatos = dados.contatos ?? {};

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">{cliente?.razao_social}</h2>
          <p className="text-sm text-strada-cinza">{cliente?.cnpj}</p>
        </div>
        <StatusBadge status={credenciamento.status} />
      </div>

      <Bloco titulo="Dados da empresa">
        <dl className="grid grid-cols-3 gap-3">
          <Campo label="CNPJ" valor={empresa.cnpj} />
          <Campo label="Razão social" valor={empresa.razao} />
          <Campo label="Nome fantasia" valor={empresa.fantasia} />
          <Campo label="CNAE principal" valor={empresa.cnae} />
          <Campo label="Quantidade de filiais" valor={empresa.filiais} />
          <Campo label="Faturamento mensal" valor={empresa.fatMes && `R$ ${empresa.fatMes}`} />
          <Campo label="Faturamento anual" valor={empresa.fatAno && `R$ ${empresa.fatAno}`} />
          <div className="col-span-3">
            <Campo label="Objeto social" valor={empresa.objeto} />
          </div>
        </dl>
      </Bloco>

      <Bloco titulo="Endereço">
        <dl className="grid grid-cols-4 gap-3">
          <Campo label="Tipo" valor={endereco.tipo} />
          <div className="col-span-2">
            <Campo label="Logradouro" valor={endereco.logradouro} />
          </div>
          <Campo label="Nº" valor={endereco.numero} />
          <Campo label="Complemento" valor={endereco.complemento} />
          <Campo label="Bairro" valor={endereco.bairro} />
          <Campo label="Município" valor={endereco.municipio} />
          <Campo label="UF" valor={endereco.uf} />
          <Campo label="CEP" valor={endereco.cep} />
        </dl>
        {entrega && (
          <p className="mt-3 border-t border-black/5 pt-3 text-xs text-strada-cinza">
            Entrega:{" "}
            {entrega === "mesmo-da-sede"
              ? "mesmo endereço da sede"
              : [
                  (entrega as Record<string, string>).logradouro,
                  (entrega as Record<string, string>).numero,
                  (entrega as Record<string, string>).municipio,
                  (entrega as Record<string, string>).uf,
                ]
                  .filter(Boolean)
                  .join(", ")}
          </p>
        )}
      </Bloco>

      <Bloco titulo="Quem assina pela empresa">
        <div className="space-y-3">
          {(dados.assinantes ?? []).map((a, i) => (
            <dl key={i} className="grid grid-cols-4 gap-3 border-t border-black/5 pt-3 first:border-0 first:pt-0">
              <Campo label="Nome" valor={a.nome} />
              <Campo label="CPF" valor={a.cpf} />
              <Campo label="E-mail" valor={a.email} />
              <Campo label="Cargo / assinatura" valor={a.cargo} />
            </dl>
          ))}
          {!dados.assinantes?.length && <p className="text-sm text-strada-cinza">Nenhum assinante informado.</p>}
        </div>
      </Bloco>

      <Bloco titulo="Testemunha">
        <dl className="grid grid-cols-3 gap-3">
          <Campo label="Nome" valor={testemunha?.nome} />
          <Campo label="CPF" valor={testemunha?.cpf} />
          <Campo label="E-mail" valor={testemunha?.email} />
        </dl>
      </Bloco>

      <Bloco titulo="Sócios, beneficiários finais e PEP">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-xs text-strada-cinza">
                <th className="py-1.5 pr-3 font-medium">Nome</th>
                <th className="py-1.5 pr-3 font-medium">CPF/CNPJ</th>
                <th className="py-1.5 pr-3 font-medium">Participação</th>
                <th className="py-1.5 pr-3 font-medium">E-mail</th>
                <th className="py-1.5 font-medium">PEP</th>
              </tr>
            </thead>
            <tbody>
              {socios?.map((s) => (
                <tr key={s.id} className="border-b border-black/5 last:border-0">
                  <td className="py-1.5 pr-3">{s.nome}</td>
                  <td className="py-1.5 pr-3">{s.cpf || "—"}</td>
                  <td className="py-1.5 pr-3">{s.participacao != null ? `${s.participacao}%` : "—"}</td>
                  <td className="py-1.5 pr-3">{s.email || "—"}</td>
                  <td className="py-1.5">
                    {s.pep_flag ? (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        Sim
                      </span>
                    ) : (
                      "Não"
                    )}
                  </td>
                </tr>
              ))}
              {!socios?.length && (
                <tr>
                  <td colSpan={5} className="py-3 text-center text-strada-cinza">
                    Nenhum sócio informado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Bloco>

      <Bloco titulo="Contatos">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(
            [
              ["financeiro", "Financeiro"],
              ["juridico", "Jurídico"],
              ["operacional", "Operacional"],
            ] as const
          ).map(([chave, titulo]) => (
            <div key={chave} className="rounded border-l-2 border-strada-laranja bg-gray-50 p-3">
              <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-strada-vinho">{titulo}</h4>
              <dl className="space-y-1.5">
                <Campo label="Nome" valor={contatos[chave]?.nome} />
                <Campo label="E-mail" valor={contatos[chave]?.email} />
                <Campo label="Telefone" valor={contatos[chave]?.telefone} />
                <Campo label="Cargo" valor={contatos[chave]?.cargo} />
              </dl>
            </div>
          ))}
        </div>
      </Bloco>

      <Bloco titulo="Conta de pagamento e capital social">
        <dl className="grid grid-cols-3 gap-3">
          <Campo label="Tipo de conta" valor={conta.tipo} />
          <Campo label="Usará a rede Strada Bank?" valor={conta.redeStradaBank} />
          <Campo label="Saldo mínimo p/ aviso" valor={conta.saldoMinimo} />
          <Campo label="Capital social" valor={capital.valor && `R$ ${capital.valor}`} />
          <Campo label="Valor unitário da quota" valor={capital.valorQuota && `R$ ${capital.valorQuota}`} />
          <Campo label="Total de quotas" valor={capital.totalQuotas} />
        </dl>
      </Bloco>

      <Bloco titulo="Declarações do cliente">
        <ul className="space-y-1 text-sm">
          <li>{declaracoes.pep ? "✓" : "✗"} Leu a definição de PEP e respondeu a autodeclaração.</li>
          <li>{declaracoes.procuracoes ? "✓" : "✗"} Declarou que só os assinantes têm poderes de representação.</li>
          <li>{declaracoes.veracidade ? "✓" : "✗"} Declarou veracidade das informações.</li>
        </ul>
      </Bloco>

      <Bloco titulo="Documentos anexados">
        <ul className="divide-y divide-black/5">
          {documentos?.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div>
                <span className="font-medium">{ROTULO_TIPO_DOCUMENTO[d.tipo] ?? d.tipo}</span>
                <span className="ml-2 text-xs text-strada-cinza">
                  {new Date(d.enviado_em).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <VerDocumentoBotao caminho={d.arquivo_url} />
            </li>
          ))}
          {!documentos?.length && <p className="py-2 text-sm text-strada-cinza">Nenhum documento anexado.</p>}
        </ul>
      </Bloco>

      <ValidadorPainel
        credenciamentoId={credenciamento.id}
        status={credenciamento.status}
        validacoesIniciais={validacoes ?? []}
      />

      <Bloco titulo="Contato comercial (registrado na abertura)">
        <dl className="grid grid-cols-3 gap-3">
          <Campo label="Nome" valor={cliente?.contato_nome} />
          <Campo label="E-mail" valor={cliente?.contato_email} />
          <Campo label="Telefone" valor={cliente?.contato_fone} />
        </dl>
      </Bloco>
    </div>
  );
}
