import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/Header";
import { ProcessoLetterhead } from "@/components/ProcessoLetterhead";
import { TimelineMovimentos } from "@/components/TimelineMovimentos";
import { supabase } from "@/integrations/supabase/client";
import { ExportAtoContext } from "@/components/ExportAtoContext";
import { exportAtoPdfV2 } from "@/lib/exportProcesso";

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

export const Route = createFileRoute("/ipm/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `IPMs do procedimento — Corregedoria da PMESP` },
      {
        name: "description",
        content:
          "Inquéritos Policiais Militares (IPM) tornados públicos para este processo administrativo pela Corregedoria da Polícia Militar do Estado de São Paulo.",
      },
      { property: "og:title", content: `IPMs do procedimento ${params.id}` },
      {
        property: "og:description",
        content: "Consulta pública dos IPMs de um processo administrativo específico.",
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
      const parsed = (
        (data ?? []) as unknown as Array<Omit<IpcRow, "policiais"> & { policiais: unknown }>
      )
        .map((r) => ({
          ...r,
          numero_protocolo: ((r as any).numero_procedimento as string | null) ?? "—",
          policiais: (Array.isArray(r.policiais) ? r.policiais : []) as Policial[],
        }))
        .filter((r) => r.denuncia_id === id)
        .sort((a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime());
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
          to="/ipm"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Voltar aos processos
        </Link>

        <div className="mt-4 eyebrow">Transparência</div>
        <h1 className="mt-2 font-serif text-3xl">
          {cabecalho
            ? `IPMs do procedimento ${cabecalho.numero_protocolo}`
            : "IPMs do procedimento"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Todos os Inquéritos Policiais Militares (IPM) deste processo administrativo tornados
          públicos pela Corregedoria da Polícia Militar do Estado de São Paulo. Os demais atos
          permanecem sob sigilo funcional.
        </p>

        {rows === null && (
          <div className="mt-10 text-sm text-muted-foreground">Carregando IPMs…</div>
        )}

        {erro && (
          <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground">
            Não foi possível carregar os IPMs públicos: {erro}
          </div>
        )}

        {rows && rows.length === 0 && !erro && (
          <div className="mt-10 rounded-md border border-border p-6 text-sm text-muted-foreground">
            Nenhum IPM público encontrado para este procedimento.
          </div>
        )}

        {rows && rows.length > 0 && (
          <div className="mt-8 space-y-10">
            <ProcessoLetterhead
              numeroProtocolo={rows[0].numero_protocolo}
              unidade={rows[0].unidade}
              readOnly
            />
            <ExportAtoContext.Provider
              value={(movimentoId) => exportarSolucaoPublica(rows, movimentoId)}
            >
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
            </ExportAtoContext.Provider>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * PDF de uma Solução pública, no mesmo modelo vetorial da Corregedoria.
 * A página pública não conhece os demais eventos do processo, por isso
 * a referência "Evento nº" é omitida.
 */
function exportarSolucaoPublica(rows: IpcRow[], movimentoId: string): Promise<void> {
  const r = rows.find((x) => x.movimento_id === movimentoId) ?? rows[0];
  const numero = r.numero_protocolo !== "—" ? r.numero_protocolo : null;
  const tipo =
    numero && /^APFD/i.test(numero)
      ? "apfd"
      : numero && /^SIND/i.test(numero)
        ? "sindicancia"
        : "ipm";
  return exportAtoPdfV2(
    {
      denuncia: {
        numero_protocolo: numero ?? "—",
        numero_procedimento: numero,
        tipo_procedimento: tipo,
        denunciante_nome: null,
        denunciante_anonimo: null,
        ocorrencia_tipo: null,
        unidade: r.unidade,
        status: "",
        termo_inicial: r.criado_em,
        acrescimos_dias: 0,
        instaurada_em: null,
        created_at: r.criado_em,
      },
      policiais: r.policiais.map((p) => ({ ...p, unidade: null })),
      movimentos: rows.map((x) => ({
        id: x.movimento_id,
        especie: "ipc",
        teor: x.teor,
        prolator_nome: x.prolator_nome,
        prolator_cargo: x.prolator_cargo,
        criado_em: x.criado_em,
      })),
    },
    movimentoId,
    { numeroEvento: null },
  );
}
