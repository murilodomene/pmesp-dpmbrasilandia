import { createFileRoute } from "@tanstack/react-router";
import { PortariaTemplate } from "@/components/PortariaTemplate";

export const Route = createFileRoute("/qa-portaria")({
  component: () => (
    <div className="min-h-screen bg-background p-6">
      <PortariaTemplate
        dados={{
          chave: "878-a1a9a07e86bda",
          ipmNumero: "CORREGPM-176/2026",
          dataInstauracao: "10/09/2026",
          dataFato: "05/09/2026",
          encarregado: "Cap PM João da Silva",
          municipioInstauracao: "São Paulo/SP",
          naturezas: ["Lesão corporal", "Abuso de autoridade"],
          indiciados: ["Sgt PM Carlos Souza", "Cb PM José Lima"],
          localFatos: "Av. Paulista, nº 1000, São Paulo/SP",
          corpo:
            "<p><strong>CONSIDERANDO</strong> os autos do procedimento em referência;</p><p><strong>CONSIDERANDO</strong> as irregularidades apuradas;</p><p>Resolve instaurar o presente IPM.</p>",
          localData: "São Paulo/SP, 10 de setembro de 2026.",
          signatarioNome: "Murilo Fenix",
          signatarioPosto: "Coronel PM",
        }}
      />
    </div>
  ),
});
