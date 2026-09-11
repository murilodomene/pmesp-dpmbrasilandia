import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { Search, Edit3, ShieldAlert, UserX, UserCheck, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { UserAvatar } from "@/components/UserAvatar";
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
  aprovarUsuario,
  getSessionInfo,
} from "@/lib/usuarios.functions";
import { APP_ROLES, ROLE_LABELS } from "@/lib/access-roles";

export const Route = createFileRoute("/_authenticated/usuarios")({
  beforeLoad: async () => {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) throw redirect({ to: "/auth" });
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .maybeSingle();
    if (((role as { role: string } | null)?.role !== "corregedor_geral") && ((role as { role: string } | null)?.role !== "subcorregedor_geral")) {
      throw redirect({ to: "/painel" });
    }
  },
  component: UsuariosPage,
});

const CARGO_LABEL: Record<string, string> = {
  ssp: "SSP",
  cmtg: "CMTG",
  corregedor_geral: "Corregedor-Geral",
  subcorregedor_geral: "Subcorregedor-Geral",
  corregedor: "Corregedor",
  cidadao: "Cidadão",
  mp: "Ministério Público",
};

const DELEGADO_CARGOS = new Set(["corregedor_geral", "subcorregedor_geral"]);
const EDITAVEIS = new Set<string>(APP_ROLES);

interface Usuario {
  id: string;
  nome: string;
  matricula: string;
  unidade: string | null;
  status: "pendente" | "ativo" | "inativo";
  cargo: string | null;
  email: string | null;
  created_at: string;
  rg: string | null;
  discord_id: string | null;
  telefone: string | null;
  foto_path: string | null;
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
  const [aprovando, setAprovando] = useState<Usuario | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (usuarios ?? []).filter((u) => {
      if (filtroStatus !== "todos" && u.status !== filtroStatus) return false;
      if (filtroCargo !== "todos" && u.cargo !== filtroCargo) return false;
      if (!q) return true;
      return (
        u.nome.toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.rg ?? "").toLowerCase().includes(q) ||
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
            Apenas o Corregedor-Geral ou Subcorregedor-Geral pode acessar esta área.
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
              placeholder="Buscar por nome, RG, e-mail ou perfil…"
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
                      {u.status === "pendente" ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => setAprovando(u)}>
                            <UserPlus className="mr-1 h-3.5 w-3.5" /> Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setExcluindo(u)}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir
                          </Button>
                        </div>
                      ) : isEditavel ? (
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
      <AprovarModal usuario={aprovando} onClose={() => setAprovando(null)} />
    </div>
  );
}

function EditarModal({ usuario, onClose }: { usuario: Usuario | null; onClose: () => void }) {
  const qc = useQueryClient();
  const editarFn = useServerFn(editarUsuarioPublico);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState<(typeof APP_ROLES)[number]>("cidadao");
  const [rg, setRg] = useState("");
  const [discord, setDiscord] = useState("");
  const [telefone, setTelefone] = useState("");
  const [fotoPath, setFotoPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const open = !!usuario;

  useMemoInit(usuario, () => {
    if (usuario) {
      setNome(usuario.nome);
      setEmail(usuario.email ?? "");
      setCargo((usuario.cargo as typeof cargo) ?? "cidadao");
      setRg(usuario.rg ?? "");
      setDiscord(usuario.discord_id ?? "");
      setTelefone(usuario.telefone ?? "");
      setFotoPath(usuario.foto_path);
    }
  });

  const m = useMutation({
    mutationFn: () =>
      editarFn({
        data: {
          user_id: usuario!.id,
          nome,
          email,
          cargo,
          rg: rg.trim() || null,
          discord_id: discord.trim() || null,
          telefone: telefone.trim() || null,
          foto_path: fotoPath,
        },
      }),
    onSuccess: () => {
      toast.success("Usuário atualizado com sucesso.");
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao atualizar."),
  });

  async function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !usuario) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem até 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${usuario.id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      setFotoPath(path);
      toast.success("Foto enviada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>Altere os dados do cadastro.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <UserAvatar path={fotoPath} name={nome} size={56} />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onSelectFile} />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? "Enviando…" : "Trocar foto"}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>RG</Label>
              <Input value={rg} onChange={(e) => setRg(e.target.value)} />
            </div>
            <div>
              <Label>Discord ID</Label>
              <Input value={discord} onChange={(e) => setDiscord(e.target.value)} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>
            <div>
              <Label>Perfil</Label>
              <Select value={cargo} onValueChange={(v) => setCargo(v as typeof cargo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cidadao">Cidadão</SelectItem>
                  <SelectItem value="mp">Ministério Público</SelectItem>
                  <SelectItem value="corregedor">Corregedor</SelectItem>
                  <SelectItem value="cmtg">CMTG</SelectItem>
                  <SelectItem value="subcorregedor_geral">Subcorregedor-Geral</SelectItem>
                  <SelectItem value="corregedor_geral">Corregedor-Geral</SelectItem>
                  <SelectItem value="ssp">SSP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || uploading}>
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

function ExcluirModal({ usuario, onClose }: { usuario: Usuario | null; onClose: () => void }) {
  const qc = useQueryClient();
  const excluirFn = useServerFn(excluirUsuario);

  const m = useMutation({
    mutationFn: () => excluirFn({ data: { user_id: usuario!.id } }),
    onSuccess: () => {
      toast.success("Usuário excluído permanentemente.");
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao excluir."),
  });

  return (
    <Dialog open={!!usuario} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir usuário</DialogTitle>
          <DialogDescription>
            Esta ação é <strong>permanente</strong>. O cadastro de{" "}
            <strong>{usuario?.nome}</strong> será removido do banco de dados junto com
            seus dados de autenticação. Deseja continuar?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending ? "Excluindo…" : "Excluir definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AprovarModal({ usuario, onClose }: { usuario: Usuario | null; onClose: () => void }) {
  const qc = useQueryClient();
  const aprovarFn = useServerFn(aprovarUsuario);
  const [cargo, setCargo] = useState<(typeof APP_ROLES)[number]>("cidadao");

  const m = useMutation({
    mutationFn: () => aprovarFn({ data: { user_id: usuario!.id, cargo } }),
    onSuccess: () => {
      toast.success("Cadastro aprovado.");
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao aprovar."),
  });

  return (
    <Dialog open={!!usuario} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aprovar cadastro</DialogTitle>
          <DialogDescription>
            Defina o cargo de <strong>{usuario?.nome}</strong> ao aprovar o cadastro.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Cargo</Label>
            <Select value={cargo} onValueChange={(v) => setCargo(v as typeof cargo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cidadao">Cidadão</SelectItem>
                <SelectItem value="mp">Ministério Público</SelectItem>
                <SelectItem value="corregedor">Corregedor</SelectItem>
                <SelectItem value="cmtg">CMTG</SelectItem>
                <SelectItem value="subcorregedor_geral">Subcorregedor-Geral</SelectItem>
                <SelectItem value="corregedor_geral">Corregedor-Geral</SelectItem>
                <SelectItem value="ssp">SSP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending ? "Aprovando…" : "Aprovar cadastro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
