import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Folder, FileText } from "lucide-react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/ipm/")({
  head: () => ({
    meta: [
      { title: "IPMs Públicos — Corregedoria da PMESP" },
      {
        name: "description",
        content:
          "Consulta pública dos Inquéritos Policiais Militares (IPM) tornados públicos pela Corregedoria da Polícia Militar do Estado de São Paulo, organizados por processo administrativo.",
      },
      { property: "og:title", content: "IPMs Públicos — Corregedoria" },
      {
        property: "og:description",
        content:
          "Inquéritos Policiais Militares disponibilizados publicamente pela Corregedoria da Polícia Militar do Estado de São Paulo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IpcPublicoIndexPage,
});

type Policial = { id: string; nome: string; rg_funcional: string | null };

interface IpcRow {
  movimento_id: string;
  denuncia_id: string;
  criado_em: string;
  prolator_nome: string;
  prolator_cargo: string;
  teor: string;
  numero_protocolo: string;
  unidade: string | null;
  policiais: Policial[];
}

interface PadFolder {
  denuncia_id: string;
  numero_protocolo: string;
  unidade: string | null;
  total: number;
  ultimo: string;
}

function IpcPublicoIndexPage() {
  const [rows, setRows] = useState<IpcRow[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("list_ipcs_publicos");
      if (cancelled) return;
      if (error) {
        setErro(error.message);
        setRows([]);
        return;
      }
      const parsed = ((data ?? []) as unknown as Array<Omit<IpcRow, "policiais"> & { policiais: unknown }>).map((r) => ({
        ...r,
        policiais: (Array.isArray(r.policiais) ? r.policiais : []) as Policial[],
      }));
      setRows(parsed);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const folders = useMemo<PadFolder[]>(() => {
    if (!rows) return [];
    const map = new Map<string, PadFolder>();
    for (const r of rows) {
      const existing = map.get(r.denuncia_id);
      if (existing) {
        existing.total += 1;
        if (r.criado_em > existing.ultimo) existing.ultimo = r.criado_em;
      } else {
        map.set(r.denuncia_id, {
          denuncia_id: r.denuncia_id,
          numero_protocolo: ((r as any).numero_procedimento ?? "—"),
          unidade: r.unidade,
          total: 1,
          ultimo: r.criado_em,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.ultimo < b.ultimo ? 1 : -1));
  }, [rows]);

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="eyebrow">Transparência</div>
        <h1 className="mt-2 font-serif text-3xl">IPMs Públicos</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Inquéritos Policiais Militares (IPM) tornados públicos pela Corregedoria Geral da
          Polícia Militar do Estado de São Paulo, organizados por processo administrativo. Clique em uma pasta para abrir os
          IPMs cadastrados no respectivo procedimento.
        </p>

        {rows === null && (
          <div className="mt-10 text-sm text-muted-foreground">Carregando IPMs…</div>
        )}

        {erro && (
          <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground">
            Não foi possível carregar os IPMs públicos: {erro}
          </div>
        )}

        {rows && folders.length === 0 && !erro && (
          <div className="mt-10 rounded-md border border-border p-6 text-sm text-muted-foreground">
            Nenhum IPM foi tornado público até o momento.
          </div>
        )}

        {folders.length > 0 && (
          <ul className="mt-8 flex flex-col gap-2">
            {folders.map((f) => (
              <li key={f.denuncia_id}>
                <Link
                  to="/ipm/$id"
                  params={{ id: f.denuncia_id }}
                  className="surface group flex items-center gap-4 p-4 transition-colors hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <div className="rounded-md bg-surface-2 p-2.5 text-amber-500 group-hover:bg-surface">
                    <Folder className="h-6 w-6" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="tabular font-serif text-base font-semibold text-foreground">
                      {f.numero_protocolo}
                    </div>
                    {f.unidade && (
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {f.unidade}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" aria-hidden />
                    {f.total} {f.total === 1 ? "IPM" : "IPMs"}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
