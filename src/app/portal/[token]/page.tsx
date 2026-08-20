import { createAdminClient } from "@/lib/supabase/admin";
import { LogoStrada } from "@/components/LogoStrada";
import { FormularioPortal } from "./FormularioPortal";

function TelaMensagem({ titulo, mensagem }: { titulo: string; mensagem: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md rounded-lg bg-white p-8 text-center shadow-sm">
        <div className="mb-6 flex justify-center">
          <LogoStrada className="h-8" />
        </div>
        <h1 className="mb-2 text-lg font-semibold text-strada-vinho">{titulo}</h1>
        <p className="text-sm text-strada-cinza">{mensagem}</p>
      </div>
    </div>
  );
}

export default async function PortalClientePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: credenciamento } = await admin
    .from("credenciamento")
    .select("status, expira_em, cliente:cliente_id(cnpj)")
    .eq("token", token)
    .single();

  if (!credenciamento) {
    return (
      <TelaMensagem
        titulo="Link inválido"
        mensagem="Não encontramos nenhuma solicitação para este link. Confira o link recebido ou fale com seu contato comercial na Strada."
      />
    );
  }

  if (
    credenciamento.expira_em &&
    new Date(credenciamento.expira_em) < new Date() &&
    credenciamento.status === "AGUARDANDO_CLIENTE"
  ) {
    return (
      <TelaMensagem
        titulo="Link expirado"
        mensagem="Este link não está mais válido. Peça ao seu contato comercial na Strada para gerar um novo."
      />
    );
  }

  if (credenciamento.status !== "AGUARDANDO_CLIENTE") {
    return (
      <TelaMensagem
        titulo="Enviado, aguarde"
        mensagem="Já recebemos seus documentos. Nossa equipe está analisando e entraremos em contato se precisarmos de algo."
      />
    );
  }

  const cliente = credenciamento.cliente as unknown as { cnpj: string } | null;

  return <FormularioPortal token={token} cnpjRegistrado={cliente?.cnpj ?? ""} />;
}
