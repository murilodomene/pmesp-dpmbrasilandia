import type { DenunciaStatus } from "@/lib/prescricao";

const LABELS: Record<DenunciaStatus, string> = {
  recebida: "Recebida",
  aguardando_analise: "Aguardando análise",
  em_analise: "Em análise",
  em_investigacao: "Em investigação",
  concluida: "Concluída",
  arquivada: "Arquivada",
};

const CLASSES: Record<DenunciaStatus, string> = {
  recebida: "bg-status-recebida text-status-recebida-fg",
  aguardando_analise: "bg-status-aguardando text-status-aguardando-fg",
  em_analise: "bg-status-analise text-status-analise-fg",
  em_investigacao: "bg-status-investigacao text-status-investigacao-fg",
  concluida: "bg-status-concluida text-status-concluida-fg",
  arquivada: "bg-status-arquivada text-status-arquivada-fg",
};

export function StatusBadge({ status }: { status: DenunciaStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CLASSES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}

export const STATUS_LABEL = LABELS;
