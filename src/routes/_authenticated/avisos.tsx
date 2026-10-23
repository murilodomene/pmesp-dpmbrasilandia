import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, X, Trash2, Pencil, Plus, Search, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { getSessionInfo } from "@/lib/usuarios.functions";
import { exportAvisoPdf } from "@/lib/exportProcesso";
import { aoMudarAvisosVistos, avisosNaoVistos, marcarAvisoVisto } from "@/lib/avisos-vistos";
import { ROLE_LABELS, isAdminRole } from "@/lib/access-roles";
import {
  listAvisos,
  criarAviso,
  atualizarAviso,
  excluirAviso,
} from "@/lib/avisos.functions";
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

const textoDe = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function AvisosPage() {
  const sessionFn = useServerFn(getSessionInfo);
  const { data: session, isLoading: carregandoSessao } = useQuery({
    queryKey: ["session-info"],
    queryFn: () => sessionFn(),
  });
  const [aberto, setAberto] = useState<Aviso | null>(null);
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<Aviso | null>(null);
  const [busca, setBusca] = useState("");
  const [soNovos, setSoNovos] = useState(false);
  const [novos, setNovos] = useState<Set<string>>(new Set());

  const cargo = session?.cargo ?? null;
  const ativo = (session?.profile as { status?: string } | null | undefined)?.status === "ativo";
  const meuId = session?.userId ?? null;
  const podeVer = ativo && (cargo === "ssp" || cargo === "cmtg" || cargo === "corregedor_geral" || cargo === "corregedor" || (cargo === "subcorregedor_geral" || cargo === "corregedor_supervisor"));
  const podePublicar = ativo && (cargo === "ssp" || cargo === "cmtg" || cargo === "corregedor_geral" || (cargo === "subcorregedor_geral" || cargo === "corregedor_supervisor"));
  const podeEditar = (a: Aviso) => podePublicar && (a.autor_id === meuId || isAdminRole(cargo));

  const listFn = useServerFn(listAvisos);
  const { data: avisos = [], isLoading } = useQuery({
    queryKey: ["avisos"],
    queryFn: () => listFn() as Promise<Aviso[]>,
    enabled: podeVer,
  });

  useEffect(() => {
    const atualizar = () => setNovos(avisosNaoVistos(avisos.map((a) => a.id)));
    atualizar();
    return aoMudarAvisosVistos(atualizar);
  }, [avisos]);

  const filtrados = useMemo(() => {
    const t = semAcento(busca.trim());
    return avisos.filter(
      (a) =>
        (!soNovos || novos.has(a.id)) &&
        (!t || semAcento(`${a.numero} ${a.titulo} ${a.autor_nome} ${textoDe(a.corpo)}`).includes(t)),
    );
  }, [avisos, busca, soNovos, novos]);

  function abrir(a: Aviso) {
    marcarAvisoVisto(a.id);
    setAberto(a);
  }

  if (carregandoSessao) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-4xl p-6 text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }
  if (!podeVer) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-4xl p-6">
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
            Acesso restrito aos usuários internos da Corregedoria.
          </div>
        </div>
      </div>
    );
  }

  const chip = (ativoChip: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs transition ${
      ativoChip ? "border-primary/55 bg-primary/10 font-semibold text-primary" : "border-border hover:bg-surface-2"
    }`;

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Comunicação interna</div>
            <h1 className="font-serif text-2xl">Avisos</h1>
          </div>
          {podePublicar && (
            <button
              onClick={() => setCriando(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Publicar aviso
            </button>
          )}
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-md border border-border bg-input px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar no número, título, autor ou texto…"
              aria-label="Buscar aviso"
              className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
          <button type="button" onClick={() => setSoNovos(false)} className={chip(!soNovos)}>
            Todos ({avisos.length})
          </button>
          <button type="button" onClick={() => setSoNovos(true)} className={chip(soNovos)}>
            Não lidos ({novos.size})
          </button>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="rounded-md border border-border p-6 text-center text-sm text-muted-foreground">
            {avisos.length === 0 ? "Nenhum aviso publicado." : soNovos ? "Nenhum aviso não lido." : "Nenhum aviso encontrado com essa busca."}
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtrados.map((a) => {
              const novo = novos.has(a.id);
              const previa = textoDe(a.corpo);
              return (
                <li key={a.id} className={`surface flex flex-col transition hover:border-primary/60 ${novo ? "border-primary/40" : ""}`}>
                  <button type="button" onClick={() => abrir(a)} className="flex flex-1 flex-col gap-1.5 p-4 text-left">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">{a.numero}</span>
                      {novo && (
                        <span className="ml-auto rounded-full bg-primary px-2 py-px text-[10px] font-semibold text-primary-foreground">
                          NOVO
                        </span>
                      )}
                    </span>
                    <span className="font-serif text-base leading-snug">{a.titulo}</span>
                    {previa && <span className="line-clamp-3 text-sm text-muted-foreground">{previa}</span>}
                    <span className="mt-auto pt-1 text-[11px] text-muted-foreground">
                      {a.autor_nome} · {new Date(a.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </button>
                  {podeEditar(a) && (
                    <div className="flex justify-end border-t border-border/60 px-3 py-1.5">
                      <button
                        type="button"
                        onClick={() => setEditando(a)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {aberto && (
        <AvisoViewer
          aviso={aberto}
          onClose={() => setAberto(null)}
          podeExcluir={podePublicar}
          podeEditar={podeEditar(aberto)}
          onEdit={() => {
            setEditando(aberto);
            setAberto(null);
          }}
          onDeleted={() => setAberto(null)}
        />
      )}
      {criando && <AvisoDialog onClose={() => setCriando(false)} />}
      {editando && <AvisoDialog aviso={editando} onClose={() => setEditando(null)} />}
    </div>
  );
}

function AvisoViewer({
  aviso, onClose, podeExcluir, podeEditar, onEdit, onDeleted,
}: {
  aviso: Aviso;
  onClose: () => void;
  podeExcluir: boolean;
  podeEditar: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const fn = useServerFn(excluirAviso);
  const [gerando, setGerando] = useState(false);
  const m = useMutation({
    mutationFn: () => fn({ data: { id: aviso.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["avisos"] });
      toast.success("Aviso excluído.");
      onDeleted();
    },
    onError: (e) => toast.error((e as Error)?.message || "Não foi possível excluir."),
  });
  useEffect(() => {
    const aoTeclar = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  const dataFmt = new Date(aviso.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });
  const cargoLabel = (ROLE_LABELS as Record<string, string>)[aviso.autor_cargo] ?? aviso.autor_cargo;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="surface flex max-h-[90vh] w-full max-w-3xl flex-col p-5">
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h3 className="font-serif text-lg">Aviso</h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={async () => {
                setGerando(true);
                try {
                  await exportAvisoPdf(aviso);
                } catch (e) {
                  toast.error((e as Error)?.message || "Falha ao gerar o PDF.");
                } finally {
                  setGerando(false);
                }
              }}
              disabled={gerando}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-surface-2 disabled:opacity-50"
            >
              {gerando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} PDF
            </button>
            {podeEditar && (
              <button onClick={onEdit} className="rounded-md border border-border p-1.5 hover:bg-surface-2" aria-label="Editar">
                <Pencil className="h-4 w-4" />
              </button>
            )}
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
            <button onClick={onClose} className="rounded-md p-1 hover:bg-surface-2" aria-label="Fechar">
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
                <div className="normal-case text-[10px] text-muted-foreground/80">corregedoriageral@pmesp.sp</div>
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
      toast.success(editing ? "Aviso atualizado." : "Aviso publicado.");
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
