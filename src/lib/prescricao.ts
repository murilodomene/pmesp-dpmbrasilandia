/**
 * Núcleo de prescrição — puro, sem estado, sem I/O.
 *
 * Regra invariante: os dias restantes NUNCA são armazenados. São sempre
 * derivados de `15 + acréscimos − dias corridos desde o termo inicial`.
 *
 * - Interrupção: redefine termo_inicial e zera acréscimos (feito no servidor).
 * - Prorrogação: soma 30 dias aos acréscimos (feito no servidor).
 * - Suspensão: status Concluída ou Arquivada param o relógio.
 */

export const PRAZO_BASE = 15;
export const PRORROGACAO_DIAS = 30;

const MS_DIA = 24 * 60 * 60 * 1000;

export type DenunciaStatus =
  | "recebida"
  | "aguardando_analise"
  | "em_analise"
  | "em_investigacao"
  | "concluida"
  | "arquivada";

export interface PrescricaoInput {
  termo_inicial: string | Date;
  acrescimos_dias: number;
  status: DenunciaStatus;
  agora?: Date;
}

export interface PrescricaoOut {
  diasRestantes: number;
  suspenso: boolean;
  prescrita: boolean;
  diasCorridos: number;
  totalPrazo: number;
  nivel: "safe" | "warn" | "danger" | "expired";
}

export function calcularPrescricao(input: PrescricaoInput): PrescricaoOut {
  const agora = input.agora ?? new Date();
  const termo =
    input.termo_inicial instanceof Date
      ? input.termo_inicial
      : new Date(input.termo_inicial);

  const suspenso = input.status === "concluida" || input.status === "arquivada";
  const totalPrazo = PRAZO_BASE + (input.acrescimos_dias || 0);
  const diasCorridos = Math.floor((agora.getTime() - termo.getTime()) / MS_DIA);
  const diasRestantes = totalPrazo - diasCorridos;
  const prescrita = !suspenso && diasRestantes < 0;

  let nivel: PrescricaoOut["nivel"];
  if (suspenso) nivel = "safe";
  else if (diasRestantes < 0) nivel = "expired";
  else if (diasRestantes <= 3) nivel = "danger";
  else if (diasRestantes <= 7) nivel = "warn";
  else nivel = "safe";

  return { diasRestantes, suspenso, prescrita, diasCorridos, totalPrazo, nivel };
}

export function formatarDiasRestantes(p: PrescricaoOut): string {
  if (p.suspenso) return "Relógio suspenso";
  if (p.prescrita) return `Prescrita há ${Math.abs(p.diasRestantes)} d`;
  if (p.diasRestantes === 0) return "Prescreve hoje";
  if (p.diasRestantes === 1) return "1 dia restante";
  return `${p.diasRestantes} dias restantes`;
}
