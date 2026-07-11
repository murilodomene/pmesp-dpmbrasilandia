import { forwardRef, useRef } from "react";
import { ShieldCheck } from "lucide-react";

export interface DocumentTemplateProps {
  procedimento: string;
  denunciado: string;
  assunto: string;
  prolatorNome: string;
  prolatorCargo: string;
  data: string; // ISO
  children: React.ReactNode;
  /** Cor do marcador lateral esquerdo (Despacho / Decisão / Portaria). */
  markerClass?: string;
}

/**
 * Papel timbrado A4 responsivo — envelopa Despacho, Decisão e Portaria.
 * NÃO usar para IPC. Somente leitura. Nada aqui é persistido no banco.
 */
export const DocumentTemplate = forwardRef<HTMLDivElement, DocumentTemplateProps>(
  function DocumentTemplate(
    {
      procedimento,
      denunciado,
      assunto,
      prolatorNome,
      prolatorCargo,
      data,
      children,
      markerClass,
    },
    ref,
  ) {
    const dataFmt = new Date(data).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    return (
      <div
        ref={ref}
        data-document-template
        className={`relative mx-auto w-full max-w-[210mm] overflow-hidden rounded-md border border-gray-200 bg-white p-4 text-gray-900 shadow-sm sm:p-8 md:p-10 ${
          markerClass ? "pl-5 sm:pl-9 md:pl-11" : ""
        }`}
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        {markerClass && (
          <span
            aria-hidden
            className={`absolute inset-y-0 left-0 w-1.5 ${markerClass}`}
          />
        )}

        {/* Cabeçalho institucional */}
        <header className="flex flex-col items-center gap-2 border-b-2 border-gray-400 pb-3 text-center">
          <img
            src="/brasao-pcsp.png"
            alt="Brasão da Polícia Civil do Estado de São Paulo"
            className="h-16 w-auto sm:h-20"
            crossOrigin="anonymous"
          />
          <div className="font-serif text-[10px] font-bold uppercase leading-snug text-gray-700 sm:text-[11px]">
            <div>Secretaria da Segurança Pública</div>
            <div>Polícia Civil do Estado de São Paulo</div>
            <div>Corregedoria Geral da Polícia Civil</div>
            <div>1ª Corregedoria da Capital</div>
            <div className="normal-case">corregedoriageral@policiacivil.sp</div>
          </div>
        </header>

        {/* Identificação */}
        <section className="mt-4 grid gap-2 text-[12px] sm:text-[13px]">
          <div>
            <span className="font-bold">PROCEDIMENTO:</span> {procedimento}
          </div>
          <div>
            <span className="font-bold">DENUNCIADO:</span> {denunciado}
          </div>
          <div>
            <span className="font-bold">ASSUNTO:</span> {assunto}
          </div>
        </section>

        {/* Corpo */}
        <main
          className="mx-1 my-6 whitespace-pre-wrap text-justify text-[12px] leading-relaxed sm:mx-4 sm:text-[13px]"
          aria-readonly="true"
        >
          {children}
        </main>

        {/* Rodapé de assinatura */}
        <footer className="mt-10 border-t border-gray-300 pt-3 text-center text-[11px] italic text-gray-700">
          <div className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
            <span>
              Datado e assinado digitalmente por {prolatorNome} — {prolatorCargo} em {dataFmt}.
            </span>
          </div>
        </footer>
      </div>
    );
  },
);

/**
 * Exporta o elemento envelopado como PDF A4 com quebra de página automática.
 */
export async function exportDocumentToPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: element.scrollWidth,
  });

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 20; // 20mm
  const imgW = pageW - margin * 2;
  const imgH = (canvas.height * imgW) / canvas.width;

  if (imgH <= pageH - margin * 2) {
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, imgW, imgH);
  } else {
    const pxPerMm = canvas.width / imgW;
    const pageHpx = Math.floor((pageH - margin * 2) * pxPerMm);
    let y = 0;
    let first = true;
    while (y < canvas.height) {
      const sliceH = Math.min(pageHpx, canvas.height - y);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceH;
      const ctx = slice.getContext("2d");
      if (!ctx) break;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      const sliceImgH = (sliceH * imgW) / canvas.width;
      if (!first) pdf.addPage();
      pdf.addImage(slice.toDataURL("image/png"), "PNG", margin, margin, imgW, sliceImgH);
      first = false;
      y += sliceH;
    }
  }

  pdf.save(filename);
}

export function useDocumentRef() {
  return useRef<HTMLDivElement>(null);
}
