import type { jsPDF } from "jspdf";

/** A4 captures with stable proportions, bounded memory and line-safe pagination. */
export async function appendPdfElement(pdf: jsPDF, element: HTMLElement, newPage = false): Promise<void> {
  const { default: html2canvas } = await import("html2canvas-pro");
  const doc = element.ownerDocument;
  await doc.fonts.ready;
  await Promise.all(Array.from(element.querySelectorAll("img")).map(async (img) => {
    if (!img.complete) await new Promise<void>((resolve) => {
      img.addEventListener("load", () => resolve(), { once: true });
      img.addEventListener("error", () => resolve(), { once: true });
    });
    if (!img.naturalWidth) throw new Error("Não foi possível carregar uma imagem do documento. Tente novamente.");
  }));
  const root = element.getBoundingClientRect();
  if (!root.width) throw new Error("O documento não está disponível para exportação.");
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const cssPerMm = root.width / pageW;
  const lines: Array<{ top: number; bottom: number }> = [];
  const walker = doc.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.textContent?.trim()) {
      const range = doc.createRange();
      range.selectNodeContents(node);
      for (const rect of Array.from(range.getClientRects())) {
        if (rect.height) lines.push({ top: rect.top - root.top, bottom: rect.bottom - root.top });
      }
    }
    node = walker.nextNode();
  }
  const blocks = Array.from(element.querySelectorAll<HTMLElement>("img, svg, header, footer, h1, h2, h3, [data-pdf-keep]"))
    .map((block) => {
      const rect = block.getBoundingClientRect();
      return { top: rect.top - root.top, bottom: rect.bottom - root.top };
    });
  // Keep a signature with the preceding text rather than on an otherwise empty page.
  for (const footer of element.querySelectorAll("footer")) {
    const rect = footer.getBoundingClientRect();
    const top = rect.top - root.top;
    const preceding = lines.filter((line) => line.bottom <= top).sort((a, b) => b.top - a.top);
    const lead = preceding[Math.min(1, preceding.length - 1)];
    if (lead) blocks.push({ top: lead.top, bottom: rect.bottom - root.top });
  }
  const contentBottom = Math.max(0, ...lines.map((line) => line.bottom), ...blocks.map((block) => block.bottom));
  const totalHeight = Math.min(Math.ceil(root.height), Math.ceil(contentBottom + 20));
  let offset = 0;
  let page = 0;
  while (offset < totalHeight) {
    const topMargin = page === 0 ? 0 : 20;
    const capacity = (pageH - topMargin - 20) * cssPerMm;
    const ideal = Math.min(offset + capacity, totalHeight);
    let end = ideal;
    if (ideal < totalHeight) {
      // Move the break above any crossing text line or small indivisible block.
      for (let pass = 0; pass < 10; pass++) {
        const previous = end;
        for (const block of [...lines, ...blocks]) {
          if (block.top > offset + 4 && block.top < end + 2 && block.bottom > end - 2 && block.bottom - block.top < capacity) {
            end = Math.min(end, block.top - 2);
          }
        }
        if (previous === end) break;
      }
    }
    if (end <= offset + 4) throw new Error("Não foi possível paginar o documento com segurança.");
    const canvas = await html2canvas(element, {
      scale: 1.5, useCORS: true, backgroundColor: "#ffffff", logging: false,
      windowWidth: 794, x: 0, y: offset, width: root.width, height: end - offset,
    });
    if (newPage || page > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.88), "JPEG", 0, topMargin, pageW,
      canvas.height * pageW / canvas.width, undefined, "FAST");
    canvas.width = 0;
    canvas.height = 0;
    newPage = false;
    offset = end;
    page += 1;
  }
}

export async function exportPdfElement(element: HTMLElement, filename: string): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  await appendPdfElement(pdf, element);
  pdf.save(filename);
}