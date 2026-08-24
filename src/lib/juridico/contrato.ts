import JSZip from "jszip";
import fs from "fs/promises";
import path from "path";

export type ProdutoContrato = "STRADA_PAY" | "STRADA_LOG";

export interface DadosContrato {
  razaoSocial: string;
  cnpj: string;
  enderecoCompleto: string;
  contatoNome: string;
  contatoEmail: string;
}

/**
 * Signatário e testemunha fixos da Strada, usados em todo contrato gerado
 * pela plataforma — resolve o problema de excesso de assinaturas internas
 * (antes: Jurídico + CFO + CEO + testemunhas variáveis em cada contrato).
 * O signatário assina com poderes de procuração; ajustar aqui quando a
 * pessoa designada mudar.
 */
export const SIGNATARIO_DESIGNADO_STRADA = {
  nome: "Priscilla Helena Martins de Souza",
  cargo: "Gerente Jurídico",
  email: "priscilla.souza@strada.log.br",
};

export const TESTEMUNHA_FIXA_STRADA = {
  nome: "Ernani Benedito Leque",
  email: "ernani.leque@strada.log.br",
};

function caminhoTemplate(produto: ProdutoContrato): string {
  switch (produto) {
    case "STRADA_PAY":
      return path.join(process.cwd(), "src/lib/juridico/templates/strada_pay.docx");
    case "STRADA_LOG":
      return path.join(process.cwd(), "src/lib/juridico/templates/strada_log.docx");
  }
}

function escaparXml(valor: string): string {
  return valor.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatarEnderecoCompleto(endereco: Record<string, string>): string {
  const partes = [
    endereco.logradouro && `${endereco.logradouro}, nº ${endereco.numero || "S/N"}`,
    endereco.complemento,
    endereco.bairro && `Bairro ${endereco.bairro}`,
    endereco.municipio && endereco.uf ? `${endereco.municipio} - ${endereco.uf}` : endereco.municipio,
    endereco.cep && `CEP ${endereco.cep}`,
  ].filter(Boolean);
  return partes.join(", ");
}

/** Gera o .docx do contrato preenchido a partir do modelo do produto. */
export async function gerarContratoDocx(produto: ProdutoContrato, dados: DadosContrato): Promise<Buffer> {
  const templateBuffer = await fs.readFile(caminhoTemplate(produto));
  const zip = await JSZip.loadAsync(templateBuffer);
  const arquivoDocumento = zip.file("word/document.xml");
  if (!arquivoDocumento) throw new Error("Modelo de contrato corrompido: word/document.xml não encontrado.");

  let xml = await arquivoDocumento.async("string");

  const substituicoes: Record<string, string> = {
    "{{RAZAO_SOCIAL}}": escaparXml(dados.razaoSocial),
    "{{CNPJ}}": escaparXml(dados.cnpj),
    "{{ENDERECO_COMPLETO}}": escaparXml(dados.enderecoCompleto),
    "{{CONTATO_NOME}}": escaparXml(dados.contatoNome),
    "{{CONTATO_EMAIL}}": escaparXml(dados.contatoEmail),
  };

  for (const [token, valor] of Object.entries(substituicoes)) {
    xml = xml.split(token).join(valor);
  }

  zip.file("word/document.xml", xml);
  return zip.generateAsync({ type: "nodebuffer" });
}
