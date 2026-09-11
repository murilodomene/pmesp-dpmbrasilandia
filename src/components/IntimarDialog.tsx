import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { buscarInternos, criarIntimacao } from "@/lib/notificacoes.functions";

const CARGO_LABEL: Record<string, string> = {
  ssp: "SSP",
  corregedor_geral: "Corregedor-Geral",
  subcorregedor_geral: "Subcorregedor-Geral",
  corregedor: "Corregedor",
};

export function IntimarDialog({
  denunciaId,
  onClose,
}: {
  denunciaId: string;
  onClose: () => void;
}) {
  const [termo, setTermo] = useState("");
  const [dest, setDest] = useState<{ id: string; nome: string; cargo: string } | null>(
    null,
  );
  const [teor, setTeor] = useState("");
  const qc = useQueryClient();

  const buscarFn = useServerFn(buscarInternos);
  const criarFn = useServerFn(criarIntimacao);

  const { data: sugestoes = [] } = useQuery({
    queryKey: ["buscar-internos", termo],
    queryFn: () => buscarFn({ data: { termo } }),
    enabled: !dest && termo.trim().length >= 1,
  });

  const m = useMutation({
    mutationFn: () =>
      criarFn({
        data: { denuncia_id: denunciaId, destinatario_id: dest!.id, teor: teor.trim() },
      }),
    onSuccess: () => {
      toast.success("Intimação expedida.");
      qc.invalidateQueries({ queryKey: ["denuncia", denunciaId] });
      qc.invalidateQueries({ queryKey: ["movimentos", denunciaId] });
      qc.invalidateQueries({ queryKey: ["notif-count"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-lg">Intimar usuário interno</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Só é possível intimar cargos iguais ou inferiores ao seu.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium">Destinatário</label>
            {dest ? (
              <div className="mt-1 flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
                <span>
                  {dest.nome}{" "}
                  <span className="text-xs text-muted-foreground">
                    · {CARGO_LABEL[dest.cargo] ?? dest.cargo}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDest(null);
                    setTermo("");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  trocar
                </button>
              </div>
            ) : (
              <>
                <input
                  autoFocus
                  value={termo}
                  onChange={(e) => setTermo(e.target.value)}
                  placeholder="Digite o nome do usuário interno"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                {termo.trim().length >= 1 && (
                  <ul className="mt-1 max-h-48 overflow-y-auto rounded-md border border-border">
                    {sugestoes.length === 0 ? (
                      <li className="p-2 text-xs text-muted-foreground">
                        Nenhum usuário encontrado.
                      </li>
                    ) : (
                      sugestoes.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => setDest(s)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-surface-2"
                          >
                            {s.nome}{" "}
                            <span className="text-xs text-muted-foreground">
                              · {CARGO_LABEL[s.cargo] ?? s.cargo}
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </>
            )}
          </div>

          <div>
            <label className="text-xs font-medium">Teor da intimação</label>
            <textarea
              value={teor}
              onChange={(e) => setTeor(e.target.value)}
              rows={5}
              placeholder="Ex.: Proceda com a oitiva do denunciado."
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!dest || teor.trim().length < 3 || m.isPending}
            onClick={() => m.mutate()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            {m.isPending ? "Enviando..." : "Enviar intimação"}
          </button>
        </div>
      </div>
    </div>
  );
}
