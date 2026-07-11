import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";

interface Profile {
  nome: string;
  status: "pendente" | "ativo" | "inativo";
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
      .select("nome, status")
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


  return (
    <header className="border-b border-border bg-surface/60 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground font-serif text-lg font-bold">
            C
          </div>
          <div className="leading-tight">
            <div className="font-serif text-sm">Corregedoria</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Polícia Civil
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/">Início</NavLink>
          <NavLink to="/denunciar">Fazer Denúncia</NavLink>
          <NavLink to="/consultar">Consultar</NavLink>
          {isCidadao && <NavLink to="/minhas-denuncias">Minhas denúncias</NavLink>}
          {isMp && <NavLink to="/mp-processos">Meus processos</NavLink>}
          {isStaff && (
            <>
              <NavLink to="/painel">Painel Interno</NavLink>
              <NavLink to="/corregedoria">Corregedoria</NavLink>
              <NavLink to="/pdo">PDO</NavLink>
              <NavLink to="/documentos">Documentos</NavLink>
            </>
          )}

        </nav>

        <div className="flex items-center gap-2">
          {loading ? null : session ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="hidden text-muted-foreground sm:inline">{profile?.nome ?? session.user.email}</span>
              <button
                onClick={signOut}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
              >
                Sair
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <Link
                to="/cidadao"
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                Área do Cidadão
              </Link>
              <Link
                to="/mp"
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
              >
                Ministério Público
              </Link>
              <Link
                to="/auth"
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
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
      className="rounded-md px-3 py-1.5 text-sm transition-colors"
    >
      {children}
    </Link>
  );
}
