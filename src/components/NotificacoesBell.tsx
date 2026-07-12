import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listMinhasNotificacoes,
  contarNaoLidasNotif,
  marcarNotificacaoLida,
  marcarTodasLidas,
} from "@/lib/notificacoes.functions";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function NotificacoesBell() {
  const [open, setOpen] = useState(false);
  const listFn = useServerFn(listMinhasNotificacoes);
  const countFn = useServerFn(contarNaoLidasNotif);
  const marcarFn = useServerFn(marcarNotificacaoLida);
  const marcarTodasFn = useServerFn(marcarTodasLidas);
  const qc = useQueryClient();


  const { data: count = 0 } = useQuery({
    queryKey: ["notif-count"],
    queryFn: () => countFn(),
    refetchInterval: 30_000,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["notif-list"],
    queryFn: () => listFn(),
    enabled: open,
    refetchInterval: open ? 20_000 : false,
  });

  const marcar = useMutation({
    mutationFn: (notif_id: string) => marcarFn({ data: { notif_id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-count"] });
      qc.invalidateQueries({ queryKey: ["notif-list"] });
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Avisos"
          className="relative rounded-md border border-border p-1.5 hover:bg-surface-2"
        >
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="border-b border-border p-3">
          <div className="font-serif text-sm">Avisos</div>
          <div className="text-[11px] text-muted-foreground">
            {count > 0 ? `${count} não lido${count === 1 ? "" : "s"}` : "Nenhum aviso não lido"}
          </div>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">Sem avisos.</div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const to =
                  n.tipo === "aviso"
                    ? "/avisos"
                    : n.denuncia_id
                      ? `/corregedoria?id=${n.denuncia_id}`
                      : "/painel";

                return (
                  <li key={n.id}>
                    <Link
                      to={to}
                      onClick={() => {
                        if (!n.lido) marcar.mutate(n.id);
                        setOpen(false);
                      }}
                      className={`block px-3 py-2 text-sm hover:bg-surface-2 ${
                        n.lido ? "opacity-70" : "bg-primary/5"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.lido && (
                          <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{n.titulo}</div>
                          {n.teor && (
                            <div className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">
                              {n.teor}
                            </div>
                          )}
                          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                            {new Date(n.created_at).toLocaleString("pt-BR")}
                            {n.tipo === "intimacao" && " · intimação"}
                            {n.tipo === "aviso" && " · aviso"}

                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
