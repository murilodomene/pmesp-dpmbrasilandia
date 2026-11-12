import { calcularPrescricao, formatarDiasRestantes, type DenunciaStatus } from "@/lib/prescricao";

/**
 * Contador de prescrição: começa com a lavratura da Portaria (ou do APFD),
 * com prazo de 15 dias (+ prorrogações). Antes disso mostra "Aguardando Portaria".
 */
interface Props {
  prescricao_inicio: string | null | undefined;
  acrescimos_dias: number;
  status: DenunciaStatus;
  interrupcoes_count?: number;
  variant?: "chip" | "block" | "compact";
}

const NIVEL_CLASS: Record<string, string> = {
  safe: "text-clock-safe border-border",
  warn: "text-clock-warn border-clock-warn/50",
  danger: "text-clock-danger border-clock-danger/60",
  expired: "text-clock-danger border-clock-danger bg-clock-danger/10",
  idle: "text-muted-foreground border-border border-dashed",
};

function dica(inicio: string | null | undefined): string {
  return inicio
    ? `Contador iniciado com a Portaria de ${new Date(inicio).toLocaleDateString("pt-BR")}`
    : "O contador de prescrição começa com a lavratura da Portaria (15 dias)";
}

export function RelogioPrescricao({
  prescricao_inicio,
  acrescimos_dias,
  status,
  variant = "chip",
}: Props) {
  const p = calcularPrescricao({ prescricao_inicio, acrescimos_dias, status });
  const cls = NIVEL_CLASS[p.nivel];
  const prazo = acrescimos_dias ? `prazo 15 + ${acrescimos_dias} dias` : "prazo 15 dias";

  if (variant === "chip") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs tabular ${cls}`}
        title={dica(prescricao_inicio)}
      >
        {formatarDiasRestantes(p)}
      </span>
    );
  }

  if (variant === "compact") {
    // Quadro pequeno do cabeçalho do processo.
    return (
      <div
        className={`flex min-w-[170px] flex-col gap-0.5 rounded-lg border px-3.5 py-2.5 ${cls}`}
        title={dica(prescricao_inicio)}
      >
        <span className="text-[10.5px] font-semibold uppercase tracking-wider opacity-80">
          Contador de prescrição
        </span>
        <span className="text-xl font-semibold leading-tight">
          {p.aguardandoPortaria ? (
            <span className="text-base">Aguardando Portaria</span>
          ) : (
            <>
              <span className="tabular">
                {p.suspenso ? "Suspenso" : p.prescrita ? "Consumada" : p.diasRestantes}
              </span>
              {!p.suspenso && !p.prescrita && (
                <span className="ml-1.5 text-[13px] font-normal opacity-80">
                  {p.diasRestantes === 1 ? "dia restante" : "dias restantes"}
                </span>
              )}
            </>
          )}
        </span>
        <span className="text-[11px] opacity-70">
          {p.aguardandoPortaria
            ? "inicia na lavratura · 15 dias"
            : prescricao_inicio
              ? `desde ${new Date(prescricao_inicio).toLocaleDateString("pt-BR")} · ${prazo}`
              : prazo}
        </span>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-4 ${cls}`}>
      <div className="text-[0.7rem] uppercase tracking-wider opacity-70">Contador de prescrição</div>
      <div className="mt-1 flex items-baseline gap-2">
        {p.aguardandoPortaria ? (
          <span className="text-lg font-semibold">Aguardando Portaria</span>
        ) : (
          <>
            <span className="tabular text-3xl font-semibold">{p.suspenso ? "—" : p.diasRestantes}</span>
            <span className="text-sm opacity-80">
              {p.suspenso ? "suspenso" : p.prescrita ? "dias além do prazo" : "dias restantes"}
            </span>
          </>
        )}
      </div>
      <div className="mt-2 text-xs opacity-70 tabular">
        {p.aguardandoPortaria
          ? "Começa com a lavratura da Portaria, com prazo de 15 dias."
          : `${dica(prescricao_inicio)} · ${prazo}`}
      </div>
      {p.prescrita && (
        <div className="mt-2 text-xs font-medium uppercase tracking-wider">Prescrição consumada</div>
      )}
    </div>
  );
}
