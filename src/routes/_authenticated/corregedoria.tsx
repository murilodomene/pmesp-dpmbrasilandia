import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Header } from "@/components/Header";
import { StatusBadge, STATUS_LABEL } from "@/components/StatusBadge";
import { RelogioPrescricao } from "@/components/RelogioPrescricao";
import { calcularPrescricao, type DenunciaStatus } from "@/lib/prescricao";
import {
  listDenuncias,
  getDenuncia,
  lancarMovimento,
  alterarStatus,
  receberDenuncia,
  prorrogar,
  juntarOitiva,
  desentranharOitiva,
  atualizarObservacoes,
  atualizarUnidade,
} from "@/lib/denuncias.functions";
import { getSessionInfo } from "@/lib/usuarios.functions";
import { Gavel, FileText, Scale, Clock, ExternalLink, X, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/corregedoria")({
  validateSearch: z.object({ id: z.string().uuid().optional() }),
  component: Corregedoria,
});

const STATUS_LIST: DenunciaStatus[] = [
  "recebida",
  "aguardando_analise",
  "em_analise",
  "em_investigacao",
  "concluida",
  "arquivada",
];
const UNIDADES = ["DEIC", "CORREGEPOL", "DECAP", "DHPP", "CERCO", "GARRA", "DENARC", "GER", "SAT"] as const;
const ESPECIES = [
  { v: "despacho", l: "Despacho", icon: FileText },
  { v: "decisao", l: "Decisão", icon: Scale },
  { v: "ipc", l: "IPC", icon: Gavel },
] as const;

function Corregedoria() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const sessionFn = useServerFn(getSessionInfo);
  const listFn = useServerFn(listDenuncias);
  const { data: session } = useQuery({ queryKey: ["session-info"], queryFn: () => sessionFn() });
  const { data: denuncias } = useQuery({ queryKey: ["denuncias"], queryFn: () => listFn() });

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<DenunciaStatus | "">("");
  const [selecionada, setSelecionada] = useState<string | null>(search.id ?? null);

  useEffect(() => {
    if (search.id) setSelecionada(search.id);
  }, [search.id]);

  const isPendente = session && (session.profile?.status !== "ativo" || !session.cargo);

  const lista = useMemo(() => {
    if (!denuncias) return [];
    const q = busca.toLowerCase().trim();
    return denuncias.filter((d) => {
      if (filtro && d.status !== filtro) return false;
      if (!q) return true;
      const alvo = [
        d.numero_protocolo,
        d.denunciante_nome,
        d.unidade,
        ...(d.denuncia_policiais ?? []).map((p) => `${p.nome} ${p.unidade ?? ""}`),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return alvo.includes(q);
    });
  }, [denuncias, busca, filtro]);

  useEffect(() => {
    if (!selecionada && lista.length > 0) setSelecionada(lista[0].id);
  }, [lista, selecionada]);

  if (isPendente) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-md px-4 py-24 text-center text-sm text-muted-foreground">
          Cadastro pendente de aprovação —{" "}
          <Link to="/pendente" className="underline">
            ver status
          </Link>
          .
        </div>
      </div>
    );
  }

  const isDelegado =
    session?.cargo === "delegado_geral" || session?.cargo === "delegado_corregedor";

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-[1400px] px-4 py-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="eyebrow">Autos</div>
            <h1 className="mt-1 font-serif text-3xl">Corregedoria</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{denuncias?.length ?? 0} procedimentos</span>
            {isDelegado && (
              <Link
                to="/usuarios"
                className="ml-2 flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-surface-2"
              >
                <Users className="h-3.5 w-3.5" /> Usuários
              </Link>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          {/* Fila esquerda */}
          <aside className="surface p-3">
            <div className="grid gap-2">
              <input
                placeholder="Buscar..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="rounded-md border border-border bg-input px-3 py-2 text-sm"
              />
              <select
                value={filtro}
                onChange={(e) => setFiltro(e.target.value as DenunciaStatus | "")}
                className="rounded-md border border-border bg-input px-3 py-2 text-sm"
              >
                <option value="">Todos os status</option>
                {STATUS_LIST.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 max-h-[75vh] space-y-1 overflow-y-auto pr-1">
              {lista.length === 0 && (
                <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  Nenhum procedimento na fila.
                </div>
              )}
              {lista.map((d) => {
                const prescr = calcularPrescricao({
                  termo_inicial: d.termo_inicial,
                  acrescimos_dias: d.acrescimos_dias,
                  status: d.status as DenunciaStatus,
                });
                const active = selecionada === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => {
                      setSelecionada(d.id);
                      navigate({ search: { id: d.id } });
                    }}
                    className={`w-full rounded-md border p-3 text-left transition ${
                      active
                        ? "border-primary/60 bg-surface-2"
                        : "border-transparent hover:bg-surface-2"
                    } ${prescr.prescrita ? "border-l-4 border-l-clock-danger" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="tabular text-xs text-muted-foreground">
                        {d.numero_protocolo}
                      </span>
                      <RelogioPrescricao
                        termo_inicial={d.termo_inicial}
                        acrescimos_dias={d.acrescimos_dias}
                        status={d.status as DenunciaStatus}
                      />
                    </div>
                    <div className="mt-1.5 line-clamp-1 text-sm">
                      {d.ocorrencia_tipo || "Sem natureza"}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground line-clamp-1">
                      {(d.denuncia_policiais ?? []).map((p) => p.nome).join(", ") || "—"} ·{" "}
                      {d.unidade || "sem unidade"}
                    </div>
                    <div className="mt-2">
                      <StatusBadge status={d.status as DenunciaStatus} />
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Autuação direita */}
          <section>{selecionada ? <Autuacao id={selecionada} /> : <VazioAutuacao />}</section>
        </div>
      </div>
    </div>
  );
}

function VazioAutuacao() {
  return (
    <div className="surface grid h-full min-h-96 place-items-center p-12 text-center text-sm text-muted-foreground">
      Selecione um procedimento na fila para abrir a autuação.
    </div>
  );
}

function Autuacao({ id }: { id: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getDenuncia);
  const { data, isLoading } = useQuery({
    queryKey: ["denuncia", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const [dialog, setDialog] = useState<
    | { kind: "status" }
    | { kind: "receber" }
    | { kind: "prorrogar" }
    | { kind: "oitiva" }
    | null
  >(null);

  const lancarFn = useServerFn(lancarMovimento);
  const [especie, setEspecie] = useState<"despacho" | "decisao" | "ipc">("despacho");
  const [teor, setTeor] = useState("");

  const obsFn = useServerFn(atualizarObservacoes);
  const [obsPub, setObsPub] = useState<string | null>(null);
  const [obsInt, setObsInt] = useState<string | null>(null);
  useEffect(() => {
    if (data?.denuncia) {
      setObsPub(data.denuncia.obs_denunciante ?? "");
      setObsInt(data.denuncia.obs_internas ?? "");
    }
  }, [data?.denuncia]);

  const unidadeFn = useServerFn(atualizarUnidade);

  const mLancar = useMutation({
    mutationFn: () => lancarFn({ data: { denuncia_id: id, especie, teor } }),
    onSuccess: () => {
      setTeor("");
      qc.invalidateQueries({ queryKey: ["denuncia", id] });
      qc.invalidateQueries({ queryKey: ["denuncias"] });
    },
  });
  const mObs = useMutation({
    mutationFn: () =>
      obsFn({ data: { denuncia_id: id, obs_denunciante: obsPub, obs_internas: obsInt } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["denuncia", id] }),
  });
  const mDesentranhar = useMutation({
    mutationFn: (oitiva_id: string) =>
      useServerFn(desentranharOitiva)({
        data: { oitiva_id, motivo: "Desentranhada por decisão do condutor." },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["denuncia", id] }),
  });

  if (isLoading || !data) {
    return <div className="surface p-8 text-sm text-muted-foreground">Carregando autos...</div>;
  }

  const { denuncia, policiais, movimentos, oitivas } = data;
  const status = denuncia.status as DenunciaStatus;
  const suspenso = status === "concluida" || status === "arquivada";

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="tabular text-xs text-muted-foreground">{denuncia.numero_protocolo}</div>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={status} />
              <span className="text-sm text-muted-foreground">
                {denuncia.ocorrencia_tipo || "Sem natureza"}
              </span>
            </div>
          </div>
          <button
            onClick={() => setDialog({ kind: "status" })}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
          >
            Movimentar status
          </button>
        </div>
      </div>

      {/* Ficha + relógio */}
      <div className="grid gap-4 md:grid-cols-[1fr_260px]">
        <div className="surface p-5">
          <h3 className="font-serif text-lg">Ficha</h3>
          <div className="mt-3 grid gap-2 text-sm">
            <Row k="Denunciante">
              {denuncia.denunciante_anonimo
                ? "Anônimo"
                : denuncia.denunciante_nome || "Não informado"}
            </Row>
            <Row k="Policiais">
              {policiais.map((p) => (
                <span key={p.id} className="mr-3">
                  {p.nome}
                  {p.rg_funcional && <span className="text-muted-foreground"> · {p.rg_funcional}</span>}
                  {p.unidade && <span className="text-muted-foreground"> · {p.unidade}</span>}
                </span>
              ))}
            </Row>
            <Row k="Unidade">
              <select
                value={denuncia.unidade ?? ""}
                onChange={(e) =>
                  unidadeFn({ data: { denuncia_id: id, unidade: e.target.value as typeof UNIDADES[number] } }).then(
                    () => qc.invalidateQueries({ queryKey: ["denuncia", id] }),
                  )
                }
                className="rounded-md border border-border bg-input px-2 py-1 text-sm"
              >
                <option value="">Selecionar...</option>
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </Row>
            <Row k="Ocorrência">
              {denuncia.ocorrencia_data
                ? new Date(denuncia.ocorrencia_data).toLocaleDateString("pt-BR")
                : "—"}{" "}
              {denuncia.ocorrencia_hora ?? ""}
              {denuncia.ocorrencia_local && (
                <span className="text-muted-foreground"> · {denuncia.ocorrencia_local}</span>
              )}
            </Row>
            <Row k="Instaurada">
              {denuncia.instaurada_em
                ? new Date(denuncia.instaurada_em).toLocaleDateString("pt-BR")
                : "Não instaurada"}
            </Row>
            <Row k="Termo inicial">
              <span className="tabular">
                {new Date(denuncia.termo_inicial).toLocaleDateString("pt-BR")}
              </span>
            </Row>
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Relato</div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{denuncia.relato}</p>
          </div>

          {(denuncia.links as string[]).length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Links</div>
              <ul className="mt-2 space-y-1 text-sm">
                {(denuncia.links as string[]).map((l, i) => (
                  <li key={i}>
                    <a
                      href={l}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <RelogioPrescricao
            termo_inicial={denuncia.termo_inicial}
            acrescimos_dias={denuncia.acrescimos_dias}
            status={status}
            interrupcoes_count={denuncia.interrupcoes_count}
            variant="block"
          />
          <button
            onClick={() => setDialog({ kind: "receber" })}
            disabled={suspenso}
            className="w-full rounded-md border border-border px-3 py-2 text-xs hover:bg-surface-2 disabled:opacity-40"
          >
            <Clock className="mr-1 inline h-3.5 w-3.5" /> Despacho de recebimento
            <div className="text-[10px] text-muted-foreground">interrompe a prescrição</div>
          </button>
          <button
            onClick={() => setDialog({ kind: "prorrogar" })}
            disabled={suspenso}
            className="w-full rounded-md border border-border px-3 py-2 text-xs hover:bg-surface-2 disabled:opacity-40"
          >
            Prorrogar (+30 dias)
            <div className="text-[10px] text-muted-foreground">remarcação de oitiva</div>
          </button>
        </div>
      </div>

      {/* Oitivas */}
      <div className="surface p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg">Oitivas juntadas</h3>
          <button
            onClick={() => setDialog({ kind: "oitiva" })}
            className="rounded-md border border-border px-3 py-1 text-xs hover:bg-surface-2"
          >
            Juntar oitiva
          </button>
        </div>
        <ul className="mt-3 space-y-1 text-sm">
          {oitivas.length === 0 && (
            <li className="text-xs text-muted-foreground">Nenhuma oitiva juntada.</li>
          )}
          {oitivas.map((o) => (
            <li
              key={o.id}
              className={`flex items-center justify-between gap-2 rounded-md border border-border/60 p-2 ${
                !o.ativa ? "opacity-50" : ""
              }`}
            >
              <div>
                <div className="font-medium">{o.identificacao}</div>
                <div className="text-xs text-muted-foreground">
                  {o.data ? new Date(o.data).toLocaleDateString("pt-BR") : "sem data"}
                  {!o.ativa && " · desentranhada"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={o.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Abrir
                </a>
                {o.ativa && (
                  <button
                    onClick={() => mDesentranhar.mutate(o.id)}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Desentranhar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Formulário de ato */}
      <div className="surface p-5">
        <h3 className="font-serif text-lg">Lançar ato</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {ESPECIES.map((e) => (
            <button
              key={e.v}
              type="button"
              onClick={() => setEspecie(e.v)}
              className={`flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs ${
                especie === e.v ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-surface-2"
              }`}
            >
              <e.icon className="h-3.5 w-3.5" /> {e.l}
            </button>
          ))}
        </div>
        <textarea
          rows={5}
          className="input mt-3"
          placeholder="Teor do ato..."
          value={teor}
          onChange={(e) => setTeor(e.target.value)}
        />
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => mLancar.mutate()}
            disabled={teor.trim().length < 3 || mLancar.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {mLancar.isPending ? "Lançando..." : "Lançar"}
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="surface p-5">
        <h3 className="font-serif text-lg">Linha do tempo</h3>
        <ul className="mt-4 space-y-3">
          {movimentos.length === 0 && (
            <li className="text-xs text-muted-foreground">Nenhum movimento ainda.</li>
          )}
          {movimentos.map((m) => (
            <li key={m.id} className="flex gap-3">
              <MovMarker especie={m.especie as string} />
              <div className="flex-1 rounded-md border border-border/60 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium uppercase tracking-wider">
                    {labelEspecie(m.especie as string)}
                  </span>
                  {m.interrompe && (
                    <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-destructive-foreground">
                      Interrompe
                    </span>
                  )}
                  {m.prorroga && (
                    <span className="rounded-full bg-primary/20 px-2 py-0.5 text-primary">
                      +30 dias
                    </span>
                  )}
                  <span className="ml-auto text-muted-foreground tabular">
                    {new Date(m.criado_em).toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{m.teor}</p>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {m.prolator_nome} · {cargoLabel(m.prolator_cargo as string)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Observações */}
      <div className="surface p-5">
        <h3 className="font-serif text-lg">Observações</h3>
        <label className="mt-3 block">
          <span className="text-xs uppercase tracking-wider text-primary">
            Ao denunciante · visível na consulta pública
          </span>
          <textarea
            rows={3}
            value={obsPub ?? ""}
            onChange={(e) => setObsPub(e.target.value)}
            className="input mt-1"
          />
        </label>
        <label className="mt-3 block">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Internas · restritas à Corregedoria
          </span>
          <textarea
            rows={3}
            value={obsInt ?? ""}
            onChange={(e) => setObsInt(e.target.value)}
            className="input mt-1"
          />
        </label>
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => mObs.mutate()}
            disabled={mObs.isPending}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2 disabled:opacity-50"
          >
            Salvar observações
          </button>
        </div>
      </div>

      {dialog?.kind === "status" && (
        <StatusDialog id={id} statusAtual={status} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "receber" && <ReceberDialog id={id} onClose={() => setDialog(null)} />}
      {dialog?.kind === "prorrogar" && <ProrrogarDialog id={id} onClose={() => setDialog(null)} />}
      {dialog?.kind === "oitiva" && <OitivaDialog id={id} onClose={() => setDialog(null)} />}

      <style>{`.input{background:var(--input);border:1px solid var(--border);border-radius:6px;padding:.55rem .7rem;font-size:.9rem;color:var(--foreground);width:100%}`}</style>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-start gap-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{k}</span>
      <div>{children}</div>
    </div>
  );
}

function labelEspecie(e: string): string {
  return e === "despacho" ? "Despacho" : e === "decisao" ? "Decisão" : e === "ipc" ? "IPC" : "Status";
}
function cargoLabel(c: string): string {
  return c === "delegado_geral"
    ? "Delegado Geral"
    : c === "delegado_corregedor"
      ? "Delegado Corregedor"
      : "Corregedor";
}

function MovMarker({ especie }: { especie: string }) {
  const style: Record<string, string> = {
    despacho: "bg-status-analise text-status-analise-fg",
    decisao: "bg-destructive text-destructive-foreground",
    ipc: "bg-status-investigacao text-status-investigacao-fg",
    status: "bg-status-aguardando text-status-aguardando-fg",
  };
  const Icon = especie === "decisao" ? Scale : especie === "ipc" ? Gavel : FileText;
  return (
    <div className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-full ${style[especie]}`}>
      <Icon className="h-4 w-4" />
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="surface w-full max-w-lg p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-serif text-lg">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-surface-2">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
      <style>{`.input{background:var(--input);border:1px solid var(--border);border-radius:6px;padding:.55rem .7rem;font-size:.9rem;color:var(--foreground);width:100%}`}</style>
    </div>
  );
}

function StatusDialog({
  id,
  statusAtual,
  onClose,
}: {
  id: string;
  statusAtual: DenunciaStatus;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const fn = useServerFn(alterarStatus);
  const [novoStatus, setNovoStatus] = useState<DenunciaStatus | "">("");
  const [motivo, setMotivo] = useState("");
  const m = useMutation({
    mutationFn: () =>
      fn({ data: { denuncia_id: id, novo_status: novoStatus as DenunciaStatus, motivo } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["denuncia", id] });
      qc.invalidateQueries({ queryKey: ["denuncias"] });
      onClose();
    },
  });
  return (
    <Modal title="Movimentar status" onClose={onClose}>
      <label className="grid gap-1.5">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Novo status</span>
        <select
          value={novoStatus}
          onChange={(e) => setNovoStatus(e.target.value as DenunciaStatus)}
          className="input"
        >
          <option value="">Selecionar...</option>
          {STATUS_LIST.map((s) => (
            <option key={s} value={s} disabled={s === statusAtual}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 grid gap-1.5">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Motivação (obrigatória)
        </span>
        <textarea rows={3} className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">
          Cancelar
        </button>
        <button
          onClick={() => m.mutate()}
          disabled={!novoStatus || motivo.length < 3 || m.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Aplicar
        </button>
      </div>
    </Modal>
  );
}

function ReceberDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const fn = useServerFn(receberDenuncia);
  const [teor, setTeor] = useState("Despacho de recebimento da denúncia.");
  const m = useMutation({
    mutationFn: () => fn({ data: { denuncia_id: id, teor } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["denuncia", id] });
      qc.invalidateQueries({ queryKey: ["denuncias"] });
      onClose();
    },
  });
  return (
    <Modal title="Despacho de recebimento" onClose={onClose}>
      <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">
        Esta ação <strong>interrompe</strong> a prescrição: o prazo reinicia do zero (15 dias) e os
        acréscimos anteriores são descartados.
      </div>
      <textarea rows={4} className="input" value={teor} onChange={(e) => setTeor(e.target.value)} />
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">
          Cancelar
        </button>
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Confirmar recebimento
        </button>
      </div>
    </Modal>
  );
}

function ProrrogarDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const fn = useServerFn(prorrogar);
  const [j, setJ] = useState("");
  const m = useMutation({
    mutationFn: () => fn({ data: { denuncia_id: id, justificativa: j } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["denuncia", id] });
      qc.invalidateQueries({ queryKey: ["denuncias"] });
      onClose();
    },
  });
  return (
    <Modal title="Prorrogar prazo em 30 dias" onClose={onClose}>
      <div className="mb-3 text-xs text-muted-foreground">
        Aplicável somente por remarcação de oitiva a pedido do denunciante.
      </div>
      <textarea
        rows={4}
        className="input"
        placeholder="Justificativa (mín. 10 caracteres)"
        value={j}
        onChange={(e) => setJ(e.target.value)}
      />
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">
          Cancelar
        </button>
        <button
          onClick={() => m.mutate()}
          disabled={j.length < 10 || m.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Prorrogar (+30 dias)
        </button>
      </div>
    </Modal>
  );
}

function OitivaDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const fn = useServerFn(juntarOitiva);
  const [ident, setIdent] = useState("");
  const [url, setUrl] = useState("");
  const [dataO, setDataO] = useState("");
  const m = useMutation({
    mutationFn: () =>
      fn({ data: { denuncia_id: id, identificacao: ident, url, data: dataO || null } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["denuncia", id] });
      onClose();
    },
  });
  return (
    <Modal title="Juntar oitiva" onClose={onClose}>
      <label className="grid gap-1.5">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Identificação</span>
        <input className="input" value={ident} onChange={(e) => setIdent(e.target.value)} />
      </label>
      <label className="mt-3 grid gap-1.5">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          URL da gravação
        </span>
        <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
      </label>
      <label className="mt-3 grid gap-1.5">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Data</span>
        <input type="date" className="input" value={dataO} onChange={(e) => setDataO(e.target.value)} />
      </label>
      {m.isError && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive-foreground">
          URL inválida ou dados incompletos.
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">
          Cancelar
        </button>
        <button
          onClick={() => m.mutate()}
          disabled={ident.length < 2 || !url || m.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Juntar
        </button>
      </div>
    </Modal>
  );
}
