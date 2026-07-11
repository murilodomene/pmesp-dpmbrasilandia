import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Header } from "@/components/Header";
import { StatusBadge, STATUS_LABEL } from "@/components/StatusBadge";
import { listMinhasDenuncias } from "@/lib/denuncias.functions";
import { getSessionInfo } from "@/lib/usuarios.functions";
import { supabase } from "@/integrations/supabase/client";
import type { DenunciaStatus } from "@/lib/prescricao";
import { FileText } from "lucide-react";
import { isHtmlAto, sanitizeAtoHtml } from "@/components/RichTextEditor";


export const Route = createFileRoute("/_authenticated/minhas-denuncias")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/cidadao" });
  },
  component: MinhasDenunciasPage,
});

function MinhasDenunciasPage() {
  const sessionFn = useServerFn(getSessionInfo);
  const listFn = useServerFn(listMinhasDenuncias);
  const { data: session } = useQuery({ queryKey: ["session-info"], queryFn: () => sessionFn() });
  const { data, isLoading } = useQuery({
    queryKey: ["minhas-denuncias"],
    queryFn: () => listFn(),
  });
  const [selected, setSelected] = useState<string | null>(null);

  const ipcsPorDenuncia = useMemo(() => {
    const map = new Map<string, typeof data extends { ipcs: infer I } ? I : never>();
    if (!data) return map;
    for (const ipc of data.ipcs) {
      const cur = map.get(ipc.denuncia_id) ?? [];
      (cur as unknown as typeof data.ipcs).push(ipc);
      map.set(ipc.denuncia_id, cur as never);
    }
    return map;
  }, [data]);

  if (session && session.cargo && session.cargo !== "cidadao") {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-lg px-4 py-24 text-center text-sm text-muted-foreground">
          Esta área é exclusiva para o cadastro Cidadão.{" "}
          <Link to="/corregedoria" className="underline">
            Ir para a Corregedoria
          </Link>
          .
        </div>
      </div>
    );
  }

  const denuncia = data?.denuncias.find((d) => d.id === selected) ?? null;
  const ipcs = denuncia && data ? ((ipcsPorDenuncia.get(denuncia.id) ?? []) as typeof data.ipcs) : [];

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="eyebrow">Área do Cidadão</div>
        <h1 className="mt-1 font-serif text-3xl">Minhas denúncias</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Você vê aqui apenas as denúncias que registrou nesta conta.
        </p>

        {isLoading && (
          <div className="mt-8 text-sm text-muted-foreground">Carregando...</div>
        )}

        {!isLoading && data && data.denuncias.length === 0 && (
          <div className="surface mt-8 grid place-items-center gap-3 p-12 text-center text-sm text-muted-foreground">
            <p>Você ainda não registrou nenhuma denúncia nesta conta.</p>
            <Link
              to="/denunciar"
              className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
            >
              Fazer nova denúncia
            </Link>
          </div>
        )}

        {data && data.denuncias.length > 0 && (
          <div className="mt-6 grid gap-4 md:grid-cols-[320px_1fr]">
            <aside className="surface p-3">
              <ul className="space-y-1">
                {data.denuncias.map((d) => {
                  const active = selected === d.id;
                  const qtIpc = (ipcsPorDenuncia.get(d.id) ?? []).length;
                  return (
                    <li key={d.id}>
                      <button
                        onClick={() => setSelected(d.id)}
                        className={`w-full rounded-md border p-3 text-left ${
                          active
                            ? "border-primary/60 bg-surface-2"
                            : "border-transparent hover:bg-surface-2"
                        }`}
                      >
                        <div className="tabular text-xs text-muted-foreground">
                          {d.numero_protocolo}
                        </div>
                        <div className="mt-1 line-clamp-1 text-sm">
                          {d.ocorrencia_tipo || "Sem natureza informada"}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <StatusBadge status={d.status as DenunciaStatus} />
                          {qtIpc > 0 && (
                            <span className="text-[10px] uppercase tracking-wider text-primary">
                              {qtIpc} IPC
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            <section>
              {!denuncia && (
                <div className="surface grid h-full min-h-72 place-items-center p-10 text-sm text-muted-foreground">
                  Selecione uma denúncia para ver os detalhes.
                </div>
              )}
              {denuncia && (
                <div className="space-y-4">
                  <div className="surface p-5">
                    <div className="tabular text-xs text-muted-foreground">
                      {denuncia.numero_protocolo}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge status={denuncia.status as DenunciaStatus} />
                      <span className="text-sm text-muted-foreground">
                        {STATUS_LABEL[denuncia.status as DenunciaStatus]}
                      </span>
                    </div>
                    {denuncia.obs_denunciante ? (
                      <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                        <div className="text-xs uppercase tracking-wider text-primary">
                          Observações ao denunciante
                        </div>
                        <p className="mt-1 whitespace-pre-wrap">{denuncia.obs_denunciante}</p>
                      </div>
                    ) : (
                      <div className="mt-4 text-xs text-muted-foreground">
                        Sem observações da Corregedoria até o momento.
                      </div>
                    )}
                  </div>

                  <div className="surface p-5">
                    <h2 className="font-serif text-lg">IPCs publicados</h2>
                    {ipcs.length === 0 ? (
                      <div className="mt-3 text-xs text-muted-foreground">
                        Nenhum IPC publicado até o momento.
                      </div>
                    ) : (
                      <ul className="mt-3 space-y-3">
                        {ipcs.map((ipc) => (
                          <li
                            key={ipc.id}
                            className="rounded-md border border-border/60 p-3"
                          >
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <FileText className="h-3.5 w-3.5" />
                              <span className="tabular">
                                {new Date(ipc.criado_em).toLocaleString("pt-BR")}
                              </span>
                            </div>
                            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">
                              {ipc.teor}
                            </pre>
                            <div className="mt-2 text-[11px] text-muted-foreground">
                              {ipc.prolator_nome}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
