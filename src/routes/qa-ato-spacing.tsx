import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DocumentTemplate, exportDocumentToPdf, useDocumentRef } from "@/components/DocumentTemplate";
import { RichTextEditor, sanitizeAtoHtml } from "@/components/RichTextEditor";

export const Route = createFileRoute("/qa-ato-spacing")({
  component: QaAtoSpacing,
});

const DEMO_HTML =
  '<p style="line-height: 1.15">Primeiro parágrafo com entrelinhas 1,15.</p>' +
  '<p style="line-height: 1.15"></p>' +
  '<p style="line-height: 1.15"></p>' +
  '<p style="line-height: 1.5">Segundo parágrafo com entrelinhas 1,5.<br>Esta é a segunda linha do mesmo parágrafo.</p>';

function QaAtoSpacing() {
  const [value, setValue] = useState(DEMO_HTML);
  const pdfRef = useDocumentRef();
  const body = <div className="ato-body" dangerouslySetInnerHTML={{ __html: sanitizeAtoHtml(value) }} />;
  const pdfBody = <div className="ato-body-pdf" dangerouslySetInnerHTML={{ __html: sanitizeAtoHtml(value) }} />;

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-8">
      <section aria-label="Editor do ato">
        <h1 className="mb-3 text-xl">Editor</h1>
        <RichTextEditor value={value} onChange={setValue} enableLineHeight minHeight={220} />
      </section>
      <section aria-label="Ato nos autos">
        <h2 className="mb-3 text-xl">Autos</h2>
        <DocumentTemplate
          procedimento="175/2026"
          denunciado="Demonstração"
          tipo="DESPACHO"
          prolatorNome="Autoridade de teste"
          prolatorCargo="Corregedor-Geral"
          data="2026-09-12T12:00:00-03:00"
          variant="screen"
        >
          {body}
        </DocumentTemplate>
      </section>
      <button
        type="button"
        onClick={() => pdfRef.current && exportDocumentToPdf(pdfRef.current, "demonstracao-espacamento-ato.pdf")}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Gerar PDF
      </button>
      <div className="pointer-events-none fixed left-[-10000px] top-0" aria-hidden>
        <DocumentTemplate
          ref={pdfRef}
          procedimento="175/2026"
          denunciado="Demonstração"
          tipo="DESPACHO"
          prolatorNome="Autoridade de teste"
          prolatorCargo="Corregedor-Geral"
          data="2026-09-12T12:00:00-03:00"
          variant="pdf"
        >
          {pdfBody}
        </DocumentTemplate>
      </div>
    </main>
  );
}