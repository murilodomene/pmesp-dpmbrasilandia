import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { Header } from "@/components/Header";
import { Search, Save, Pencil, X, FileText, ChevronUp, ChevronDown, GitBranch } from "lucide-react";
import { HierarquiaQuadro } from "@/components/HierarquiaQuadro";
import { FluxoPAD } from "@/components/FluxoPAD";
import { PMESP_CREST_URL } from "@/lib/branding";

const HIERARQUIA_ROLES = new Set(["ssp", "cmtg", "corregedor_geral", "corregedor", "subcorregedor_geral"]);
const FLUXO_ROLES = HIERARQUIA_ROLES;

export const Route = createFileRoute("/_authenticated/documentos")({
  component: DocumentosPage,
});

type Doc = {
  id: string;
  titulo: string;
  conteudo: string;
  atualizado_em: string;
};

const FLUXO_DOC: Doc = {
  id: "fluxo",
  titulo: "Fluxo do Processo Administrativo",
  conteudo: "",
  atualizado_em: new Date(0).toISOString(),
};

import {
  type TocEntry,
  anchorize,
  highlight,
  isLegalDoc,
  legalToHtml,
  mdToHtml,
} from "@/lib/documento-formatter";

const DOC_ORDER = ["manual", "regimento", "fardamentos", "hierarquia", "fluxo"];

function DocumentosPage() {
  const { session } = useSession();
  const [cargo, setCargo] = useState<string | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const [salvando, setSalvando] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const podeEditar = cargo === "ssp" || cargo === "cmtg" || cargo === "corregedor_geral" || cargo === "subcorregedor_geral";

  useEffect(() => {
    if (!session) return;
    supabase.from("user_roles").select("role").eq("user_id", session.user.id).maybeSingle()
      .then(({ data }) => setCargo((data as { role: string } | null)?.role ?? null));
  }, [session]);

  useEffect(() => {
    supabase.from("documentos").select("*").then(({ data }) => {
      const list = ((data ?? []) as Doc[]).sort(
        (a, b) => DOC_ORDER.indexOf(a.id) - DOC_ORDER.indexOf(b.id),
      );
      setDocs(list);
      // ?open=<docId> deep-link
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const open = params.get("open");
        if (open && list.some((d) => d.id === open)) setSelectedId(open);
      }
    });
  }, []);

  // hash-based direct navigation
  useEffect(() => {
    if (!selectedId) return;
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, [selectedId]);

  const podeVerHierarquia = cargo !== null && HIERARQUIA_ROLES.has(cargo);
  const podeVerFluxo = cargo !== null && FLUXO_ROLES.has(cargo);
  const visibleDocs = useMemo(() => {
    const base = docs.filter((d) => d.id !== "hierarquia" || podeVerHierarquia);
    const withFluxo = podeVerFluxo ? [...base, FLUXO_DOC] : base;
    return withFluxo.sort(
      (a, b) => DOC_ORDER.indexOf(a.id) - DOC_ORDER.indexOf(b.id),
    );
  }, [docs, podeVerHierarquia, podeVerFluxo]);

  const selected = visibleDocs.find((d) => d.id === selectedId) ?? null;
  const isHierarquia = selected?.id === "hierarquia";
  const isFluxo = selected?.id === "fluxo";
  const isLegal = !!selected && !isHierarquia && !isFluxo && isLegalDoc(selected.conteudo);

  const rendered = useMemo(() => {
    if (!selected || isFluxo) return { html: "", toc: [] as TocEntry[], count: 0, legal: false };
    const legal = !isHierarquia && isLegalDoc(selected.conteudo);
    const built = legal
      ? legalToHtml(selected.conteudo)
      : anchorize(mdToHtml(selected.conteudo));
    const finalHtml = highlight(built.html, buscaAtiva);
    const count = buscaAtiva.trim() ? (finalHtml.match(/<mark\b/g)?.length ?? 0) : 0;
    return { html: finalHtml, toc: built.toc, count, legal };
  }, [selected, isHierarquia, isFluxo, buscaAtiva]);

  // Sequential navigation between matches
  const [currentIndex, setCurrentIndex] = useState(0);
  useEffect(() => { setCurrentIndex(0); }, [buscaAtiva, selectedId]);

  useEffect(() => {
    if (!contentRef.current) return;
    const marks = contentRef.current.querySelectorAll<HTMLElement>("mark");
    marks.forEach((m, i) => {
      if (i === currentIndex) {
        m.classList.remove("bg-yellow-300");
        m.classList.add("bg-orange-400", "ring-2", "ring-blue-500");
      } else {
        m.classList.add("bg-yellow-300");
        m.classList.remove("bg-orange-400", "ring-2", "ring-blue-500");
      }
    });
    marks[currentIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentIndex, rendered.html]);

  const total = rendered.count;
  function goNext() { if (total > 1) setCurrentIndex((i) => (i + 1) % total); }
  function goPrev() { if (total > 1) setCurrentIndex((i) => (i - 1 + total) % total); }

  const searchResults = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q || selectedId) return [];
    return visibleDocs
      .map((d) => {
        const hay = (d.titulo + "\n" + d.conteudo).toLowerCase();
        const idx = hay.indexOf(q);
        if (idx === -1) return null;
        const start = Math.max(0, idx - 40);
        const end = Math.min(hay.length, idx + q.length + 60);
        const trecho = (start > 0 ? "…" : "") + d.conteudo.slice(start, end) + (end < d.conteudo.length ? "…" : "");
        return { doc: d, trecho };
      })
      .filter(Boolean) as { doc: Doc; trecho: string }[];
  }, [busca, visibleDocs, selectedId]);

  function abrir(id: string, termo?: string) {
    setSelectedId(id);
    setEditando(false);
    if (termo) {
      setBuscaAtiva(termo);
      setTimeout(() => {
        const mark = contentRef.current?.querySelector("mark");
        mark?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    } else {
      setBuscaAtiva("");
    }
  }

  async function salvar() {
    if (!selected) return;
    setSalvando(true);
    const { data, error } = await supabase
      .from("documentos")
      .update({ conteudo: rascunho })
      .eq("id", selected.id)
      .select()
      .single();
    setSalvando(false);
    if (error) {
      alert("Erro ao salvar: " + error.message);
      return;
    }
    setDocs((prev) => prev.map((d) => (d.id === selected.id ? (data as Doc) : d)));
    setEditando(false);
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl">Documentos</h1>
            <p className="text-sm text-muted-foreground">Acervo normativo interno da Corregedoria.</p>
          </div>
          {!selectedId && (
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar em todos os documentos…"
                className="w-full rounded-lg border border-border bg-surface pl-9 pr-9 py-2 text-sm shadow-sm outline-none transition focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              {busca && (
                <button
                  onClick={() => setBusca("")}
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {!selectedId && busca.trim() && (
          <div className="mb-8 animate-fade-in rounded-lg border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-4 py-2 text-xs uppercase tracking-widest text-muted-foreground">
              {searchResults.length === 0
                ? "Nenhum resultado"
                : `${searchResults.length} resultado${searchResults.length > 1 ? "s" : ""} encontrado${searchResults.length > 1 ? "s" : ""}`}
            </div>
            {searchResults.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  Nenhum resultado encontrado para <span className="font-medium text-foreground">"{busca}"</span>
                </p>
                <button
                  onClick={() => setBusca("")}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
                >
                  <X className="h-3.5 w-3.5" /> Limpar busca
                </button>
              </div>
            ) : (
              <ul>
                {searchResults.map(({ doc, trecho }, i) => (
                  <li key={i} className="animate-fade-in">
                    <button
                      onClick={() => abrir(doc.id, busca)}
                      className="block w-full border-b border-border/60 px-4 py-3 text-left hover:bg-surface-2"
                    >
                      <div className="font-medium">{doc.titulo}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{trecho}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!selectedId && !busca.trim() && (
          <ul className="grid gap-4 sm:grid-cols-2">
            {visibleDocs.map((d) => (
              <li key={d.id} className="animate-fade-in">
                <button
                  onClick={() => abrir(d.id)}
                  className="group flex w-full items-start gap-4 rounded-lg border border-border bg-surface p-5 text-left shadow-sm transition hover:border-primary hover:bg-surface-2"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                    {d.id === "fluxo" ? <GitBranch className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-serif text-lg">{d.titulo}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {d.id === "fluxo"
                        ? "Referência visual — somente leitura"
                        : `Atualizado em ${new Date(d.atualizado_em).toLocaleString("pt-BR")}`}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected && (
          <article className="rounded-lg border border-border bg-surface">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
              <div>
                <button
                  onClick={() => { setSelectedId(null); setEditando(false); setBuscaAtiva(""); }}
                  className="mb-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  ← Voltar
                </button>
                {isLegal ? (
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    Documento normativo
                  </div>
                ) : (
                  <h2 className="font-serif text-2xl">{selected.titulo}</h2>
                )}
              </div>
              {podeEditar && !editando && !isHierarquia && !isFluxo && (
                <button
                  onClick={() => { setRascunho(selected.conteudo); setEditando(true); }}
                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
                >
                  <Pencil className="h-4 w-4" /> Editar
                </button>
              )}
              {editando && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditando(false)}
                    className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
                  >
                    <X className="h-4 w-4" /> Cancelar
                  </button>
                  <button
                    disabled={salvando}
                    onClick={salvar}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" /> {salvando ? "Salvando…" : "Salvar"}
                  </button>
                </div>
              )}
            </header>

            {isFluxo ? (
              <FluxoPAD />
            ) : isHierarquia ? (
              <HierarquiaQuadro cargo={cargo} />
            ) : editando ? (
              <div className="p-6">
                <p className="mb-2 text-xs text-muted-foreground">
                  Suporta Markdown: <code>#</code> títulos, <code>**negrito**</code>, <code>*itálico*</code>, listas com <code>-</code>. Referências a "Art. N" viram âncoras.
                </p>
                <textarea
                  value={rascunho}
                  onChange={(e) => setRascunho(e.target.value)}
                  className="min-h-[60vh] w-full rounded-md border border-border bg-background p-4 font-mono text-sm outline-none focus:border-primary"
                />
              </div>
            ) : (
              <>
                {isLegal && (
                  <div className="border-b border-border/60 bg-surface-2/40 px-6 py-6">
                    <div className="flex items-start gap-4">
                      <img
                        src={PMESP_CREST_URL}
                        alt=""
                        aria-hidden
                        className="h-14 w-auto flex-shrink-0 opacity-90 sm:h-16"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground sm:text-[11px]">
                          Polícia Militar do Estado de São Paulo — Corregedoria
                        </div>
                        <h2 className="mt-1 font-serif text-2xl leading-tight text-foreground sm:text-3xl">
                          {selected.titulo}
                        </h2>
                        <p className="mt-1 text-xs italic text-muted-foreground sm:text-sm">
                          {selected.id === "regimento"
                            ? "Estrutura, competências e funcionamento da Corregedoria."
                            : "Diretrizes, condutas e regras gerais da Polícia Militar do Estado de São Paulo."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="sticky top-0 z-10 border-b border-border bg-surface/95 px-6 py-3 backdrop-blur">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={buscaAtiva}
                      onChange={(e) => setBuscaAtiva(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") { setBuscaAtiva(""); return; }
                        if (e.key === "Enter" || e.key === "ArrowDown") {
                          e.preventDefault();
                          if (e.shiftKey && e.key === "Enter") goPrev(); else goNext();
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          goPrev();
                        }
                      }}
                      placeholder="Buscar neste documento… (Enter próximo, Shift+Enter anterior, Esc limpa)"
                      className="w-full rounded-lg border border-border bg-background pl-9 pr-9 py-2 text-sm shadow-sm outline-none transition focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    {buscaAtiva && (
                      <button
                        onClick={() => setBuscaAtiva("")}
                        aria-label="Limpar busca"
                        className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {buscaAtiva.trim() && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {rendered.count === 0
                        ? "Nenhum resultado"
                        : `${rendered.count} resultado${rendered.count > 1 ? "s" : ""} encontrado${rendered.count > 1 ? "s" : ""}`}
                    </div>
                  )}
                </div>

                {buscaAtiva.trim() && rendered.count === 0 ? (
                  <div className="flex flex-col items-center gap-3 px-6 py-16 text-center animate-fade-in">
                    <p className="text-sm text-muted-foreground">
                      Nenhum resultado encontrado para <span className="font-medium text-foreground">"{buscaAtiva}"</span>
                    </p>
                    <button
                      onClick={() => setBuscaAtiva("")}
                      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
                    >
                      <X className="h-3.5 w-3.5" /> Limpar busca
                    </button>
                  </div>
                ) : (
                  <div className="px-4 py-6 sm:px-6 md:px-8">
                    <div
                      key={buscaAtiva}
                      ref={contentRef}
                      className={
                        rendered.legal
                          ? "mx-auto max-w-[850px] animate-fade-in text-[15px] text-foreground/90"
                          : "prose prose-invert mx-auto max-w-[850px] animate-fade-in prose-headings:font-serif prose-h1:text-2xl prose-h2:text-xl prose-p:leading-relaxed"
                      }
                      dangerouslySetInnerHTML={{ __html: rendered.html }}
                    />
                  </div>
                )}
              </>
            )}
          </article>
        )}

        {selected && !editando && buscaAtiva.trim() && (
          <div
            role="toolbar"
            aria-label="Navegação entre resultados"
            className="fixed z-40 flex items-center gap-2 rounded-full border border-border bg-surface/95 px-3 py-2 shadow-lg backdrop-blur
                       bottom-4 left-1/2 -translate-x-1/2
                       md:bottom-auto md:left-auto md:translate-x-0 md:top-24 md:right-6"
          >
            <button
              onClick={goPrev}
              disabled={total < 2}
              aria-label="Resultado anterior"
              className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition hover:bg-surface-2 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <span className="min-w-[6.5rem] text-center text-xs tabular-nums text-muted-foreground">
              {total === 0 ? "Nenhum resultado" : `${currentIndex + 1} de ${total}`}
            </span>
            <button
              onClick={goNext}
              disabled={total < 2}
              aria-label="Próximo resultado"
              className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition hover:bg-surface-2 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              onClick={() => setBuscaAtiva("")}
              aria-label="Fechar busca"
              className="ml-1 grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
