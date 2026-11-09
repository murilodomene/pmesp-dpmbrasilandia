import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { abrirPeticao, listPeticoes, type Peticao } from "@/lib/peticoes.functions";
import { tamanhoLegivel } from "@/components/PeticoesUploader";
import type { PeticoesExport } from "@/lib/exportProcesso";

const DIA = 24 * 60 * 60 * 1000;

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function usePeticoes(denunciaId: string) {
  const listar = useServerFn(listPeticoes);
  return useQuery({
    queryKey: ["peticoes", denunciaId],
    queryFn: () => listar({ data: { denuncia_id: denunciaId } }),
    staleTime: 60_000,
  });
}

function Situacao({ p }: { p: Peticao }) {
  if (p.removido_em) {
    return (
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
        expurgado {new Date(p.removido_em).toLocaleDateString("pt-BR")}
      </span>
    );
  }
  const dias = Math.ceil((new Date(p.expira_em).getTime() - Date.now()) / DIA);
  const cor =
    dias <= 7
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
      : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${cor}`}>
      {dias <= 0 ? "expira hoje" : `expira em ${dias} dia${dias > 1 ? "s" : ""}`}
    </span>
  );
}

/** Petições em PDF enviadas pelo denunciante, com Abrir e Baixar. */
export function PeticoesDenuncia({ denunciaId }: { denunciaId: string }) {
  const q = usePeticoes(denunciaId);
  const abrir = useServerFn(abrirPeticao);
  const [carregando, setCarregando] = useState<string | null>(null);

  async function acessar(p: Peticao, baixar: boolean) {
    // Abre a aba antes da chamada para o navegador não bloquear o pop-up.
    const aba = baixar ? null : window.open("about:blank", "_blank");
    setCarregando(`${p.id}-${baixar ? "b" : "a"}`);
    try {
      const r = await abrir({ data: { id: p.id, baixar } });
      if (aba) aba.location.href = r.url;
      else window.location.href = r.url;
    } catch (e) {
      aba?.close();
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir o PDF.");
    } finally {
      setCarregando(null);
    }
  }

  const lista = q.data ?? [];
  if (!lista.length) return null;

  return (
    <div className="border-t border-border px-5 py-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <FileText className="h-3.5 w-3.5 text-primary" aria-hidden />
        Petições do denunciante ({lista.length})
      </div>
      <ul className="mt-2 space-y-1.5">
        {lista.map((p) => (
          <li
            key={p.id}
            className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border px-3 py-2 text-sm ${
              p.removido_em ? "opacity-60" : ""
            }`}
          >
            <span className="rounded bg-red-900/70 px-1.5 py-0.5 text-[10px] font-bold text-red-100">
              PDF
            </span>
            <span className="min-w-0 flex-1 truncate" title={p.nome}>
              {p.nome}
            </span>
            <span className="w-full text-xs text-muted-foreground sm:w-auto">
              {dataHora(p.enviado_em)}
              {p.paginas ? ` · ${p.paginas} pág${p.paginas > 1 ? "s" : ""}` : ""} ·{" "}
              {tamanhoLegivel(p.tamanho)}
            </span>
            <Situacao p={p} />
            {!p.removido_em && (
              <span className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => acessar(p, false)}
                  disabled={!!carregando}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-2"
                >
                  {carregando === `${p.id}-a` ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ExternalLink className="h-3.5 w-3.5" />
                  )}
                  Abrir
                </button>
                <button
                  type="button"
                  onClick={() => acessar(p, true)}
                  disabled={!!carregando}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-2"
                >
                  {carregando === `${p.id}-b` ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  Baixar
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Os PDFs ficam no sistema por 30 dias a contar do envio; depois, só este registro permanece.
      </p>
    </div>
  );
}

/**
 * Opção "Juntar as petições na íntegra" da exportação do processo
 * (marcada por padrão) e os dados que a exportação precisa.
 */
export function usePeticoesExport(denunciaId: string) {
  const q = usePeticoes(denunciaId);
  const abrir = useServerFn(abrirPeticao);
  const [juntar, setJuntar] = useState(true);
  const lista = q.data ?? [];
  const disponiveis = lista.filter((p) => !p.removido_em);
  const paginas = disponiveis.reduce((s, p) => s + (p.paginas ?? 0), 0);
  return {
    lista,
    disponiveis: disponiveis.length,
    paginas,
    juntar,
    setJuntar,
    dados: (): PeticoesExport | undefined =>
      lista.length
        ? {
            lista,
            juntar,
            obterUrl: async (id: string) => (await abrir({ data: { id } })).url,
          }
        : undefined,
  };
}

export function JuntarPeticoesCheckbox({ ctl }: { ctl: ReturnType<typeof usePeticoesExport> }) {
  if (!ctl.disponiveis) return null;
  return (
    <label
      className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground"
      title="Inclui no PDF as páginas das petições enviadas pelo denunciante (ainda disponíveis no sistema)"
    >
      <input
        type="checkbox"
        checked={ctl.juntar}
        onChange={(e) => ctl.setJuntar(e.target.checked)}
        className="h-3.5 w-3.5 accent-[var(--primary)]"
      />
      Juntar petições ({ctl.disponiveis}
      {ctl.paginas ? `, ${ctl.paginas} pág${ctl.paginas > 1 ? "s" : ""}.` : ""})
    </label>
  );
}
