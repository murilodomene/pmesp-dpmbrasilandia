/**
 * Conversão do teor dos atos (HTML do editor ou texto plano) em parágrafos
 * com trechos estilizados, prontos para o motor de PDF vetorial.
 *
 * O editor só produz p, br, strong/b, em/i, u, span e a (ver sanitizeAtoHtml),
 * com text-align e line-height no estilo do parágrafo.
 */

export type Align = "left" | "center" | "right" | "justify";

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  href?: string;
}

export interface Paragraph {
  align: Align;
  /** Fator de entrelinha do editor (CSS line-height). */
  lineHeight: number;
  runs: Run[];
}

/* ------------ caracteres ------------ */

// Caracteres além do Latin-1 que as fontes padrão do PDF (WinAnsi) suportam.
const WINANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const SUBSTITUTOS: Record<string, string> = {
  "→": "->",
  "⇒": "=>",
  "←": "<-",
  "✓": "v",
  "✔": "v",
  "≥": ">=",
  "≤": "<=",
  "≠": "!=",
  "−": "-",
  "‐": "-",
  "‑": "-",
  " ": " ",
  " ": " ",
  "​": "",
  "﻿": "",
  "\t": "    ",
};

/** Garante que o texto só use caracteres que a fonte do PDF consegue desenhar. */
export function pdfSafe(texto: string): string {
  let out = "";
  for (const ch of texto) {
    const c = ch.codePointAt(0) ?? 0;
    if (
      ch === "\n" ||
      (c >= 0x20 && c <= 0x7e) ||
      (c >= 0xa0 && c <= 0xff) ||
      WINANSI_EXTRA.includes(ch)
    ) {
      out += ch;
      continue;
    }
    if (ch in SUBSTITUTOS) {
      out += SUBSTITUTOS[ch];
      continue;
    }
    const base = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
    if (/^[\x20-\x7e]+$/.test(base)) out += base;
  }
  return out;
}

/* ------------ HTML → parágrafos ------------ */

export function isHtml(teor: string): boolean {
  return /<\/?(p|br|strong|em|u|span|b|i|a|div)\b/i.test(teor);
}

function alinhamento(el: Element | null, padrao: Align): Align {
  const st = el?.getAttribute("style") ?? "";
  const m = st.match(/text-align\s*:\s*(left|center|right|justify)/i);
  return m ? (m[1].toLowerCase() as Align) : padrao;
}

function entrelinha(el: Element | null, padrao: number): number {
  const st = el?.getAttribute("style") ?? "";
  const m = st.match(/line-height\s*:\s*([\d.]+)/i);
  const v = m ? Number(m[1]) : NaN;
  return Number.isFinite(v) && v >= 0.8 && v <= 3 ? v : padrao;
}

type Estilo = Omit<Run, "text">;

export function htmlParaParagrafos(
  html: string,
  padrao: { align: Align; lineHeight: number },
): Paragraph[] {
  const doc = new DOMParser().parseFromString(
    `<!doctype html><html><body>${html}</body></html>`,
    "text/html",
  );
  const paragrafos: Paragraph[] = [];
  let atual: Paragraph | null = null;

  const abrir = (el: Element | null) => {
    atual = {
      align: alinhamento(el, padrao.align),
      lineHeight: entrelinha(el, padrao.lineHeight),
      runs: [],
    };
    paragrafos.push(atual);
    return atual;
  };

  const visitar = (no: Node, estilo: Estilo) => {
    if (no.nodeType === 3) {
      const texto = (no.textContent ?? "").replace(/[ \t\r\n\f]+/g, " ");
      if (!texto) return;
      (atual ?? abrir(null)).runs.push({ text: texto, ...estilo });
      return;
    }
    if (no.nodeType !== 1) return;
    const el = no as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === "p" || tag === "div") {
      abrir(el);
      el.childNodes.forEach((filho) => visitar(filho, estilo));
      atual = null;
      return;
    }
    if (tag === "br") {
      (atual ?? abrir(null)).runs.push({ text: "\n", ...estilo });
      return;
    }
    const novo: Estilo = { ...estilo };
    if (tag === "strong" || tag === "b") novo.bold = true;
    if (tag === "em" || tag === "i") novo.italic = true;
    if (tag === "u") novo.underline = true;
    if (tag === "a") {
      const href = el.getAttribute("href") ?? "";
      if (/^(https?:|mailto:|tel:)/i.test(href)) novo.href = href;
    }
    const st = el.getAttribute("style") ?? "";
    if (/font-weight\s*:\s*(bold|[6-9]00)/i.test(st)) novo.bold = true;
    if (/font-style\s*:\s*italic/i.test(st)) novo.italic = true;
    if (/text-decoration[^;]*underline/i.test(st)) novo.underline = true;
    el.childNodes.forEach((filho) => visitar(filho, novo));
  };

  doc.body.childNodes.forEach((filho) => visitar(filho, {}));

  // Remove espaços nas pontas de cada parágrafo (o HTML costuma trazê-los).
  for (const p of paragrafos) {
    while (p.runs.length && !p.runs[0].text.trim() && p.runs[0].text !== "\n") p.runs.shift();
    if (p.runs.length) p.runs[0] = { ...p.runs[0], text: p.runs[0].text.replace(/^ +/, "") };
    const ult = p.runs.length - 1;
    if (ult >= 0) p.runs[ult] = { ...p.runs[ult], text: p.runs[ult].text.replace(/ +$/, "") };
  }
  return paragrafos;
}

/** Texto plano: cada linha vira um parágrafo; linhas vazias viram linhas em branco. */
export function textoParaParagrafos(
  texto: string,
  padrao: { align: Align; lineHeight: number },
): Paragraph[] {
  return texto
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((linha) => ({
      align: padrao.align,
      lineHeight: padrao.lineHeight,
      runs: linha.trim() ? [{ text: linha.trim() }] : [],
    }));
}

export function teorParaParagrafos(
  teor: string,
  padrao: { align: Align; lineHeight: number },
): Paragraph[] {
  const lista = isHtml(teor) ? htmlParaParagrafos(teor, padrao) : textoParaParagrafos(teor, padrao);
  // Descarta linhas em branco no início e no fim do teor.
  while (lista.length && !lista[0].runs.some((r) => r.text.trim())) lista.shift();
  while (lista.length && !lista[lista.length - 1].runs.some((r) => r.text.trim())) lista.pop();
  return lista;
}

/** Texto corrido (sem marcação) — usado em verificações. */
export function textoPuro(teor: string): string {
  if (!isHtml(teor)) return teor;
  return teor
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}
