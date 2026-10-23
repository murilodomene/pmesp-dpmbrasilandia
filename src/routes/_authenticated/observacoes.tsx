import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, X, Trash2, Pencil, Plus, Search, Link2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { getSessionInfo } from "@/lib/usuarios.functions";
import { exportFichaFuncionalPdf } from "@/lib/exportProcesso";
import { rotuloDesfechoPdo } from "@/lib/pdo-rotulos";
import { ROLE_LABELS } from "@/lib/access-roles";
import {
  listObservacoes,
  criarObservacao,
  atualizarObservacao,
  excluirObservacao,
  buscarPoliciais,
  buscarPads,
  listRegistrosAutomaticos,
} from "@/lib/observacoes.functions";
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
  return (ROLE_LABELS as Record<string, string>)[c] ?? c;
}

const STATUS_PROC: Record<string, string> = {
  recebida: "Recebida",
  em_analise: "Em análise",
  em_investigacao: "Em investigação",
  concluso: "Concluso",
  ag_decurso_prazo: "Aguardando decurso de prazo",
  em_recurso: "Em recurso",
  transito_julgado: "Trânsito em julgado",
  arquivada: "Arquivada",
};

type ProcAuto = {
  denuncia_id: string;
  numero: string;
  tipo: string | null;
  natureza: string | null;
  instaurada_em: string | null;
  status: string;
  nome: string;
  re: string | null;
  cargo: string | null;
  unidade: string | null;
};
type FiscAuto = {
  pdo_id: string;
  numero: string;
  data: string;
  local: string;
  desfecho: string;
  nome: string;
  re: string | null;
  cargo: string | null;
};
type Ficha = {
  chave: string;
  nome: string;
  re: string | null;
  posto: string | null;
  opm: string | null;
  observacoes: Observacao[];
  procedimentos: ProcAuto[];
  pdos: FiscAuto[];
  ultima: number;
};

const semAcento = (t: string) =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const textoDe = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Junta observações, procedimentos (como denunciado) e PDOs (como fiscalizado)
 * por policial: pelo RE e, quando não houver RE, pelo nome.
 */
function montarFichas(obs: Observacao[], procs: ProcAuto[], fiscs: FiscAuto[]): Ficha[] {
  type Pessoa = { nome: string; re: string | null; posto: string | null; opm: string | null; data: number; add: (f: Ficha) => void };
  const pessoas: Pessoa[] = [
    ...obs
      .filter((o) => o.policial_nome || o.policial_matricula)
      .map((o) => ({
        nome: o.policial_nome ?? "",
        re: o.policial_matricula,
        posto: o.policial_cargo,
        opm: o.policial_unidade,
        data: new Date(o.created_at).getTime(),
        add: (f: Ficha) => f.observacoes.push(o),
      })),
    ...procs.map((p) => ({
      nome: p.nome,
      re: p.re,
      posto: p.cargo,
      opm: p.unidade,
      data: p.instaurada_em ? new Date(p.instaurada_em).getTime() : 0,
      add: (f: Ficha) => {
        if (!f.procedimentos.some((x) => x.denuncia_id === p.denuncia_id)) f.procedimentos.push(p);
      },
    })),
    ...fiscs.map((x) => ({
      nome: x.nome,
      re: x.re,
      posto: x.cargo,
      opm: null,
      data: new Date(x.data).getTime(),
      add: (f: Ficha) => {
        if (!f.pdos.some((y) => y.pdo_id === x.pdo_id)) f.pdos.push(x);
      },
    })),
  ];
  // Quem tem RE primeiro: assim um registro só com nome cai na ficha certa.
  pessoas.sort((a, b) => Number(!!b.re?.trim()) - Number(!!a.re?.trim()));
  const fichas = new Map<string, Ficha>();
  const porNome = new Map<string, string>();
  for (const p of pessoas) {
    const re = (p.re ?? "").replace(/\W/g, "").toUpperCase();
    const nome = semAcento(p.nome);
    if (!re && !nome) continue;
    const chave = re ? `re:${re}` : porNome.get(nome) ?? `nome:${nome}`;
    let f = fichas.get(chave);
    if (!f) {
      f = { chave, nome: p.nome.trim(), re: p.re?.trim() || null, posto: null, opm: null, observacoes: [], procedimentos: [], pdos: [], ultima: 0 };
      fichas.set(chave, f);
    }
    if (nome && !porNome.has(nome)) porNome.set(nome, chave);
    if (!f.nome && p.nome) f.nome = p.nome.trim();
    if (!f.posto && p.posto) f.posto = p.posto;
    if (!f.opm && p.opm) f.opm = p.opm;
    f.ultima = Math.max(f.ultima, p.data || 0);
    p.add(f);
  }
  for (const f of fichas.values()) {
    f.observacoes.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    f.procedimentos.sort((a, b) => +new Date(b.instaurada_em ?? 0) - +new Date(a.instaurada_em ?? 0));
    f.pdos.sort((a, b) => +new Date(b.data) - +new Date(a.data));
  }
  return Array.from(fichas.values()).sort((a, b) => b.ultima - a.ultima);
}

function ObservacoesPage() {
  const search = Route.useSearch();
  const sessionFn = useServerFn(getSessionInfo);
  const { data: session, isLoading: carregandoSessao } = useQuery({
    queryKey: ["session-info"],
    queryFn: () => sessionFn(),
  });
  const [tab, setTab] = useState<"policial" | "geral">("policial");
  const [busca, setBusca] = useState(search.q ?? "");
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [aberto, setAberto] = useState<Observacao | null>(null);
  const [editando, setEditando] = useState<Observacao | null>(null);
  const [criando, setCriando] = useState<Partial<Observacao> | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const perfil = session?.profile as { nome?: string; status?: string; posto_graduacao?: string | null } | null | undefined;
  const cargo = session?.cargo ?? null;
  const podeVer =
    perfil?.status === "ativo" &&
    !!cargo &&
    ["ssp", "cmtg", "corregedor_geral", "corregedor", "subcorregedor_geral", "corregedor_supervisor"].includes(cargo);

  const listFn = useServerFn(listObservacoes);
  const { data: obs = [], isLoading } = useQuery({
    queryKey: ["observacoes"],
    queryFn: () => listFn() as Promise<Observacao[]>,
    enabled: podeVer,
  });
  const autoFn = useServerFn(listRegistrosAutomaticos);
  const { data: auto } = useQuery({
    queryKey: ["observacoes-automaticas"],
    queryFn: () => autoFn(),
    enabled: podeVer,
  });

  const fichas = useMemo(
    () => montarFichas(obs, (auto?.procedimentos ?? []) as ProcAuto[], (auto?.fiscalizacoes ?? []) as FiscAuto[]),
    [obs, auto],
  );
  const termo = semAcento(busca);
  const fichasFiltradas = useMemo(() => {
    if (!termo) return fichas;
    return fichas.filter((f) =>
      semAcento(
        [
          f.nome,
          f.re,
          f.posto,
          f.opm,
          ...f.procedimentos.map((p) => `${p.numero} ${p.natureza ?? ""}`),
          ...f.pdos.map((p) => p.numero),
          ...f.observacoes.map((o) => `${o.autor_nome} ${textoDe(o.corpo)} ${o.pads.map((x) => x.numero_protocolo).join(" ")}`),
        ]
          .filter(Boolean)
          .join(" "),
      ).includes(termo),
    );
  }, [fichas, termo]);
  const obsFiltradas = useMemo(() => {
    if (!termo) return obs;
    return obs.filter((o) =>
      semAcento(
        [
          o.policial_nome,
          o.policial_matricula,
          o.policial_unidade,
          o.policial_cargo,
          o.autor_nome,
          textoDe(o.corpo),
          ...o.pads.map((p) => p.numero_protocolo),
        ]
          .filter(Boolean)
          .join(" "),
      ).includes(termo),
    );
  }, [obs, termo]);
  const ficha =
    fichasFiltradas.find((f) => f.chave === selecionada) ?? fichasFiltradas[0] ?? null;

  async function exportarFicha(f: Ficha) {
    setGerandoPdf(true);
    try {
      await exportFichaFuncionalPdf({
        policial: { nome: f.nome, posto: f.posto, re: f.re, opm: f.opm },
        emitidaPor: {
          nome: [perfil?.posto_graduacao, perfil?.nome].filter(Boolean).join(" ") || "—",
          cargo,
        },
        emitidaEm: new Date().toISOString(),
        procedimentos: f.procedimentos.map((p) => ({
          numero: p.numero,
          natureza: p.natureza,
          instaurado_em: p.instaurada_em,
          status: p.status,
        })),
        pdos: f.pdos.map((p) => ({ numero: p.numero, data: p.data, local: p.local, desfecho: p.desfecho, papel: "fiscalizado" as const })),
        observacoes: f.observacoes.map((o) => ({
          data: o.created_at,
          autor: `${o.autor_nome} — ${cargoLabel(o.autor_cargo)}`,
          corpo: o.corpo,
          processos: o.pads.map((p) => p.numero_protocolo),
        })),
      });
    } catch (e) {
      toast.error((e as Error)?.message || "Falha ao gerar a ficha funcional.");
    } finally {
      setGerandoPdf(false);
    }
  }

  if (carregandoSessao) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-4xl p-6 text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }
  if (!podeVer) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-4xl p-6">
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
            Acesso restrito aos usuários internos da Corregedoria.
          </div>
        </div>
      </div>
    );
  }

  const aba = (ativa: boolean) =>
    `flex-1 rounded-md border px-3 py-1.5 text-xs transition ${
      ativa ? "border-primary/55 bg-primary/10 font-semibold text-primary" : "border-border hover:bg-surface-2"
    }`;

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Controle interno · restrito à Corregedoria
            </div>
            <h1 className="font-serif text-2xl">Observações</h1>
          </div>
          <button
            onClick={() => setCriando({})}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Nova observação
          </button>
        </header>

        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="surface flex max-h-[calc(100vh-160px)] min-h-[320px] flex-col overflow-hidden">
            <div className="space-y-2 border-b border-border p-3">
              <label className="flex items-center gap-2 rounded-md border border-border bg-input px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <input
                  type="search"
                  className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="Policial, RE, OPM, processo ou texto…"
                  aria-label="Buscar"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </label>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setTab("policial")} className={aba(tab === "policial")}>
                  Por policial ({fichasFiltradas.length})
                </button>
                <button type="button" onClick={() => setTab("geral")} className={aba(tab === "geral")}>
                  Lista geral ({obsFiltradas.length})
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-sm text-muted-foreground">Carregando...</div>
              ) : tab === "policial" ? (
                fichasFiltradas.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    {fichas.length ? "Nenhum policial encontrado com essa busca." : "Nenhum policial com registros ainda."}
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {fichasFiltradas.map((f) => {
                      const ativa = ficha?.chave === f.chave;
                      const total = f.observacoes.length + f.procedimentos.length + f.pdos.length;
                      return (
                        <li key={f.chave}>
                          <button
                            type="button"
                            onClick={() => setSelecionada(f.chave)}
                            aria-current={ativa ? "true" : undefined}
                            className={`grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-0.5 px-4 py-2.5 text-left transition ${
                              ativa ? "bg-primary/10" : "hover:bg-surface-2"
                            }`}
                          >
                            <span className={`truncate text-sm ${ativa ? "font-semibold text-primary" : "font-medium"}`}>
                              {[f.posto, f.nome].filter(Boolean).join(" ") || "—"}
                            </span>
                            <span
                              className={`rounded-full px-2 py-px text-[11px] ${ativa ? "bg-primary text-primary-foreground" : "border border-border"}`}
                              title="Total de registros"
                            >
                              {total}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {[f.re && `RE ${f.re}`, f.opm].filter(Boolean).join(" · ") || "Sem RE"}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {f.procedimentos.length > 0 && `${f.procedimentos.length} proc.`}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )
              ) : obsFiltradas.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  {obs.length ? "Nenhuma observação encontrada com essa busca." : "Nenhuma observação registrada."}
                </div>
              ) : (
                <ul className="grid gap-2 p-3">
                  {obsFiltradas.map((o) => (
                    <li key={o.id}>
                      <ObservacaoCard obs={o} onOpen={() => setAberto(o)} showPolicial />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          <section className="surface min-w-0 overflow-hidden">
            {!ficha ? (
              <div className="grid min-h-[320px] place-items-center p-6 text-center text-sm text-muted-foreground">
                Selecione um policial para ver a ficha.
              </div>
            ) : (
              <FichaPolicial
                ficha={ficha}
                gerandoPdf={gerandoPdf}
                onExportar={() => exportarFicha(ficha)}
                onNova={() =>
                  setCriando({
                    policial_nome: ficha.nome,
                    policial_matricula: ficha.re,
                    policial_cargo: ficha.posto,
                    policial_unidade: ficha.opm,
                  })
                }
                onAbrir={(o) => setAberto(o)}
              />
            )}
          </section>
        </div>
      </div>

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
      {criando && <ObservacaoDialog inicial={criando} onClose={() => setCriando(null)} />}
      {editando && <ObservacaoDialog obs={editando} onClose={() => setEditando(null)} />}
    </div>
  );
}

function FichaPolicial({
  ficha,
  gerandoPdf,
  onExportar,
  onNova,
  onAbrir,
}: {
  ficha: Ficha;
  gerandoPdf: boolean;
  onExportar: () => void;
  onNova: () => void;
  onAbrir: (o: Observacao) => void;
}) {
  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
  const titulo = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className={titulo}>Ficha do policial</div>
          <h2 className="font-serif text-xl">{[ficha.posto, ficha.nome].filter(Boolean).join(" ")}</h2>
          <div className="text-sm text-muted-foreground">
            {[ficha.re ? `RE ${ficha.re}` : "Sem RE cadastrado", ficha.opm].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onExportar}
            disabled={gerandoPdf}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2 disabled:opacity-50"
          >
            {gerandoPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Exportar ficha (PDF)
          </button>
          <button
            type="button"
            onClick={onNova}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/55 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
          >
            <Plus className="h-3.5 w-3.5" /> Observação para este policial
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-2 border-b border-border sm:grid-cols-4">
        {[
          { k: "Procedimentos", v: ficha.procedimentos.length },
          { k: "PDOs fiscalizado", v: ficha.pdos.length },
          { k: "Observações", v: ficha.observacoes.length },
          { k: "Último registro", v: ficha.ultima ? new Date(ficha.ultima).toLocaleDateString("pt-BR") : "—" },
        ].map((c, i) => (
          <div key={c.k} className={`px-5 py-3 ${i ? "sm:border-l sm:border-border" : ""}`}>
            <dt className={titulo}>{c.k}</dt>
            <dd className="tabular text-lg font-semibold">{c.v}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-5 p-5">
        <div>
          <div className={`${titulo} mb-2`}>Procedimentos disciplinares (registro automático)</div>
          {ficha.procedimentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum procedimento instaurado contra este policial.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="bg-background/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2">Procedimento</th>
                    <th className="px-3 py-2">Natureza</th>
                    <th className="px-3 py-2">Instauração</th>
                    <th className="px-3 py-2">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ficha.procedimentos.map((p) => (
                    <tr key={p.denuncia_id}>
                      <td className="whitespace-nowrap px-3 py-2">
                        <a href={`/corregedoria?id=${p.denuncia_id}`} className="font-medium text-primary hover:underline">
                          {p.numero}
                        </a>
                      </td>
                      <td className="px-3 py-2">{p.natureza || "—"}</td>
                      <td className="tabular whitespace-nowrap px-3 py-2 text-muted-foreground">{fmt(p.instaurada_em)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{STATUS_PROC[p.status] ?? p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {ficha.pdos.length > 0 && (
          <div>
            <div className={`${titulo} mb-2`}>PDOs em que foi fiscalizado (registro automático)</div>
            <ul className="divide-y divide-border rounded-md border border-border text-sm">
              {ficha.pdos.map((p) => (
                <li key={p.pdo_id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2">
                  <span className="font-mono text-xs font-semibold text-primary">{p.numero}</span>
                  <span className="tabular text-muted-foreground">{fmt(p.data)}</span>
                  <span className="min-w-0 flex-1 truncate">{p.local}</span>
                  <span className="text-xs text-muted-foreground">{rotuloDesfechoPdo(p.desfecho)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <div className={`${titulo} mb-2`}>Observações da Corregedoria</div>
          {ficha.observacoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma observação escrita para este policial.</p>
          ) : (
            <ol className="space-y-3">
              {ficha.observacoes.map((o) => (
                <li key={o.id} className="grid gap-x-4 sm:grid-cols-[96px_minmax(0,1fr)]">
                  <span className="tabular pt-2 text-xs text-muted-foreground">{fmt(o.created_at)}</span>
                  <ObservacaoCard obs={o} onOpen={() => onAbrir(o)} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
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
  const previa = textoDe(obs.corpo);
  return (
    <div className="surface flex w-full flex-col items-start gap-1 p-3 text-left transition hover:border-primary/60">
      <button type="button" onClick={onOpen} className="flex w-full flex-col items-start gap-1 text-left">
        {showPolicial && (
          <span className="text-xs">
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
          </span>
        )}
        <span className="text-[11px] text-muted-foreground">
          {obs.autor_nome} — {cargoLabel(obs.autor_cargo)} · {new Date(obs.created_at).toLocaleString("pt-BR")}
        </span>
        {previa && <span className="line-clamp-2 text-sm text-foreground/90">{previa}</span>}
      </button>
      {obs.pads.length > 0 && (
        <span className="flex flex-wrap items-center gap-1 pt-1 text-[11px]">
          <Link2 className="h-3 w-3 text-primary" aria-hidden />
          {obs.pads.map((p) => (
            <a
              key={p.denuncia_id}
              href={`/corregedoria?id=${p.denuncia_id}`}
              className="rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-primary hover:bg-primary/20"
            >
              {p.numero_protocolo}
            </a>
          ))}
        </span>
      )}
    </div>
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
      qc.invalidateQueries({ queryKey: ["obs-policial-count"] });
      toast.success("Observação excluída.");
      onClose();
    },
    onError: (e) => toast.error((e as Error)?.message || "Não foi possível excluir."),
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
                      <a
                        key={p.denuncia_id}
                        href={`/corregedoria?id=${p.denuncia_id}`}
                        className="rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary hover:bg-primary/20"
                      >
                        {p.numero_protocolo}
                      </a>
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

function ObservacaoDialog({
  obs,
  inicial,
  onClose,
}: {
  obs?: Observacao;
  /** Dados do policial já preenchidos (botão "Observação para este policial"). */
  inicial?: Partial<Observacao>;
  onClose: () => void;
}) {
  const editing = !!obs;
  const base = obs ?? inicial;
  const [nome, setNome] = useState(base?.policial_nome ?? "");
  const [matricula, setMatricula] = useState(base?.policial_matricula ?? "");
  const [cargoPol, setCargoPol] = useState(base?.policial_cargo ?? "");
  const [unidade, setUnidade] = useState(base?.policial_unidade ?? "");
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

  // Sugestões de policiais: busca pelo RE quando houver, senão pelo nome.
  const termoPolicial = matricula.trim() || nome.trim();
  useEffect(() => {
    if (termoPolicial.length < 2) {
      setPolSug([]);
      return;
    }
    const t = setTimeout(() => {
      buscarPolFn({ data: { termo: termoPolicial } }).then((r) => setPolSug(r)).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [termoPolicial, buscarPolFn]);

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
      qc.invalidateQueries({ queryKey: ["obs-policial-count"] });
      toast.success(editing ? "Observação atualizada." : "Observação registrada.");
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
              <span className="text-muted-foreground">Posto/Graduação</span>
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
                placeholder="Busque por número (ex.: 001/2026)"
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
