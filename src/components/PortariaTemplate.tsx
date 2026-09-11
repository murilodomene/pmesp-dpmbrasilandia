import { forwardRef, useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { sanitizeAtoHtml } from "@/components/RichTextEditor";
import { PMESP_CREST_URL } from "@/lib/branding";

export type PortariaDados = {
  chave: string;
  ipmNumero: string;
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

function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    JsBarcode(ref.current, value, {
      format: "CODE128",
      displayValue: false,
      height: 42,
      width: 1.45,
      margin: 0,
      background: "transparent",
      lineColor: "#111111",
    });
  }, [value]);
  return <svg ref={ref} aria-label={`Código de barras ${value}`} className="h-[42px] max-w-full" />;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-[6px] bg-[#c7c7c7] py-[1px] text-center text-[14px] font-bold leading-[17px]">
      {children}
    </div>
  );
}

export const PortariaTemplate = forwardRef<HTMLDivElement, { dados: PortariaDados }>(
  function PortariaTemplate({ dados }, ref) {
    return (
      <div className="w-full overflow-x-auto">
        <article
          ref={ref}
          data-portaria-template
          className="portaria-document mx-auto min-h-[297mm] w-[210mm] max-w-full bg-white px-[20mm] pb-[20mm] pt-[20mm] font-['Arial'] text-[14px] leading-[1.28] text-[#111111] shadow-sm"
        >
          <header className="grid grid-cols-[38mm_1fr] items-center">
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

          <h2 className="mb-[14px] mt-[7mm] text-center text-[20px] font-bold leading-[24px]">
            IPM Nº {dados.ipmNumero}
          </h2>

          <div className="space-y-0">
            <p><strong>DATA DE INSTAURAÇÃO:</strong> {dados.dataInstauracao}</p>
            <p><strong>DATA DO FATO:</strong> {dados.dataFato}</p>
            <div className="h-[14px]" />
            <p><strong>ENCARREGADO:</strong> {dados.encarregado}</p>
            <p><strong>MUNICÍPIO DE INSTAURAÇÃO:</strong> {dados.municipioInstauracao}</p>
          </div>

          <SectionTitle>NATUREZAS</SectionTitle>
          <div className="space-y-[2px] pl-[6mm]">
            {dados.naturezas.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}
          </div>

          <SectionTitle>POLICIAIS MILITARES INDICIADOS</SectionTitle>
          <div className="space-y-[2px] pl-[6mm]">
            {dados.indiciados.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}
          </div>

          <SectionTitle>LOCAL DOS FATOS</SectionTitle>
          <p>{dados.localFatos}</p>

          <SectionTitle>PORTARIA</SectionTitle>
          <div
            className="portaria-body mt-[7mm] text-justify"
            dangerouslySetInnerHTML={{ __html: sanitizeAtoHtml(dados.corpo) }}
          />

          <p className="mt-[9mm] text-justify">{dados.localData}</p>
          <div className="mt-[9mm] text-center">
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
  const pageHeightPx = Math.floor((pageH * canvas.width) / pageW);
  let offset = 0;
  let page = 0;
  while (offset < canvas.height) {
    const height = Math.min(pageHeightPx, canvas.height - offset);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = pageHeightPx;
    const context = slice.getContext("2d");
    if (!context) break;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, slice.width, slice.height);
    context.drawImage(canvas, 0, offset, canvas.width, height, 0, 0, canvas.width, height);
    if (page > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL("image/png"), "PNG", 0, 0, pageW, pageH);
    offset += height;
    page += 1;
  }
  pdf.save(filename);
}