import JSZip from "jszip";
import fs from "fs/promises";
import path from "path";

export interface CondicoesPay {
  taxaFrete?: string;
  taxaVpo?: string;
  semParar?: string;
  moveMais?: string;
  taggyStrada?: string;
}

export interface CondicoesLog {
  gestaoPerformance?: string;
  matchCargas?: string;
  trocaNota?: string;
  gerenciamentoRisco?: string;
  portariaTracking?: string;
  bid?: string;
}

export interface DadosProposta {
  validade?: string;
  vtf?: string;
  localData: string;
  pay?: CondicoesPay;
  log?: CondicoesLog;
}

function escaparXml(valor: string): string {
  return valor.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Remove a seção (título + tabela de preços logo em seguida) quando o produto não foi negociado. */
function removerSecao(xml: string, tituloTexto: string): string {
  const idxTitulo = xml.indexOf(`<w:t>${tituloTexto}</w:t>`);
  if (idxTitulo < 0) return xml;

  const idxInicioParagrafo = xml.lastIndexOf("<w:p>", idxTitulo);
  const idxTblStart = xml.indexOf("<w:tbl>", idxTitulo);
  const idxTblEnd = xml.indexOf("</w:tbl>", idxTblStart) + "</w:tbl>".length;
  if (idxInicioParagrafo < 0 || idxTblStart < 0) return xml;

  return xml.slice(0, idxInicioParagrafo) + xml.slice(idxTblEnd);
}

function caminhoTemplate(): string {
  return path.join(process.cwd(), "src/lib/comercial/templates/proposta.docx");
}

export async function gerarPropostaDocx(dados: DadosProposta): Promise<Buffer> {
  const templateBuffer = await fs.readFile(caminhoTemplate());
  const zip = await JSZip.loadAsync(templateBuffer);
  const arquivoDocumento = zip.file("word/document.xml");
  if (!arquivoDocumento) throw new Error("Modelo de proposta corrompido: word/document.xml não encontrado.");

  let xml = await arquivoDocumento.async("string");

  const pay = dados.pay ?? {};
  const log = dados.log ?? {};

  const substituicoes: Record<string, string> = {
    "{{VALIDADE}}": dados.validade || "—",
    "{{VTF}}": dados.vtf || "—",
    "{{LOCAL_DATA}}": dados.localData,
    "{{TAXA_FRETE}}": pay.taxaFrete || "—",
    "{{TAXA_VPO}}": pay.taxaVpo || "—",
    "{{SEM_PARAR}}": pay.semParar || "—",
    "{{MOVE_MAIS}}": pay.moveMais || "—",
    "{{TAGGY_STRADA}}": pay.taggyStrada || "—",
    "{{GESTAO_PERFORMANCE}}": log.gestaoPerformance || "—",
    "{{MATCH_CARGAS}}": log.matchCargas || "—",
    "{{TROCA_NOTA}}": log.trocaNota || "—",
    "{{GERENCIAMENTO_RISCO}}": log.gerenciamentoRisco || "—",
    "{{PORTARIA_TRACKING}}": log.portariaTracking || "—",
    "{{BID}}": log.bid || "—",
  };

  for (const [token, valor] of Object.entries(substituicoes)) {
    xml = xml.split(token).join(escaparXml(valor));
  }

  if (!dados.pay) xml = removerSecao(xml, "STRADA PAY");
  if (!dados.log) xml = removerSecao(xml, "STRADA LOG");

  zip.file("word/document.xml", xml);
  return zip.generateAsync({ type: "nodebuffer" });
}
