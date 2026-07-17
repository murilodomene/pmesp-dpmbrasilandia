/**
 * Núcleo de prescrição — puro, sem estado, sem I/O.
 *
 * Regra invariante: os dias restantes NUNCA são armazenados. São sempre
 * derivados de `15 + acréscimos − dias corridos desde o termo inicial`.
 *
 * - Interrupção: redefine termo_inicial e zera acréscimos (feito no servidor).
 * - Prorrogação: soma 30 dias aos acréscimos (feito no servidor).
 * - Suspensão: status "Aguardando Decurso do Prazo", "Trânsito em Julgado" e
 *   "Arquivada" param o relógio de 15 dias. O prazo de 7 dias de recurso
 *   é um timer separado (ver `calcularDecursoPrazo`).
 */

export const PRAZO_BASE = 15;
export const PRORROGACAO_DIAS = 30;
export const PRAZO_DECURSO_DIAS = 7;

const MS_DIA = 24 * 60 * 60 * 1000;

export type DenunciaStatus =
  | "novo"
  | "recebida"
  | "aguardando_analise"
  | "em_analise"
  | "em_recurso"
  | "em_investigacao"
  | "concluso"
  | "ag_decurso_prazo"
  | "transito_julgado"
  | "arquivada"
  // legado — mantido apenas para compatibilidade de tipos; nenhum registro novo é criado com este valor.
  | "concluida";

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

const STATUS_SUSPENSOS: DenunciaStatus[] = [
  "ag_decurso_prazo",
  "transito_julgado",
  "arquivada",
  "concluida",
];

export function isEncerrado(status: DenunciaStatus): boolean {
  return STATUS_SUSPENSOS.includes(status);
}

export function calcularPrescricao(input: PrescricaoInput): PrescricaoOut {
  const agora = input.agora ?? new Date();
  const termo =
    input.termo_inicial instanceof Date
      ? input.termo_inicial
      : new Date(input.termo_inicial);

  const suspenso = isEncerrado(input.status);
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

/**
 * Timer separado do prazo prescricional. Só corre em "Aguardando Decurso do Prazo".
 * Retorna dias restantes do prazo de 7 dias corridos para recurso administrativo.
 */
export function calcularDecursoPrazo(
  concluidoEm: string | Date | null | undefined,
  agora: Date = new Date(),
): { diasRestantes: number; vencido: boolean } | null {
  if (!concluidoEm) return null;
  const inicio = concluidoEm instanceof Date ? concluidoEm : new Date(concluidoEm);
  // Regra: exclui o dia do começo, inclui o dia do vencimento.
  // Trabalha em dias de calendário para não sofrer com fuso/skew de relógio.
  const startDay = Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const todayDay = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const diasDesdeInicio = Math.round((todayDay - startDay) / MS_DIA);
  const diasRestantes = PRAZO_DECURSO_DIAS - diasDesdeInicio;
  return { diasRestantes, vencido: diasRestantes <= 0 };
}
