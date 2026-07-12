import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { listNotificacoes, marcarNotificacaoLida } from "@/lib/notificacoes.functions";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const list = useServerFn(listNotificacoes);
  const marcar = useServerFn(marcarNotificacaoLida);

  const { data } = useQuery({
    queryKey: ["notificacoes"],
    queryFn: () => list(),
    refetchInterval: 30_000,
  });

  const mMarcar = useMutation({
    mutationFn: (id: string) => marcar({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacoes"] }),
  });

  const items = (data ?? []) as Array<{
    id: string;
    denuncia_id: string | null;
    aviso_id: string | null;
    tipo: "auto" | "intimacao" | "aviso";
    titulo: string;
    teor: string | null;
    remetente_nome: string | null;
    lido: boolean;
    created_at: string;
    denuncias?: { numero_protocolo: string } | null;
  }>;
  const naoLidas = items.filter((n) => !n.lido).length;

  async function abrir(n: (typeof items)[number]) {
    if (!n.lido) {
      try {
        await mMarcar.mutateAsync(n.id);
      } catch {}
    }
    setOpen(false);
    if (n.tipo === "aviso") {
      navigate({ to: "/avisos" });
    } else if (n.denuncia_id) {
      navigate({ to: "/corregedoria", search: { id: n.denuncia_id } });
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notificações"
          className="relative rounded-md border border-border p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {naoLidas > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
              {naoLidas > 99 ? "99+" : naoLidas}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="border-b border-border px-3 py-2 text-sm font-medium">Avisos</div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              Nenhum aviso.
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => abrir(n)}
                className={`flex w-full flex-col gap-1 border-b border-border px-3 py-2 text-left transition-colors hover:bg-surface-2 ${
                  n.lido ? "opacity-70" : "bg-surface-2/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">
                    {!n.lido && <span className="mr-1 inline-block h-2 w-2 rounded-full bg-primary" />}
                    {n.titulo}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {n.tipo === "intimacao" ? "Intimação" : "Aviso"}
                  </span>
                </div>
                {n.teor && (
                  <div className="line-clamp-2 text-xs text-muted-foreground">{n.teor}</div>
                )}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{n.denuncias?.numero_protocolo ?? ""}</span>
                  <span>{new Date(n.created_at).toLocaleString("pt-BR")}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
