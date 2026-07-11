import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Search, Edit3, ShieldAlert, UserX, UserCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  listUsuarios,
  alterarStatusUsuario,
  editarUsuarioPublico,
  excluirUsuario,
  getSessionInfo,
} from "@/lib/usuarios.functions";

export const Route = createFileRoute("/_authenticated/usuarios")({
  component: UsuariosPage,
});

const CARGO_LABEL: Record<string, string> = {
  delegado_geral: "Delegado Geral",
  delegado_corregedor: "Delegado Corregedor",
  corregedor: "Corregedor",
  cidadao: "Cidadão",
  mp: "Ministério Público",
};

const DELEGADO_CARGOS = new Set(["delegado_geral", "delegado_corregedor"]);
const EDITAVEIS = new Set(["cidadao", "mp"]);

interface Usuario {
  id: string;
  nome: string;
  matricula: string;
  unidade: string | null;
  status: "pendente" | "ativo" | "inativo";
  cargo: string | null;
  email: string | null;
  created_at: string;
}

function UsuariosPage() {
  const sessionFn = useServerFn(getSessionInfo);
  const { data: session } = useQuery({ queryKey: ["session-info"], queryFn: () => sessionFn() });

  const isDelegado = session?.cargo ? DELEGADO_CARGOS.has(session.cargo) : false;

  const listFn = useServerFn(listUsuarios);
  const { data: usuarios, error, isLoading } = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => listFn() as Promise<Usuario[]>,
    enabled: !!isDelegado,
  });

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroCargo, setFiltroCargo] = useState<string>("todos");

  const [editando, setEditando] = useState<Usuario | null>(null);
  const [confirmando, setConfirmando] = useState<Usuario | null>(null);
  const [excluindo, setExcluindo] = useState<Usuario | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (usuarios ?? []).filter((u) => {
      if (filtroStatus !== "todos" && u.status !== filtroStatus) return false;
      if (filtroCargo !== "todos" && u.cargo !== filtroCargo) return false;
      if (!q) return true;
      return (
        u.nome.toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.cargo ? CARGO_LABEL[u.cargo] ?? u.cargo : "").toLowerCase().includes(q)
      );
    });
  }, [usuarios, busca, filtroStatus, filtroCargo]);

  if (!session) return null;

  if (!isDelegado) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
          <ShieldAlert className="h-12 w-12 text-destructive" />
          <h1 className="mt-4 font-serif text-2xl">403 — Acesso Negado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Apenas Delegado Geral ou Delegado Corregedor podem acessar esta área.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="eyebrow">Gestão</div>
        <h1 className="mt-1 font-serif text-3xl">Gestão de Usuários</h1>
        <p className="text-sm text-muted-foreground">
          Aprove cadastros, edite cidadãos e representantes do MP, e controle o status de acesso.
        </p>

        {error && (
          <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            {error instanceof Error ? error.message : "Erro ao carregar."}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, e-mail ou perfil…"
              className="pl-9"
            />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroCargo} onValueChange={setFiltroCargo}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Perfil" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os perfis</SelectItem>
              {Object.entries(CARGO_LABEL).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-6 overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">Carregando…</TableCell></TableRow>
              )}
              {!isLoading && filtrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-14 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-muted-foreground">
                      <Search className="h-8 w-8 opacity-60" />
                      <div className="text-sm">Nenhum usuário encontrado com esses filtros.</div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {filtrados.map((u) => {
                const isEditavel = u.cargo ? EDITAVEIS.has(u.cargo) : false;
                return (
                  <TableRow key={u.id} className="transition-colors hover:bg-surface-2">
                    <TableCell className="font-medium">{u.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email ?? "—"}</TableCell>
                    <TableCell>{u.cargo ? CARGO_LABEL[u.cargo] ?? u.cargo : "—"}</TableCell>
                    <TableCell>
                      {u.status === "ativo" ? (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Ativo</Badge>
                      ) : u.status === "inativo" ? (
                        <Badge variant="secondary">Inativo</Badge>
                      ) : (
                        <Badge variant="outline">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="tabular text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditavel ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditando(u)}>
                            <Edit3 className="mr-1 h-3.5 w-3.5" /> Editar
                          </Button>
                          <Button
                            size="sm"
                            variant={u.status === "ativo" ? "secondary" : "default"}
                            onClick={() => setConfirmando(u)}
                          >
                            {u.status === "ativo" ? (
                              <><UserX className="mr-1 h-3.5 w-3.5" /> Inativar</>
                            ) : (
                              <><UserCheck className="mr-1 h-3.5 w-3.5" /> Ativar</>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setExcluindo(u)}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Não editável</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <EditarModal usuario={editando} onClose={() => setEditando(null)} />
      <StatusModal usuario={confirmando} onClose={() => setConfirmando(null)} />
      <ExcluirModal usuario={excluindo} onClose={() => setExcluindo(null)} />
    </div>
  );
}

function EditarModal({ usuario, onClose }: { usuario: Usuario | null; onClose: () => void }) {
  const qc = useQueryClient();
  const editarFn = useServerFn(editarUsuarioPublico);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState<"cidadao" | "mp">("cidadao");

  const open = !!usuario;

  useMemoInit(usuario, () => {
    if (usuario) {
      setNome(usuario.nome);
      setEmail(usuario.email ?? "");
      setCargo((usuario.cargo as "cidadao" | "mp") ?? "cidadao");
    }
  });

  const m = useMutation({
    mutationFn: () =>
      editarFn({ data: { user_id: usuario!.id, nome, email, cargo } }),
    onSuccess: () => {
      toast.success("Usuário atualizado com sucesso.");
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao atualizar."),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>Altere os dados do cadastro público.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Perfil</Label>
            <Select value={cargo} onValueChange={(v) => setCargo(v as "cidadao" | "mp")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cidadao">Cidadão</SelectItem>
                <SelectItem value="mp">Ministério Público</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusModal({ usuario, onClose }: { usuario: Usuario | null; onClose: () => void }) {
  const qc = useQueryClient();
  const statusFn = useServerFn(alterarStatusUsuario);
  const proximo: "ativo" | "inativo" = usuario?.status === "ativo" ? "inativo" : "ativo";

  const m = useMutation({
    mutationFn: () => statusFn({ data: { user_id: usuario!.id, status: proximo } }),
    onSuccess: () => {
      toast.success(proximo === "ativo" ? "Usuário ativado." : "Usuário inativado.");
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao alterar status."),
  });

  return (
    <Dialog open={!!usuario} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {proximo === "inativo" ? "Inativar usuário" : "Ativar usuário"}
          </DialogTitle>
          <DialogDescription>
            {proximo === "inativo"
              ? `Deseja inativar ${usuario?.nome}? O acesso ao sistema será bloqueado.`
              : `Deseja reativar ${usuario?.nome}? O acesso será restaurado.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            variant={proximo === "inativo" ? "destructive" : "default"}
            onClick={() => m.mutate()}
            disabled={m.isPending}
          >
            {m.isPending ? "Aplicando…" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Sincroniza estado local quando o usuário selecionado muda
function useMemoInit(dep: unknown, fn: () => void) {
  useMemo(() => {
    fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
}
