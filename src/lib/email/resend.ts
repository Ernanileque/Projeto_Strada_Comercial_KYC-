import { Resend } from "resend";

const CHECKLIST_DOCUMENTOS = [
  "Contrato social consolidado (ou Estatuto Social + Ata de eleição da diretoria, se aplicável)",
  "Cartão CNPJ",
  "RG ou CNH de quem vai assinar pela empresa",
  "Comprovante de endereço da empresa",
  "Dados bancários para o fluxo financeiro",
];

interface DadosEmailProposta {
  destinatarioEmail: string;
  destinatarioNome: string;
  razaoSocial: string;
  portalUrl: string;
  anexoBuffer: Buffer;
  anexoNomeArquivo: string;
}

function clienteResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY não configurada — o envio de e-mail ainda não está disponível.");
  return new Resend(apiKey);
}

export async function enviarPropostaPorEmail(dados: DadosEmailProposta): Promise<void> {
  const resend = clienteResend();

  const checklistHtml = CHECKLIST_DOCUMENTOS.map((item) => `<li>${item}</li>`).join("");
  const checklistTexto = CHECKLIST_DOCUMENTOS.map((item) => `- ${item}`).join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 600px;">
      <p>Olá${dados.destinatarioNome ? `, ${dados.destinatarioNome}` : ""},</p>
      <p>Segue em anexo a proposta comercial da Strada para a <strong>${dados.razaoSocial}</strong>.</p>
      <p>Para darmos sequência ao credenciamento, acesse o link abaixo e preencha a ficha cadastral, anexando os documentos necessários:</p>
      <p><a href="${dados.portalUrl}" style="color: #C0392B; font-weight: bold;">${dados.portalUrl}</a></p>
      <p><strong>Documentos necessários:</strong></p>
      <ul>${checklistHtml}</ul>
      <p>Qualquer dúvida, estamos à disposição.</p>
      <p>Atenciosamente,<br/>Equipe Comercial Strada</p>
    </div>
  `.trim();

  const text = `Olá${dados.destinatarioNome ? `, ${dados.destinatarioNome}` : ""},

Segue em anexo a proposta comercial da Strada para a ${dados.razaoSocial}.

Para darmos sequência ao credenciamento, acesse o link abaixo e preencha a ficha cadastral, anexando os documentos necessários:
${dados.portalUrl}

Documentos necessários:
${checklistTexto}

Qualquer dúvida, estamos à disposição.

Atenciosamente,
Equipe Comercial Strada`;

  const { error } = await resend.emails.send({
    from: "Strada Comercial <onboarding@resend.dev>",
    to: dados.destinatarioEmail,
    subject: `Proposta comercial Strada — ${dados.razaoSocial}`,
    html,
    text,
    attachments: [
      {
        filename: dados.anexoNomeArquivo,
        content: dados.anexoBuffer,
      },
    ],
  });

  if (error) throw new Error(`Falha ao enviar e-mail: ${error.message}`);
}
