import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Header } from "@/components/Header";
import { submitDenuncia, submitDenunciaCidadao } from "@/lib/denuncias.functions";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/denunciar")({
  head: () => ({
    meta: [
      { title: "Fazer denúncia — Corregedoria da Polícia Civil" },
      {
        name: "description",
        content:
          "Registre denúncia de conduta indevida de policial civil. Sigilo garantido, aceita anonimato.",
      },
      { property: "og:title", content: "Fazer denúncia — Corregedoria" },
      {
        property: "og:description",
        content: "Canal oficial para reportar conduta indevida de policial civil.",
      },
    ],
  }),
  component: DenunciarPage,
});

const UNIDADES = ["DEIC", "CORREGEPOL", "DECAP", "DHPP", "CERCO", "GARRA", "DENARC", "GER", "SAT"] as const;

interface Policial {
  nome: string;
  rg_funcional: string;
  unidade: (typeof UNIDADES)[number] | "";
}

function DenunciarPage() {
  const submitFn = useServerFn(submitDenuncia);
  const [anonimo, setAnonimo] = useState(false);
  const [form, setForm] = useState({
    denunciante_nome: "",
    denunciante_identificador: "",
    denunciante_contato: "",
    ocorrencia_tipo: "",
    ocorrencia_local: "",
    ocorrencia_data: "",
    ocorrencia_hora: "",
    relato: "",
    info_adicional: "",
  });
  const [policiais, setPoliciais] = useState<Policial[]>([{ nome: "", rg_funcional: "", unidade: "" }]);
  const [linksTxt, setLinksTxt] = useState("");
  const [protocolo, setProtocolo] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      submitFn({ data: payload as never }),
    onSuccess: (r) => setProtocolo(r.protocolo),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const links = linksTxt
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    mut.mutate({
      denunciante_anonimo: anonimo,
      denunciante_nome: form.denunciante_nome || null,
      denunciante_identificador: form.denunciante_identificador || null,
      denunciante_contato: form.denunciante_contato || null,
      ocorrencia_tipo: form.ocorrencia_tipo || null,
      ocorrencia_local: form.ocorrencia_local || null,
      ocorrencia_data: form.ocorrencia_data || null,
      ocorrencia_hora: form.ocorrencia_hora || null,
      relato: form.relato,
      info_adicional: form.info_adicional || null,
      links,
      policiais: policiais
        .filter((p) => p.nome.trim())
        .map((p) => ({
          nome: p.nome,
          rg_funcional: p.rg_funcional || null,
          unidade: p.unidade || null,
        })),
    });
  }

  if (protocolo) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-2xl px-4 py-16">
          <div className="eyebrow">Denúncia registrada</div>
          <h1 className="mt-2 font-serif text-3xl">Guarde o número de protocolo</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ele é o único meio de consultar o andamento. Anote agora — não haverá reenvio.
          </p>
          <div className="surface mt-8 p-8 text-center">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Protocolo</div>
            <div className="tabular mt-2 font-serif text-4xl text-primary">{protocolo}</div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/consultar"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Consultar agora
            </Link>
            <Link to="/" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">
              Voltar ao início
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <form onSubmit={submit} className="mx-auto max-w-3xl px-4 py-12">
        <div className="eyebrow">Canal público</div>
        <h1 className="mt-2 font-serif text-3xl">Fazer denúncia</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Os campos marcados com * são obrigatórios. A denúncia gera um número de protocolo para
          consulta posterior.
        </p>

        <section className="surface mt-8 p-6">
          <h2 className="font-serif text-lg">Denunciante</h2>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={anonimo}
              onChange={(e) => setAnonimo(e.target.checked)}
            />
            Denúncia anônima (não informar identidade)
          </label>
          {!anonimo && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Nome">
                <input
                  className="input"
                  value={form.denunciante_nome}
                  onChange={(e) => setForm({ ...form, denunciante_nome: e.target.value })}
                />
              </Field>
              <Field label="Identificador (CPF, RG, ID)">
                <input
                  className="input"
                  value={form.denunciante_identificador}
                  onChange={(e) => setForm({ ...form, denunciante_identificador: e.target.value })}
                />
              </Field>
              <Field label="Contato (telefone/email)">
                <input
                  className="input md:col-span-2"
                  value={form.denunciante_contato}
                  onChange={(e) => setForm({ ...form, denunciante_contato: e.target.value })}
                />
              </Field>
            </div>
          )}
        </section>

        <section className="surface mt-6 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg">Policiais denunciados *</h2>
            <button
              type="button"
              onClick={() =>
                setPoliciais([...policiais, { nome: "", rg_funcional: "", unidade: "" }])
              }
              className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-surface-2"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {policiais.map((p, i) => (
              <div key={i} className="grid gap-2 rounded-md border border-border/60 p-3 md:grid-cols-[1fr_140px_160px_auto]">
                <input
                  required={i === 0}
                  placeholder="Nome do policial"
                  className="input"
                  value={p.nome}
                  onChange={(e) => {
                    const copy = [...policiais];
                    copy[i].nome = e.target.value;
                    setPoliciais(copy);
                  }}
                />
                <input
                  placeholder="RG funcional"
                  className="input"
                  value={p.rg_funcional}
                  onChange={(e) => {
                    const copy = [...policiais];
                    copy[i].rg_funcional = e.target.value;
                    setPoliciais(copy);
                  }}
                />
                <select
                  className="input"
                  value={p.unidade}
                  onChange={(e) => {
                    const copy = [...policiais];
                    copy[i].unidade = e.target.value as Policial["unidade"];
                    setPoliciais(copy);
                  }}
                >
                  <option value="">Unidade</option>
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                {policiais.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPoliciais(policiais.filter((_, j) => j !== i))}
                    className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-destructive"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="surface mt-6 p-6">
          <h2 className="font-serif text-lg">Ocorrência</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Tipo/natureza">
              <input
                className="input"
                value={form.ocorrencia_tipo}
                onChange={(e) => setForm({ ...form, ocorrencia_tipo: e.target.value })}
              />
            </Field>
            <Field label="Local">
              <input
                className="input"
                value={form.ocorrencia_local}
                onChange={(e) => setForm({ ...form, ocorrencia_local: e.target.value })}
              />
            </Field>
            <Field label="Data">
              <input
                type="date"
                className="input"
                value={form.ocorrencia_data}
                onChange={(e) => setForm({ ...form, ocorrencia_data: e.target.value })}
              />
            </Field>
            <Field label="Horário">
              <input
                type="time"
                className="input"
                value={form.ocorrencia_hora}
                onChange={(e) => setForm({ ...form, ocorrencia_hora: e.target.value })}
              />
            </Field>
          </div>
        </section>

        <section className="surface mt-6 p-6">
          <h2 className="font-serif text-lg">Relato *</h2>
          <textarea
            required
            minLength={20}
            rows={8}
            className="input mt-4"
            value={form.relato}
            onChange={(e) => setForm({ ...form, relato: e.target.value })}
            placeholder="Descreva o fato com o máximo de detalhes possível."
          />
          <div className="mt-4 grid gap-4">
            <Field label="Informações adicionais">
              <textarea
                rows={3}
                className="input"
                value={form.info_adicional}
                onChange={(e) => setForm({ ...form, info_adicional: e.target.value })}
              />
            </Field>
            <Field label="Links (um por linha)">
              <textarea
                rows={3}
                className="input"
                value={linksTxt}
                onChange={(e) => setLinksTxt(e.target.value)}
                placeholder="https://..."
              />
            </Field>
          </div>
        </section>

        {mut.isError && (
          <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground">
            {mut.error instanceof Error ? mut.error.message : "Erro ao enviar. Verifique os campos."}
          </div>
        )}

        <div className="mt-8 flex justify-end gap-3">
          <Link to="/" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={mut.isPending}
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {mut.isPending ? "Enviando..." : "Enviar denúncia"}
          </button>
        </div>

        <style>{`.input{background:var(--input);border:1px solid var(--border);border-radius:6px;padding:.55rem .7rem;font-size:.9rem;color:var(--foreground);width:100%}`}</style>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
