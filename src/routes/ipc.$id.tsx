import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/Header";
import { ProcessoLetterhead } from "@/components/ProcessoLetterhead";
import { TimelineMovimentos } from "@/components/TimelineMovimentos";
import { supabase } from "@/integrations/supabase/client";

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

export const Route = createFileRoute("/ipc/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `IPCs do procedimento — Corregedoria da Polícia Civil` },
      {
        name: "description",
        content:
          "Informes Preliminares Conclusivos (IPC) tornados públicos para este processo administrativo pela Corregedoria Geral da Polícia Civil.",
      },
      { property: "og:title", content: `IPCs do procedimento ${params.id}` },
      {
        property: "og:description",
        content:
          "Consulta pública dos IPCs de um processo administrativo específico.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IpcPublicoPadPage,
});

function IpcPublicoPadPage() {
  const { id } = Route.useParams();
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
      const parsed = ((data ?? []) as Array<Omit<IpcRow, "policiais"> & { policiais: unknown }>)
        .map((r) => ({
          ...r,
          policiais: (Array.isArray(r.policiais) ? r.policiais : []) as Policial[],
        }))
        .filter((r) => r.denuncia_id === id)
        .sort((a, b) => (a.criado_em < b.criado_em ? -1 : 1));
      setRows(parsed);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const cabecalho = rows && rows[0];

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-4xl px-4 py-12">
        <Link
          to="/ipc"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Voltar aos processos
        </Link>

        <div className="mt-4 eyebrow">Transparência</div>
        <h1 className="mt-2 font-serif text-3xl">
          {cabecalho ? `IPCs do procedimento ${cabecalho.numero_protocolo}` : "IPCs do procedimento"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Todos os Informes Preliminares Conclusivos (IPC) deste processo administrativo tornados
          públicos pela Corregedoria Geral da Polícia Civil. Os demais atos permanecem sob sigilo
          funcional.
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
            Nenhum IPC público encontrado para este procedimento.
          </div>
        )}

        {rows && rows.length > 0 && (
          <div className="mt-8 space-y-10">
            <ProcessoLetterhead
              numeroProtocolo={rows[0].numero_protocolo}
              unidade={rows[0].unidade}
              readOnly
            />
            <TimelineMovimentos
              movimentos={rows.map((r) => ({
                id: r.movimento_id,
                especie: "ipc",
                teor: r.teor,
                criado_em: r.criado_em,
                prolator_nome: r.prolator_nome,
                prolator_cargo: r.prolator_cargo,
                ipc_publicado: true,
              }))}
              procedimento={rows[0].numero_protocolo}
              unidade={rows[0].unidade ?? "—"}
              policiais={rows[0].policiais}
            />
          </div>
        )}
      </div>
    </div>
  );
}
