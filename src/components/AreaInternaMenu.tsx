import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard,
  Gavel,
  Car,
  Megaphone,
  Users,
  FileText,
  ShieldCheck,
  Wrench,
  Menu,
  X,
} from "lucide-react";
import { getSessionInfo } from "@/lib/usuarios.functions";
import { listAvisos } from "@/lib/avisos.functions";
import { ROLE_LABELS, isAdminRole, isInternalRole } from "@/lib/access-roles";
import { PMESP_CREST_URL } from "@/lib/branding";
import { aoMudarAvisosVistos, avisosNaoVistos } from "@/lib/avisos-vistos";

/** Verdadeiro dentro da área interna (o Header esconde o menu "Área interna"). */
const AreaInternaContext = createContext(false);
export function useDentroAreaInterna(): boolean {
  return useContext(AreaInternaContext);
}

type Item = { to: string; label: string; icon: typeof Gavel; badge?: string | null };

/**
 * Layout da área interna: menu vertical à esquerda (desktop) ou gaveta
 * (celular). Só aparece para usuários internos ativos; cidadão, MP e
 * cadastro pendente continuam como antes.
 */
export function AreaInternaLayout({ children }: { children: ReactNode }) {
  const sessionFn = useServerFn(getSessionInfo);
  const { data: session } = useQuery({ queryKey: ["session-info"], queryFn: () => sessionFn() });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [aberto, setAberto] = useState(false);

  const perfil = session?.profile as { nome?: string; status?: string; posto_graduacao?: string | null } | null | undefined;
  const cargo = session?.cargo ?? null;
  const ativo = perfil?.status === "ativo";
  const staff = ativo && !!cargo && cargo !== "cidadao" && cargo !== "mp";
  const interno = ativo && isInternalRole(cargo);
  const admin = ativo && isAdminRole(cargo);

  const avisosFn = useServerFn(listAvisos);
  const { data: avisos } = useQuery({
    queryKey: ["avisos"],
    queryFn: () => avisosFn(),
    enabled: !!interno,
  });
  const [novos, setNovos] = useState(0);
  useEffect(() => {
    const contar = () => setNovos(avisosNaoVistos((avisos ?? []).map((a: { id: string }) => a.id)).size);
    contar();
    return aoMudarAvisosVistos(contar);
  }, [avisos]);

  // Fecha a gaveta do celular ao trocar de página.
  useEffect(() => setAberto(false), [pathname]);

  if (!staff || pathname.startsWith("/pendente")) return <>{children}</>;

  const grupos: { titulo: string; itens: Item[] }[] = [
    {
      titulo: "Processos",
      itens: [
        { to: "/painel", label: "Painel interno", icon: LayoutDashboard },
        { to: "/corregedoria", label: "Corregedoria", icon: Gavel },
        { to: "/pdo", label: "PDO", icon: Car },
      ],
    },
    {
      titulo: "Comunicação e registros",
      itens: [
        ...(interno
          ? [{ to: "/avisos", label: "Avisos", icon: Megaphone, badge: novos ? `${novos} ${novos === 1 ? "novo" : "novos"}` : null }]
          : []),
        ...(interno ? [{ to: "/observacoes", label: "Observações", icon: Users }] : []),
        { to: "/documentos", label: "Documentos", icon: FileText },
      ],
    },
    ...(admin
      ? [
          {
            titulo: "Administração",
            itens: [
              { to: "/usuarios", label: "Gestão de usuários", icon: ShieldCheck },
              { to: "/manutencao", label: "Manutenção", icon: Wrench },
            ],
          },
        ]
      : []),
  ];

  const nomeCompleto = [perfil?.posto_graduacao, perfil?.nome].filter(Boolean).join(" ");
  const menu = (
    <nav aria-label="Área interna" className="flex h-full flex-col gap-5 px-3 py-4">
      <Link to="/painel" className="flex items-center gap-2.5 border-b border-border px-1.5 pb-3">
        <img src={PMESP_CREST_URL} alt="" className="h-9 w-7 object-contain" />
        <span className="leading-tight">
          <span className="block font-serif text-sm">Corregedoria</span>
          <span className="block text-[11px] text-muted-foreground">Área interna</span>
        </span>
      </Link>
      {grupos.map((g) => (
        <div key={g.titulo} className="space-y-0.5">
          <div className="px-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            {g.titulo}
          </div>
          {g.itens.map((it) => {
            const ativoAqui = pathname === it.to || pathname.startsWith(`${it.to}/`);
            return (
              <Link
                key={it.to}
                to={it.to}
                aria-current={ativoAqui ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-md border px-2.5 py-2 text-sm transition ${
                  ativoAqui
                    ? "border-primary/45 bg-primary/10 font-semibold text-primary"
                    : "border-transparent text-foreground/90 hover:bg-surface-2"
                }`}
              >
                <it.icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="flex-1">{it.label}</span>
                {it.badge && (
                  <span className="rounded-full bg-primary px-1.5 py-px text-[10.5px] font-semibold text-primary-foreground">
                    {it.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
      <div className="mt-auto flex items-center gap-2.5 border-t border-border px-1.5 pt-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold">
          {(perfil?.nome ?? "?")
            .split(/\s+/)
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase())
            .join("")}
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[13px] font-semibold">{nomeCompleto || "—"}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {cargo ? (ROLE_LABELS as Record<string, string>)[cargo] ?? cargo : ""}
          </span>
        </span>
      </div>
    </nav>
  );

  return (
    <AreaInternaContext.Provider value={true}>
      <div className="md:flex">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 overflow-y-auto border-r border-border bg-background/70 md:block">
          {menu}
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>

      {/* Celular: botão fixo que abre o menu em gaveta */}
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-medium shadow-lg md:hidden"
        aria-label="Abrir menu da área interna"
      >
        <Menu className="h-4 w-4" aria-hidden /> Menu
      </button>
      {aberto && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu da área interna">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Fechar menu"
            onClick={() => setAberto(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r border-border bg-background">
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="absolute right-3 top-3 rounded-md p-1.5 hover:bg-surface-2"
              aria-label="Fechar menu"
            >
              <X className="h-4 w-4" />
            </button>
            {menu}
          </div>
        </div>
      )}
    </AreaInternaContext.Provider>
  );
}
