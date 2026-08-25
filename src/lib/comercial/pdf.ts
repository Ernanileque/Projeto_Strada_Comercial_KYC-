import CloudConvert from "cloudconvert";

/**
 * Converte o .docx da proposta em PDF via CloudConvert, mantendo a
 * formatação exata do modelo aprovado pelo jurídico (capa centralizada,
 * quebras de página etc.) — o que uma conversão local via HTML não
 * preserva.
 */
export async function converterDocxParaPdf(docxBuffer: Buffer, nomeArquivo: string): Promise<Buffer> {
  const apiKey = process.env.CLOUDCONVERT_API_KEY;
  if (!apiKey) {
    throw new Error("CLOUDCONVERT_API_KEY não configurada — a conversão para PDF ainda não está disponível.");
  }

  const cloudConvert = new CloudConvert(apiKey);

  let job = await cloudConvert.jobs.create({
    tasks: {
      "importar-docx": { operation: "import/upload" },
      "converter-pdf": {
        operation: "convert",
        input: "importar-docx",
        input_format: "docx",
        output_format: "pdf",
      },
      "exportar-pdf": { operation: "export/url", input: "converter-pdf" },
    },
  });

  const tarefaUpload = job.tasks.find((t) => t.name === "importar-docx");
  if (!tarefaUpload) throw new Error("Falha ao iniciar conversão da proposta para PDF.");
  await cloudConvert.tasks.upload(tarefaUpload, docxBuffer, nomeArquivo);

  job = await cloudConvert.jobs.wait(job.id);

  const tarefaExportar = job.tasks.find((t) => t.operation === "export/url" && t.status === "finished");
  const arquivoUrl = tarefaExportar?.result?.files?.[0]?.url;
  if (!arquivoUrl) {
    const tarefaComErro = job.tasks.find((t) => t.status === "error");
    throw new Error(`Falha ao converter proposta para PDF: ${tarefaComErro?.message ?? "erro desconhecido"}`);
  }

  const resposta = await fetch(arquivoUrl);
  if (!resposta.ok) throw new Error("Falha ao baixar PDF convertido da proposta.");
  return Buffer.from(await resposta.arrayBuffer());
}
