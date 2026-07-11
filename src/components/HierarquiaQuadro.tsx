import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Save, Trash2, X, Pencil } from "lucide-react";

type Grupo =
  | "delegado"
  | "cupula"
  | "investigadores"
  | "agentes_classe_especial"
  | "agentes";

type Membro = {
  id: string;
  grupo: Grupo;
  ordem: number;
  nome: string;
  rg: string;
  edital: string;
  patente: string;
  transferido: string;
  status: string;
  cargo: string;
  instrutor: string;
  promocao: string;
  pad: string;
  atividade: string;
};

const GRUPOS: { key: Grupo; label: string }[] = [
  { key: "delegado", label: "Delegado" },
  { key: "cupula", label: "Cúpula" },
  { key: "investigadores", label: "Investigadores" },
  { key: "agentes_classe_especial", label: "Agentes Classe Especial" },
  { key: "agentes", label: "Agentes" },
];

const PATENTES = [
  "Corregedor Geral",
  "Subcorregedor Geral",
  "Escrivão",
  "Investigador Chefe",
  "Investigador",
  "Agente Classe Especial",
  "Agente 1º Classe",
];
const TRANSFERIDOS = ["Transferência", "Convite", "Reintegração"];
const STATUSES = ["Ativo", "Inativo"];
const CARGOS = ["Delegado", "RH", "Supervisor", "Cúpula", "N/A"];
const INSTRUTORES = ["Instrutor CORREGEPOL", "N/A"];

function badgeCls(kind: "status" | "patente" | "transferido" | "cargo", value: string) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap";
  if (kind === "status") {
    if (value === "Ativo")
      return `${base} bg-emerald-500/15 text-emerald-300 ring-emerald-500/30`;
    if (value === "Inativo")
      return `${base} bg-rose-500/15 text-rose-300 ring-rose-500/30`;
    return `${base} bg-muted text-muted-foreground ring-border`;
  }
  if (kind === "patente") {
    if (/Corregedor Geral/i.test(value))
      return `${base} bg-amber-500/15 text-amber-300 ring-amber-500/30`;
    if (/Subcorregedor/i.test(value))
      return `${base} bg-yellow-500/15 text-yellow-300 ring-yellow-500/30`;
    if (/Escriv/i.test(value))
      return `${base} bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-500/30`;
    if (/Chefe/i.test(value))
      return `${base} bg-indigo-500/15 text-indigo-300 ring-indigo-500/30`;
    if (/Classe Especial/i.test(value))
      return `${base} bg-sky-500/15 text-sky-300 ring-sky-500/30`;
    if (/Investigador/i.test(value))
      return `${base} bg-blue-500/15 text-blue-300 ring-blue-500/30`;
    if (/Agente/i.test(value))
      return `${base} bg-teal-500/15 text-teal-300 ring-teal-500/30`;
    return `${base} bg-muted text-muted-foreground ring-border`;
  }
  if (kind === "transferido") {
    if (value === "Transferência")
      return `${base} bg-cyan-500/15 text-cyan-300 ring-cyan-500/30`;
    if (value === "Convite")
      return `${base} bg-violet-500/15 text-violet-300 ring-violet-500/30`;
    if (value === "Reintegração")
      return `${base} bg-orange-500/15 text-orange-300 ring-orange-500/30`;
    return `${base} bg-muted text-muted-foreground ring-border`;
  }
  // cargo
  if (value === "Delegado")
    return `${base} bg-amber-500/15 text-amber-300 ring-amber-500/30`;
  if (value === "Cúpula")
    return `${base} bg-indigo-500/15 text-indigo-300 ring-indigo-500/30`;
  if (value === "RH" || value === "Supervisor")
    return `${base} bg-sky-500/15 text-sky-300 ring-sky-500/30`;
  return `${base} bg-muted text-muted-foreground ring-border`;
}

const COLS: { key: keyof Membro; label: string; badge?: "status" | "patente" | "transferido" | "cargo"; options?: string[] }[] = [
  { key: "nome", label: "Nome" },
  { key: "rg", label: "RG" },
  { key: "edital", label: "Edital" },
  { key: "patente", label: "Patente", badge: "patente", options: PATENTES },
  { key: "transferido", label: "Transferido", badge: "transferido", options: TRANSFERIDOS },
  { key: "status", label: "Status", badge: "status", options: STATUSES },
  { key: "cargo", label: "Cargo", badge: "cargo", options: CARGOS },
  { key: "instrutor", label: "Instrutor", options: INSTRUTORES },
  { key: "promocao", label: "Promoção" },
  { key: "pad", label: "PAD" },
  { key: "atividade", label: "Atividade" },
];

export function HierarquiaQuadro({ cargo }: { cargo: string | null }) {
  const podeEditar = cargo === "delegado_corregedor";
  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Membro | null>(null);
  const [busy, setBusy] = useState(false);

  async function carregar() {
    setLoading(true);
    const { data, error } = await supabase
      .from("hierarquia_membros" as never)
      .select("*")
      .order("grupo", { ascending: true })
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });
    if (error) {
      console.error(error);
      setMembros([]);
    } else {
      setMembros((data ?? []) as unknown as Membro[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  const porGrupo = useMemo(() => {
    const map = new Map<Grupo, Membro[]>();
    for (const g of GRUPOS) map.set(g.key, []);
    for (const m of membros) map.get(m.grupo)?.push(m);
    return map;
  }, [membros]);

  async function adicionar(grupo: Grupo) {
    setBusy(true);
    const { data, error } = await supabase
      .from("hierarquia_membros" as never)
      .insert({
        grupo,
        nome: "Novo membro",
        ordem: (porGrupo.get(grupo)?.length ?? 0) + 1,
      } as never)
      .select()
      .single();
    setBusy(false);
    if (error) return alert("Erro ao adicionar: " + error.message);
    const novo = data as unknown as Membro;
    setMembros((prev) => [...prev, novo]);
    setEditId(novo.id);
    setDraft(novo);
  }

  async function salvar() {
    if (!draft) return;
    setBusy(true);
    const { id, ...patch } = draft;
    const { data, error } = await supabase
      .from("hierarquia_membros" as never)
      .update(patch as never)
      .eq("id", id)
      .select()
      .single();
    setBusy(false);
    if (error) return alert("Erro ao salvar: " + error.message);
    const atualizado = data as unknown as Membro;
    setMembros((prev) => prev.map((m) => (m.id === id ? atualizado : m)));
    setEditId(null);
    setDraft(null);
  }

  async function remover(id: string) {
    if (!confirm("Remover este membro da hierarquia?")) return;
    setBusy(true);
    const { error } = await supabase
      .from("hierarquia_membros" as never)
      .delete()
      .eq("id", id);
    setBusy(false);
    if (error) return alert("Erro ao remover: " + error.message);
    setMembros((prev) => prev.filter((m) => m.id !== id));
    if (editId === id) {
      setEditId(null);
      setDraft(null);
    }
  }

  function iniciarEdicao(m: Membro) {
    setEditId(m.id);
    setDraft({ ...m });
  }

  function cancelarEdicao() {
    setEditId(null);
    setDraft(null);
  }

  function renderCelula(m: Membro, col: (typeof COLS)[number]) {
    const value = (m[col.key] as string) ?? "";
    const editing = editId === m.id && draft;
    if (editing) {
      if (col.options) {
        return (
          <select
            value={(draft![col.key] as string) ?? ""}
            onChange={(e) => setDraft({ ...draft!, [col.key]: e.target.value } as Membro)}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
          >
            <option value="">—</option>
            {col.options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        );
      }
      return (
        <input
          value={(draft![col.key] as string) ?? ""}
          onChange={(e) => setDraft({ ...draft!, [col.key]: e.target.value } as Membro)}
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
        />
      );
    }
    if (col.badge && value) {
      return <span className={badgeCls(col.badge, value)}>{value}</span>;
    }
    return <span className="text-sm text-foreground/90">{value || <span className="text-muted-foreground/60">—</span>}</span>;
  }

  return (
    <div className="p-6">
      <header className="mb-6 flex items-center gap-4 border-b border-border pb-4">
        <img src="/brasao-pcsp.png" alt="Brasão PCSP" className="h-14 w-auto" />
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Polícia Civil do Estado de São Paulo — Corregedoria Geral
          </div>
          <h3 className="font-serif text-xl">Hierarquia — Corregedoria</h3>
          <div className="text-xs text-muted-foreground">
            Quadro estruturado e orgânico de pessoal.
            {podeEditar
              ? " Você tem permissão para editar."
              : " Consulta somente leitura."}
          </div>
        </div>
      </header>

      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-40 bg-surface-2 rounded" />
          <div className="h-24 bg-surface-2 rounded" />
        </div>
      ) : (
        <div className="space-y-8">
          {GRUPOS.map((g) => {
            const list = porGrupo.get(g.key) ?? [];
            return (
              <section key={g.key}>
                <div className="mb-3 flex items-center justify-between border-b border-border/60 pb-2">
                  <h4 className="font-serif text-lg text-foreground">{g.label}</h4>
                  {podeEditar && (
                    <button
                      onClick={() => adicionar(g.key)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-surface-2 disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar
                    </button>
                  )}
                </div>

                <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
                  <div className="rounded-lg border border-border bg-background/40">
                    <table className="w-full min-w-[1100px] table-fixed border-collapse text-sm">
                      <colgroup>
                        <col style={{ width: "180px" }} />
                        <col style={{ width: "72px" }} />
                        <col style={{ width: "72px" }} />
                        <col style={{ width: "160px" }} />
                        <col style={{ width: "130px" }} />
                        <col style={{ width: "90px" }} />
                        <col style={{ width: "150px" }} />
                        <col style={{ width: "160px" }} />
                        <col style={{ width: "100px" }} />
                        <col style={{ width: "70px" }} />
                        <col style={{ width: "90px" }} />
                        {podeEditar && <col style={{ width: "96px" }} />}
                      </colgroup>
                      <thead>
                        <tr className="border-b border-border bg-surface-2/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                          {COLS.map((c) => (
                            <th key={c.key} className="whitespace-nowrap px-3 py-2 font-medium">{c.label}</th>
                          ))}
                          {podeEditar && <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Ações</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {list.length === 0 ? (
                          <tr>
                            <td
                              colSpan={COLS.length + (podeEditar ? 1 : 0)}
                              className="px-3 py-6 text-center text-xs italic text-muted-foreground"
                            >
                              Nenhum membro registrado neste grupo.
                            </td>
                          </tr>
                        ) : (
                          list.map((m) => (
                            <tr key={m.id} className="border-b border-border/40 last:border-0 hover:bg-surface/60">
                              {COLS.map((c) => (
                                <td key={c.key} className="whitespace-nowrap px-3 py-2 align-middle">
                                  {renderCelula(m, c)}
                                </td>
                              ))}
                              {podeEditar && (
                                <td className="whitespace-nowrap px-3 py-2 text-right">
                                  {editId === m.id ? (
                                    <div className="flex justify-end gap-1">
                                      <button
                                        onClick={salvar}
                                        disabled={busy}
                                        className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                                      >
                                        <Save className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={cancelarEdicao}
                                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-2"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex justify-end gap-1">
                                      <button
                                        onClick={() => iniciarEdicao(m)}
                                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-2"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={() => remover(m.id)}
                                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
