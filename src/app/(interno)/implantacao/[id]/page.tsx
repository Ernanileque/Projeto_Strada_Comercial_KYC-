import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";
import { PRODUTO_LABEL, type ProdutoCredenciamento } from "@/lib/estados";
import { VerDocumentoBotao } from "../../compliance/VerDocumentoBotao";
import { ImplantacaoPainel } from "./ImplantacaoPainel";

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

/** Storage path é "{credenciamentoId}/{timestamp}-{nomeOriginal}" — extrai só o nome. */
function nomeOriginalArquivo(caminho: string): string {
  const arquivo = caminho.split("/").pop() ?? caminho;
  return arquivo.replace(/^\d+-/, "");
}

export default async function CredenciamentoImplantacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: credenciamento } = await supabase
    .from("credenciamento")
    .select(
      "id, status, produto, cliente:cliente_id(razao_social, cnpj, contato_nome, contato_email, contato_fone)",
    )
    .eq("id", id)
    .single();

  if (!credenciamento) notFound();

  const [{ data: implantacao }, { data: documentos }, { data: contratos }] = await Promise.all([
    supabase.from("implantacao").select("iniciada_em, operando_em").eq("credenciamento_id", id).maybeSingle(),
    supabase
      .from("documento")
      .select("id, tipo, arquivo_url, enviado_em")
      .eq("credenciamento_id", id)
      .order("enviado_em"),
    supabase
      .from("contrato")
      .select("id, produto, arquivo_url, status, assinado_em")
      .eq("credenciamento_id", id),
  ]);

  const cliente = credenciamento.cliente as unknown as {
    razao_social: string;
    cnpj: string;
    contato_nome: string | null;
    contato_email: string | null;
    contato_fone: string | null;
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">{cliente?.razao_social}</h2>
          <p className="text-sm text-strada-cinza">
            {cliente?.cnpj} — {PRODUTO_LABEL[credenciamento.produto as ProdutoCredenciamento]}
          </p>
        </div>
        <StatusBadge status={credenciamento.status} />
      </div>

      <ImplantacaoPainel
        credenciamentoId={credenciamento.id}
        status={credenciamento.status}
        implantacao={implantacao ?? null}
      />

      <section className="overflow-hidden rounded border border-black/10 bg-white">
        <h3 className="bg-strada-vinho px-4 py-2 text-xs font-bold uppercase tracking-wide text-white">
          Documentos para implantação
        </h3>
        <ul className="divide-y divide-black/5 p-4 pt-0">
          {contratos?.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-4">
              <div>
                <span className="font-medium">Contrato — {PRODUTO_LABEL[c.produto as ProdutoCredenciamento]}</span>
                {c.assinado_em && (
                  <span className="ml-2 text-xs text-strada-cinza">
                    assinado em {new Date(c.assinado_em).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
              {c.arquivo_url && <VerDocumentoBotao caminho={c.arquivo_url} />}
            </li>
          ))}
          {documentos?.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-4">
              <div>
                <span className="font-medium">{ROTULO_TIPO_DOCUMENTO[d.tipo] ?? d.tipo}</span>
                <span className="ml-2 text-xs text-strada-cinza">{nomeOriginalArquivo(d.arquivo_url)}</span>
              </div>
              <VerDocumentoBotao caminho={d.arquivo_url} />
            </li>
          ))}
          {!contratos?.length && !documentos?.length && (
            <p className="py-4 text-sm text-strada-cinza">Nenhum documento disponível ainda.</p>
          )}
        </ul>
      </section>

      <section className="overflow-hidden rounded border border-black/10 bg-white">
        <h3 className="bg-strada-vinho px-4 py-2 text-xs font-bold uppercase tracking-wide text-white">
          Contato comercial (registrado na abertura)
        </h3>
        <dl className="grid grid-cols-3 gap-3 p-4">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-strada-cinza">Nome</dt>
            <dd className="text-sm">{cliente?.contato_nome || "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-strada-cinza">E-mail</dt>
            <dd className="text-sm">{cliente?.contato_email || "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-strada-cinza">Telefone</dt>
            <dd className="text-sm">{cliente?.contato_fone || "—"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
