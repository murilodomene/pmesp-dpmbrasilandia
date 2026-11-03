/**
 * Ofício no modelo oficial (timbre da SSP/PMESP em duas colunas, Times 12),
 * em texto vetorial. Medidas tiradas do modelo .docx da Corregedoria.
 */
import type { jsPDF } from "jspdf";
import { PdfWriter, MARGEM_ESQ, PAGE_W, PAGE_H } from "@/lib/pdf/pdf-writer";
import { teorParaParagrafos } from "@/lib/pdf/pdf-text";
import type { PdfImagem } from "@/lib/pdf/processo-pdf";
import { cargoNoOficio, nomeComPostoExtenso } from "@/lib/postos";
import type { Oficio } from "@/lib/oficios.functions";

/** Endereço impresso sob o brasão (igual nos dois sites). */
export const ENDERECO_TIMBRE_OFICIO =
  "Av Jacu-Pêssego, n.° 01,\nItaquera, Zona Sul\nSão Paulo/SP, CEP.: 00000001\nFone: (011) 000-001";

export interface PessoaOficio {
  id?: string | null;
  nome: string;
  posto?: string | null;
  /** Cargo no sistema (corregedor_geral, …). */
  cargo?: string | null;
}

export interface PdfOficio {
  /** Número completo, ex.: "CORREGPM 001/360/26" (ou o próximo, na prévia). */
  numero: string;
  /** Data de expedição (ISO). */
  data: string;
  /** Autoridade endereçada (pode ter várias linhas). */
  destinatario: string;
  referencia?: string | null;
  assunto: string;
  /** Texto do ofício (HTML do editor ou texto simples). */
  corpo: string;
  /** Autoridade que assina; null enquanto aguarda assinatura (prévia). */
  signatario: PessoaOficio | null;
  /** Quem redigiu: consta como Encarregado. */
  redator: PessoaOficio;
  /** Endereço sob o brasão (uma linha por quebra); padrão: ENDERECO_TIMBRE_OFICIO. */
  enderecoTimbre?: string;
  cancelado?: { em: string; motivo?: string | null; por?: string | null } | null;
  /** Marca d'água "PRÉVIA" (ainda não expedido). */
  previa?: boolean;
}

/** Margens do modelo: 17,5 mm dos dois lados. */
const ESQ = 17.5;
const LARGURA = PAGE_W - ESQ * 2;
const RECUO = ESQ - MARGEM_ESQ; // o PdfWriter mede a partir da margem de 20 mm
const COL2_X = 54;
const COL2_L = PAGE_W - ESQ - COL2_X;

function dataExtenso(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

export async function gerarOficioPdf(o: PdfOficio, brasao: PdfImagem): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  pdf.setProperties({
    title: `Ofício nº ${o.numero}`,
    subject: o.assunto,
    creator: "Corregedoria PMESP",
  });
  const w = new PdfWriter(pdf);
  w.familia = "times";

  // ---- coluna 1: brasão e endereço ----
  const bh = 23.6;
  const bw = (bh * brasao.width) / brasao.height;
  const col1Centro = ESQ + 3 + 23.6 / 2;
  w.imagem(brasao.dataUrl, col1Centro - bw / 2, 4.6, bw, bh);
  let ya = 4.6 + bh + 1.6;
  for (const linha of (o.enderecoTimbre ?? ENDERECO_TIMBRE_OFICIO)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)) {
    w.textoEm(linha, col1Centro, ya, { size: 6, align: "center" });
    ya += 2.55;
  }

  // ---- coluna 2: cabeçalho ----
  let y = 4.2;
  const linha2 = (texto: string, bold = false, passo = 5.2) => {
    w.y = y;
    w.texto(texto, {
      size: 12,
      bold,
      indent: COL2_X - MARGEM_ESQ,
      width: COL2_L,
      lineHeight: 1.0,
      align: "left",
    });
    y = Math.max(w.y, y + passo);
  };
  linha2("SECRETARIA DE SEGURANÇA PÚBLICA", true, 5.4);
  linha2("POLÍCIA MILITAR DO ESTADO DE SÃO PAULO", true, 6.6);
  linha2(`São Paulo, ${dataExtenso(o.data)}.`, false, 7.3);
  linha2(`OFÍCIO N° ${o.numero}`, false, 7.3);
  for (const l of o.destinatario
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean))
    linha2(l, false, 5.6);
  y += 0.6;
  if (o.referencia?.trim()) linha2(`Referência (s): ${o.referencia.trim()}`, false, 6.2);
  linha2(`Assunto: ${o.assunto.trim()}`, false, 6.2);

  // ---- corpo (largura total) ----
  w.y = Math.max(y, ya) + 5;
  if (o.cancelado) {
    const texto = `OFÍCIO CANCELADO em ${new Date(o.cancelado.em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}${
      o.cancelado.por ? ` por ${o.cancelado.por}` : ""
    }${o.cancelado.motivo ? `. Motivo: ${o.cancelado.motivo}` : "."}`;
    w.texto(texto, {
      size: 10,
      bold: true,
      indent: RECUO,
      width: LARGURA,
      color: [185, 28, 28],
      after: 3,
    });
  }
  const paragrafos = teorParaParagrafos(o.corpo, { align: "justify", lineHeight: 1.15 });
  for (const p of paragrafos) {
    w.paragrafo(p, {
      size: 12,
      indent: RECUO,
      width: LARGURA,
      after: p.runs.some((r) => r.text.trim()) ? 1.6 : 0,
    });
  }

  // ---- assinatura ----
  // Quem assina (nome e cargo, em negrito). Quem redigiu consta como
  // Encarregado: na mesma assinatura quando é a própria autoridade,
  // ou logo abaixo quando foi redigido por outro policial.
  const centro = {
    size: 11,
    bold: true,
    align: "center" as const,
    indent: RECUO,
    width: LARGURA,
    lineHeight: 1.0,
  };
  const redator = nomeComPostoExtenso(o.redator.posto, o.redator.nome);
  const mesmo =
    !!o.signatario &&
    (o.signatario.id ? o.signatario.id === o.redator.id : o.signatario.nome === o.redator.nome);
  w.pular(16);
  w.garantir(30);
  if (o.signatario) {
    w.texto(nomeComPostoExtenso(o.signatario.posto, o.signatario.nome), centro);
    const cargo = cargoNoOficio(o.signatario.cargo);
    if (cargo) w.texto(cargo, centro);
    if (mesmo) w.texto("Encarregado", centro);
  } else {
    w.texto("[assinatura da autoridade]", { ...centro, bold: false, color: [120, 120, 120] });
  }
  if (!mesmo) {
    w.pular(8);
    w.texto(redator, centro);
    w.texto("Encarregado", centro);
  }

  // ---- rodapé só quando houver mais de uma página ----
  const total = pdf.getNumberOfPages();
  if (total > 1) {
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i);
      w.textoEm(`Ofício nº ${o.numero} — Página ${i} de ${total}`, PAGE_W - ESQ, PAGE_H - 12, {
        size: 9,
        align: "right",
      });
    }
  }
  if (o.previa) {
    for (let i = 1; i <= pdf.getNumberOfPages(); i++) {
      pdf.setPage(i);
      w.textoEm("PRÉVIA — NÃO EXPEDIDO", PAGE_W / 2, PAGE_H - 9, {
        size: 9,
        bold: true,
        align: "center",
        color: [185, 28, 28],
      });
    }
  }
  return pdf;
}

export function nomeArquivoOficio(numero: string): string {
  return `Oficio-${numero.replace(/^CORREGPM\s*/i, "").replace(/[^\w]+/g, "-")}.pdf`;
}

/** Ofício gravado → dados do PDF. */
export function pdfDoOficio(o: Oficio, proximoNumero?: string | null): PdfOficio {
  return {
    numero: o.numero ?? proximoNumero ?? "CORREGPM ___/360/__",
    data: o.expedido_em ?? new Date().toISOString(),
    destinatario: o.destinatario,
    referencia: o.referencia,
    assunto: o.assunto,
    corpo: o.corpo,
    signatario: o.signatario_nome
      ? {
          id: o.signatario_id,
          nome: o.signatario_nome,
          posto: o.signatario_posto,
          cargo: o.signatario_cargo,
        }
      : null,
    redator: {
      id: o.redator_id,
      nome: o.redator_nome,
      posto: o.redator_posto,
      cargo: o.redator_cargo,
    },
    cancelado: o.cancelado_em
      ? { em: o.cancelado_em, motivo: o.motivo_cancelamento, por: o.cancelado_por_nome }
      : null,
    previa: o.status !== "expedido" && o.status !== "cancelado",
  };
}
