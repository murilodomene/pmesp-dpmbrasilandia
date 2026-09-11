import { StickyNote } from "lucide-react";
import { PMESP_CREST_URL } from "@/lib/branding";

type Etapa = {
  n: number;
  titulo: string;
  nota?: string;
};

const ETAPAS: Etapa[] = [
  { n: 1, titulo: "Denúncia" },
  { n: 2, titulo: "Análise de Justa Causa da Denúncia" },
  { n: 3, titulo: "Portaria" },
  {
    n: 4,
    titulo: "Marcação da Oitiva",
    nota:
      "A oitiva realizada detém caráter pessoal e nela são oportunizados o contraditório, a ampla defesa, a presença de advogado e o direito do policial civil de permanecer em silêncio.",
  },
  { n: 5, titulo: "Deliberação da Cúpula da Corregedoria" },
  { n: 6, titulo: "IPM", nota: "O IPM é a decisão final da Corregedoria sobre o caso." },
  {
    n: 7,
    titulo: "Recurso (7 dias)",
    nota:
      "Após a publicação do IPM, há o prazo de 7 dias para que o(s) denunciado(s) interponha(m) recurso, com ou sem advogado.",
  },
  { n: 8, titulo: "Trânsito em Julgado Administrativo" },
];

export function FluxoPAD() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* Cabeçalho institucional */}
      <header className="mb-8 flex flex-col items-center gap-3 border-b border-border/60 pb-6 text-center">
        <img
          src={PMESP_CREST_URL}
          alt=""
          aria-hidden
          className="h-16 w-auto opacity-90 sm:h-20"
        />
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground sm:text-[11px]">
            Corregedoria da Polícia Militar do Estado de São Paulo
          </div>
          <h1 className="mt-1 font-serif text-2xl leading-tight text-foreground sm:text-3xl">
            Fluxo do Processo Administrativo
          </h1>
          <p className="mt-1 text-xs italic text-muted-foreground sm:text-sm">
            Rito do procedimento disciplinar — do recebimento ao trânsito em julgado.
          </p>
        </div>
      </header>

      {/* Fluxograma vertical */}
      <ol className="relative space-y-4">
        {ETAPAS.map((etapa, idx) => (
          <li key={etapa.n} className="animate-fade-in">
            <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              {/* Nó da etapa */}
              <div className="group relative rounded-xl border border-border bg-surface p-4 shadow-sm transition hover:border-primary/60 md:col-start-1">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-amber-500/40 bg-amber-500/10 font-serif text-sm font-semibold text-amber-400"
                  >
                    {etapa.n}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/90">
                      Etapa {etapa.n}
                    </div>
                    <div className="font-serif text-lg leading-tight text-foreground">
                      {etapa.titulo}
                    </div>
                  </div>
                </div>
              </div>

              {/* Callout lateral */}
              {etapa.nota && (
                <aside
                  role="note"
                  aria-label={`Observação sobre a etapa ${etapa.n}`}
                  className="relative rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 text-[13px] leading-relaxed text-foreground/85 md:col-start-2"
                >
                  <span
                    aria-hidden
                    className="hidden md:absolute md:-left-3 md:top-6 md:block md:h-px md:w-3 md:bg-amber-500/40"
                  />
                  <div className="flex items-start gap-2">
                    <StickyNote
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400/90"
                      aria-hidden
                    />
                    <p className="italic">{etapa.nota}</p>
                  </div>
                </aside>
              )}
            </div>

            {/* Conector para a próxima etapa */}
            {idx < ETAPAS.length - 1 && (
              <div
                aria-hidden
                className="flex justify-start pl-[18px] md:pl-[18px]"
              >
                <div className="flex flex-col items-center py-1">
                  <span className="block h-6 w-px bg-gradient-to-b from-border to-amber-500/40" />
                  <span className="block h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-amber-500/60" />
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>

      <footer className="mt-10 border-t border-border/60 pt-4 text-center text-[11px] italic text-muted-foreground">
        Material de referência interna — somente leitura.
      </footer>
    </div>
  );
}
