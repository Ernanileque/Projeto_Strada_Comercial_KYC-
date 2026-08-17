import type { Area } from "@/lib/areas";

export type StatusCredenciamento =
  | "PROPOSTA_ACEITA"
  | "AGUARDANDO_CLIENTE"
  | "EM_ANALISE"
  | "VALIDADO"
  | "DEVOLVIDO"
  | "REPROVADO"
  | "EM_CONTRATO"
  | "AGUARDANDO_ASSINATURA"
  | "ASSINADO"
  | "EM_IMPLANTACAO"
  | "OPERANDO";

export const SLA_HORAS = 24;

/** Estação (área) responsável por agir em cada status. `null` = ninguém age (estado terminal ou aguardando o cliente). */
export const AREA_RESPONSAVEL: Record<StatusCredenciamento, Area | null> = {
  PROPOSTA_ACEITA: "comercial",
  AGUARDANDO_CLIENTE: null,
  EM_ANALISE: "compliance",
  VALIDADO: "juridico",
  DEVOLVIDO: null,
  REPROVADO: null,
  EM_CONTRATO: "juridico",
  AGUARDANDO_ASSINATURA: "juridico",
  ASSINADO: "implantacao",
  EM_IMPLANTACAO: "implantacao",
  OPERANDO: null,
};

export const STATUS_LABEL: Record<StatusCredenciamento, string> = {
  PROPOSTA_ACEITA: "Proposta aceita",
  AGUARDANDO_CLIENTE: "Aguardando cliente",
  EM_ANALISE: "Em análise (Compliance)",
  VALIDADO: "Validado",
  DEVOLVIDO: "Devolvido ao cliente",
  REPROVADO: "Reprovado",
  EM_CONTRATO: "Em contrato (Jurídico)",
  AGUARDANDO_ASSINATURA: "Aguardando assinatura",
  ASSINADO: "Assinado",
  EM_IMPLANTACAO: "Em implantação",
  OPERANDO: "Operando",
};

/** Cor do badge de status, alinhada à MIV Strada 2026. */
export const STATUS_COR: Record<StatusCredenciamento, string> = {
  PROPOSTA_ACEITA: "bg-gray-100 text-gray-700",
  AGUARDANDO_CLIENTE: "bg-amber-100 text-amber-800",
  EM_ANALISE: "bg-blue-100 text-blue-800",
  VALIDADO: "bg-emerald-100 text-emerald-800",
  DEVOLVIDO: "bg-red-100 text-red-800",
  REPROVADO: "bg-red-100 text-red-800",
  EM_CONTRATO: "bg-indigo-100 text-indigo-800",
  AGUARDANDO_ASSINATURA: "bg-orange-100 text-orange-800",
  ASSINADO: "bg-emerald-100 text-emerald-800",
  EM_IMPLANTACAO: "bg-blue-100 text-blue-800",
  OPERANDO: "bg-emerald-600 text-white",
};

export function horasEmAberto(desde: string | Date): number {
  const inicio = typeof desde === "string" ? new Date(desde) : desde;
  return (Date.now() - inicio.getTime()) / (1000 * 60 * 60);
}

export function estourouSla(desde: string | Date): boolean {
  return horasEmAberto(desde) > SLA_HORAS;
}
