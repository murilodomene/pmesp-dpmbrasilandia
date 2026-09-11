import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { UserAvatar, useAvatarUrl } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSessionInfo, atualizarPerfil } from "@/lib/usuarios.functions";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: PerfilPage,
});

const CARGO_LABEL: Record<string, string> = {
  ssp: "SSP",
  corregedor_geral: "Corregedor-Geral",
  subcorregedor_geral: "Subcorregedor-Geral",
  corregedor: "Corregedor",
  cidadao: "Cidadão",
  mp: "Ministério Público",
};

function PerfilPage() {
  const qc = useQueryClient();
  const sessionFn = useServerFn(getSessionInfo);
  const salvarFn = useServerFn(atualizarPerfil);

  const { data: session, isLoading } = useQuery({
    queryKey: ["session-info"],
    queryFn: () => sessionFn(),
  });

  const isCorregedor = session?.cargo === "corregedor_geral" || session?.cargo === "subcorregedor_geral";
  const canEditAll = isCorregedor;

  const [nome, setNome] = useState("");
  const [rg, setRg] = useState("");
  const [discord, setDiscord] = useState("");
  const [telefone, setTelefone] = useState("");
  const [fotoPath, setFotoPath] = useState<string | null>(null);
  const [previewLocal, setPreviewLocal] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session?.profile) return;
    const p = session.profile as Record<string, unknown>;
    setNome((p.nome as string) ?? "");
    setRg((p.rg as string) ?? "");
    setDiscord((p.discord_id as string) ?? "");
    setTelefone((p.telefone as string) ?? "");
    setFotoPath((p.foto_path as string) ?? null);
  }, [session?.profile]);

  const remoteUrl = useAvatarUrl(fotoPath);
  const displayUrl = previewLocal ?? remoteUrl;

  async function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter até 5 MB.");
      return;
    }
    setPreviewLocal(URL.createObjectURL(file));
    setUploading(true);
    try {
      const uid = session!.userId;
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${uid}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      setFotoPath(path);
      toast.success("Foto enviada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar foto.");
      setPreviewLocal(null);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSalvar() {
    const novosErros: Record<string, string> = {};
    if (canEditAll) {
      if (!nome.trim()) novosErros.nome = "Informe o nome.";
    }
    if (telefone && telefone.trim().length < 8) {
      novosErros.telefone = "Telefone inválido.";
    }
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        telefone: telefone.trim() || null,
        foto_path: fotoPath,
      };
      if (canEditAll) {
        payload.nome = nome.trim();
        payload.rg = rg.trim() || null;
        payload.discord_id = discord.trim() || null;
      }
      await salvarFn({ data: payload as never });
      toast.success("Perfil atualizado com sucesso.");
      qc.invalidateQueries({ queryKey: ["session-info"] });
      setPreviewLocal(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !session) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-muted-foreground">
          Carregando…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="eyebrow">Conta</div>
        <h1 className="mt-1 font-serif text-3xl">Meu perfil</h1>
        <p className="text-sm text-muted-foreground">
          {canEditAll
            ? "Você tem permissão total para editar todos os campos do seu perfil."
            : "Você pode atualizar sua foto e telefone. Demais campos são gerenciados pela Corregedoria."}
        </p>

        <div className="mt-8 rounded-lg border border-border bg-surface p-6">
          <div className="flex flex-col items-start gap-6 sm:flex-row">
            <div className="flex flex-col items-center gap-3">
              {displayUrl ? (
                <img
                  src={displayUrl}
                  alt="foto do perfil"
                  className="h-28 w-28 rounded-full object-cover ring-1 ring-border"
                />
              ) : (
                <UserAvatar path={fotoPath} name={nome} size={112} />
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onSelectFile}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Enviando…</>
                ) : (
                  <><Upload className="mr-2 h-3.5 w-3.5" /> Trocar foto</>
                )}
              </Button>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
              <CampoBloqueado
                label="Nome"
                value={nome}
                onChange={setNome}
                editable={canEditAll}
                erro={erros.nome}
              />
              <CampoBloqueado
                label="RG"
                value={rg}
                onChange={setRg}
                editable={canEditAll}
              />
              <div>
                <Label className="flex items-center gap-1 text-xs">
                  Cargo <Lock className="h-3 w-3 text-muted-foreground" />
                </Label>
                <Input
                  value={session.cargo ? CARGO_LABEL[session.cargo] ?? session.cargo : "—"}
                  readOnly
                  className="cursor-not-allowed bg-muted"
                />
              </div>
              <CampoBloqueado
                label="Discord ID"
                value={discord}
                onChange={setDiscord}
                editable={canEditAll}
              />
              <div className="sm:col-span-2">
                <Label className="text-xs">Telefone</Label>
                <Input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  aria-invalid={!!erros.telefone}
                />
                {erros.telefone && (
                  <p className="mt-1 text-xs text-destructive">{erros.telefone}</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={handleSalvar} disabled={saving || uploading}>
              {saving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…</>
              ) : (
                "Salvar alterações"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CampoBloqueado({
  label,
  value,
  onChange,
  editable,
  erro,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  editable: boolean;
  erro?: string;
}) {
  return (
    <div>
      <Label className="flex items-center gap-1 text-xs">
        {label}
        {!editable && <Lock className="h-3 w-3 text-muted-foreground" />}
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={!editable}
        aria-invalid={!!erro}
        className={!editable ? "cursor-not-allowed bg-muted" : ""}
      />
      {erro && <p className="mt-1 text-xs text-destructive">{erro}</p>}
    </div>
  );
}
