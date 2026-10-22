import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Header } from "@/components/Header";
import { StatusBadge, STATUS_LABEL } from "@/components/StatusBadge";
import { RelogioPrescricao } from "@/components/RelogioPrescricao";
import { type DenunciaStatus } from "@/lib/prescricao";
import { listMeusProcessosMp, getDenuncia } from "@/lib/denuncias.functions";
import { getSessionInfo } from "@/lib/usuarios.functions";
import { ExternalLink, Download, ShieldAlert } from "lucide-react";
import { exportAtoPdfV2, exportProcessoCompletoV2 } from "@/lib/exportProcesso";
import { ExportAtoContext } from "@/components/ExportAtoContext";
import { toast } from "sonner";
import { ProcessoLetterhead, ProcessoDetalheSkeleton } from "@/components/ProcessoLetterhead";
import { TimelineMovimentos } from "@/components/TimelineMovimentos";

export const Route = createFileRoute("/_authenticated/mp-processos")({
  component: MpProcessosPage,
});

function MpProcessosPage() {
  const sessionFn = useServerFn(getSessionInfo);
  const listFn = useServerFn(listMeusProcessosMp);
  const { data: session } = useQuery({ queryKey: ["session-info"], queryFn: () => sessionFn() });
  const { data, isLoading } = useQuery({ queryKey: ["mp-processos"], queryFn: () => listFn() });
  const [selecionado, setSelecionado] = useState<string | null>(null);

  if (session && session.cargo && session.cargo !== "mp") {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-lg px-4 py-24 text-center text-sm text-muted-foreground">
          Esta área é exclusiva para o Ministério Público.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="eyebrow">Ministério Público</div>
        <h1 className="mt-1 font-serif text-3xl">Meus processos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Você vê aqui apenas os processos aos quais a Corregedoria lhe concedeu acesso —
          somente leitura.
        </p>

        {isLoading && (
          <div className="mt-8 text-sm text-muted-foreground">Carregando...</div>
        )}

        {!isLoading && data && data.length === 0 && (
          <div className="surface mt-8 grid place-items-center gap-2 p-12 text-center text-sm text-muted-foreground">
            <p>Nenhum processo foi concedido a você até o momento.</p>
            <p className="text-xs">O acesso é concedido pela Corregedoria, processo por processo.</p>
          </div>
        )}

        {data && data.length > 0 && (
          <div className="mt-6 grid gap-4 md:grid-cols-[320px_1fr]">
            <aside className="surface p-3">
              <ul className="space-y-1">
                {data.map((d) => {
                  const active = selecionado === d.id;
                  return (
                    <li key={d.id}>
                      <button
                        onClick={() => setSelecionado(d.id)}
                        className={`w-full rounded-md border p-3 text-left ${
                          active
                            ? "border-primary/60 bg-surface-2"
                            : "border-transparent hover:bg-surface-2"
                        }`}
                      >
                        <div className="tabular text-xs text-muted-foreground">
                          {(d as any).numero_procedimento ?? d.numero_protocolo}
                        </div>
                        <div className="mt-1 line-clamp-1 text-sm">
                          {d.ocorrencia_tipo || "Sem natureza informada"}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <StatusBadge status={d.status as DenunciaStatus} />
                          {d.unidade && (
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              {d.unidade}
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
              {!selecionado && (
                <div className="surface grid h-full min-h-72 place-items-center p-10 text-sm text-muted-foreground">
                  Selecione um processo para consulta.
                </div>
              )}
              {selecionado && <DetalheProcesso id={selecionado} />}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function DetalheProcesso({ id }: { id: string }) {
  const getFn = useServerFn(getDenuncia);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["mp-processo", id],
    queryFn: () => getFn({ data: { id } }),
  });

  if (isLoading) return <ProcessoDetalheSkeleton />;
  if (isError) {
    const msg = error instanceof Error ? error.message : "erro";
    const naoAutorizado = /permiss|not.?found|acesso|unauth|forbidden|denied|policy|rls/i.test(msg);
    return (
      <div className="surface grid place-items-center gap-3 p-10 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" aria-hidden />
        <div>
          <div className="font-serif text-lg">
            {naoAutorizado ? "Acesso não autorizado" : "Não foi possível abrir o processo"}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {naoAutorizado
              ? "Você não possui habilitação para consultar este processo."
              : msg}
          </p>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const d = data.denuncia;

  return (
    <div className="space-y-4">
      <ProcessoLetterhead
        numeroProtocolo={(d as any).numero_procedimento ?? d.numero_protocolo}
        unidade={d.unidade}
        readOnly
      />

      <div className="surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={d.status as DenunciaStatus} />
              <span className="text-sm text-muted-foreground">
                {STATUS_LABEL[d.status as DenunciaStatus]}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ExportarProcessoMpBtn data={data} />
            <RelogioPrescricao
              termo_inicial={d.termo_inicial ?? d.created_at}
              acrescimos_dias={d.acrescimos_dias ?? 0}
              status={d.status as DenunciaStatus}
              interrupcoes_count={d.interrupcoes_count ?? 0}
            />
          </div>
        </div>
      </div>


      <div className="surface p-5">
        <h2 className="font-serif text-lg">Ficha</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <Info label="Denunciante">
            {d.denunciante_anonimo
              ? "Anônimo"
              : [d.denunciante_nome, d.denunciante_identificador, d.denunciante_contato]
                  .filter(Boolean)
                  .join(" · ") || "—"}
          </Info>
          <Info label="Ocorrência">{d.ocorrencia_tipo || "—"}</Info>
          <Info label="Local">{d.ocorrencia_local || "—"}</Info>
          <Info label="Data / hora">
            {[d.ocorrencia_data, d.ocorrencia_hora].filter(Boolean).join(" · ") || "—"}
          </Info>
        </dl>
        <div className="mt-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Relato</div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{d.relato || "—"}</p>
        </div>
        {d.info_adicional && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Informações adicionais
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{d.info_adicional}</p>
          </div>
        )}
        {Array.isArray(d.links) && d.links.length > 0 && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Links</div>
            <ul className="mt-1 space-y-1 text-sm">
              {(d.links as string[]).map((l, i) => (
                <li key={i}>
                  <a
                    href={l}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="surface p-5">
        <h2 className="font-serif text-lg">Denunciados</h2>
        {data.policiais.length === 0 ? (
          <div className="mt-2 text-xs text-muted-foreground">Nenhum policial identificado.</div>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {data.policiais.map((p) => (
              <li key={p.id} className="rounded-md border border-border/60 p-2">
                <div>{p.nome}</div>
                <div className="text-xs text-muted-foreground">
                  {[p.rg_funcional, p.unidade].filter(Boolean).join(" · ") || "—"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ExportAtoContext.Provider
        value={(movimentoId) =>
          exportAtoPdfV2(
            {
              denuncia: data.denuncia as never,
              policiais: data.policiais as never,
              movimentos: data.movimentos as never,
            },
            movimentoId,
          )
        }
      >
        <TimelineMovimentos
          movimentos={data.movimentos as never}
          procedimento={(d as any).numero_procedimento ?? d.numero_protocolo}
          unidade={d.unidade || "—"}
          policiais={data.policiais as never}
        />
      </ExportAtoContext.Provider>

      <div className="surface p-5">
        <h2 className="font-serif text-lg">Oitivas</h2>
        {data.oitivas.length === 0 ? (
          <div className="mt-2 text-xs text-muted-foreground">Nenhuma oitiva juntada.</div>
        ) : (
          <ul className="mt-3 space-y-3">
            {data.oitivas.map((o) => (
              <li key={o.id} className="rounded-md border border-border/60 p-3">
                <div className="text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleString("pt-BR")}
                  {o.data && ` · realizada em ${new Date(o.data).toLocaleDateString("pt-BR")}`}
                </div>
                <div className="mt-1 text-sm font-medium">{o.identificacao}</div>
                {o.url && (
                  <a
                    href={o.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> abrir gravação
                  </a>
                )}
              </li>
            ))}
          </ul>

        )}
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Consulta somente leitura. Observações internas da Corregedoria não são exibidas.
      </p>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}

function ExportarProcessoMpBtn({ data }: { data: Awaited<ReturnType<typeof getDenuncia>> }) {
  const [gerando, setGerando] = useState(false);
  async function onClick() {
    setGerando(true);
    try {
      await exportProcessoCompletoV2({
        denuncia: data.denuncia as never,
        policiais: data.policiais as never,
        movimentos: data.movimentos as never,
        oitivas: [],
      });
    } catch (e) {
      toast.error((e as Error)?.message || "Falha ao gerar o PDF do processo.");
    } finally {
      setGerando(false);
    }
  }
  return (
    <button
      onClick={onClick}
      disabled={gerando}
      title="Exportar processo completo em PDF"
      className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2 disabled:opacity-50"
    >
      <Download className="h-3.5 w-3.5" /> {gerando ? "Gerando PDF..." : "Exportar processo (PDF)"}
    </button>
  );
}

