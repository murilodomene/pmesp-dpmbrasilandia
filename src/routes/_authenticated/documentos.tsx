import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { Header } from "@/components/Header";
import { Search, Save, Pencil, X, FileText, ChevronUp, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/documentos")({
  component: DocumentosPage,
});

type Doc = {
  id: string;
  titulo: string;
  conteudo: string;
  atualizado_em: string;
};

const DOC_ORDER = ["manual", "regimento", "fardamentos", "hierarquia"];

// Insert stable anchor IDs into headings referencing articles.
function anchorize(html: string): { html: string; toc: { id: string; label: string }[] } {
  const toc: { id: string; label: string }[] = [];
  const seen = new Set<string>();
  const re = /(Artigo|Art\.?)\s*(\d+)\s*(º|°)?/gi;
  const withAnchors = html.replace(re, (match, _p1, num) => {
    const id = `art-${num}`;
    if (seen.has(id)) return match;
    seen.add(id);
    toc.push({ id, label: `Art. ${num}` });
    return `<span id="${id}" class="scroll-mt-24">${match}</span>`;
  });
  return { html: withAnchors, toc };
}

// Very small markdown -> HTML (headings, bold, italics, lists, paragraphs).
function mdToHtml(md: string): string {
  const esc = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const lines = esc.split(/\n/);
  const out: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    const li = line.match(/^[-*]\s+(.*)$/);
    if (h) {
      if (inList) { out.push("</ul>"); inList = false; }
      const lvl = h[1].length;
      out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`);
    } else if (li) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(li[1])}</li>`);
    } else if (line === "") {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push("");
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function highlight(html: string, term: string): string {
  if (!term.trim()) return html;
  const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(
    new RegExp(`(${safe})(?![^<]*>)`, "gi"),
    '<mark class="bg-yellow-300 text-black rounded px-0.5">$1</mark>',
  );
}

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

  const podeEditar = cargo === "delegado_geral" || cargo === "delegado_corregedor";

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

  const selected = docs.find((d) => d.id === selectedId) ?? null;

  const rendered = useMemo(() => {
    if (!selected) return { html: "", toc: [] as { id: string; label: string }[], count: 0 };
    const html = mdToHtml(selected.conteudo);
    const withAnchors = anchorize(html);
    const finalHtml = highlight(withAnchors.html, buscaAtiva);
    const count = buscaAtiva.trim() ? (finalHtml.match(/<mark\b/g)?.length ?? 0) : 0;
    return { html: finalHtml, toc: withAnchors.toc, count };
  }, [selected, buscaAtiva]);

  // Auto-scroll to first match when searching inside a document
  useEffect(() => {
    if (!selectedId || !buscaAtiva.trim()) return;
    const t = setTimeout(() => {
      contentRef.current?.querySelector("mark")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => clearTimeout(t);
  }, [buscaAtiva, selectedId, rendered.html]);

  const searchResults = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q || selectedId) return [];
    return docs
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
  }, [busca, docs, selectedId]);

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
            {docs.map((d) => (
              <li key={d.id} className="animate-fade-in">
                <button
                  onClick={() => abrir(d.id)}
                  className="group flex w-full items-start gap-4 rounded-lg border border-border bg-surface p-5 text-left shadow-sm transition hover:border-primary hover:bg-surface-2"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-serif text-lg">{d.titulo}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Atualizado em {new Date(d.atualizado_em).toLocaleString("pt-BR")}
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
                <h2 className="font-serif text-2xl">{selected.titulo}</h2>
              </div>
              {podeEditar && !editando && (
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

            {editando ? (
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
                <div className="sticky top-0 z-10 border-b border-border bg-surface/95 px-6 py-3 backdrop-blur">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={buscaAtiva}
                      onChange={(e) => setBuscaAtiva(e.target.value)}
                      placeholder="Buscar neste documento…"
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
                  <div className="grid gap-6 p-6 md:grid-cols-[220px_1fr]">
                    {rendered.toc.length > 0 && (
                      <nav className="md:sticky md:top-24 md:self-start rounded-md border border-border bg-background/50 p-3">
                        <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Sumário</div>
                        <ul className="space-y-1 text-sm">
                          {rendered.toc.map((t) => (
                            <li key={t.id}>
                              <a
                                href={`#${t.id}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  document.getElementById(t.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                                  history.replaceState(null, "", `#${t.id}`);
                                }}
                                className="block rounded px-2 py-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                              >
                                {t.label}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </nav>
                    )}
                    <div
                      key={buscaAtiva}
                      ref={contentRef}
                      className="prose prose-invert max-w-none animate-fade-in prose-headings:font-serif prose-h1:text-2xl prose-h2:text-xl prose-p:leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: rendered.html }}
                    />
                  </div>
                )}
              </>
            )}
          </article>
        )}
      </main>
    </div>
  );
}
