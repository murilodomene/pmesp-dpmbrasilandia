import type { DenunciaStatus } from "@/lib/prescricao";

const LABELS: Record<DenunciaStatus, string> = {
  novo: "Novo",
  recebida: "Recebida",
  aguardando_analise: "Aguardando análise",
  em_analise: "Em análise",
  em_recurso: "Em Recurso",
  em_investigacao: "Em investigação",
  concluso: "Concluso",
  ag_decurso_prazo: "Aguardando Decurso do Prazo",
  transito_julgado: "Trânsito em Julgado",
  arquivada: "Arquivada",
  concluida: "Concluída",
};

const CLASSES: Record<DenunciaStatus, string> = {
  novo: "bg-sky-500/15 text-sky-300 border border-sky-500/30",
  recebida: "bg-status-recebida text-status-recebida-fg",
  aguardando_analise: "bg-status-aguardando text-status-aguardando-fg",
  em_analise: "bg-status-analise text-status-analise-fg",
  em_recurso: "bg-violet-500/15 text-violet-300 border border-violet-500/30",
  em_investigacao: "bg-status-investigacao text-status-investigacao-fg",
  ag_decurso_prazo: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  transito_julgado: "bg-emerald-600/15 text-emerald-300 border border-emerald-600/30",
  arquivada: "bg-status-arquivada text-status-arquivada-fg",
  concluida: "bg-status-concluida text-status-concluida-fg",
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
