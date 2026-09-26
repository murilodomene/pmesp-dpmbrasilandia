import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { getSessionInfo } from "@/lib/usuarios.functions";
import {
  createPdo,
  listPdos,
  getPdo,
  gerarProcedimentoDoPdo,
  excluirPdo,
  listCorregedoresPdo,
} from "@/lib/pdo.functions";
import { Plus, ArrowRight, X, Trash2, Loader2, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pdo")({
  component: PdoPage,
});

const ITENS = [
  { chave: "documentacao", label: "Documentação funcional" },
  { chave: "armamento", label: "Armamento" },
  { chave: "colete", label: "Colete balístico" },
  { chave: "fardamento", label: "Fardamento / uniforme" },
  { chave: "viatura", label: "Estado geral da viatura" },
] as const;

const ESTADOS = [
  { v: "conforme", l: "Conforme" },
  { v: "nao_conforme", l: "Não conforme" },
  { v: "nao_aplicavel", l: "N/A" },
] as const;

const DESFECHOS = [
  { v: "regular", l: "Regular — nada a apontar" },
  { v: "sanada", l: "Irregularidade sanada no local" },
  { v: "gera_procedimento", l: "Irregularidade que origina procedimento" },
] as const;

const CARGO_LABEL: Record<string, string> = {
  ssp: "SSP",
  cmtg: "CMTG",
  corregedor_geral: "Corregedor-Geral",
  subcorregedor_geral: "Subcorregedor-Geral",
  corregedor_supervisor: "Corregedor Supervisor",
  corregedor: "Corregedor",
};

const DESFECHO_DISCORD: Record<string, string> = {
  regular: "REGULAR",
  sanada: "IRREGULARIDADE SANADA NO LOCAL",
  gera_procedimento: "IRREGULARIDADE QUE ORIGINA PROCEDIMENTO",
};

const CARGO_DISCORD: Record<string, string> = {
  ssp: "SSP",
  cmtg: "CMTG",
  corregedor_geral: "Corregedor Geral",
  subcorregedor_geral: "Subcorregedor Geral",
  corregedor_supervisor: "Corregedor Supervisor",
  corregedor: "Corregedor",
};

function pdoDiscordText(pdo: any): string {
  const E = "<:dpm:1511263085632163942>";
  const join = (...p: (string | undefined | null)[]) => p.filter((x) => x && String(x).trim()).join(" · ");
  const cargoAssinatura =
    CARGO_DISCORD[pdo.lavrado_por_cargo] ?? (pdo.lavrado_por_cargo ? String(pdo.lavrado_por_cargo) : "");
  const vtr = join(pdo.vtr_prefixo, pdo.vtr_placa, pdo.vtr_unidade) || "—";
  const equipe = (pdo.equipe ?? []).map((m: any) => join(m.cargo, m.nome, m.matricula));
  const abordados = (Array.isArray(pdo.abordados) ? pdo.abordados : []).map((a: any, i: number) =>
    join(`P${i + 1}`, a.nome, a.matricula, a.cargo),
  );
  const itens = (pdo.itens ?? []).map((it: any) => {
    const label = ITENS.find((x) => x.chave === it.chave)?.label ?? it.chave;
    const est = ESTADOS.find((e) => e.v === it.estado)?.l ?? it.estado;
    return `${label}: ${est}${it.observacao ? ` — ${it.observacao}` : ""}`;
  });
  // Uma única linha em branco entre cada linha do modelo.
  return [
    `${E}** Corregedoria Geral da Polícia Militar do Estado de São Paulo**`,
    "```PATRULHAMENTO OSTENSIVO DISCIPLINAR```",
    `DATA/HORA: ${new Date(pdo.abordagem_em).toLocaleString("pt-BR")}`,
    `LOCAL: ${pdo.local}`,
    `VTR: ${vtr}`,
    `DESFECHO: ${DESFECHO_DISCORD[pdo.desfecho] ?? String(pdo.desfecho).toUpperCase()}`,
    "EQUIPE CORREGEDORA:",
    ...(equipe.length ? equipe : ["—"]),
    "FISCALIZADOS:",
    ...(abordados.length ? abordados : ["—"]),
    "ITENS VERIFICADOS: ",
    ...(itens.length ? itens : ["—"]),
    `RELATO: ${pdo.relato?.trim() || "Sem alteração."}`,
    `> ${pdo.lavrado_por_nome}`,
    cargoAssinatura ? `> ${E} ${cargoAssinatura}` : `> ${E}`,
  ].join("\n\n");
}


function PdoPage() {
  const sessionFn = useServerFn(getSessionInfo);
  const listFn = useServerFn(listPdos);
  const { data: session } = useQuery({ queryKey: ["session-info"], queryFn: () => sessionFn() });
  const { data: pdos } = useQuery({ queryKey: ["pdos"], queryFn: () => listFn() });

  const [aberto, setAberto] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  const [busca, setBusca] = useState("");
  const [excluir, setExcluir] = useState<{ id: string; numero: string } | null>(null);

  const cargo = session?.cargo ?? null;
  const isStaff = cargo && cargo !== "cidadao" && cargo !== "mp";
  const canDelete = cargo === "corregedor_geral" || (cargo === "subcorregedor_geral" || cargo === "corregedor_supervisor");
  const canGenerate =
    cargo === "ssp" || cargo === "cmtg" || cargo === "corregedor_geral" || cargo === "corregedor" || (cargo === "subcorregedor_geral" || cargo === "corregedor_supervisor");

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return pdos ?? [];
    return (pdos ?? []).filter((p: any) => {
      if (p.numero?.toLowerCase().includes(q)) return true;
      if (p.vtr_prefixo?.toLowerCase().includes(q)) return true;
      if (p.vtr_placa?.toLowerCase().includes(q)) return true;
      const abs = Array.isArray(p.abordados) ? p.abordados : [];
      return abs.some(
        (a: any) =>
          a?.nome?.toLowerCase().includes(q) || a?.matricula?.toLowerCase().includes(q),
      );
    });
  }, [pdos, busca]);

  if (!isStaff) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-5xl p-8 text-sm text-muted-foreground">
          O módulo PDO é restrito a usuários internos ativos.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl">PDO — Diligências Ostensivas</h1>
            <p className="text-xs text-muted-foreground">
              Registro de abordagens fiscalizatórias em viaturas da Polícia Militar do Estado de São Paulo.
            </p>
          </div>
          <button
            onClick={() => setNovo(true)}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Novo PDO
          </button>
        </div>

        <div className="surface p-3">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por número, VTR ou abordado..."
            className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
          />
        </div>

        <div className="surface divide-y divide-border">
          {filtrados.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">Nenhum PDO registrado.</div>
          )}
          {filtrados.map((p: any) => (
            <div
              key={p.id}
              className="flex items-center gap-2 p-3 text-sm hover:bg-surface-2"
            >
              <button
                onClick={() => setAberto(p.id)}
                className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <div className="tabular text-xs text-muted-foreground">{p.numero}</div>
                  <div className="truncate">
                    {new Date(p.abordagem_em).toLocaleString("pt-BR")} · {p.local}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    VTR {p.vtr_prefixo || "—"}
                    {p.vtr_placa ? ` · ${p.vtr_placa}` : ""}
                    {p.vtr_unidade ? ` · ${p.vtr_unidade}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <DesfechoBadge d={p.desfecho} />
                  {p.procedimento_numero && (
                    <div className="mt-1 text-[10px] text-muted-foreground tabular">
                      → {p.procedimento_numero}
                    </div>
                  )}
                </div>
              </button>
              {canDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExcluir({ id: p.id, numero: p.numero });
                  }}
                  aria-label={`Excluir ${p.numero}`}
                  className="rounded-md p-2 text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {novo && (
        <NovoPdoDialog
          session={session}
          onClose={() => setNovo(false)}
          onCreated={(id) => {
            setNovo(false);
            setAberto(id);
          }}
        />
      )}
      {aberto && (
        <VerPdoDialog
          id={aberto}
          canDelete={canDelete}
          canGenerate={canGenerate}
          onClose={() => setAberto(null)}
          onRequestDelete={(id, numero) => setExcluir({ id, numero })}
        />
      )}
      {excluir && (
        <ConfirmarExclusaoDialog
          id={excluir.id}
          numero={excluir.numero}
          onDone={() => {
            setExcluir(null);
            if (aberto === excluir.id) setAberto(null);
          }}
          onClose={() => setExcluir(null)}
        />
      )}
    </div>
  );
}

function DesfechoBadge({ d }: { d: string }) {
  const map: Record<string, { l: string; cls: string }> = {
    regular: { l: "Regular", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
    sanada: { l: "Sanada", cls: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
    gera_procedimento: {
      l: "Origina procedimento",
      cls: "bg-red-500/10 text-red-400 border-red-500/30",
    },
  };
  const it = map[d] ?? { l: d, cls: "" };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] ${it.cls}`}>{it.l}</span>
  );
}

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className={`surface w-full ${wide ? "max-w-3xl" : "max-w-lg"} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <h3 className="font-serif text-base">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-surface-2">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

function NovoPdoDialog({
  session,
  onClose,
  onCreated,
}: {
  session: any;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createPdo);

  const [abordagem_em, setAbordagem] = useState(() =>
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
  );
  const [local, setLocal] = useState("");
  const [vtr_prefixo, setPrefixo] = useState("");
  const [vtr_placa, setPlaca] = useState("");
  const [vtr_unidade, setUnid] = useState("");

  const [equipe, setEquipe] = useState([
    {
      cargo: CARGO_LABEL[session?.cargo ?? ""] ?? session?.cargo ?? "",
      nome: session?.profile?.nome ?? "",
      matricula: session?.profile?.matricula ?? "",
    },
  ]);
  const corrFn = useServerFn(listCorregedoresPdo);
  const { data: corregedores } = useQuery({
    queryKey: ["pdo-corregedores"],
    queryFn: () => corrFn(),
  });
  const preencheMembro = (i: number, campo: "nome" | "matricula", valor: string) => {
    const achado = (corregedores ?? []).find((c) =>
      campo === "nome"
        ? c.nome.toLowerCase() === valor.trim().toLowerCase()
        : !!c.matricula && c.matricula === valor.trim(),
    );
    setEquipe((eq) =>
      eq.map((x, j) =>
        j !== i
          ? x
          : achado
            ? { cargo: CARGO_LABEL[achado.role] ?? x.cargo, nome: achado.nome, matricula: achado.matricula }
            : { ...x, [campo]: valor },
      ),
    );
  };
  const [abordados, setAbordados] = useState([{ nome: "", matricula: "", cargo: "" }]);
  const [itens, setItens] = useState(
    ITENS.map((i) => ({ chave: i.chave, estado: "conforme" as const, observacao: "" })),
  );
  const [desfecho, setDesfecho] = useState<"regular" | "sanada" | "gera_procedimento">("regular");
  const [relato, setRelato] = useState("");

  const m = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          abordagem_em: new Date(abordagem_em).toISOString(),
          local,
          vtr_prefixo,
          vtr_placa,
          vtr_unidade,
          equipe,
          abordados: abordados.filter((a) => a.nome.trim()),
          itens,
          desfecho,
          relato,
        },
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["pdos"] });
      onCreated(r.id);
    },
  });

  return (
    <Modal title="Novo PDO" onClose={onClose} wide>
      <div className="space-y-4 text-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Data/hora da abordagem">
            <input
              type="datetime-local"
              value={abordagem_em}
              onChange={(e) => setAbordagem(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Local">
            <input value={local} onChange={(e) => setLocal(e.target.value)} className="input" />
          </Field>
        </div>

        <Section title="1. VTR abordada">
          <div className="grid gap-2 md:grid-cols-3">
            <Field label="Prefixo">
              <input value={vtr_prefixo} onChange={(e) => setPrefixo(e.target.value)} className="input" />
            </Field>
            <Field label="Placa">
              <input value={vtr_placa} onChange={(e) => setPlaca(e.target.value)} className="input" />
            </Field>
            <Field label="Unidade de origem">
              <input value={vtr_unidade} onChange={(e) => setUnid(e.target.value)} className="input" />
            </Field>
          </div>
        </Section>

        <Section
          title="2. Equipe corregedora"
          action={
            <button
              type="button"
              onClick={() => setEquipe((e) => [...e, { cargo: "", nome: "", matricula: "" }])}
              className="text-xs text-primary hover:underline"
            >
              + adicionar
            </button>
          }
        >
          <div className="space-y-2">
            <datalist id="pdo-corr-nomes">
              {(corregedores ?? []).map((c) => (
                <option key={c.nome + c.matricula} value={c.nome}>
                  {c.matricula}
                </option>
              ))}
            </datalist>
            <datalist id="pdo-corr-mats">
              {(corregedores ?? []).filter((c) => c.matricula).map((c) => (
                <option key={c.matricula + c.nome} value={c.matricula}>
                  {c.nome}
                </option>
              ))}
            </datalist>
            {equipe.map((m, i) => (
              <div key={i} className="grid gap-2 md:grid-cols-[1fr_1.4fr_1fr_auto]">
                <input
                  value={m.cargo}
                  onChange={(e) => atualiza(setEquipe, i, "cargo", e.target.value)}
                  placeholder="Cargo"
                  className="input"
                />
                <input
                  value={m.nome}
                  list="pdo-corr-nomes"
                  onChange={(e) => preencheMembro(i, "nome", e.target.value)}
                  placeholder="Nome (selecione ou digite)"
                  className="input"
                />
                <input
                  value={m.matricula}
                  list="pdo-corr-mats"
                  onChange={(e) => preencheMembro(i, "matricula", e.target.value)}
                  placeholder="Passaporte / Matrícula"
                  className="input"
                />

                <button
                  type="button"
                  disabled={equipe.length === 1}
                  onClick={() => setEquipe((eq) => eq.filter((_, j) => j !== i))}
                  className="rounded-md border border-border px-2 text-xs text-muted-foreground disabled:opacity-30"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="3. Identificação dos abordados (P1–P4)"
          action={
            abordados.length < 4 ? (
              <button
                type="button"
                onClick={() => setAbordados((a) => [...a, { nome: "", matricula: "", cargo: "" }])}
                className="text-xs text-primary hover:underline"
              >
                + adicionar
              </button>
            ) : null
          }
        >
          <div className="space-y-2">
            {abordados.map((a, i) => (
              <div key={i} className="grid gap-2 md:grid-cols-[auto_1.4fr_1fr_1fr_auto] md:items-center">
                <span className="text-xs text-muted-foreground">P{i + 1}</span>
                <input
                  value={a.nome}
                  onChange={(e) => atualiza(setAbordados, i, "nome", e.target.value)}
                  placeholder="Nome"
                  className="input"
                />
                <input
                  value={a.matricula}
                  onChange={(e) => atualiza(setAbordados, i, "matricula", e.target.value)}
                  placeholder="Matrícula"
                  className="input"
                />
                <input
                  value={a.cargo}
                  onChange={(e) => atualiza(setAbordados, i, "cargo", e.target.value)}
                  placeholder="Cargo"
                  className="input"
                />
                <button
                  type="button"
                  disabled={abordados.length === 1}
                  onClick={() => setAbordados((v) => v.filter((_, j) => j !== i))}
                  className="rounded-md border border-border px-2 text-xs text-muted-foreground disabled:opacity-30"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </Section>

        <Section title="4. Itens verificados">
          <div className="space-y-2">
            {ITENS.map((it, idx) => (
              <div key={it.chave} className="grid gap-2 md:grid-cols-[1fr_180px_2fr] md:items-center">
                <div className="text-sm">{it.label}</div>
                <select
                  value={itens[idx].estado}
                  onChange={(e) =>
                    setItens((v) =>
                      v.map((x, i) => (i === idx ? { ...x, estado: e.target.value as any } : x)),
                    )
                  }
                  className="input"
                >
                  {ESTADOS.map((s) => (
                    <option key={s.v} value={s.v}>
                      {s.l}
                    </option>
                  ))}
                </select>
                <input
                  value={itens[idx].observacao}
                  onChange={(e) =>
                    setItens((v) => v.map((x, i) => (i === idx ? { ...x, observacao: e.target.value } : x)))
                  }
                  placeholder="Observação"
                  className="input"
                />
              </div>
            ))}
          </div>
        </Section>

        <Section title="5. Desfecho">
          <div className="space-y-1">
            {DESFECHOS.map((d) => (
              <label key={d.v} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="desfecho"
                  checked={desfecho === d.v}
                  onChange={() => setDesfecho(d.v)}
                />
                {d.l}
              </label>
            ))}
          </div>
        </Section>

        <Section title="6. Relato / observações">
          <textarea
            value={relato}
            onChange={(e) => setRelato(e.target.value)}
            rows={4}
            className="input"
          />
        </Section>

        {m.error && (
          <p className="text-xs text-destructive">
            {m.error instanceof Error ? m.error.message : "Erro ao salvar."}
          </p>
        )}

        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="text-xs text-muted-foreground">
            Ao salvar, o PDO será datado e assinado digitalmente por{" "}
            <strong>{session?.profile?.nome}</strong> ({CARGO_LABEL[session?.cargo ?? ""] ?? session?.cargo}).
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!local.trim() || m.isPending}
              onClick={() => m.mutate()}
              className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-40"
            >
              {m.isPending ? "Salvando..." : "Salvar PDO"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function atualiza<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, i: number, k: keyof T, v: any) {
  setter((arr) => arr.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
}

function VerPdoDialog({
  id,
  canDelete,
  canGenerate,
  onClose,
  onRequestDelete,
}: {
  id: string;
  canDelete: boolean;
  canGenerate: boolean;
  onClose: () => void;
  onRequestDelete: (id: string, numero: string) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const getFn = useServerFn(getPdo);
  const gerarFn = useServerFn(gerarProcedimentoDoPdo);
  const { data: pdo } = useQuery({ queryKey: ["pdo", id], queryFn: () => getFn({ data: { id } }) });
  const [gerando, setGerando] = useState(false);

  if (!pdo) return null;
  const abordados = Array.isArray(pdo.abordados) ? pdo.abordados : [];
  return (
    <Modal title={pdo.numero} onClose={onClose} wide>
      <div className="space-y-4 text-sm">
        <div className="grid gap-2 md:grid-cols-2">
          <Info k="Data/hora">{new Date(pdo.abordagem_em).toLocaleString("pt-BR")}</Info>
          <Info k="Local">{pdo.local}</Info>
          <Info k="VTR">
            {pdo.vtr_prefixo || "—"}
            {pdo.vtr_placa ? ` · ${pdo.vtr_placa}` : ""}
            {pdo.vtr_unidade ? ` · ${pdo.vtr_unidade}` : ""}
          </Info>
          <Info k="Desfecho">
            <DesfechoBadge d={pdo.desfecho} />
          </Info>
        </div>

        <Section title="Equipe corregedora">
          <ul className="space-y-1 text-sm">
            {(pdo.equipe ?? []).map((m: any, i: number) => (
              <li key={i}>
                {m.cargo && <span className="text-muted-foreground">{m.cargo} · </span>}
                {m.nome}
                {m.matricula && <span className="text-muted-foreground"> · {m.matricula}</span>}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Abordados">
          {abordados.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum abordado registrado.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {abordados.map((a: any, i: number) => (
                <li key={i}>
                  <span className="text-muted-foreground">P{i + 1} · </span>
                  {a.nome}
                  {a.matricula && <span className="text-muted-foreground"> · {a.matricula}</span>}
                  {a.cargo && <span className="text-muted-foreground"> · {a.cargo}</span>}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Itens verificados">
          <ul className="space-y-1 text-sm">
            {(pdo.itens ?? []).map((it: any) => {
              const label = ITENS.find((x) => x.chave === it.chave)?.label ?? it.chave;
              const est = ESTADOS.find((e) => e.v === it.estado)?.l ?? it.estado;
              return (
                <li key={it.chave}>
                  <strong>{label}:</strong> {est}
                  {it.observacao && <span className="text-muted-foreground"> — {it.observacao}</span>}
                </li>
              );
            })}
          </ul>
        </Section>

        {pdo.relato && (
          <Section title="Relato">
            <p className="whitespace-pre-wrap text-sm">{pdo.relato}</p>
          </Section>
        )}

        <div className="rounded-md border border-border bg-surface-2 p-3 text-xs">
          <div>Datado e assinado digitalmente</div>
          <div className="text-muted-foreground">
            {new Date(pdo.assinado_em).toLocaleString("pt-BR")} — {pdo.lavrado_por_nome} (
            {CARGO_LABEL[pdo.lavrado_por_cargo] ?? pdo.lavrado_por_cargo})
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(pdoDiscordText(pdo));
                toast.success("Texto para o Discord copiado.");
              } catch {
                toast.error("Não foi possível copiar.");
              }
            }}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
          >
            Copiar para Discord
          </button>
        </div>

        {pdo.desfecho === "gera_procedimento" && (
          <div className="rounded-md border border-border p-3">
            {pdo.procedimento_numero ? (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span>
                  Procedimento gerado:{" "}
                  <span className="tabular font-medium">{pdo.procedimento_numero}</span>
                </span>
                <button
                  onClick={() => navigate({ to: "/corregedoria", search: { id: pdo.procedimento_id } })}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
                >
                  Abrir <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : canGenerate ? (
              <button
                onClick={() => setGerando(true)}
                className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-opacity hover:opacity-90"
              >
                Gerar procedimento a partir deste PDO
              </button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Somente Corregedor-Geral, SSP ou Corregedor podem gerar o procedimento.
              </p>
            )}
          </div>
        )}

        <div className="flex justify-between border-t border-border pt-3">
          {canDelete ? (
            <button
              onClick={() => onRequestDelete(id, pdo.numero)}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> Excluir PDO
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
          >
            Fechar
          </button>
        </div>

        <style>{`.input{background:var(--input);border:1px solid var(--border);border-radius:6px;padding:.5rem .7rem;font-size:.9rem;color:var(--foreground);width:100%}`}</style>
      </div>

      {gerando && (
        <GerarProcedimentoDialog
          pdoId={id}
          abordados={abordados}
          defaultRelato={pdo.relato ?? ""}
          defaultUnidade={pdo.vtr_unidade ?? ""}
          gerarFn={gerarFn}
          onClose={() => setGerando(false)}
          onSuccess={(denuncia_id, protocolo) => {
            qc.invalidateQueries({ queryKey: ["pdos"] });
            qc.invalidateQueries({ queryKey: ["pdo", id] });
            qc.invalidateQueries({ queryKey: ["denuncias"] });
            setGerando(false);
            toast.success(`Procedimento ${protocolo} gerado.`);
            onClose();
            navigate({ to: "/corregedoria", search: { id: denuncia_id } });
          }}
        />
      )}
    </Modal>
  );
}

function GerarProcedimentoDialog({
  pdoId,
  abordados,
  defaultRelato,
  defaultUnidade,
  gerarFn,
  onClose,
  onSuccess,
}: {
  pdoId: string;
  abordados: any[];
  defaultRelato: string;
  defaultUnidade: string;
  gerarFn: ReturnType<typeof useServerFn<typeof gerarProcedimentoDoPdo>>;
  onClose: () => void;
  onSuccess: (denuncia_id: string, protocolo: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [relato, setRelato] = useState(defaultRelato);
  const [unidade, setUnidade] = useState(defaultUnidade);

  const pool = useMemo(
    () =>
      abordados
        .map((a: any, i: number) => ({ i, ...a }))
        .filter((a: any) => (a.nome ?? "").trim()),
    [abordados],
  );
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter(
      (a: any) =>
        a.nome?.toLowerCase().includes(q) ||
        a.matricula?.toLowerCase().includes(q) ||
        a.cargo?.toLowerCase().includes(q),
    );
  }, [pool, busca]);

  const m = useMutation({
    mutationFn: () =>
      gerarFn({
        data: {
          pdo_id: pdoId,
          relato,
          unidade: unidade || null,
          denunciados: selecionados.map((i) => ({
            nome: abordados[i].nome,
            matricula: abordados[i].matricula ?? "",
            cargo: abordados[i].cargo ?? "",
          })),
        },
      }),
    onSuccess: (r) => onSuccess(r.denuncia_id, r.protocolo),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao gerar procedimento."),
  });

  const toggle = (i: number) =>
    setSelecionados((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));

  return (
    <Modal title="Gerar Procedimento" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            Selecione os policiais denunciados
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-input px-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, matrícula ou cargo..."
              className="w-full bg-transparent py-2 text-sm outline-none"
            />
          </div>

          {selecionados.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selecionados.map((i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-primary"
                >
                  {abordados[i]?.nome}
                  <button
                    onClick={() => toggle(i)}
                    aria-label={`Remover ${abordados[i]?.nome}`}
                    className="hover:opacity-80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="mt-2 max-h-60 overflow-y-auto rounded-md border border-border">
            {filtrados.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">Nenhum policial encontrado.</div>
            ) : (
              filtrados.map((a: any) => {
                const checked = selecionados.includes(a.i);
                return (
                  <button
                    key={a.i}
                    onClick={() => toggle(a.i)}
                    className={`flex w-full items-start gap-2 border-b border-border/50 p-2 text-left text-sm transition-colors last:border-b-0 hover:bg-surface-2 ${
                      checked ? "bg-primary/5" : ""
                    }`}
                  >
                    <input type="checkbox" checked={checked} readOnly className="mt-1" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{a.nome}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {a.cargo || "—"}
                        {a.matricula ? ` · ${a.matricula}` : ""}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <Field label="Unidade">
          <input value={unidade} onChange={(e) => setUnidade(e.target.value)} className="input" />
        </Field>
        <Field label="Relato">
          <textarea value={relato} onChange={(e) => setRelato(e.target.value)} rows={4} className="input" />
        </Field>

        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <button
            onClick={onClose}
            disabled={m.isPending}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
          >
            Cancelar
          </button>
          <button
            disabled={selecionados.length === 0 || !relato.trim() || m.isPending}
            onClick={() => m.mutate()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {m.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {m.isPending ? "Gerando..." : "Confirmar Geração"}
          </button>
        </div>
        <style>{`.input{background:var(--input);border:1px solid var(--border);border-radius:6px;padding:.5rem .7rem;font-size:.9rem;color:var(--foreground);width:100%}`}</style>
      </div>
    </Modal>
  );
}

function ConfirmarExclusaoDialog({
  id,
  numero,
  onDone,
  onClose,
}: {
  id: string;
  numero: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const excluirFn = useServerFn(excluirPdo);
  const m = useMutation({
    mutationFn: () => excluirFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pdos"] });
      toast.success(`${numero} excluído.`);
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao excluir PDO."),
  });
  return (
    <Modal title="Excluir PDO" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p>
          Deseja realmente excluir <strong>{numero}</strong>? Esta ação é irreversível.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={m.isPending}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
          >
            Cancelar
          </button>
          <button
            onClick={() => m.mutate()}
            disabled={m.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {m.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {m.isPending ? "Excluindo..." : "Excluir"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <h4 className="font-serif text-sm">{title}</h4>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
      <style>{`.input{background:var(--input);border:1px solid var(--border);border-radius:6px;padding:.5rem .7rem;font-size:.9rem;color:var(--foreground);width:100%}`}</style>
    </label>
  );
}

function Info({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{k}</div>
      <div>{children}</div>
    </div>
  );
}
