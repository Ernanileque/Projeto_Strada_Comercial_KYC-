/**
 * Portal externo do cliente — acesso via link com token, sem login.
 * Fisicamente separado do grupo de rotas (interno) por exigência de
 * segurança/LGPD do brief. Implementação real chega na Fase 1.
 */
export default async function PortalClientePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await params;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md text-center">
        <h1 className="mb-2 text-lg font-semibold text-strada-vinho">
          Portal do cliente
        </h1>
        <p className="text-sm text-strada-cinza">
          Envio de documentos e ficha KYC — disponível na Fase 1.
        </p>
      </div>
    </div>
  );
}
