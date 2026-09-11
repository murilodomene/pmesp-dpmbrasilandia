import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, X, Trash2, Pencil, Plus } from "lucide-react";
import {
  listAvisos,
  criarAviso,
  atualizarAviso,
  excluirAviso,
} from "@/lib/avisos.functions";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { RichTextEditor, sanitizeAtoHtml, isHtmlAto } from "@/components/RichTextEditor";
import { PMESP_CREST_URL } from "@/lib/branding";

export const Route = createFileRoute("/_authenticated/avisos")({
  head: () => ({
    meta: [
      { title: "Avisos — Corregedoria" },
      { name: "description", content: "Comunicados internos da chefia da Corregedoria." },
    ],
  }),
  component: AvisosPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">{(error as Error).message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Não encontrado.</div>,
});

type Aviso = {
  id: string;
  numero: string;
  titulo: string;
  corpo: string;
  autor_nome: string;
  autor_cargo: string;
  autor_id: string;
  created_at: string;
};

function AvisosPage() {
  const { session } = useSession();
  const [cargo, setCargo] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [aberto, setAberto] = useState<Aviso | null>(null);
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<Aviso | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase.from("user_roles").select("role").eq("user_id", session.user.id).maybeSingle()
      .then(({ data }) => setCargo((data as { role: string } | null)?.role ?? null));
    supabase.from("profiles").select("status").eq("id", session.user.id).maybeSingle()
      .then(({ data }) => setStatus((data as { status: string } | null)?.status ?? null));
  }, [session]);

  const ativo = status === "ativo";
  const podeVer = ativo && (cargo === "ssp" || const podeVer = ativo && (cargo=== "cmtg" || cargo === "corregedor_geral" || cargo === "corregedor" || cargo === "subcorregedor_geral");
  const podePublicar = ativo && (cargo === "ssp" || const podePublicar = ativo && (cargo=== "cmtg" || cargo === "corregedor_geral" || cargo === "subcorregedor_geral");

  const listFn = useServerFn(listAvisos);
  const { data: avisos = [], isLoading } = useQuery({
    queryKey: ["avisos"],
    queryFn: () => listFn() as Promise<Aviso[]>,
    enabled: podeVer,
  });

  if (session === null) {
    return <div className="mx-auto max-w-4xl p-6 text-sm">Faça login para acessar.</div>;
  }
  if (session && !podeVer) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
          Acesso restrito aos usuários internos da Corregedoria.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">Avisos</h1>
          <p className="text-xs text-muted-foreground">
            Comunicados da chefia da Corregedoria — do mais recente ao mais antigo.
          </p>
        </div>
        {podePublicar && (
          <button
            onClick={() => setCriando(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Publicar aviso
          </button>
        )}
      </header>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : avisos.length === 0 ? (
        <div className="rounded-md border border-border p-6 text-center text-sm text-muted-foreground">
          Nenhum aviso publicado.
        </div>
      ) : (
        <ul className="grid gap-3">
          {avisos.map((a) => (
            <li
              key={a.id}
              className="surface cursor-pointer p-4 transition hover:border-primary/60"
              onClick={() => setAberto(a)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-widest text-primary">
                    {a.numero}
                  </div>
                  <div className="mt-0.5 truncate font-serif text-base">{a.titulo}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {a.autor_nome} · {new Date(a.created_at).toLocaleString("pt-BR")}
                  </div>
                </div>
                {podePublicar && session?.user.id === a.autor_id && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditando(a); }}
                      className="rounded-md border border-border p-1.5 hover:bg-surface-2"
                      aria-label="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {aberto && (
        <AvisoViewer
          aviso={aberto}
          onClose={() => setAberto(null)}
          podeExcluir={podePublicar}
          onDeleted={() => setAberto(null)}
        />
      )}
      {criando && <AvisoDialog onClose={() => setCriando(false)} />}
      {editando && <AvisoDialog aviso={editando} onClose={() => setEditando(null)} />}
    </div>
  );
}

function AvisoViewer({
  aviso, onClose, podeExcluir, onDeleted,
}: { aviso: Aviso; onClose: () => void; podeExcluir: boolean; onDeleted: () => void }) {
  const qc = useQueryClient();
  const fn = useServerFn(excluirAviso);
  const m = useMutation({
    mutationFn: () => fn({ data: { id: aviso.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["avisos"] });
      onDeleted();
    },
  });

  const dataFmt = new Date(aviso.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });
  const cargoLabel =
    aviso.autor_cargo === "ssp"
      ? "SSP"
      : aviso.autor_cargo === "corregedor_geral"
        ? "Corregedor-Geral"
        : aviso.autor_cargo === "subcorregedor_geral"
        ? "Subcorregedor-Geral"
        : "Corregedor";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="surface flex max-h-[90vh] w-full max-w-3xl flex-col p-5">
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h3 className="font-serif text-lg">Aviso</h3>
          <div className="flex items-center gap-1">
            {podeExcluir && (
              <button
                onClick={() => {
                  if (window.confirm("Excluir definitivamente este aviso?")) m.mutate();
                }}
                className="rounded-md border border-destructive/40 p-1.5 text-destructive hover:bg-destructive/10"
                aria-label="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} className="rounded-md p-1 hover:bg-surface-2">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="relative rounded-md">
            <header className="flex items-start gap-3 pb-3">
              <img src={PMESP_CREST_URL} alt="" aria-hidden className="h-12 w-auto flex-shrink-0 opacity-90 sm:h-14" />
              <div className="text-[10px] font-semibold uppercase leading-snug tracking-wide text-muted-foreground sm:text-[11px]">
                <div>Secretaria da Segurança Pública</div>
                <div>Polícia Militar do Estado de São Paulo</div>
                <div>Corregedoria da Polícia Militar do Estado de São Paulo</div>
                <div>1ª Corregedoria da Capital</div>
                <div className="normal-case text-[10px] text-muted-foreground/80">corregedoriageral@policiacivil.sp</div>
              </div>
            </header>
            <div className="h-px w-full bg-border/60" />
            <div className="py-3 text-center">
              <div className="font-serif text-base font-semibold tracking-[0.25em] text-foreground sm:text-lg">
                AVISO
              </div>
              <div className="mt-0.5 text-[11px] italic text-muted-foreground">{aviso.numero}</div>
            </div>
            <div className="h-px w-full bg-border/60" />
            <div className="py-3">
              <div className="mb-2 font-serif text-base font-semibold text-foreground">{aviso.titulo}</div>
              {isHtmlAto(aviso.corpo) ? (
                <div className="ato-body text-sm leading-relaxed text-foreground"
                     dangerouslySetInnerHTML={{ __html: sanitizeAtoHtml(aviso.corpo) }} />
              ) : (
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{aviso.corpo}</div>
              )}
            </div>
            <div className="h-px w-full bg-border/60" />
            <footer className="pt-2 text-[11px] italic text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-emerald-500" aria-hidden />
                Publicado por {aviso.autor_nome} — {cargoLabel} em {dataFmt}.
              </span>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

function AvisoDialog({ aviso, onClose }: { aviso?: Aviso; onClose: () => void }) {
  const editing = !!aviso;
  const [titulo, setTitulo] = useState(aviso?.titulo ?? "");
  const [corpo, setCorpo] = useState(aviso?.corpo ?? "");
  const qc = useQueryClient();
  const criarFn = useServerFn(criarAviso);
  const editarFn = useServerFn(atualizarAviso);
  const m = useMutation({
    mutationFn: async () => {
      if (editing) await editarFn({ data: { id: aviso!.id, titulo, corpo: sanitizeAtoHtml(corpo) } });
      else await criarFn({ data: { titulo, corpo: sanitizeAtoHtml(corpo) } });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["avisos"] });
      qc.invalidateQueries({ queryKey: ["notif-count"] });
      qc.invalidateQueries({ queryKey: ["notif-list"] });
      onClose();
    },
  });

  const corpoTexto = useMemo(() => corpo.replace(/<[^>]+>/g, "").trim(), [corpo]);
  const disabled = titulo.trim().length < 3 || corpoTexto.length < 3 || m.isPending;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="surface flex max-h-[90vh] w-full max-w-3xl flex-col p-5">
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h3 className="font-serif text-lg">{editing ? "Editar aviso" : "Publicar aviso"}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-surface-2"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">Título</span>
            <input
              className="rounded-md border border-border bg-input px-3 py-2 text-sm"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={200}
              placeholder="Ex.: Alteração no rito das oitivas"
            />
          </label>
          <div className="mt-3 grid gap-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Corpo do aviso</span>
            <RichTextEditor value={corpo} onChange={setCorpo} minHeight={220} />
          </div>
          {m.isError && (
            <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive-foreground">
              {(m.error as Error)?.message || "Não foi possível salvar."}
            </div>
          )}
        </div>
        <div className="mt-4 flex shrink-0 justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">Cancelar</button>
          <button
            onClick={() => m.mutate()}
            disabled={disabled}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {m.isPending ? "Salvando..." : editing ? "Salvar alterações" : "Publicar aviso"}
          </button>
        </div>
      </div>
    </div>
  );
}
