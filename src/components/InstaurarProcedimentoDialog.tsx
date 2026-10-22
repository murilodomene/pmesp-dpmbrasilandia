import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { instaurarProcedimento } from "@/lib/denuncias.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const CARGOS_INSTAURACAO = [
  "ssp",
  "cmtg",
  "corregedor_geral",
  "subcorregedor_geral",
  "corregedor_supervisor",
  "corregedor",
];

export function InstaurarProcedimentoBotao({ denunciaId }: { denunciaId: string }) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"ipm" | "sindicancia" | "apfd">("ipm");
  const qc = useQueryClient();
  const fn = useServerFn(instaurarProcedimento);
  const m = useMutation({
    mutationFn: () => fn({ data: { denuncia_id: denunciaId, tipo } }),
    onSuccess: (r) => {
      toast.success(`Instaurado: ${r.numero}`);
      qc.invalidateQueries({ queryKey: ["denuncia", denunciaId] });
      qc.invalidateQueries({ queryKey: ["denuncias"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Instaurar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Instaurar procedimento</DialogTitle>
            <DialogDescription>
              Escolha o tipo. Esta ação é <strong>irreversível</strong>: o número interno será gerado
              e registrado na linha do tempo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {(
              [
                ["ipm", "IPM — Inquérito Policial Militar"],
                ["sindicancia", "Sindicância (SINDPM)"],
                ["apfd", "APFD — Auto de Prisão em Flagrante Delito"],
              ] as const
            ).map(([v, l]) => (
              <label
                key={v}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-3 text-sm"
              >
                <input type="radio" name="tipo-proc" checked={tipo === v} onChange={() => setTipo(v)} />
                {l}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={m.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => m.mutate()} disabled={m.isPending}>
              {m.isPending ? "Instaurando..." : "Confirmar instauração"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
