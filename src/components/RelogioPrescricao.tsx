import { calcularPrescricao, formatarDiasRestantes, type DenunciaStatus } from "@/lib/prescricao";

interface Props {
  termo_inicial: string;
  acrescimos_dias: number;
  status: DenunciaStatus;
  interrupcoes_count?: number;
  variant?: "chip" | "block";
}

const NIVEL_CLASS: Record<string, string> = {
  safe: "text-clock-safe border-border",
  warn: "text-clock-warn border-clock-warn/50",
  danger: "text-clock-danger border-clock-danger/60",
  expired: "text-clock-danger border-clock-danger bg-clock-danger/10",
};

export function RelogioPrescricao({
  termo_inicial,
  acrescimos_dias,
  status,
  interrupcoes_count = 0,
  variant = "chip",
}: Props) {
  const p = calcularPrescricao({ termo_inicial, acrescimos_dias, status });
  const cls = NIVEL_CLASS[p.nivel];

  if (variant === "chip") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs tabular ${cls}`}
        title={`Termo inicial: ${new Date(termo_inicial).toLocaleDateString("pt-BR")}`}
      >
        {formatarDiasRestantes(p)}
      </span>
    );
  }

  return (
    <div className={`rounded-lg border p-4 ${cls}`}>
      <div className="text-[0.7rem] uppercase tracking-wider opacity-70">Relógio da prescrição</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="tabular text-3xl font-semibold">
          {p.suspenso ? "—" : p.diasRestantes}
        </span>
        <span className="text-sm opacity-80">
          {p.suspenso ? "suspenso" : p.prescrita ? "dias além do prazo" : "dias restantes"}
        </span>
      </div>
      <div className="mt-2 text-xs opacity-70 tabular">
        Prazo base 15 + {acrescimos_dias} de acréscimos · {interrupcoes_count} interrupções
      </div>
      {p.prescrita && (
        <div className="mt-2 text-xs font-medium uppercase tracking-wider">
          Prescrição consumada
        </div>
      )}
    </div>
  );
}
