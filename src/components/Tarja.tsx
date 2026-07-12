import { X, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { adicionarTarja, editarTarja, removerTarja } from "@/lib/denuncias.functions";

export type CorTarja = "vermelho" | "amarelo" | "verde" | "azul";

export interface TarjaData {
  id: string;
  cor: CorTarja;
  texto: string;
}

export const CORES_TARJA: { valor: CorTarja; label: string }[] = [
  { valor: "vermelho", label: "Vermelho" },
  { valor: "amarelo", label: "Amarelo" },
  { valor: "verde", label: "Verde" },
  { valor: "azul", label: "Azul" },
];

const CLASSES_BADGE: Record<CorTarja, string> = {
  vermelho:
    "border-red-500/40 bg-red-500/15 text-red-100 dark:text-red-200",
  amarelo:
    "border-amber-500/40 bg-amber-500/15 text-amber-100 dark:text-amber-200",
  verde:
    "border-emerald-500/40 bg-emerald-500/15 text-emerald-100 dark:text-emerald-200",
  azul:
    "border-sky-500/40 bg-sky-500/15 text-sky-100 dark:text-sky-200",
};

export const COR_HEX_TARJA: Record<CorTarja, string> = {
  vermelho: "#ef4444",
  amarelo: "#f59e0b",
  verde: "#10b981",
  azul: "#0ea5e9",
};

export function TarjaBadge({
  tarja,
  podeEditar,
  onEdit,
  onRemove,
}: {
  tarja: TarjaData;
  podeEditar?: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${CLASSES_BADGE[tarja.cor]}`}
      title={tarja.texto}
    >
      <span className="max-w-[16rem] truncate">{tarja.texto}</span>
      {podeEditar && (
        <>
          <button
            type="button"
            onClick={onEdit}
            className="opacity-70 hover:opacity-100"
            aria-label="Editar tarja"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="opacity-70 hover:opacity-100"
            aria-label="Remover tarja"
          >
            <X className="h-3 w-3" />
          </button>
        </>
      )}
    </span>
  );
}

/** Faixa colorida discreta para a lista de processos. */
export function TarjasStrip({ tarjas }: { tarjas: TarjaData[] }) {
  if (!tarjas || tarjas.length === 0) return null;
  return (
    <span
      className="pointer-events-none absolute left-0 top-0 flex h-full w-1 flex-col overflow-hidden rounded-l-sm"
      aria-hidden
    >
      {tarjas.slice(0, 2).map((t) => (
        <span
          key={t.id}
          className="flex-1"
          style={{ backgroundColor: COR_HEX_TARJA[t.cor] }}
          title={t.texto}
        />
      ))}
    </span>
  );
}

export function TarjasManager({
  denunciaId,
  tarjas,
  podeEditar,
}: {
  denunciaId: string;
  tarjas: TarjaData[];
  podeEditar: boolean;
}) {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<
    | { kind: "add" }
    | { kind: "edit"; tarja: TarjaData }
    | null
  >(null);

  const addFn = useServerFn(adicionarTarja);
  const editFn = useServerFn(editarTarja);
  const removeFn = useServerFn(removerTarja);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["denuncia", denunciaId] });
    qc.invalidateQueries({ queryKey: ["denuncias"] });
  };

  const mRemove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Tarja removida.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro."),
  });

  const podeAdicionar = podeEditar && tarjas.length < 2;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {tarjas.map((t) => (
          <TarjaBadge
            key={t.id}
            tarja={t}
            podeEditar={podeEditar}
            onEdit={() => setDialog({ kind: "edit", tarja: t })}
            onRemove={() => {
              if (confirm(`Remover a tarja "${t.texto}"?`)) mRemove.mutate(t.id);
            }}
          />
        ))}
        {podeAdicionar && (
          <button
            type="button"
            onClick={() => setDialog({ kind: "add" })}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-surface-2"
            title="Afixar tarja"
          >
            <Plus className="h-3 w-3" /> Tarja
          </button>
        )}
      </div>

      <TarjaDialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        initial={dialog?.kind === "edit" ? dialog.tarja : null}
        onSubmit={async ({ cor, texto }) => {
          if (dialog?.kind === "edit") {
            await editFn({ data: { id: dialog.tarja.id, cor, texto } });
            toast.success("Tarja atualizada.");
          } else {
            await addFn({ data: { denuncia_id: denunciaId, cor, texto } });
            toast.success("Tarja afixada.");
          }
          invalidate();
          setDialog(null);
        }}
      />
    </>
  );
}

function TarjaDialog({
  open,
  onClose,
  initial,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  initial: TarjaData | null;
  onSubmit: (v: { cor: CorTarja; texto: string }) => Promise<void>;
}) {
  const [cor, setCor] = useState<CorTarja>(initial?.cor ?? "azul");
  const [texto, setTexto] = useState(initial?.texto ?? "");
  const [saving, setSaving] = useState(false);

  // Reset when opening
  useState(() => {
    setCor(initial?.cor ?? "azul");
    setTexto(initial?.texto ?? "");
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
        else {
          setCor(initial?.cor ?? "azul");
          setTexto(initial?.texto ?? "");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Editar tarja" : "Afixar tarja"}</DialogTitle>
          <DialogDescription>
            Escolha uma cor e escreva um texto curto (até 26 caracteres).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Cor</Label>
            <div className="mt-2 flex gap-2">
              {CORES_TARJA.map((c) => (
                <button
                  key={c.valor}
                  type="button"
                  onClick={() => setCor(c.valor)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs transition ${
                    cor === c.valor
                      ? "border-primary ring-2 ring-primary/40"
                      : "border-border hover:bg-surface-2"
                  }`}
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: COR_HEX_TARJA[c.valor] }}
                  />
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Texto</Label>
            <Input
              value={texto}
              maxLength={26}
              onChange={(e) => setTexto(e.target.value.slice(0, 26))}
              placeholder="Ex.: Ag. Reciclagem de Curso"
            />
            <div className="mt-1 text-right text-[10px] text-muted-foreground">
              {texto.length}/26
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Prévia</Label>
            <div className="mt-2">
              <TarjaBadge tarja={{ id: "preview", cor, texto: texto || "Prévia" }} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            disabled={saving || texto.trim().length === 0}
            onClick={async () => {
              setSaving(true);
              try {
                await onSubmit({ cor, texto: texto.trim() });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Erro.");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Salvando…" : initial ? "Salvar" : "Afixar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
