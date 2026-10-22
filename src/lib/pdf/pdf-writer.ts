/**
 * Motor de composição de PDF em texto vetorial (jsPDF, fontes padrão do PDF).
 *
 * Substitui a "foto" das páginas (html2canvas → JPEG) por texto real:
 * nítido em qualquer zoom, selecionável/pesquisável e leve.
 * Medidas em milímetros, página A4 retrato.
 */
import type { jsPDF } from "jspdf";
import { pdfSafe, type Align, type Paragraph, type Run } from "@/lib/pdf/pdf-text";

export const PAGE_W = 210;
export const PAGE_H = 297;
export const MARGEM_ESQ = 20;
export const MARGEM_DIR = 20;
export const LARGURA_UTIL = PAGE_W - MARGEM_ESQ - MARGEM_DIR;
export const TOPO = 20;
/** Limite inferior do conteúdo (o rodapé começa logo abaixo). */
export const LIMITE_INFERIOR = 261;

const PT = 25.4 / 72; // mm por ponto
const ASCENDENTE = 0.905; // proporção da fonte acima da linha de base (Arial/Helvetica)
/** Multiplicador que reproduz o espaçamento "1,15" do Word a partir do line-height do editor. */
const FATOR_ENTRELINHA = 1.15;

export type Cor = [number, number, number];
export const PRETO: Cor = [17, 17, 17];
export const CINZA: Cor = [90, 90, 90];
export const AZUL_LINK: Cor = [30, 64, 175];

export interface OpcoesTexto {
  size: number;
  bold?: boolean;
  italic?: boolean;
  align?: Align;
  color?: Cor;
  /** Fator de entrelinha (padrão 1,15 do editor). */
  lineHeight?: number;
  /** Recuo à esquerda, em mm, a partir da margem. */
  indent?: number;
  /** Largura disponível; padrão: largura útil menos recuo. */
  width?: number;
  /** Espaço extra após o parágrafo, em mm. */
  after?: number;
}

interface Peca extends Run {
  w: number;
}
interface Palavra {
  pecas: Peca[];
  w: number;
  /** Largura do espaço que precede a palavra (no estilo do trecho). */
  espaco: number;
  quebraForcada?: boolean;
}

export function estiloFonte(r: { bold?: boolean; italic?: boolean }): string {
  if (r.bold && r.italic) return "bolditalic";
  if (r.bold) return "bold";
  if (r.italic) return "italic";
  return "normal";
}

export class PdfWriter {
  pdf: jsPDF;
  /** Topo da próxima linha (mm). */
  y = TOPO;

  constructor(pdf: jsPDF) {
    this.pdf = pdf;
  }

  /* ---------- página ---------- */

  novaPagina(): void {
    this.pdf.addPage("a4", "portrait");
    this.y = TOPO;
  }

  espacoRestante(): number {
    return LIMITE_INFERIOR - this.y;
  }

  /** Garante altura livre; se não houver, abre nova página. */
  garantir(altura: number): void {
    if (this.y + altura > LIMITE_INFERIOR) this.novaPagina();
  }

  pular(mm: number): void {
    this.y += mm;
  }

  /* ---------- texto simples ---------- */

  private fonte(r: { bold?: boolean; italic?: boolean }, size: number, cor: Cor = PRETO) {
    this.pdf.setFont("helvetica", estiloFonte(r));
    this.pdf.setFontSize(size);
    this.pdf.setTextColor(cor[0], cor[1], cor[2]);
  }

  /**
   * Largura do texto SEM kerning: o PDF desenha cada glifo com o avanço
   * normal, então medir com kerning faz as palavras "engolirem" o espaço.
   */
  largura(texto: string, r: { bold?: boolean; italic?: boolean }, size: number): number {
    this.fonte(r, size);
    const unidades = this.pdf.getStringUnitWidth(pdfSafe(texto), { kerning: {} } as never);
    return (unidades * size) / this.pdf.internal.scaleFactor;
  }

  passoLinha(size: number, lineHeight = 1.15): number {
    return size * PT * lineHeight * FATOR_ENTRELINHA;
  }

  /** Escreve texto em posição absoluta (linha de base calculada a partir do topo). */
  textoEm(
    texto: string,
    x: number,
    topo: number,
    o: OpcoesTexto & { align?: "left" | "center" | "right" },
  ): void {
    const t = pdfSafe(texto);
    const w = this.largura(t, o, o.size);
    this.fonte(o, o.size, o.color);
    const base = topo + o.size * PT * ASCENDENTE;
    const xi = o.align === "right" ? x - w : o.align === "center" ? x - w / 2 : x;
    this.pdf.text(t, xi, base);
  }

  /** Parágrafo de um só estilo, com quebra automática de linhas. */
  texto(texto: string, o: OpcoesTexto): void {
    this.paragrafo(
      {
        align: o.align ?? "left",
        lineHeight: o.lineHeight ?? 1.15,
        runs: [{ text: texto, bold: o.bold, italic: o.italic }],
      },
      o,
    );
  }

  /* ---------- parágrafos com estilos mistos ---------- */

  private palavras(p: Paragraph, size: number): Palavra[] {
    const lista: Palavra[] = [];
    let atual: Palavra | null = null;
    let espacoPendente = 0;
    for (const run of p.runs) {
      const partes = pdfSafe(run.text).split(/(\n| +)/);
      for (const parte of partes) {
        if (!parte) continue;
        if (parte === "\n") {
          if (atual) lista.push(atual);
          lista.push({ pecas: [], w: 0, espaco: 0, quebraForcada: true });
          atual = null;
          espacoPendente = 0;
          continue;
        }
        if (/^ +$/.test(parte)) {
          if (atual) lista.push(atual);
          atual = null;
          espacoPendente = this.largura(" ", run, size);
          continue;
        }
        const w = this.largura(parte, run, size);
        const peca: Peca = { ...run, text: parte, w };
        if (!atual) atual = { pecas: [], w: 0, espaco: lista.length ? espacoPendente : 0 };
        atual.pecas.push(peca);
        atual.w += w;
        espacoPendente = 0;
      }
    }
    if (atual) lista.push(atual);
    return lista;
  }

  /** Divide uma palavra maior que a linha (ex.: links longos) em pedaços que cabem. */
  private fatiar(palavra: Palavra, max: number, size: number): Palavra[] {
    const out: Palavra[] = [];
    let atual: Palavra = { pecas: [], w: 0, espaco: palavra.espaco };
    for (const peca of palavra.pecas) {
      let buf = "";
      for (const ch of peca.text) {
        const w = this.largura(buf + ch, peca, size);
        if (atual.w + w > max && (buf || atual.pecas.length)) {
          if (buf) atual.pecas.push({ ...peca, text: buf, w: this.largura(buf, peca, size) });
          atual.w = atual.pecas.reduce((s, p) => s + p.w, 0);
          out.push(atual);
          atual = { pecas: [], w: 0, espaco: 0 };
          buf = ch;
        } else {
          buf += ch;
        }
      }
      if (buf) {
        const w = this.largura(buf, peca, size);
        atual.pecas.push({ ...peca, text: buf, w });
        atual.w += w;
      }
    }
    if (atual.pecas.length) out.push(atual);
    return out;
  }

  /** Mede quantas linhas o parágrafo ocupa (para manter blocos juntos). */
  alturaParagrafo(p: Paragraph, o: OpcoesTexto): number {
    const linhas = this.montarLinhas(p, o);
    const passo = this.passoLinha(o.size, p.lineHeight);
    return Math.max(1, linhas.length) * passo + (o.after ?? 0);
  }

  private montarLinhas(p: Paragraph, o: OpcoesTexto): { palavras: Palavra[]; ultima: boolean }[] {
    const max = o.width ?? LARGURA_UTIL - (o.indent ?? 0);
    const linhas: { palavras: Palavra[]; ultima: boolean }[] = [];
    let linha: Palavra[] = [];
    let w = 0;
    const fechar = (ultima: boolean) => {
      linhas.push({ palavras: linha, ultima });
      linha = [];
      w = 0;
    };
    let fila = this.palavras(p, o.size);
    fila = fila.flatMap((pal) => (pal.w > max ? this.fatiar(pal, max, o.size) : [pal]));
    for (const pal of fila) {
      if (pal.quebraForcada) {
        fechar(true);
        continue;
      }
      const esp = linha.length ? pal.espaco : 0;
      if (linha.length && w + esp + pal.w > max + 0.01) fechar(false);
      w += (linha.length ? pal.espaco : 0) + pal.w;
      linha.push(pal);
    }
    if (linha.length || !linhas.length) fechar(true);
    return linhas;
  }

  paragrafo(p: Paragraph, o: OpcoesTexto): void {
    const passo = this.passoLinha(o.size, p.lineHeight);
    const x0 = MARGEM_ESQ + (o.indent ?? 0);
    const max = o.width ?? LARGURA_UTIL - (o.indent ?? 0);
    const cor = o.color ?? PRETO;
    const vazio = !p.runs.some((r) => r.text.trim());
    if (vazio) {
      this.garantir(passo);
      this.y += passo;
      return;
    }
    const linhas = this.montarLinhas(p, o);
    for (const { palavras, ultima } of linhas) {
      this.garantir(passo);
      const base = this.y + o.size * PT * ASCENDENTE + (passo - o.size * PT) / 2.4;
      const natural = palavras.reduce((s, pal, i) => s + pal.w + (i ? pal.espaco : 0), 0);
      const align = p.align === "justify" && ultima ? "left" : p.align;
      let x = x0;
      let extra = 0;
      if (align === "center") x = x0 + (max - natural) / 2;
      else if (align === "right") x = x0 + max - natural;
      else if (align === "justify" && palavras.length > 1) {
        extra = (max - natural) / (palavras.length - 1);
        // Linha "esgarçada" (ex.: antes de um link enorme): melhor alinhar à esquerda.
        if (extra > 4) extra = 0;
      }
      // Fim do último trecho sublinhado da linha, para ligar o sublinhado por cima dos espaços.
      let fimSublinhado: number | null = null;
      palavras.forEach((pal, i) => {
        if (i) x += pal.espaco + extra;
        const primeira = pal.pecas[0];
        if (
          fimSublinhado !== null &&
          primeira &&
          (primeira.underline || primeira.href) &&
          x > fimSublinhado
        ) {
          const corPonte = primeira.href ? AZUL_LINK : cor;
          this.pdf.setDrawColor(corPonte[0], corPonte[1], corPonte[2]);
          this.pdf.setLineWidth(0.18);
          this.pdf.line(fimSublinhado, base + 0.6, x, base + 0.6);
        }
        fimSublinhado = null;
        for (const peca of pal.pecas) {
          const corPeca = peca.href ? AZUL_LINK : cor;
          this.fonte(
            { bold: peca.bold ?? o.bold, italic: peca.italic ?? o.italic },
            o.size,
            corPeca,
          );
          this.pdf.text(peca.text, x, base);
          if (peca.underline || peca.href) {
            this.pdf.setDrawColor(corPeca[0], corPeca[1], corPeca[2]);
            this.pdf.setLineWidth(0.18);
            this.pdf.line(x, base + 0.6, x + peca.w, base + 0.6);
          }
          if (peca.href)
            this.pdf.link(x, base - o.size * PT * ASCENDENTE, peca.w, o.size * PT, {
              url: peca.href,
            });
          x += peca.w;
          fimSublinhado = peca.underline || peca.href ? x : null;
        }
      });
      this.y += passo;
    }
    if (o.after) this.y += o.after;
  }

  /* ---------- formas e imagens ---------- */

  linhaHorizontal(
    y: number,
    cor: Cor = [200, 200, 200],
    espessura = 0.2,
    x0 = MARGEM_ESQ,
    x1 = PAGE_W - MARGEM_DIR,
  ): void {
    this.pdf.setDrawColor(cor[0], cor[1], cor[2]);
    this.pdf.setLineWidth(espessura);
    this.pdf.line(x0, y, x1, y);
  }

  retangulo(
    x: number,
    y: number,
    w: number,
    h: number,
    opts: { fill?: Cor; stroke?: Cor; espessura?: number; raio?: number },
  ): void {
    if (opts.fill) this.pdf.setFillColor(opts.fill[0], opts.fill[1], opts.fill[2]);
    if (opts.stroke) {
      this.pdf.setDrawColor(opts.stroke[0], opts.stroke[1], opts.stroke[2]);
      this.pdf.setLineWidth(opts.espessura ?? 0.3);
    }
    const estilo = opts.fill && opts.stroke ? "FD" : opts.fill ? "F" : "S";
    if (opts.raio) this.pdf.roundedRect(x, y, w, h, opts.raio, opts.raio, estilo);
    else this.pdf.rect(x, y, w, h, estilo);
  }

  imagem(dataUrl: string, x: number, y: number, w: number, h: number): void {
    const formato = /^data:image\/png/i.test(dataUrl) ? "PNG" : "JPEG";
    this.pdf.addImage(dataUrl, formato, x, y, w, h, undefined, "FAST");
  }
}
