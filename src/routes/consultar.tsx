import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Header } from "@/components/Header";
import { consultarPublica } from "@/lib/denuncias.functions";
import { StatusBadge } from "@/components/StatusBadge";
import type { DenunciaStatus } from "@/lib/prescricao";

export const Route = createFileRoute("/consultar")({
  head: () => ({
    meta: [
      { title: "Consultar denúncia — Corregedoria" },
      { name: "description", content: "Acompanhe uma denúncia pelo número de protocolo." },
      { property: "og:title", content: "Consultar denúncia — Corregedoria" },
      { property: "og:description", content: "Consulta pública pelo número de protocolo." },
    ],
  }),
  component: ConsultarPage,
});

interface Result {
  numero_protocolo: string;
  status: DenunciaStatus;
  obs_denunciante: string | null;
  created_at: string;
}

function ConsultarPage() {
  const consultar = useServerFn(consultarPublica);
  const [protocolo, setProtocolo] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null | "notfound">(null);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const r = await consultar({ data: { protocolo: protocolo.trim() } });
      setResult((r as Result | null) ?? "notfound");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="eyebrow">Consulta pública</div>
        <h1 className="mt-2 font-serif text-3xl">Acompanhar denúncia</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Informe o número de protocolo recebido no ato da denúncia.
        </p>

        <form onSubmit={buscar} className="surface mt-8 flex gap-2 p-4">
          <input
            required
            placeholder="#000001/2026"
            value={protocolo}
            onChange={(e) => setProtocolo(e.target.value)}
            className="tabular flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {loading ? "..." : "Consultar"}
          </button>
        </form>

        {result === "notfound" && (
          <div className="mt-6 rounded-md border border-border p-4 text-sm text-muted-foreground">
            Nenhuma denúncia encontrada para este protocolo.
          </div>
        )}

        {result && result !== "notfound" && (
          <div className="surface mt-6 p-6">
            <div className="flex items-center justify-between">
              <span className="tabular text-sm text-muted-foreground">{result.numero_protocolo}</span>
              <StatusBadge status={result.status} />
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Registrada em {new Date(result.created_at).toLocaleDateString("pt-BR")}
            </div>
            <div className="mt-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Observações da Corregedoria
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {result.obs_denunciante?.trim() || "Sem observações públicas no momento."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
