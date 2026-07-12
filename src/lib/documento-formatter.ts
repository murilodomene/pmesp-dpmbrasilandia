// Shared formatter for institutional documents (Manual, Regimento, ...).
// Used by both the internal Documentos tab and the public Manual route.

export type TocEntry = { id: string; label: string; chapter?: string };

export const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

export function isLegalDoc(md: string): boolean {
  return /^\s*Art\.?\s*\d+/m.test(md);
}

export function anchorize(html: string): { html: string; toc: TocEntry[] } {
  const toc: TocEntry[] = [];
  const seen = new Set<string>();
  const re = /(Artigo|Art\.?)\s*(\d+)\s*(º|°)?/gi;
  const withAnchors = html.replace(re, (match, _p1, num) => {
    const id = `art-${num}`;
    if (seen.has(id)) return match;
    seen.add(id);
    toc.push({ id, label: `Art. ${num}` });
    return `<span id="${id}" class="scroll-mt-24">${match}</span>`;
  });
  return { html: withAnchors, toc };
}

export function mdToHtml(md: string): string {
  const esc = escHtml(md);
  const lines = esc.split(/\n/);
  const out: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    const li = line.match(/^[-*]\s+(.*)$/);
    if (h) {
      if (inList) { out.push("</ul>"); inList = false; }
      const lvl = h[1].length;
      out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`);
    } else if (li) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(li[1])}</li>`);
    } else if (line === "") {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push("");
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

export function legalToHtml(md: string): { html: string; toc: TocEntry[] } {
  const toc: TocEntry[] = [];
  const seen = new Set<string>();
  let currentChapter: string | undefined;

  const chapterRe = /^(CAPÍTULO|TÍTULO|LIVRO|SEÇÃO|SUBSEÇÃO|PARTE)\s+[IVXLCDM\d]+.*$/i;
  const articleRe = /^(Art\.?\s*\d+[ºo°]?)\s*[-–.]?\s*(.*)$/;
  const paragraphRe = /^(§\s*\d+[ºo°]?|Parágrafo único\.?)\s*[-–.]?\s*(.*)$/i;
  const romanRe = /^([IVXLCDM]+)\s*[.\-–)]\s+(.+)$/;
  const allCapsRe = /^[A-ZÁÉÍÓÚÂÊÔÛÃÕÇÑ0-9 ,\-–:'"()/º°ª§]+$/;

  const lines = md.split(/\n/);
  const out: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) { out.push("</ol>"); inList = false; }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }

    if (chapterRe.test(line)) {
      closeList();
      currentChapter = line;
      out.push(
        `<h2 class="mt-10 mb-3 border-b border-border/60 pb-2 font-serif text-lg font-semibold uppercase tracking-[0.2em] text-primary">${escHtml(line)}</h2>`,
      );
      continue;
    }

    let m: RegExpMatchArray | null;
    if ((m = line.match(articleRe))) {
      closeList();
      const label = m[1].replace(/\s+/g, " ").trim();
      const numMatch = label.match(/(\d+)/);
      const num = numMatch?.[1];
      const id = num ? `art-${num}` : "";
      let idAttr = "";
      if (id && !seen.has(id)) {
        seen.add(id);
        idAttr = ` id="${id}"`;
        toc.push({ id, label: `Art. ${num}`, chapter: currentChapter });
      }
      const rest = inline(escHtml(m[2] ?? ""));
      out.push(
        `<p${idAttr} class="mt-6 scroll-mt-24 text-justify leading-relaxed"><strong class="text-primary">${escHtml(label)}</strong> ${rest}</p>`,
      );
      continue;
    }

    if ((m = line.match(paragraphRe))) {
      closeList();
      const label = m[1].trim();
      const rest = inline(escHtml(m[2] ?? ""));
      out.push(
        `<p class="mt-3 pl-4 text-justify leading-relaxed"><strong class="text-foreground">${escHtml(label)}</strong> ${rest}</p>`,
      );
      continue;
    }

    if ((m = line.match(romanRe))) {
      if (!inList) {
        out.push(`<ol class="my-3 list-none space-y-1 pl-8">`);
        inList = true;
      }
      out.push(
        `<li class="text-justify leading-relaxed"><span class="mr-2 font-medium text-muted-foreground">${escHtml(m[1])}.</span>${inline(escHtml(m[2]))}</li>`,
      );
      continue;
    }

    if (line.length > 3 && line.length < 140 && allCapsRe.test(line)) {
      closeList();
      out.push(
        `<h3 class="mt-8 mb-2 font-serif text-base font-semibold uppercase tracking-widest text-foreground/90">${escHtml(line)}</h3>`,
      );
      continue;
    }

    closeList();
    out.push(`<p class="mt-2 leading-relaxed">${inline(escHtml(line))}</p>`);
  }
  closeList();
  return { html: out.join("\n"), toc };
}

export function highlight(html: string, term: string): string {
  if (!term.trim()) return html;
  const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(
    new RegExp(`(${safe})(?![^<]*>)`, "gi"),
    '<mark class="bg-yellow-300 text-black rounded px-0.5">$1</mark>',
  );
}
