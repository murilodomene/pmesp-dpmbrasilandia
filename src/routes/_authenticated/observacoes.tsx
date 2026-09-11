import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, X, Trash2, Pencil, Plus, Search, User, Link2 } from "lucide-react";
import {
  listObservacoes,
  criarObservacao,
  atualizarObservacao,
  excluirObservacao,
  buscarPoliciais,
  buscarPads,
} from "@/lib/observacoes.functions";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { RichTextEditor, sanitizeAtoHtml, isHtmlAto } from "@/components/RichTextEditor";
import { AtoAnexosUploader, type AtoAnexo } from "@/components/AtoAnexosUploader";
import { AtoAnexosLinks } from "@/components/AtoAnexosLinks";
import { PMESP_CREST_URL } from "@/lib/branding";
import { OPMS, POSTOS_GRADUACOES } from "@/lib/personnel-options";

export const Route = createFileRoute("/_authenticated/observacoes")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Observações — Corregedoria" },
      { name: "description", content: "Controle interno de observações sobre policiais." },
    ],
  }),
  component: ObservacoesPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">{(error as Error).message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Não encontrado.</div>,
});

const CARGOS_POLICIAIS = POSTOS_GRADUACOES;

const UNIDADES = OPMS;

type Pad = { observacao_id: string; denuncia_id: string; numero_protocolo: string };
type Observacao = {
  id: string;
  autor_id: string;
  autor_nome: string;
  autor_cargo: string;
  policial_nome: string | null;
  policial_matricula: string | null;
  policial_cargo: string | null;
  policial_unidade: string | null;
  corpo: string;
  anexos: { nome: string; path: string }[];
  created_at: string;
  pads: Pad[];
};

function cargoLabel(c: string) {
  if (c === "delegado_geral") return "Delegado Geral";
  if (c === "delegado_corregedor") return "Delegado Corregedor";
  if (c === "coordenador") return "Coordenador";
  if (c === "corregedor") return "Corregedor";
  return c;
}

function ObservacoesPage() {
  const { session } = useSession();
  const search = Route.useSearch();
  const [cargo, setCargo] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [tab, setTab] = useState<"policial" | "geral">(search.q ? "geral" : "policial");
  const [busca, setBusca] = useState(search.q ?? "");
  const [aberto, setAberto] = useState<Observacao | null>(null);
  const [editando, setEditando] = useState<Observacao | null>(null);
  const [criando, setCriando] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase.from("user_roles").select("role").eq("user_id", session.user.id).maybeSingle()
      .then(({ data }) => setCargo((data as { role: string } | null)?.role ?? null));
    supabase.from("profiles").select("status").eq("id", session.user.id).maybeSingle()
      .then(({ data }) => setStatus((data as { status: string } | null)?.status ?? null));
  }, [session]);

  const ativo = status === "ativo";
  const podeVer = ativo && (cargo === "delegado_geral" || cargo === "delegado_corregedor" || cargo === "corregedor" || cargo === "coordenador");

  const listFn = useServerFn(listObservacoes);
  const { data: obs = [], isLoading } = useQuery({
    queryKey: ["observacoes"],
    queryFn: () => listFn() as Promise<Observacao[]>,
    enabled: podeVer,
  });

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return obs;
    return obs.filter((o) => {
      const hay = [
        o.policial_nome,
        o.policial_matricula,
        o.policial_unidade,
        o.policial_cargo,
        ...o.pads.map((p) => p.numero_protocolo),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(t);
    });
  }, [obs, busca]);

  const porPolicial = useMemo(() => {
    const map = new Map<string, { chave: string; nome: string; matricula: string | null; cargo: string | null; unidade: string | null; observacoes: Observacao[] }>();
    for (const o of filtrados) {
      if (!o.policial_nome && !o.policial_matricula) continue; // observações gerais só aparecem na "Lista geral"
      const chave = (o.policial_matricula || o.policial_nome || "").toLowerCase();
      const cur = map.get(chave);
      if (cur) cur.observacoes.push(o);
      else
        map.set(chave, {
          chave,
          nome: o.policial_nome ?? "—",
          matricula: o.policial_matricula,
          cargo: o.policial_cargo,
          unidade: o.policial_unidade,
          observacoes: [o],
        });
    }
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [filtrados]);

  if (session === null) {
    return <div className="mx-auto max-w-4xl p-6 text-sm">Faça login para acessar.</div>;
  }
  if (session && !podeVer) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
          Acesso restrito à Corregedoria (Delegado Geral, Delegado Corregedor ou Corregedor).
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">Observações</h1>
          <p className="text-xs text-muted-foreground">
            Controle interno da Corregedoria — apartado dos autos formais dos PADs.
          </p>
        </div>
        <button
          onClick={() => setCriando(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Nova observação
        </button>
      </header>

      <div className="mb-3 flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setTab("policial")}
          className={`border-b-2 px-3 py-2 text-sm ${tab === "policial" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
        >
          Por policial
        </button>
        <button
          onClick={() => setTab("geral")}
          className={`border-b-2 px-3 py-2 text-sm ${tab === "geral" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
        >
          Lista geral
        </button>
      </div>

      <label className="mb-3 flex items-center gap-2 rounded-md border border-border bg-input px-2 py-1.5 text-sm">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          className="flex-1 bg-transparent focus:outline-none"
          placeholder="Buscar por nome, matrícula, unidade ou nº de PAD"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </label>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-md border border-border p-6 text-center text-sm text-muted-foreground">
          Nenhuma observação registrada.
        </div>
      ) : tab === "policial" ? (
        <ul className="grid gap-2">
          {porPolicial.map((p) => (
            <li key={p.chave} className="surface p-3">
              <button
                onClick={() => setExpandido(expandido === p.chave ? null : p.chave)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    <span className="font-medium">{p.nome}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {[p.matricula && `Mat. ${p.matricula}`, p.cargo, p.unidade].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                  {p.observacoes.length} observaç{p.observacoes.length === 1 ? "ão" : "ões"}
                </span>
              </button>
              {expandido === p.chave && (
                <ul className="mt-3 grid gap-2 border-t border-border/60 pt-3">
                  {p.observacoes.map((o) => (
                    <li key={o.id}>
                      <ObservacaoCard obs={o} onOpen={() => setAberto(o)} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid gap-2">
          {filtrados.map((o) => (
            <li key={o.id}>
              <ObservacaoCard obs={o} onOpen={() => setAberto(o)} showPolicial />
            </li>
          ))}
        </ul>
      )}

      {aberto && (
        <ObservacaoViewer
          obs={aberto}
          onClose={() => setAberto(null)}
          onEdit={() => {
            setEditando(aberto);
            setAberto(null);
          }}
        />
      )}
      {criando && <ObservacaoDialog onClose={() => setCriando(false)} />}
      {editando && <ObservacaoDialog obs={editando} onClose={() => setEditando(null)} />}
    </div>
  );
}

function ObservacaoCard({
  obs,
  onOpen,
  showPolicial,
}: {
  obs: Observacao;
  onOpen: () => void;
  showPolicial?: boolean;
}) {
  return (
    <button
      onClick={onOpen}
      className="surface flex w-full flex-col items-start gap-1 p-3 text-left transition hover:border-primary/60"
    >
      {showPolicial && (
        <div className="text-xs">
          {obs.policial_nome ? (
            <>
              <span className="font-medium">{obs.policial_nome}</span>
              <span className="text-muted-foreground">
                {" · "}
                {[obs.policial_matricula, obs.policial_cargo, obs.policial_unidade].filter(Boolean).join(" · ") || "—"}
              </span>
            </>
          ) : (
            <span className="font-medium italic text-muted-foreground">Observação geral</span>
          )}
        </div>
      )}
      <div className="text-[11px] text-muted-foreground">
        {obs.autor_nome} — {cargoLabel(obs.autor_cargo)} · {new Date(obs.created_at).toLocaleString("pt-BR")}
      </div>
      {obs.pads.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 pt-1 text-[11px]">
          <Link2 className="h-3 w-3 text-primary" />
          {obs.pads.map((p) => (
            <span key={p.denuncia_id} className="rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-primary">
              {p.numero_protocolo}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function ObservacaoViewer({
  obs,
  onClose,
  onEdit,
}: {
  obs: Observacao;
  onClose: () => void;
  onEdit: () => void;
}) {
  const qc = useQueryClient();
  const fn = useServerFn(excluirObservacao);
  const m = useMutation({
    mutationFn: () => fn({ data: { id: obs.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["observacoes"] });
      qc.invalidateQueries({ queryKey: ["obs-pad-count"] });
      onClose();
    },
  });

  const dataFmt = new Date(obs.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="surface flex max-h-[90vh] w-full max-w-3xl flex-col p-5">
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h3 className="font-serif text-lg">Observação</h3>
          <div className="flex items-center gap-1">
            <button onClick={onEdit} className="rounded-md border border-border p-1.5 hover:bg-surface-2" aria-label="Editar">
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => { if (window.confirm("Excluir esta observação?")) m.mutate(); }}
              className="rounded-md border border-destructive/40 p-1.5 text-destructive hover:bg-destructive/10"
              aria-label="Excluir"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="rounded-md p-1 hover:bg-surface-2">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="relative rounded-md">
            <header className="flex items-start gap-3 pb-3">
              <img src={PMESP_CREST_URL} alt="" aria-hidden className="h-12 w-auto flex-shrink-0 opacity-90 sm:h-14" />
              <div className="text-[10px] font-semibold uppercase leading-snug tracking-wide text-muted-foreground sm:text-[11px]">
                <div>Secretaria da Segurança Pública</div>
                <div>Polícia Militar do Estado de São Paulo</div>
                <div>Corregedoria da Polícia Militar do Estado de São Paulo</div>
                <div>1ª Corregedoria da Capital</div>
              </div>
            </header>
            <div className="h-px w-full bg-border/60" />
            <div className="py-3 text-center">
              <div className="font-serif text-base font-semibold tracking-[0.25em] text-foreground sm:text-lg">
                OBSERVAÇÃO
              </div>
            </div>
            <div className="h-px w-full bg-border/60" />
            <dl className="grid gap-1.5 py-3 text-xs sm:text-sm">
              {obs.policial_nome && (
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold uppercase tracking-wider text-primary">Policial:</dt>
                  <dd className="text-foreground">{obs.policial_nome}</dd>
                </div>
              )}
              {obs.policial_matricula && (
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold uppercase tracking-wider text-primary">Matrícula:</dt>
                  <dd className="text-foreground">{obs.policial_matricula}</dd>
                </div>
              )}
              {obs.policial_cargo && (
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold uppercase tracking-wider text-primary">Cargo:</dt>
                  <dd className="text-foreground">{obs.policial_cargo}</dd>
                </div>
              )}
              {obs.policial_unidade && (
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold uppercase tracking-wider text-primary">Unidade:</dt>
                  <dd className="text-foreground">{obs.policial_unidade}</dd>
                </div>
              )}
              {obs.pads.length > 0 && (
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold uppercase tracking-wider text-primary">PADs vinculados:</dt>
                  <dd className="flex flex-wrap gap-1">
                    {obs.pads.map((p) => (
                      <span key={p.denuncia_id} className="rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">
                        {p.numero_protocolo}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
            <div className="h-px w-full bg-border/60" />
            <div className="py-4 text-sm leading-relaxed text-foreground">
              {isHtmlAto(obs.corpo) ? (
                <div className="ato-body" dangerouslySetInnerHTML={{ __html: sanitizeAtoHtml(obs.corpo) }} />
              ) : (
                <div className="whitespace-pre-wrap">{obs.corpo}</div>
              )}
              {obs.anexos && obs.anexos.length > 0 && <AtoAnexosLinks anexos={obs.anexos} />}
            </div>
            <div className="h-px w-full bg-border/60" />
            <footer className="pt-2 text-[11px] italic text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-emerald-500" aria-hidden />
                Registrado por {obs.autor_nome} — {cargoLabel(obs.autor_cargo)} em {dataFmt}.
              </span>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

function ObservacaoDialog({ obs, onClose }: { obs?: Observacao; onClose: () => void }) {
  const editing = !!obs;
  const [nome, setNome] = useState(obs?.policial_nome ?? "");
  const [matricula, setMatricula] = useState(obs?.policial_matricula ?? "");
  const [cargoPol, setCargoPol] = useState(obs?.policial_cargo ?? "");
  const [unidade, setUnidade] = useState(obs?.policial_unidade ?? "");
  const [corpo, setCorpo] = useState(obs?.corpo ?? "");
  const [anexos, setAnexos] = useState<AtoAnexo[]>(obs?.anexos ?? []);
  const [pads, setPads] = useState<{ id: string; numero_protocolo: string }[]>(
    obs?.pads.map((p) => ({ id: p.denuncia_id, numero_protocolo: p.numero_protocolo })) ?? [],
  );
  const [padTermo, setPadTermo] = useState("");
  const [padSug, setPadSug] = useState<{ id: string; numero_protocolo: string }[]>([]);
  const [polSug, setPolSug] = useState<{ nome: string; matricula: string | null; cargo: string | null; unidade: string | null }[]>([]);
  const tempPrefix = useMemo(() => obs?.id ?? `tmp-${Math.random().toString(16).slice(2)}`, [obs]);

  const qc = useQueryClient();
  const criarFn = useServerFn(criarObservacao);
  const editarFn = useServerFn(atualizarObservacao);
  const buscarPolFn = useServerFn(buscarPoliciais);
  const buscarPadFn = useServerFn(buscarPads);

  useEffect(() => {
    const t = setTimeout(() => {
      buscarPolFn({ data: { termo: nome + " " + matricula } }).then((r) => setPolSug(r)).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [nome, matricula, buscarPolFn]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (padTermo.trim().length < 1) { setPadSug([]); return; }
      buscarPadFn({ data: { termo: padTermo } }).then((r) => setPadSug(r)).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [padTermo, buscarPadFn]);

  const m = useMutation({
    mutationFn: async () => {
      const payload = {
        policial_nome: nome.trim(),
        policial_matricula: matricula.trim() || null,
        policial_cargo: cargoPol || null,
        policial_unidade: unidade || null,
        corpo: sanitizeAtoHtml(corpo),
        anexos,
        pads: pads.map((p) => p.id),
      };
      if (editing) await editarFn({ data: { ...payload, id: obs!.id } });
      else await criarFn({ data: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["observacoes"] });
      qc.invalidateQueries({ queryKey: ["obs-pad-count"] });
      onClose();
    },
  });

  const corpoTexto = useMemo(() => corpo.replace(/<[^>]+>/g, "").trim(), [corpo]);
  const disabled = corpoTexto.length < 3 || m.isPending;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="surface flex max-h-[90vh] w-full max-w-3xl flex-col p-5">
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h3 className="font-serif text-lg">{editing ? "Editar observação" : "Nova observação"}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-surface-2"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">Nome do policial (opcional)</span>
              <input
                className="rounded-md border border-border bg-input px-3 py-2 text-sm"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                list="obs-nome-sug"
                maxLength={200}
              />
              <datalist id="obs-nome-sug">
                {polSug.map((p, i) => (
                  <option key={i} value={p.nome} />
                ))}
              </datalist>
            </label>
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">Matrícula</span>
              <input
                className="rounded-md border border-border bg-input px-3 py-2 text-sm"
                value={matricula}
                onChange={(e) => {
                  setMatricula(e.target.value);
                  const match = polSug.find((p) => p.matricula === e.target.value);
                  if (match) {
                    if (!nome) setNome(match.nome);
                    if (!cargoPol && match.cargo) setCargoPol(match.cargo);
                    if (!unidade && match.unidade) setUnidade(match.unidade);
                  }
                }}
                list="obs-mat-sug"
                maxLength={50}
              />
              <datalist id="obs-mat-sug">
                {polSug.filter((p) => p.matricula).map((p, i) => (
                  <option key={i} value={p.matricula!}>{p.nome}</option>
                ))}
              </datalist>
            </label>
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">Cargo</span>
              <select
                className="rounded-md border border-border bg-input px-3 py-2 text-sm"
                value={cargoPol}
                onChange={(e) => setCargoPol(e.target.value)}
              >
                <option value="">—</option>
                {CARGOS_POLICIAIS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">Unidade</span>
              <select
                className="rounded-md border border-border bg-input px-3 py-2 text-sm"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
              >
                <option value="">—</option>
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Corpo da observação *</span>
            <RichTextEditor value={corpo} onChange={setCorpo} minHeight={220} />
          </div>

          <div className="grid gap-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Imagens (armazenamento interno privado)</span>
            <AtoAnexosUploader
              denunciaId={`observacoes/${tempPrefix}`}
              value={anexos}
              onChange={setAnexos}
            />
          </div>

          <div className="grid gap-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">PADs vinculados</span>
            <div className="flex flex-wrap gap-1">
              {pads.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  {p.numero_protocolo}
                  <button
                    type="button"
                    onClick={() => setPads(pads.filter((x) => x.id !== p.id))}
                    className="text-primary/70 hover:text-destructive"
                    aria-label="Remover vínculo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="relative">
              <input
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
                placeholder="Busque por número (ex.: 1-001/2026)"
                value={padTermo}
                onChange={(e) => setPadTermo(e.target.value)}
              />
              {padSug.length > 0 && padTermo && (
                <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
                  {padSug
                    .filter((s) => !pads.some((p) => p.id === s.id))
                    .map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setPads([...pads, s]);
                            setPadTermo("");
                            setPadSug([]);
                          }}
                          className="block w-full px-3 py-1.5 text-left text-xs hover:bg-surface-2"
                        >
                          {s.numero_protocolo}
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>

          {m.isError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive-foreground">
              {(m.error as Error)?.message || "Não foi possível salvar."}
            </div>
          )}
        </div>

        <div className="mt-4 flex shrink-0 justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">Cancelar</button>
          <button
            onClick={() => m.mutate()}
            disabled={disabled}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {m.isPending ? "Salvando..." : editing ? "Salvar alterações" : "Registrar observação"}
          </button>
        </div>
      </div>
    </div>
  );
}
