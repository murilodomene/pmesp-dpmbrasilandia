import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Send, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { getSessionInfo } from "@/lib/usuarios.functions";
import {
  encaminharMinuta,
  listAssinantesMinuta,
  reenviarMinuta,
  type EspecieMinuta,
} from "@/lib/minutas.functions";
import { ROLE_LABELS } from "@/lib/access-roles";

const rotuloCargo = (c: string) => (ROLE_LABELS as Record<string, string>)[c] ?? c;

/**
 * Escolha das autoridades que vão assinar a minuta (encaminhar pela primeira
 * vez ou reenviar uma minuta devolvida/corrigida).
 */
export function EncaminharMinutaDialog({
  denunciaId,
  procedimento,
  rotuloAto,
  conteudo,
  minuta,
  onClose,
  onDone,
  enviar,
  papel = "Escrivão",
}: {
  denunciaId: string;
  procedimento: string;
  rotuloAto: string;
  /** Monta o conteúdo no momento do envio (lança erro se faltar campo). */
  conteudo: () => {
    especie: EspecieMinuta;
    teor: string;
    dados: Record<string, unknown>;
    anexos: Array<{ nome: string; path: string }>;
  };
  /** Ao reenviar: a minuta e as escolhas anteriores. */
  minuta?: { id: string; destinatarios: string[]; recado: string | null };
  onClose: () => void;
  onDone?: () => void;
  /** Envio próprio (ex.: ofícios); sem ele, grava como minuta de ato. */
  enviar?: (destinatarios: string[], recado: string | null) => Promise<unknown>;
  /** Como quem encaminha consta no documento assinado. */
  papel?: string;
}) {
  const qc = useQueryClient();
  const sessionFn = useServerFn(getSessionInfo);
  const { data: session } = useQuery({ queryKey: ["session-info"], queryFn: () => sessionFn() });
  const assinantesFn = useServerFn(listAssinantesMinuta);
  const {
    data: assinantes,
    isLoading,
    error: erroLista,
  } = useQuery({ queryKey: ["assinantes-minuta"], queryFn: () => assinantesFn() });
  const encaminharFn = useServerFn(encaminharMinuta);
  const reenviarFn = useServerFn(reenviarMinuta);

  const [marcados, setMarcados] = useState<string[]>(minuta?.destinatarios ?? []);
  const [recado, setRecado] = useState(minuta?.recado ?? "");

  useEffect(() => {
    // Captura antes do Esc da janela de baixo (ex.: Portaria), para não fechar as duas.
    const aoTeclar = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
  }, [onClose]);

  const eu = session?.userId;
  const lista = (assinantes ?? []).filter((a) => a.id !== eu);
  const perfil = session?.profile as
    { nome?: string; posto_graduacao?: string | null } | null | undefined;
  const meuNome = [perfil?.posto_graduacao, perfil?.nome].filter(Boolean).join(" ");

  const m = useMutation({
    mutationFn: async () => {
      if (enviar) {
        await enviar(marcados, recado.trim() || null);
        return;
      }
      const c = conteudo();
      const payload = { ...c, destinatarios: marcados, recado: recado.trim() || null };
      if (minuta) await reenviarFn({ data: { minuta_id: minuta.id, ...payload } });
      else await encaminharFn({ data: { denuncia_id: denunciaId, ...payload } });
    },
    onSuccess: () => {
      toast.success(minuta ? "Reenviado para assinatura." : "Encaminhado para assinatura.");
      qc.invalidateQueries({ queryKey: ["minutas"] });
      qc.invalidateQueries({ queryKey: ["minutas-pendentes"] });
      onDone?.();
      onClose();
    },
    onError: (e) => toast.error((e as Error)?.message || "Não foi possível encaminhar a minuta."),
  });

  const alternar = (id: string) =>
    setMarcados((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={(ev) => ev.target === ev.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Encaminhar minuta para assinatura"
        className="surface flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h3 className="font-serif text-lg">
              {minuta ? "Reenviar minuta para assinatura" : "Encaminhar minuta para assinatura"}
            </h3>
            <div className="text-xs text-muted-foreground">
              {rotuloAto} · {procedimento}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 hover:bg-surface-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Assinantes ({marcados.length} {marcados.length === 1 ? "selecionado" : "selecionados"}
              )
            </div>
            {isLoading && (
              <div className="text-sm text-muted-foreground">Carregando autoridades…</div>
            )}
            {erroLista && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs">
                {(erroLista as Error).message}
              </div>
            )}
            {!isLoading && !erroLista && lista.length === 0 && (
              <div className="text-sm text-muted-foreground">
                Nenhuma outra autoridade ativa pode assinar minutas.
              </div>
            )}
            {lista.map((a) => {
              const on = marcados.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => alternar(a.id)}
                  className={`flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition ${
                    on
                      ? "border-primary/60 bg-primary/10"
                      : "border-border bg-background/40 hover:bg-surface-2"
                  }`}
                >
                  <span
                    className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded ${
                      on ? "bg-primary text-primary-foreground" : "border border-border"
                    }`}
                  >
                    {on && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">
                      {[a.posto_graduacao, a.nome].filter(Boolean).join(" ")}
                    </span>
                    <span className="text-muted-foreground"> · {rotuloCargo(a.cargo)}</span>
                  </span>
                </button>
              );
            })}
            <p className="text-xs text-muted-foreground">
              Qualquer um dos selecionados pode assinar. Quando um assina, a minuta sai da fila dos
              outros.
            </p>
          </div>

          <label className="grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Recado para a autoridade (opcional)
            </span>
            <input
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm read-only:opacity-80"
              value={recado}
              maxLength={500}
              onChange={(ev) => setRecado(ev.target.value)}
              placeholder="Ex.: urgente — oitiva marcada para amanhã"
            />
          </label>

          <div className="flex items-center gap-2.5 rounded-md border border-border bg-background/40 px-3 py-2.5 text-xs text-muted-foreground">
            <UserRound className="h-4 w-4 shrink-0" aria-hidden />
            <span>
              Você{meuNome ? ` (${meuNome})` : ""} constará como{" "}
              <strong className="text-foreground">{papel}</strong> no documento assinado.
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={() => m.mutate()}
            disabled={marcados.length === 0 || m.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Send className="h-4 w-4" aria-hidden />
            {m.isPending
              ? "Enviando..."
              : minuta
                ? "Reenviar para assinatura"
                : "Encaminhar para assinatura"}
          </button>
        </div>
      </div>
    </div>
  );
}
