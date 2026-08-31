import type { ResultadoValidador } from "@/lib/compliance/validador";

function corResultado(resultado: string): string {
  if (resultado === "APTO") return "bg-emerald-100 text-emerald-800";
  if (resultado === "NÃO APTO" || resultado === "NAO_APTO") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
}

export function ResultadoValidadorDisplay({ resultado }: { resultado: ResultadoValidador }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className={`rounded px-3 py-1 text-sm font-bold ${corResultado(resultado.veredicto.resultado)}`}>
          {resultado.veredicto.resultado}
        </span>
        <p className="text-sm text-strada-cinza">{resultado.veredicto.justificativa}</p>
      </div>

      {resultado.erros && resultado.erros.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          {resultado.erros.map((e, i) => (
            <p key={i}>
              Falha na etapa &quot;{e.etapa}&quot;: {e.mensagem}
            </p>
          ))}
        </div>
      )}

      {resultado.analiseCadastral && (
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-strada-vinho">
            Análise cadastral
          </h4>
          <ul className="divide-y divide-black/5 rounded border border-black/10">
            {resultado.analiseCadastral.inconsistencias.map((item, i) => (
              <li key={i} className="p-2 text-sm">
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      item.gravidade === "atencao" ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {item.gravidade === "atencao" ? "Atenção" : "OK"}
                  </span>
                  <div>
                    <p>
                      <span className="font-medium">{item.documento}</span> — {item.campo}: {item.descricao}
                    </p>
                    {item.gravidade === "atencao" && item.acao && item.acao !== "Nenhuma" && (
                      <p className="text-xs text-strada-cinza">Ação sugerida: {item.acao}</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {resultado.analiseCompliance && (
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-strada-vinho">
            Dossiê e beneficiários finais
          </h4>
          <p className="mb-3 whitespace-pre-wrap rounded border border-black/10 bg-gray-50 p-3 text-sm">
            {resultado.analiseCompliance.dossie}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left text-xs text-strada-cinza">
                  <th className="py-1.5 pr-3 font-medium">Nome</th>
                  <th className="py-1.5 pr-3 font-medium">CPF/CNPJ</th>
                  <th className="py-1.5 pr-3 font-medium">Participação</th>
                  <th className="py-1.5 pr-3 font-medium">Benef. final?</th>
                  <th className="py-1.5 font-medium">Recomendação</th>
                </tr>
              </thead>
              <tbody>
                {resultado.analiseCompliance.beneficiarios.map((b, i) => (
                  <tr key={i} className="border-b border-black/5 last:border-0">
                    <td className="py-1.5 pr-3">{b.nome}</td>
                    <td className="py-1.5 pr-3">{b.cpf_cnpj}</td>
                    <td className="py-1.5 pr-3">{b.participacao}</td>
                    <td className="py-1.5 pr-3">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          b.gravidade === "atencao" ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {b.beneficiario_final === "sim" ? "Sim" : "Não"}
                      </span>
                    </td>
                    <td className="py-1.5 text-xs text-strada-cinza">{b.recomendacao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {resultado.analiseReputacional && (
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-strada-vinho">
            Análise reputacional
          </h4>
          <p className="mb-1 text-sm">
            <span className="font-medium">Empresa: </span>
            {resultado.analiseReputacional.empresa_sintese}
          </p>
          <p className="mb-3 text-sm">
            <span className="font-medium">Sócios/administradores: </span>
            {resultado.analiseReputacional.socios_sintese}
          </p>
          <ul className="space-y-1.5">
            {[...resultado.analiseReputacional.empresa_achados, ...resultado.analiseReputacional.socios_achados].map(
              (a, i) => (
                <li key={i} className="rounded border border-black/10 p-2 text-xs">
                  <span
                    className={`mr-2 rounded px-1.5 py-0.5 font-bold uppercase ${
                      a.gravidade === "atencao" ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {a.tipo}
                  </span>
                  <span className="font-medium">{a.nome}</span> — {a.resumo} ({a.fonte}, {a.data})
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
