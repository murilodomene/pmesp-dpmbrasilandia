import { Lock } from "lucide-react";
import { PMESP_CREST_URL } from "@/lib/branding";

interface ProcessoLetterheadProps {
  numeroProtocolo: string;
  unidade?: string | null;
  readOnly?: boolean;
}

/**
 * Cabeçalho oficial / papel timbrado institucional para o topo da tela
 * de visualização de processos. Reutilizável em qualquer perfil.
 */
export function ProcessoLetterhead({
  numeroProtocolo,
  unidade,
  readOnly = false,
}: ProcessoLetterheadProps) {
  return (
    <div className="surface overflow-hidden p-0">
      <header className="flex flex-col items-center gap-2 border-b-2 border-border/70 px-5 py-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div className="flex items-center gap-3">
          <img
            src={PMESP_CREST_URL}
            alt="Brasão da Corregedoria da Polícia Militar do Estado de São Paulo"
            className="h-14 w-auto sm:h-16"
          />
          <div className="text-[10px] font-semibold uppercase leading-snug tracking-wide text-muted-foreground sm:text-[11px]">
            <div>Secretaria da Segurança Pública</div>
            <div>Polícia Militar do Estado de São Paulo</div>
            <div>Corregedoria da Polícia Militar do Estado de São Paulo</div>
            <div>1ª Corregedoria da Capital</div>
            <div className="normal-case text-muted-foreground/80">
              corregedoriageral@pmesp.sp
            </div>
          </div>
        </div>
        <div className="text-center sm:text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Processo Administrativo
          </div>
          <div className="tabular font-serif text-base font-semibold text-foreground sm:text-lg">
            {numeroProtocolo}
          </div>
          {unidade && (
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {unidade}
            </div>
          )}
        </div>
      </header>
      {readOnly && (
        <div className="flex items-center justify-center gap-1.5 bg-surface-2/60 px-4 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
          <Lock className="h-3 w-3" aria-hidden />
          Consulta somente leitura
        </div>
      )}
    </div>
  );
}

export function ProcessoDetalheSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="surface h-28" />
      <div className="surface h-24" />
      <div className="surface h-40" />
      <div className="surface h-60" />
    </div>
  );
}
