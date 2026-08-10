import { STATUS_COR, STATUS_LABEL, type StatusCredenciamento } from "@/lib/estados";

export function StatusBadge({ status }: { status: StatusCredenciamento }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_COR[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
