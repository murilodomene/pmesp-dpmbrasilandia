import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Header } from "@/components/Header";
import {
  listUsuarios,
  aprovarUsuario,
  alterarStatusUsuario,
  getSessionInfo,
} from "@/lib/usuarios.functions";

export const Route = createFileRoute("/_authenticated/usuarios")({
  component: UsuariosPage,
});

const CARGOS = [
  { v: "delegado_geral", l: "Delegado Geral" },
  { v: "delegado_corregedor", l: "Delegado Corregedor" },
  { v: "corregedor", l: "Corregedor" },
] as const;

function UsuariosPage() {
  const sessionFn = useServerFn(getSessionInfo);
  const { data: session } = useQuery({ queryKey: ["session-info"], queryFn: () => sessionFn() });
  const isDelegado = session?.cargo === "delegado_corregedor";

  const listFn = useServerFn(listUsuarios);
  const { data: usuarios, error } = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => listFn(),
    enabled: !!isDelegado,
  });

  if (!session) return null;

  if (!isDelegado) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-md px-4 py-24 text-center text-sm text-muted-foreground">
          Apenas o Delegado Corregedor pode gerenciar usuários.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="eyebrow">Gestão</div>
        <h1 className="mt-1 font-serif text-3xl">Usuários</h1>
        <p className="text-sm text-muted-foreground">
          Aprove cadastros, atribua cargos e controle o status dos servidores.
        </p>

        {error && (
          <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            {error instanceof Error ? error.message : "Erro ao carregar."}
          </div>
        )}

        <div className="mt-6 space-y-2">
          {(usuarios ?? []).map((u) => (
            <UsuarioRow key={u.id} u={u} />
          ))}
          {usuarios?.length === 0 && (
            <div className="surface p-8 text-center text-sm text-muted-foreground">
              Nenhum usuário cadastrado além de você.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface Usuario {
  id: string;
  nome: string;
  matricula: string;
  unidade: string | null;
  status: "pendente" | "ativo" | "inativo";
  cargo: string | null;
  created_at: string;
}

function UsuarioRow({ u }: { u: Usuario }) {
  const qc = useQueryClient();
  const aprovarFn = useServerFn(aprovarUsuario);
  const statusFn = useServerFn(alterarStatusUsuario);
  const [cargo, setCargo] = useState<string>(u.cargo ?? "corregedor");

  const mAprovar = useMutation({
    mutationFn: () =>
      aprovarFn({ data: { user_id: u.id, cargo: cargo as "delegado_geral" | "delegado_corregedor" | "corregedor" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usuarios"] }),
  });
  const mStatus = useMutation({
    mutationFn: (novo: "ativo" | "inativo") =>
      statusFn({ data: { user_id: u.id, status: novo } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usuarios"] }),
  });

  return (
    <div className="surface flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <div className="font-medium">{u.nome}</div>
        <div className="text-xs text-muted-foreground tabular">
          Matrícula {u.matricula || "—"} · {u.unidade ?? "sem unidade"} ·{" "}
          <span
            className={
              u.status === "ativo"
                ? "text-status-concluida-fg"
                : u.status === "pendente"
                  ? "text-primary"
                  : "text-muted-foreground"
            }
          >
            {u.status}
          </span>
          {u.cargo && ` · ${cargoLabel(u.cargo)}`}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={cargo}
          onChange={(e) => setCargo(e.target.value)}
          className="rounded-md border border-border bg-input px-2 py-1 text-xs"
        >
          {CARGOS.map((c) => (
            <option key={c.v} value={c.v}>
              {c.l}
            </option>
          ))}
        </select>
        <button
          onClick={() => mAprovar.mutate()}
          disabled={mAprovar.isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {u.status === "pendente" ? "Aprovar" : "Atualizar cargo"}
        </button>
        {u.status !== "inativo" ? (
          <button
            onClick={() => mStatus.mutate("inativo")}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
          >
            Inativar
          </button>
        ) : (
          <button
            onClick={() => mStatus.mutate("ativo")}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
          >
            Reativar
          </button>
        )}
      </div>
    </div>
  );
}

function cargoLabel(c: string): string {
  switch (c) {
    case "delegado_geral": return "Delegado Geral";
    case "delegado_corregedor": return "Delegado Corregedor";
    case "corregedor": return "Corregedor";
    case "cidadao": return "Cidadão";
    case "mp": return "Ministério Público";
    default: return c;
  }
}
