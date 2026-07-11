import { forwardRef, useRef } from "react";

export interface DocumentTemplateProps {
  procedimento: string;
  denunciado: string;
  assunto: string;
  prolatorNome: string;
  prolatorCargo: string;
  data: string; // ISO
  children: React.ReactNode;
}

/**
 * Papel timbrado estático (A4) para envelopar atos:
 * Despacho, Decisão e Portaria. NÃO usar para IPC.
 * Cabeçalho e rodapé não são persistidos no banco — são apresentação.
 */
export const DocumentTemplate = forwardRef<HTMLDivElement, DocumentTemplateProps>(
  function DocumentTemplate(
    { procedimento, denunciado, assunto, prolatorNome, prolatorCargo, data, children },
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
        style={{
          background: "#ffffff",
          color: "#111827",
          width: "210mm",
          minHeight: "297mm",
          padding: "20mm",
          margin: "0 auto",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "12px",
          lineHeight: 1.55,
          boxSizing: "border-box",
        }}
      >
        {/* Cabeçalho */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            paddingBottom: "10px",
            borderBottom: "2px solid #9ca3af",
          }}
        >
          <img
            src="/brasao-pcsp.png"
            alt="Brasão da Polícia Civil do Estado de São Paulo"
            style={{ height: "80px", width: "auto", flexShrink: 0 }}
            crossOrigin="anonymous"
          />
          <div
            style={{
              fontFamily: "Arial, Helvetica, sans-serif",
              fontSize: "11px",
              fontWeight: 700,
              color: "#374151",
              lineHeight: 1.5,
              textAlign: "left",
            }}
          >
            <div>SECRETARIA DA SEGURANÇA PÚBLICA</div>
            <div>POLÍCIA CIVIL DO ESTADO DE SÃO PAULO</div>
            <div>Corregedoria Geral da Polícia Civil</div>
            <div>1ª Corregedoria da Capital</div>
            <div>corregedoriageral@policiacivil.sp</div>
          </div>
        </header>

        {/* Bloco de identificação */}
        <section
          style={{
            display: "grid",
            gap: "8px",
            marginTop: "16px",
            fontSize: "12px",
          }}
        >
          <div>
            <strong>PROCEDIMENTO:</strong> {procedimento}
          </div>
          <div>
            <strong>DENUNCIADO:</strong> {denunciado}
          </div>
          <div>
            <strong>ASSUNTO:</strong> {assunto}
          </div>
        </section>

        {/* Corpo */}
        <main
          style={{
            marginTop: "24px",
            marginBottom: "24px",
            fontSize: "12px",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            textAlign: "justify",
          }}
        >
          {children}
        </main>

        {/* Rodapé */}
        <footer
          style={{
            marginTop: "40px",
            textAlign: "center",
            fontSize: "11px",
            color: "#374151",
            fontStyle: "italic",
          }}
        >
          Datado e assinado digitalmente por {prolatorNome} — {prolatorCargo} em {dataFmt}.
        </footer>
      </div>
    );
  },
);

/**
 * Exporta o elemento envelopado em `DocumentTemplate` como PDF A4
 * com margens dinâmicas e quebra de página evitando linhas órfãs.
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

  // A imagem já contém as margens de 20mm do template; ocupamos página cheia.
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;

  if (imgH <= pageH) {
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, imgW, imgH);
  } else {
    // Fatiar em páginas evitando cortar linhas: recortamos por página em canvas separado.
    const pxPerMm = canvas.width / pageW;
    const pageHpx = Math.floor(pageH * pxPerMm);
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
      pdf.addImage(slice.toDataURL("image/png"), "PNG", 0, 0, imgW, sliceImgH);
      first = false;
      y += sliceH;
    }
  }

  pdf.save(filename);
}

/** Hook conveniente para telas que precisam capturar/baixar o template. */
export function useDocumentRef() {
  return useRef<HTMLDivElement>(null);
}
