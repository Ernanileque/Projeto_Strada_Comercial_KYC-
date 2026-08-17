export type TipoContrato = "strada_pay" | "strada_log";

export const TIPO_CONTRATO_LABEL: Record<TipoContrato, string> = {
  strada_pay: "Strada Pay — Pagamento de Frete e Vale-Pedágio",
  strada_log: "Strada Log — Plataforma Logística",
};

export const PRODUTOS_STRADA_LOG = [
  "Strada Match de Cargas",
  "Strada Gestão de Lotes",
  "Strada Integração CIOT TMS",
  "Strada Gestão da Rota",
  "Strada Troca Notas",
  "Strada Portaria",
  "Strada BID",
] as const;
