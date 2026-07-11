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
import { FileText, Gavel, Scale, Stamp, ExternalLink } from "lucide-react";
import { isHtmlAto, sanitizeAtoHtml } from "@/components/RichTextEditor";


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
                          {d.numero_protocolo}
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

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando...</div>;
  if (isError)
    return (
      <div className="surface p-6 text-sm text-destructive-foreground">
        Não foi possível abrir este processo: {error instanceof Error ? error.message : "erro"}
      </div>
    );
  if (!data) return null;

  const d = data.denuncia;

  return (
    <div className="space-y-4">
      <div className="surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="tabular text-xs text-muted-foreground">{d.numero_protocolo}</div>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={d.status as DenunciaStatus} />
              <span className="text-sm text-muted-foreground">
                {STATUS_LABEL[d.status as DenunciaStatus]}
              </span>
              {d.unidade && (
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {d.unidade}
                </span>
              )}
            </div>
          </div>
          <RelogioPrescricao
            termo_inicial={d.termo_inicial ?? d.created_at}
            acrescimos_dias={d.acrescimos_dias ?? 0}
            status={d.status as DenunciaStatus}
            interrupcoes_count={d.interrupcoes_count ?? 0}
          />
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

      <div className="surface p-5">
        <h2 className="font-serif text-lg">Movimentação</h2>
        {data.movimentos.length === 0 ? (
          <div className="mt-2 text-xs text-muted-foreground">Sem movimentos.</div>
        ) : (
          <ul className="mt-3 space-y-3">
            {data.movimentos.map((m) => (
              <li key={m.id} className="rounded-md border border-border/60 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <IconEspecie especie={m.especie} />
                  <span className="uppercase tracking-wider">{m.especie}</span>
                  <span className="tabular">
                    {new Date(m.criado_em).toLocaleString("pt-BR")}
                  </span>
                </div>
                {isHtmlAto(m.teor) ? (
                  <div
                    className="ato-body mt-2 whitespace-pre-wrap text-sm"
                    dangerouslySetInnerHTML={{ __html: sanitizeAtoHtml(m.teor) }}
                  />
                ) : (
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">{m.teor}</pre>
                )}

                <div className="mt-1 text-[11px] text-muted-foreground">
                  {m.prolator_nome} — {m.prolator_cargo}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

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

function IconEspecie({ especie }: { especie: string }) {
  if (especie === "portaria") return <Stamp className="h-3.5 w-3.5" />;
  if (especie === "ipc") return <Gavel className="h-3.5 w-3.5" />;
  if (especie === "decisao") return <Scale className="h-3.5 w-3.5" />;
  return <FileText className="h-3.5 w-3.5" />;
}
