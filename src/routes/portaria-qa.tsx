import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { PortariaTemplate, exportPortariaToPdf, type PortariaDados } from "@/components/PortariaTemplate";

export const Route = createFileRoute("/portaria-qa")({
  head: () => ({ meta: [{ title: "Conferência da Portaria PMESP" }, { name: "description", content: "Conferência visual temporária da Portaria PMESP." }, { property: "og:title", content: "Conferência da Portaria PMESP" }, { property: "og:description", content: "Conferência visual temporária da Portaria PMESP." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: QA,
});

const paragraph = "1. Considerando os elementos reunidos nos autos e a necessidade de apuração integral dos fatos, determino a instauração do presente Inquérito Policial Militar, observadas as garantias legais, os prazos regulamentares e as providências indispensáveis ao esclarecimento da ocorrência, devendo todas as diligências ser documentadas e juntadas aos autos em ordem cronológica, com especial atenção aos atos que devam ser cumpridos em dias úteis.";
const dados: PortariaDados = {
  chave: "878-a1a9a07e86bda", ipmNumero: "CORREGPM-176/2026", dataInstauracao: "11 de setembro de 2026", dataFato: "08 de setembro de 2026", encarregado: "TEN CEL PM JOÃO DA SILVA", municipioInstauracao: "São Paulo/SP", naturezas: ["Transgressão disciplinar", "Infração penal militar em tese"], indiciados: ["CAP PM CARLOS DE SOUZA — RE 123456-7", "1º TEN PM MARCOS PEREIRA — RE 765432-1"], localFatos: "Sede da unidade policial militar, São Paulo/SP.", corpo: Array.from({ length: 12 }, (_, i) => `<p>${paragraph.replace("1.", `${i + 1}.`)}</p>`).join(""), localData: "São Paulo/SP, 11 de setembro de 2026.", signatarioNome: "Murilo Fenix", signatarioPosto: "Coronel PM",
};

function QA() {
  const ref = useRef<HTMLElement>(null);
  return <main className="mx-auto max-w-5xl p-6"><div id="screen" className="surface p-6"><PortariaTemplate dados={dados} variant="screen" /></div><button id="download" className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground" onClick={() => ref.current && exportPortariaToPdf(ref.current, "portaria-paginacao-qa.pdf")}>Gerar PDF</button><div className="pointer-events-none fixed left-[-10000px] top-0"><PortariaTemplate ref={ref} dados={dados} variant="pdf" /></div></main>;
}
