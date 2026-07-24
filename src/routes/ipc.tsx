import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { ProcessoLetterhead } from "@/components/ProcessoLetterhead";
import { TimelineMovimentos } from "@/components/TimelineMovimentos";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/ipc")({
  head: () => ({
    meta: [
      { title: "IPCs Públicos — Corregedoria da Polícia Civil" },
      {
        name: "description",
        content:
          "Consulta pública dos Informes Preliminares Conclusivos (IPC) tornados públicos pela Corregedoria Geral da Polícia Civil.",
      },
      { property: "og:title", content: "IPCs Públicos — Corregedoria" },
      {
        property: "og:description",
        content:
          "Informes Preliminares Conclusivos disponibilizados publicamente pela Corregedoria da Polícia Civil.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IpcPublicoPage,
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

function IpcPublicoPage() {
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
      const parsed = ((data ?? []) as Array<Omit<IpcRow, "policiais"> & { policiais: unknown }>).map((r) => ({
        ...r,
        policiais: (Array.isArray(r.policiais) ? r.policiais : []) as Policial[],
      }));
      setRows(parsed);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="eyebrow">Transparência</div>
        <h1 className="mt-2 font-serif text-3xl">IPCs Públicos</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Informes Preliminares Conclusivos (IPC) tornados públicos pela Corregedoria Geral da
          Polícia Civil. Os demais atos do processo administrativo permanecem sob sigilo funcional.
        </p>

        {rows === null && (
          <div className="mt-10 text-sm text-muted-foreground">Carregando IPCs…</div>
        )}

        {erro && (
          <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground">
            Não foi possível carregar os IPCs públicos: {erro}
          </div>
        )}

        {rows && rows.length === 0 && !erro && (
          <div className="mt-10 rounded-md border border-border p-6 text-sm text-muted-foreground">
            Nenhum IPC foi tornado público até o momento.
          </div>
        )}

        <div className="mt-8 space-y-10">
          {(rows ?? []).map((r) => (
            <article key={r.movimento_id} className="space-y-4">
              <ProcessoLetterhead
                numeroProtocolo={r.numero_protocolo}
                unidade={r.unidade}
                readOnly
              />
              <TimelineMovimentos
                movimentos={[
                  {
                    id: r.movimento_id,
                    especie: "ipc",
                    teor: r.teor,
                    criado_em: r.criado_em,
                    prolator_nome: r.prolator_nome,
                    prolator_cargo: r.prolator_cargo,
                    ipc_publicado: true,
                  },
                ]}
                procedimento={r.numero_protocolo}
                unidade={r.unidade ?? "—"}
                policiais={r.policiais}
              />
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
