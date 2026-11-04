import type { PdfTac } from "@/lib/pdf/processo-pdf";
import type { Tac, TacConfig } from "@/lib/tac.functions";

/** Data local "AAAA-MM-DD" → ISO ao meio-dia (evita virar o dia por fuso). */
export const isoDeData = (d: string | null | undefined) => (d ? `${d}T12:00:00-03:00` : null);

export function somarMeses(base: Date, meses: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + meses);
  return d;
}

export function rotuloOrigem(t: Pick<Tac, "origem_texto" | "denuncias">): string | null {
  return t.denuncias?.numero_procedimento ?? t.origem_texto ?? null;
}

/** TAC gravado → dados do PDF. */
export function pdfDoTac(t: Tac, config?: TacConfig | null, proximoNumero?: string | null): PdfTac {
  const celebrado = t.celebrado_em ?? new Date().toISOString();
  const inicio = isoDeData(t.inicio) ?? celebrado;
  const fim = isoDeData(t.fim) ?? somarMeses(new Date(inicio), t.prazo_meses).toISOString();
  const aviso =
    t.status === "cancelado" && t.numero
      ? `TERMO CANCELADO em ${new Date(t.cancelado_em ?? celebrado).toLocaleDateString("pt-BR")}${t.motivo_cancelamento ? ` — ${t.motivo_cancelamento}` : ""}`
      : t.status === "descumprido"
        ? `TERMO REVOGADO POR DESCUMPRIMENTO em ${new Date(t.encerrado_em ?? celebrado).toLocaleDateString("pt-BR")}`
        : null;
  return {
    id: t.id,
    numero: t.numero ?? proximoNumero ?? "___/____",
    celebrado_em: celebrado,
    compromissario: {
      nome: t.compromissario_nome,
      posto: t.compromissario_posto,
      re: t.compromissario_re,
      opm: t.compromissario_opm,
    },
    origem: rotuloOrigem(t),
    data_fato: isoDeData(t.data_fato),
    capitulacao: t.capitulacao,
    fato: t.fato,
    requisitos: t.requisitos,
    obrigacoes: t.obrigacoes,
    prazo_meses: t.prazo_meses,
    inicio,
    fim,
    acompanhamento: t.acompanhamento,
    clausula_descumprimento: t.clausula_descumprimento ?? config?.clausula_descumprimento ?? "",
    disposicoes_finais: t.disposicoes_finais ?? config?.disposicoes_finais ?? "",
    autoridade: t.signatario_nome
      ? { nome: t.signatario_nome, posto: t.signatario_posto, cargo: t.signatario_cargo }
      : null,
    aviso,
    previa: !t.numero,
  };
}
