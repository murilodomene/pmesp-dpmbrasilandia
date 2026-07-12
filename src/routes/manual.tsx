import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import {
  anchorize,
  highlight,
  isLegalDoc,
  legalToHtml,
  mdToHtml,
} from "@/lib/documento-formatter";

export const Route = createFileRoute("/manual")({
  component: ManualPublicoPage,
  head: () => ({
    meta: [
      { title: "Manual de Procedimentos — Corregedoria Geral da Polícia Civil" },
      {
        name: "description",
        content:
          "Manual de Procedimentos da Corregedoria Geral da Polícia Civil do Estado de São Paulo — diretrizes, condutas e regras gerais, em consulta pública.",
      },
      { property: "og:title", content: "Manual de Procedimentos — Corregedoria Geral" },
      {
        property: "og:description",
        content:
          "Consulta pública ao Manual de Procedimentos da Corregedoria Geral da Polícia Civil.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Doc = { id: string; titulo: string; conteudo: string; atualizado_em: string };

function ManualPublicoPage() {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [buscaAtiva, setBuscaAtiva] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("documentos")
      .select("*")
      .eq("id", "manual")
      .maybeSingle()
      .then(({ data, error }) => {
        setCarregando(false);
        if (error) {
          setErro("Não foi possível carregar o Manual.");
          return;
        }
        setDoc((data as Doc | null) ?? null);
      });
  }, []);

  const rendered = useMemo(() => {
    if (!doc) return { html: "", legal: false, count: 0 };
    const legal = isLegalDoc(doc.conteudo);
    const built = legal ? legalToHtml(doc.conteudo) : anchorize(mdToHtml(doc.conteudo));
    const finalHtml = highlight(built.html, buscaAtiva);
    const count = buscaAtiva.trim() ? (finalHtml.match(/<mark\b/g)?.length ?? 0) : 0;
    return { html: finalHtml, legal, count };
  }, [doc, buscaAtiva]);

  useEffect(() => { setCurrentIndex(0); }, [buscaAtiva]);

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
  const goNext = () => { if (total > 1) setCurrentIndex((i) => (i + 1) % total); };
  const goPrev = () => { if (total > 1) setCurrentIndex((i) => (i - 1 + total) % total); };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <article className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border/60 bg-surface-2/40 px-6 py-6">
            <div className="flex items-start gap-4">
              <img
                src="/brasao-pcsp.png"
                alt=""
                aria-hidden
                className="h-14 w-auto shrink-0 opacity-90 sm:h-16"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground sm:text-[11px]">
                  Polícia Civil do Estado de São Paulo — Corregedoria Geral
                </div>
                <h1 className="mt-1 font-serif text-2xl leading-tight text-foreground sm:text-3xl">
                  {doc?.titulo ?? "Manual de Procedimentos"}
                </h1>
                <p className="mt-1 text-xs italic text-muted-foreground sm:text-sm">
                  Diretrizes, condutas e regras gerais da Polícia Civil — consulta pública.
                </p>
              </div>
            </div>
          </div>

          {carregando ? (
            <div className="px-6 py-16 text-center text-sm text-muted-foreground">
              Carregando…
            </div>
          ) : erro || !doc ? (
            <div className="px-6 py-16 text-center text-sm text-muted-foreground">
              {erro ?? "Manual indisponível no momento."}
            </div>
          ) : (
            <>
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
                    placeholder="Buscar no Manual… (Enter próximo, Shift+Enter anterior, Esc limpa)"
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
                    {total === 0
                      ? "Nenhum resultado"
                      : `${total} resultado${total > 1 ? "s" : ""} encontrado${total > 1 ? "s" : ""}`}
                  </div>
                )}
              </div>

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
            </>
          )}
        </article>

        {doc && buscaAtiva.trim() && (
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
