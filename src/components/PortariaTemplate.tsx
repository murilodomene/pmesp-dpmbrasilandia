import { forwardRef, useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { sanitizeAtoHtml } from "@/components/RichTextEditor";
import { PMESP_CREST_URL } from "@/lib/branding";

export type PortariaDados = {
  chave: string;
  ipmNumero: string;
  tipoProcedimento?: "ipm" | "sindicancia" | "apfd";
  dataInstauracao: string;
  dataFato: string;
  encarregado: string;
  municipioInstauracao: string;
  naturezas: string[];
  indiciados: string[];
  localFatos: string;
  corpo: string;
  localData: string;
  signatarioNome: string;
  signatarioPosto: string;
};

export function isPortariaDados(value: unknown): value is PortariaDados {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Partial<PortariaDados>;
  return (
    typeof data.chave === "string" &&
    typeof data.ipmNumero === "string" &&
    typeof data.corpo === "string" &&
    Array.isArray(data.naturezas) &&
    Array.isArray(data.indiciados)
  );
}

function Barcode({ value, compact = false }: { value: string; compact?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    JsBarcode(ref.current, value, {
      format: "CODE128",
      displayValue: false,
      height: 42,
      width: 1.45,
      margin: 0,
      background: compact ? "#ffffff" : "transparent",
      lineColor: "#111111",
    });
  }, [compact, value]);
  return <svg ref={ref} aria-label={`Código de barras ${value}`} className="h-[42px] max-w-full" />;
}

function SectionTitle({ children, variant }: { children: React.ReactNode; variant: "screen" | "pdf" }) {
  if (variant === "screen") {
    return (
      <div className="my-4 flex items-center gap-3" data-pdf-keep>
        <div className="h-px flex-1 bg-border/60" />
        <h3 className="font-serif text-sm font-semibold uppercase text-foreground">{children}</h3>
        <div className="h-px flex-1 bg-border/60" />
      </div>
    );
  }
  return (
    <div className="my-[6px] bg-[#c7c7c7] py-[1px] text-center text-[14px] font-bold leading-[17px]" data-pdf-keep>
      {children}
    </div>
  );
}

export const PortariaTemplate = forwardRef<HTMLElement, { dados: PortariaDados; variant?: "screen" | "pdf" }>(
  function PortariaTemplate({ dados, variant = "screen" }, ref) {
    if (variant === "screen") {
      return (
        <article ref={ref} data-portaria-template className="portaria-screen w-full text-sm leading-relaxed text-foreground">
          <header className="flex flex-col items-center gap-2 pb-4 text-center">
            <img
              src={PMESP_CREST_URL}
              alt="Brasão da Polícia Militar do Estado de São Paulo"
              className="h-20 w-16 flex-none object-contain sm:h-24 sm:w-20"
              crossOrigin="anonymous"
            />
            <div className="text-xs font-semibold uppercase text-muted-foreground sm:text-sm">SECRETARIA DA SEGURANÇA PÚBLICA</div>
            <div className="text-xs font-semibold uppercase text-foreground sm:text-base">POLÍCIA MILITAR DO ESTADO DE SÃO PAULO</div>
            <div className="mt-2 text-[10px] font-bold uppercase text-primary">CHAVE IDENTIFICADORA</div>
            <div className="font-mono text-[11px] leading-tight text-foreground">{dados.chave}</div>
          </header>

          <div className="h-px bg-border/60" />
          <h2 className="py-4 text-center font-serif text-lg font-semibold text-foreground">{dados.tipoProcedimento === "sindicancia" ? "SINDPM" : dados.tipoProcedimento === "apfd" ? "APFD" : "IPM"} Nº {dados.ipmNumero}</h2>
          <div className="h-px bg-border/60" />

          <dl className="grid gap-2 py-4">
            <div className="flex flex-wrap gap-x-2"><dt className="font-semibold text-primary">DATA DE INSTAURAÇÃO:</dt><dd>{dados.dataInstauracao}</dd></div>
            <div className="flex flex-wrap gap-x-2"><dt className="font-semibold text-primary">DATA DO FATO:</dt><dd>{dados.dataFato}</dd></div>
            <div className="flex flex-wrap gap-x-2"><dt className="font-semibold text-primary">ENCARREGADO:</dt><dd>{dados.encarregado}</dd></div>
            <div className="flex flex-wrap gap-x-2"><dt className="font-semibold text-primary">MUNICÍPIO DE INSTAURAÇÃO:</dt><dd>{dados.municipioInstauracao}</dd></div>
          </dl>

          <SectionTitle variant="screen">NATUREZAS</SectionTitle>
          <div className="space-y-1 px-2 sm:px-5">
            {dados.naturezas.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}
          </div>

          <SectionTitle variant="screen">POLICIAIS MILITARES INDICIADOS</SectionTitle>
          <div className="space-y-1 px-2 sm:px-5">
            {dados.indiciados.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}
          </div>

          <SectionTitle variant="screen">LOCAL DOS FATOS</SectionTitle>
          <p className="px-2 sm:px-5">{dados.localFatos}</p>

          <SectionTitle variant="screen">{dados.tipoProcedimento === "apfd" ? "AUTO DE PRISÃO EM FLAGRANTE DELITO" : "PORTARIA"}</SectionTitle>
          <div className="portaria-body-screen px-2 text-justify sm:px-5" dangerouslySetInnerHTML={{ __html: sanitizeAtoHtml(dados.corpo) }} />

          <p className="mt-8 px-2 text-justify sm:px-5">{dados.localData}</p>
          <div className="mt-8 text-center font-semibold text-foreground">
            <p>{dados.signatarioNome.toUpperCase()}</p>
            <p>{dados.signatarioPosto.toUpperCase()}</p>
          </div>
        </article>
      );
    }

    return (
      <div className="w-full overflow-x-auto">
        <article
          ref={ref}
          data-portaria-template
          className="portaria-document mx-auto min-h-[297mm] w-[210mm] max-w-full bg-white px-[20mm] pb-[20mm] pt-[20mm] font-['Arial'] text-[14px] leading-[1.28] text-[#111111] shadow-sm"
        >
          <header className="grid grid-cols-[38mm_1fr] items-center" data-pdf-keep>
            <div className="flex justify-center">
              <img
                src={PMESP_CREST_URL}
                alt="Brasão da Polícia Militar do Estado de São Paulo"
                className="h-[28mm] w-[24mm] object-contain"
                crossOrigin="anonymous"
              />
            </div>
            <div>
              <div className="text-[17px] font-bold leading-[20px]">SECRETARIA DA SEGURANÇA PÚBLICA</div>
              <div className="text-[16px] font-bold leading-[19px]">POLÍCIA MILITAR DO ESTADO DE SÃO PAULO</div>
              <div className="mt-[2px] text-[9px] font-bold leading-[11px]">CHAVE IDENTIFICADORA</div>
              <Barcode value={dados.chave} />
              <div className="font-['Courier_New'] text-[12px] leading-[14px]">{dados.chave}</div>
            </div>
          </header>

          <h2 className="mb-[14px] mt-[7mm] text-center text-[20px] font-bold leading-[24px]" data-pdf-keep>
            {dados.tipoProcedimento === "sindicancia" ? "SINDPM" : dados.tipoProcedimento === "apfd" ? "APFD" : "IPM"} Nº {dados.ipmNumero}
          </h2>

          <div className="space-y-0">
            <p><strong>DATA DE INSTAURAÇÃO:</strong> {dados.dataInstauracao}</p>
            <p><strong>DATA DO FATO:</strong> {dados.dataFato}</p>
            <div className="h-[14px]" />
            <p><strong>ENCARREGADO:</strong> {dados.encarregado}</p>
            <p><strong>MUNICÍPIO DE INSTAURAÇÃO:</strong> {dados.municipioInstauracao}</p>
          </div>

          <SectionTitle variant="pdf">NATUREZAS</SectionTitle>
          <div className="space-y-[2px] pl-[6mm]">
            {dados.naturezas.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}
          </div>

          <SectionTitle variant="pdf">POLICIAIS MILITARES INDICIADOS</SectionTitle>
          <div className="space-y-[2px] pl-[6mm]">
            {dados.indiciados.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}
          </div>

          <SectionTitle variant="pdf">LOCAL DOS FATOS</SectionTitle>
          <p>{dados.localFatos}</p>

          <SectionTitle variant="pdf">{dados.tipoProcedimento === "apfd" ? "AUTO DE PRISÃO EM FLAGRANTE DELITO" : "PORTARIA"}</SectionTitle>
          <div
            className="portaria-body mt-[7mm] text-justify"
            dangerouslySetInnerHTML={{ __html: sanitizeAtoHtml(dados.corpo) }}
          />

          <p className="mt-[9mm] text-justify">{dados.localData}</p>
          <div className="mt-[9mm] text-center" data-pdf-keep>
            <p>{dados.signatarioNome.toUpperCase()}</p>
            <p className="mt-[3px]">{dados.signatarioPosto.toUpperCase()}</p>
          </div>
        </article>
      </div>
    );
  },
);

export async function exportPortariaToPdf(element: HTMLElement, filename: string): Promise<void> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: 794,
  });
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const elementRect = element.getBoundingClientRect();
  const canvasScale = canvas.width / elementRect.width;
  const cssPerMm = elementRect.width / pageW;
  const topMarginMm = 12;
  const bottomMarginMm = 12;

  type TextBlock = { top: number; bottom: number; lines: Array<{ top: number; bottom: number }> };
  const textBlocks: TextBlock[] = [];
  const candidates = element.querySelectorAll<HTMLElement>("p, li, [data-pdf-keep], .portaria-body > div");
  candidates.forEach((block) => {
    const blockRect = block.getBoundingClientRect();
    const lineRects: Array<{ top: number; bottom: number }> = [];
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.textContent?.trim()) {
        const range = document.createRange();
        range.selectNodeContents(node);
        Array.from(range.getClientRects()).forEach((rect) => {
          if (rect.height > 0) lineRects.push({ top: rect.top - elementRect.top, bottom: rect.bottom - elementRect.top });
        });
      }
      node = walker.nextNode();
    }
    const lines = lineRects
      .sort((a, b) => a.top - b.top)
      .filter((line, index, all) => index === 0 || Math.abs(line.top - all[index - 1].top) > 2);
    if (lines.length) textBlocks.push({ top: blockRect.top - elementRect.top, bottom: blockRect.bottom - elementRect.top, lines });
  });

  function safeBreak(startCss: number, idealCss: number): number {
    let cut = idealCss;
    const guard = 2;
    for (const block of textBlocks) {
      if (block.bottom <= startCss || block.top >= cut) continue;
      const crossing = block.lines.find((line) => line.top < cut + guard && line.bottom > cut - guard);
      if (crossing) cut = Math.min(cut, crossing.top - guard);

      const before = block.lines.filter((line) => line.bottom <= cut).length;
      const after = block.lines.length - before;
      if (before > 0 && after > 0 && (before < 2 || after < 2)) {
        const widowSafeLine = block.lines[Math.max(0, block.lines.length - 2)];
        const wholeBlockFits = block.bottom - block.top < idealCss - startCss;
        cut = wholeBlockFits && before < 2 ? Math.min(cut, block.top - guard) : Math.min(cut, widowSafeLine.top - guard);
      }
    }
    const minimumProgress = startCss + 80;
    return cut > minimumProgress ? cut : idealCss;
  }

  let offsetCss = 0;
  let page = 0;
  while (offsetCss * canvasScale < canvas.height) {
    const topMargin = page === 0 ? 0 : topMarginMm;
    const capacityCss = (pageH - topMargin - bottomMarginMm) * cssPerMm;
    const remainingCss = canvas.height / canvasScale - offsetCss;
    const endCss = remainingCss <= capacityCss ? offsetCss + remainingCss : safeBreak(offsetCss, offsetCss + capacityCss);
    const offset = Math.round(offsetCss * canvasScale);
    const height = Math.min(Math.round((endCss - offsetCss) * canvasScale), canvas.height - offset);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = height;
    const context = slice.getContext("2d");
    if (!context) break;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, slice.width, slice.height);
    context.drawImage(canvas, 0, offset, canvas.width, height, 0, 0, canvas.width, height);
    if (page > 0) pdf.addPage();
    const renderedHeight = height / (canvas.width / pageW);
    pdf.addImage(slice.toDataURL("image/png"), "PNG", 0, topMargin, pageW, renderedHeight);
    offsetCss = endCss;
    page += 1;
  }
  pdf.save(filename);
}