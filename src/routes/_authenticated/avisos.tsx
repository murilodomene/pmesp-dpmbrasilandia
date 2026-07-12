import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listAvisos,
  criarAviso,
  atualizarAviso,
  removerAviso,
} from "@/lib/avisos.functions";
import { RichTextEditor, sanitizeAtoHtml, isHtmlAto } from "@/components/RichTextEditor";
import { Plus, Pencil, Trash2, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/avisos")({
  component: AvisosPage,
  head: () => ({
    meta: [{ title: "Avisos — Corregedoria" }],
  }),
});

interface Aviso {
  id: string;
  numero: string;
  titulo: string;
  corpo: string;
  autor_id: string;
  autor_nome: string;
  autor_cargo: string;
  created_at: string;
  updated_at: string;
}

const CARGO_LABEL: Record<string, string> = {
  delegado_geral: "Delegado Geral",
  delegado_corregedor: "Delegado Corregedor",
  corregedor: "Corregedor",
};

function AvisosPage() {
  const [cargo, setCargo] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [modo, setModo] = useState<"novo" | "editar" | null>(null);
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");

  const qc = useQueryClient();
  const list = useServerFn(listAvisos);
  const criar = useServerFn(criarAviso);
  const atualizar = useServerFn(atualizarAviso);
  const remover = useServerFn(removerAviso);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUid(data.user?.id ?? null);
      if (!data.user) return;
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .maybeSingle()
        .then(({ data: r }) => setCargo((r as { role: string } | null)?.role ?? null));
    });
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["avisos"],
    queryFn: () => list(),
  });
  const avisos = (data ?? []) as Aviso[];
  const atual = useMemo(() => avisos.find((a) => a.id === selecionado) ?? null, [avisos, selecionado]);

  const podePublicar = cargo === "delegado_geral" || cargo === "delegado_corregedor";

  const mCriar = useMutation({
    mutationFn: () => criar({ data: { titulo: titulo.trim(), corpo: sanitizeAtoHtml(corpo) } }),
    onSuccess: (r) => {
      setModo(null);
      setTitulo("");
      setCorpo("");
      setSelecionado(r.id);
      qc.invalidateQueries({ queryKey: ["avisos"] });
      qc.invalidateQueries({ queryKey: ["notificacoes"] });
    },
  });

  const mAtualizar = useMutation({
    mutationFn: () =>
      atualizar({ data: { id: atual!.id, titulo: titulo.trim(), corpo: sanitizeAtoHtml(corpo) } }),
    onSuccess: () => {
      setModo(null);
      qc.invalidateQueries({ queryKey: ["avisos"] });
    },
  });

  const mRemover = useMutation({
    mutationFn: (id: string) => remover({ data: { id } }),
    onSuccess: () => {
      setSelecionado(null);
      qc.invalidateQueries({ queryKey: ["avisos"] });
    },
  });

  function iniciarNovo() {
    setModo("novo");
    setTitulo("");
    setCorpo("");
    setSelecionado(null);
  }
  function iniciarEditar() {
    if (!atual) return;
    setModo("editar");
    setTitulo(atual.titulo);
    setCorpo(atual.corpo);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="font-serif text-2xl">Avisos</h1>
          <p className="text-xs text-muted-foreground">
            Comunicados internos da chefia da Corregedoria.
          </p>
        </div>
        {podePublicar && (
          <button
            onClick={iniciarNovo}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Novo aviso
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <aside className="surface max-h-[70vh] overflow-y-auto p-0">
          {isLoading ? (
            <div className="p-4 text-xs text-muted-foreground">Carregando…</div>
          ) : avisos.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">Nenhum aviso publicado.</div>
          ) : (
            avisos.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  setSelecionado(a.id);
                  setModo(null);
                }}
                className={`block w-full border-b border-border px-3 py-2 text-left text-xs transition-colors hover:bg-surface-2 ${
                  selecionado === a.id ? "bg-surface-2" : ""
                }`}
              >
                <div className="font-semibold">{a.numero}</div>
                <div className="line-clamp-1 text-muted-foreground">{a.titulo}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {new Date(a.created_at).toLocaleDateString("pt-BR")}
                </div>
              </button>
            ))
          )}
        </aside>

        <section>
          {modo ? (
            <div className="surface space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-lg">
                  {modo === "novo" ? "Publicar aviso" : "Editar aviso"}
                </h2>
                <button
                  onClick={() => setModo(null)}
                  className="rounded-md border border-border p-1 text-muted-foreground hover:bg-surface-2"
                  aria-label="Fechar"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Título</label>
                <input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                  placeholder="Assunto do comunicado"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Corpo</label>
                <RichTextEditor value={corpo} onChange={setCorpo} minHeight={240} />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setModo(null)}
                  className="rounded-md border border-border px-3 py-2 text-xs hover:bg-surface-2"
                >
                  Cancelar
                </button>
                <button
                  disabled={!titulo.trim() || !corpo.trim() || mCriar.isPending || mAtualizar.isPending}
                  onClick={() => (modo === "novo" ? mCriar.mutate() : mAtualizar.mutate())}
                  className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {modo === "novo" ? "Publicar" : "Salvar alterações"}
                </button>
              </div>
            </div>
          ) : atual ? (
            <AvisoTimbrado
              aviso={atual}
              podeEditar={podePublicar}
              podeRemover={podePublicar && (atual.autor_id === uid || cargo === "delegado_corregedor")}
              onEditar={iniciarEditar}
              onRemover={() => {
                if (confirm("Remover este aviso?")) mRemover.mutate(atual.id);
              }}
            />
          ) : (
            <div className="surface p-8 text-center text-sm text-muted-foreground">
              Selecione um aviso para visualizar.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function AvisoTimbrado({
  aviso,
  podeEditar,
  podeRemover,
  onEditar,
  onRemover,
}: {
  aviso: Aviso;
  podeEditar: boolean;
  podeRemover: boolean;
  onEditar: () => void;
  onRemover: () => void;
}) {
  const data = new Date(aviso.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const html = isHtmlAto(aviso.corpo)
    ? sanitizeAtoHtml(aviso.corpo)
    : `<p>${aviso.corpo.replace(/\n/g, "<br/>")}</p>`;

  return (
    <article className="surface overflow-hidden p-0">
      <header className="flex items-center justify-between gap-3 border-b-2 border-border/70 bg-surface-2/40 px-5 py-4">
        <div className="flex items-center gap-3">
          <img src="/brasao-pcsp.png" alt="" className="h-14 w-auto" />
          <div className="text-[10px] font-semibold uppercase leading-snug tracking-wide text-muted-foreground">
            <div>Secretaria da Segurança Pública</div>
            <div>Polícia Civil do Estado de São Paulo</div>
            <div>Corregedoria Geral da Polícia Civil</div>
            <div>1ª Corregedoria da Capital</div>
          </div>
        </div>
        <div className="flex gap-1">
          {podeEditar && (
            <button
              onClick={onEditar}
              className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-surface-2"
              aria-label="Editar"
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {podeRemover && (
            <button
              onClick={onRemover}
              className="rounded-md border border-border p-1.5 text-danger hover:bg-danger/10"
              aria-label="Remover"
              title="Remover"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>

      <div className="px-6 py-8">
        <h2 className="text-center font-serif text-lg font-bold uppercase tracking-widest">
          {aviso.numero}
        </h2>
        <h3 className="mt-2 text-center font-serif text-base font-semibold">{aviso.titulo}</h3>

        <div
          className="prose-tiptap mx-auto mt-6 max-w-none text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <div className="mt-10 text-center text-sm">
          <div>São Paulo, {data}.</div>
          <div className="mt-6 font-semibold">{aviso.autor_nome}</div>
          <div className="text-xs text-muted-foreground">
            {CARGO_LABEL[aviso.autor_cargo] ?? aviso.autor_cargo}
          </div>
        </div>
      </div>
    </article>
  );
}
