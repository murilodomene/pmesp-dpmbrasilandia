import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronDown, LogOut, UserCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificacoesBell } from "@/components/NotificacoesBell";
import { UserAvatar } from "@/components/UserAvatar";
import { PMESP_CREST_URL } from "@/lib/branding";
import { ROLE_LABELS, isAdminRole, isInternalRole } from "@/lib/access-roles";

interface Profile {
  nome: string;
  status: "pendente" | "ativo" | "inativo";
  foto_path: string | null;
}

export function Header() {
  const { session, loading } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cargo, setCargo] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setCargo(null);
      return;
    }
    supabase
      .from("profiles")
      .select("nome, status, foto_path")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data as Profile | null));
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setCargo((data as { role: string } | null)?.role ?? null));
  }, [session]);

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  }

  const ativo = profile?.status === "ativo";
  const isCidadao = cargo === "cidadao";
  const isMp = cargo === "mp";
  const isStaff = ativo && cargo && !isCidadao && !isMp;
  const isDelegadoCorregedor = ativo && isAdminRole(cargo);

  const isInternoCorregedoria =
    ativo && isInternalRole(cargo);

  const internalLinks: { to: string; label: string }[] = isStaff
    ? [
        { to: "/painel", label: "Painel Interno" },
        { to: "/corregedoria", label: "Corregedoria" },
        { to: "/pdo", label: "PDO" },
        { to: "/avisos", label: "Avisos" },
        ...(isInternoCorregedoria ? [{ to: "/observacoes", label: "Observações" }] : []),
        { to: "/documentos", label: "Documentos" },
        ...(isDelegadoCorregedor ? [{ to: "/usuarios", label: "Gestão de Usuários" }] : []),
        ...(isDelegadoCorregedor ? [{ to: "/manutencao", label: "Manutenção" }] : []),
      ]
    : [];

  return (
    <header className="border-b border-border bg-surface/60 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:flex-nowrap">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <img
            src={PMESP_CREST_URL}
            alt="Brasão da Corregedoria da Polícia Militar do Estado de São Paulo"
            className="block h-11 w-9 shrink-0 object-contain"
          />
          <div className="leading-tight">
            <div className="font-serif text-sm whitespace-nowrap">Corregedoria</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">
              Polícia Militar do Estado de São Paulo
            </div>
          </div>
        </Link>

        <nav className="hidden min-w-0 flex-nowrap items-center gap-0.5 md:flex">
          <NavLink to="/">Início</NavLink>
          <NavLink to="/denunciar">Fazer Denúncia</NavLink>
          <NavLink to="/consultar">Consultar</NavLink>
          <NavLink to="/ipc">IPM</NavLink>
          <NavLink to="/manual">RDPM</NavLink>
          {isCidadao && <NavLink to="/minhas-denuncias">Minhas denúncias</NavLink>}
          {isMp && <NavLink to="/mp-processos">Meus processos</NavLink>}

          {/* Internal links always collapsed into a dropdown to avoid overflow */}
          {internalLinks.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
                Área interna
                <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px]">
                {internalLinks.map((l) => (
                  <DropdownMenuItem key={l.to} asChild>
                    <Link to={l.to} className="w-full whitespace-nowrap cursor-pointer">
                      {l.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {loading ? null : session ? (
            <div className="flex items-center gap-2 text-sm">
              {isStaff && <NotificacoesBell />}
              <DropdownMenu>
                <DropdownMenuTrigger className="group flex items-center gap-2 rounded-md border border-transparent px-2 py-1 transition-colors hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-ring">
                  <UserAvatar path={profile?.foto_path} name={profile?.nome ?? session.user.email} size={30} />
                  <div className="hidden text-left leading-tight sm:block">
                    <div className="max-w-[180px] truncate text-xs font-medium text-foreground">
                      {profile?.nome ?? session.user.email}
                    </div>
                    {cargo && (
                      <div className="max-w-[180px] truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                        {ROLE_LABELS[cargo as keyof typeof ROLE_LABELS] ?? cargo}
                      </div>
                    )}
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[200px]">
                  <DropdownMenuItem asChild>
                    <Link to="/perfil" className="cursor-pointer">
                      <UserCircle className="mr-2 h-4 w-4" />
                      Perfil
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <Link
                to="/cidadao"
                className="whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                Área do Cidadão
              </Link>
              <Link
                to="/mp"
                className="whitespace-nowrap rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
              >
                Ministério Público
              </Link>
              <Link
                to="/auth"
                className="whitespace-nowrap rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
              >
                Acesso interno
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      activeProps={{ className: "text-foreground bg-surface-2" }}
      inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
      activeOptions={{ exact: to === "/" }}
      className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition-colors"
    >
      {children}
    </Link>
  );
}
