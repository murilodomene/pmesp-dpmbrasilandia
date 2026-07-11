import { forwardRef, useRef } from "react";
import { ShieldCheck } from "lucide-react";
import { isHtmlAto, sanitizeAtoHtml } from "./RichTextEditor";

export type AtoTipo = "DESPACHO" | "DECISÃO" | "PORTARIA" | "IPC";

export interface DocumentTemplateCampo {
  label: string;
  valor: React.ReactNode;
}

export interface DocumentTemplateProps {
  procedimento: string;
  denunciado: string;
  /** Rótulo central em destaque (DESPACHO/DECISÃO/PORTARIA/IPC). */
  tipo?: AtoTipo;
  /** Subtítulo discreto abaixo do tipo (ex.: "Resolução final do inquérito"). */
  subtitulo?: string;
  /** Compatibilidade legada — usado apenas no PDF quando `tipo` não é definido. */
  assunto?: string;
  prolatorNome: string;
  prolatorCargo: string;
  data: string; // ISO
  /** HTML (rich text já sanitizado) OU texto plano. */
  teor?: string;
  /** Conteúdo customizado — sobrescreve `teor` (para portaria com links). */
  children?: React.ReactNode;
  /** "screen" = tema escuro integrado; "pdf" = papel branco A4. */
  variant?: "screen" | "pdf";
  /** Cor do marcador lateral esquerdo. */
  markerClass?: string;
  /** Campos estruturados. Se ausente, exibe apenas Procedimento + Denunciado. */
  campos?: DocumentTemplateCampo[];
}


/**
 * Envelopa Despacho, Decisão e Portaria. Duas apresentações:
 * - variant="screen" (default): tema escuro, integrado à linha do tempo.
 * - variant="pdf": papel branco A4 formal com brasão — usado só na exportação.
 * NÃO usar para IPC. Somente leitura.
 */
export const DocumentTemplate = forwardRef<HTMLDivElement, DocumentTemplateProps>(
  function DocumentTemplate(
    {
      procedimento,
      denunciado,
      tipo,
      subtitulo,
      assunto,
      prolatorNome,
      prolatorCargo,
      data,
      teor,
      children,
      variant = "screen",
      markerClass,
      campos,
    },
    ref,
  ) {

    const dataFmt = new Date(data).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const bodyContent =
      children ??
      (teor
        ? isHtmlAto(teor)
          ? (
              <div
                className={variant === "pdf" ? "ato-body-pdf" : "ato-body"}
                dangerouslySetInnerHTML={{ __html: sanitizeAtoHtml(teor) }}
              />
            )
          : <div className="whitespace-pre-wrap">{teor}</div>
        : null);

    if (variant === "pdf") {
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
            <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${markerClass}`} />
          )}

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

          <section className="mt-4 grid gap-2 text-[12px] sm:text-[13px]">
            <div><span className="font-bold">PROCEDIMENTO:</span> {procedimento}</div>
            <div><span className="font-bold">DENUNCIADO:</span> {denunciado}</div>
            {assunto && <div><span className="font-bold">ASSUNTO:</span> {assunto}</div>}
          </section>

          <main
            className="mx-1 my-6 whitespace-pre-wrap text-justify text-[12px] leading-relaxed sm:mx-4 sm:text-[13px]"
            aria-readonly="true"
          >
            {bodyContent}
          </main>

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
    }

    // ---------- variant="screen" (tema escuro, orgânico) ----------
    return (
      <div
        ref={ref}
        data-document-template
        className={`relative rounded-md ${markerClass ? "pl-4" : ""}`}
      >
        {markerClass && (
          <span aria-hidden className={`absolute inset-y-0 left-0 w-0.5 rounded-full ${markerClass}`} />
        )}

        {/* Cabeçalho institucional, alinhado à esquerda, integrado ao tema */}
        <header className="flex items-start gap-3 pb-3">
          <img
            src="/brasao-pcsp.png"
            alt=""
            aria-hidden
            className="h-12 w-auto flex-shrink-0 opacity-90 sm:h-14"
          />
          <div className="text-[10px] font-semibold uppercase leading-snug tracking-wide text-muted-foreground sm:text-[11px]">
            <div>Secretaria da Segurança Pública</div>
            <div>Polícia Civil do Estado de São Paulo</div>
            <div>Corregedoria Geral da Polícia Civil</div>
            <div>1ª Corregedoria da Capital</div>
            <div className="normal-case text-[10px] text-muted-foreground/80">
              corregedoriageral@policiacivil.sp
            </div>
          </div>
        </header>

        <div className="h-px w-full bg-border/60" />

        {/* Tipo do ato em destaque */}
        {tipo && (
          <div className="py-3 text-center">
            <span className="font-serif text-base font-semibold tracking-[0.2em] text-foreground sm:text-lg">
              {tipo}
            </span>
          </div>
        )}

        <div className="h-px w-full bg-border/60" />

        {/* Bloco de identificação */}
        <dl className="grid gap-1.5 py-3 text-xs sm:text-sm">
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-semibold uppercase tracking-wider text-primary">Procedimento:</dt>
            <dd className="text-foreground">{procedimento}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-semibold uppercase tracking-wider text-primary">Denunciado:</dt>
            <dd className="text-foreground">{denunciado}</dd>
          </div>
        </dl>

        <div className="h-px w-full bg-border/60" />

        {/* Corpo */}
        <div className="py-4 text-sm leading-relaxed text-foreground" aria-readonly="true">
          {bodyContent}
        </div>

        <div className="h-px w-full bg-border/60" />

        {/* Fecho */}
        <footer className="pt-2 text-[11px] italic text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-emerald-500" aria-hidden />
            Datado e assinado digitalmente por {prolatorNome} — {prolatorCargo} em {dataFmt}.
          </span>
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
  const margin = 20;
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
