export type Area =
  | "comercial"
  | "diretoria_comercial"
  | "compliance"
  | "juridico"
  | "implantacao"
  | "gestao";

export const AREAS: Record<Area, { label: string; rota: string }> = {
  comercial: { label: "Comercial", rota: "/comercial" },
  diretoria_comercial: { label: "Diretoria Comercial", rota: "/diretoria-comercial" },
  compliance: { label: "Compliance", rota: "/compliance" },
  juridico: { label: "Jurídico", rota: "/juridico" },
  implantacao: { label: "Implantação", rota: "/implantacao" },
  gestao: { label: "Gestão", rota: "/dashboard" },
};

export const NAV_ITEMS: { area: Area; label: string; rota: string }[] = [
  { area: "comercial", label: "Comercial", rota: "/comercial" },
  { area: "diretoria_comercial", label: "Diretoria Comercial", rota: "/diretoria-comercial" },
  { area: "compliance", label: "Compliance", rota: "/compliance" },
  { area: "juridico", label: "Jurídico", rota: "/juridico" },
  { area: "implantacao", label: "Implantação", rota: "/implantacao" },
  { area: "gestao", label: "Gestão", rota: "/dashboard" },
];
