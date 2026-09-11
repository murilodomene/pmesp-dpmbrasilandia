import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { StatusBadge, STATUS_LABEL } from "@/components/StatusBadge";
import { RelogioPrescricao } from "@/components/RelogioPrescricao";
import {
  calcularPrescricao,
  calcularDecursoPrazo,
  type DenunciaStatus,
} from "@/lib/prescricao";
import {
  listDenuncias,
  alterarStatus,
  atualizarObservacoes,
  instaurarOficio,
} from "@/lib/denuncias.functions";
import { getSessionInfo } from "@/lib/usuarios.functions";
import { OPMS } from "@/lib/personnel-options";
import { Plus, Trash2, X, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/painel")({
  component: PainelInterno,
});

// "transito_julgado" NÃO aparece — só é atingido automaticamente.
const STATUS_LIST_MANUAL: DenunciaStatus[] = [
  "novo",
  "aguardando_analise",
  "recebida",
  "em_investigacao",
  "concluso",
  "ag_decurso_prazo",
  "arquivada",
];

type TabKey = "em_andamento" | "ag_decurso" | "transitado" | "arquivado";
const TAB_STATUS: Record<TabKey, DenunciaStatus[]> = {
  em_andamento: ["novo", "recebida", "aguardando_analise", "em_analise", "em_investigacao", "concluso"],
  ag_decurso: ["ag_decurso_prazo"],
  transitado: ["transito_julgado", "concluida"],
  arquivado: ["arquivada"],
};
const TAB_LABEL: Record<TabKey, string> = {
  em_andamento: "Em andamento",
  ag_decurso: "Ag. Decurso do Prazo",
  transitado: "Trânsito em Julgado",
  arquivado: "Arquivados",
};

function PainelInterno() {
  const sessionFn = useServerFn(getSessionInfo);
  const listFn = useServerFn(listDenuncias);
  const { data: session } = useQuery({ queryKey: ["session-info"], queryFn: () => sessionFn() });
  const { data: denuncias } = useQuery({ queryKey: ["denuncias"], queryFn: () => listFn() });

  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<TabKey>("em_andamento");
  const [aberta, setAberta] = useState<string | null>(null);
  const [oficioAberto, setOficioAberto] = useState(false);

  const cargo = session?.cargo ?? null;
  const podeInstaurar =
    cargo === "ssp" || cargo === "corregedor_geral" || cargo === "corregedor" || cargo === "subcorregedor_geral";
    cargo === "cmtg" || cargo === "corregedor_geral" || cargo === "corregedor" || cargo === "subcorregedor_geral";

  if (session && (session.profile?.status !== "ativo" || !session.cargo)) {
    return <RedirectPendente />;
  }

  const contagens = useMemo(() => {
    const acc: Record<TabKey, number> = {
      em_andamento: 0,
      ag_decurso: 0,
      transitado: 0,
      arquivado: 0,
    };
    if (!denuncias) return acc;
    for (const d of denuncias) {
      const s = d.status as DenunciaStatus;
      (Object.keys(TAB_STATUS) as TabKey[]).forEach((k) => {
        if (TAB_STATUS[k].includes(s)) acc[k] += 1;
      });
    }
    return acc;
  }, [denuncias]);

  const lista = useMemo(() => {
    if (!denuncias) return [];
    const q = busca.toLowerCase().trim();
    const statusPermitidos = TAB_STATUS[aba];
    let filtrada = denuncias.filter((d) => statusPermitidos.includes(d.status as DenunciaStatus));
    if (q) {
      filtrada = filtrada.filter((d) => {
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
    }
    if (aba === "em_andamento") {
      // ordenar por prazo prescricional crescente (o que prescreve primeiro no topo)
      filtrada = [...filtrada].sort((a, b) => {
        const pa = calcularPrescricao({
          termo_inicial: a.termo_inicial,
          acrescimos_dias: a.acrescimos_dias,
          status: a.status as DenunciaStatus,
        });
        const pb = calcularPrescricao({
          termo_inicial: b.termo_inicial,
          acrescimos_dias: b.acrescimos_dias,
          status: b.status as DenunciaStatus,
        });
        return pa.diasRestantes - pb.diasRestantes;
      });
    }
    return filtrada;
  }, [denuncias, busca, aba]);

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="eyebrow">Triagem</div>
            <h1 className="mt-1 font-serif text-3xl">Painel Interno</h1>
            <p className="text-sm text-muted-foreground">
              Entrada das denúncias — para conduzir procedimentos, use a{" "}
              <Link to="/corregedoria" className="underline">
                Corregedoria
              </Link>
              .
            </p>
          </div>

          {podeInstaurar ? (
            <button
              onClick={() => setOficioAberto(true)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Instaurar Denúncia de Ofício
            </button>
          ) : (
            <span
              title="Apenas SSP, Corregedor-Geral ou Corregedor podem instaurar de ofício."
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-md bg-muted px-4 py-2.5 text-sm font-semibold text-muted-foreground opacity-60"
              aria-disabled
            >
              <Plus className="h-4 w-4" aria-hidden />
              Instaurar Denúncia de Ofício
            </span>
          )}
        </div>


        <div className="surface mt-6 flex flex-wrap gap-2 p-3">
          <input
            placeholder="Buscar por protocolo, nome, unidade..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="min-w-64 flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm"
          />
        </div>

        <div
          role="tablist"
          className="mt-4 flex flex-wrap gap-1 border-b border-border"
        >
          {(Object.keys(TAB_LABEL) as TabKey[]).map((k) => {
            const active = aba === k;
            return (
              <button
                key={k}
                role="tab"
                aria-selected={active}
                onClick={() => setAba(k)}
                className={`inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition ${
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {TAB_LABEL[k]}
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs tabular">
                  {contagens[k]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 space-y-2">
          {lista.length === 0 && (
            <div className="surface p-8 text-center text-sm text-muted-foreground">
              Nenhum procedimento nesta aba.
            </div>
          )}
          {lista.map((d) => {
            const prescr = calcularPrescricao({
              termo_inicial: d.termo_inicial,
              acrescimos_dias: d.acrescimos_dias,
              status: d.status as DenunciaStatus,
            });
            const decurso =
              aba === "ag_decurso"
                ? calcularDecursoPrazo(d.concluido_em ?? null)
                : null;
            return (
              <button
                key={d.id}
                onClick={() => setAberta(d.id)}
                className={`surface w-full p-4 text-left hover:bg-surface-2 ${prescr.prescrita ? "border-clock-danger" : ""}`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="tabular text-xs text-muted-foreground">{d.numero_protocolo}</span>
                  <StatusBadge status={d.status as DenunciaStatus} />
                  {decurso ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
                      <Clock className="h-3 w-3" />
                      {decurso.vencido
                        ? "Prazo vencido"
                        : decurso.diasRestantes === 1
                          ? "1 dia restante"
                          : `${decurso.diasRestantes} dias restantes`}
                    </span>
                  ) : (
                    <RelogioPrescricao
                      termo_inicial={d.termo_inicial}
                      acrescimos_dias={d.acrescimos_dias}
                      status={d.status as DenunciaStatus}
                    />
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(d.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <div className="mt-2 text-sm">
                  {d.ocorrencia_tipo || "Sem tipo informado"} ·{" "}
                  <span className="text-muted-foreground">
                    {(d.denuncia_policiais ?? []).map((p) => p.nome).join(", ") || "Sem policiais"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

      </div>

      {aberta && <TriagemModal id={aberta} onClose={() => setAberta(null)} />}
      {oficioAberto && podeInstaurar && (
        <OficioModal onClose={() => setOficioAberto(false)} />
      )}

    </div>
  );
}

function TriagemModal({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listDenuncias);
  const alterarFn = useServerFn(alterarStatus);
  const obsFn = useServerFn(atualizarObservacoes);
  const { data: denuncias } = useQuery({ queryKey: ["denuncias"], queryFn: () => listFn() });
  const d = denuncias?.find((x) => x.id === id);

  const [novoStatus, setNovoStatus] = useState<DenunciaStatus | "">("");
  const [motivo, setMotivo] = useState("");
  const [obsPub, setObsPub] = useState("");
  const [obsInt, setObsInt] = useState("");

  const mStatus = useMutation({
    mutationFn: () =>
      alterarFn({
        data: { denuncia_id: id, novo_status: novoStatus as DenunciaStatus, motivo },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["denuncias"] });
      setNovoStatus("");
      setMotivo("");
    },
  });

  const mObs = useMutation({
    mutationFn: () =>
      obsFn({
        data: { denuncia_id: id, obs_denunciante: obsPub || null, obs_internas: obsInt || null },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["denuncias"] }),
  });

  if (!d) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="surface max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="tabular text-xs text-muted-foreground">{d.numero_protocolo}</div>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={d.status as DenunciaStatus} />
              <RelogioPrescricao
                termo_inicial={d.termo_inicial}
                acrescimos_dias={d.acrescimos_dias}
                status={d.status as DenunciaStatus}
              />
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-surface-2">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-2 text-sm">
          <Row k="Tipo" v={d.ocorrencia_tipo} />
          <Row
            k="Policiais"
            v={(d.denuncia_policiais ?? []).map((p) => `${p.nome}${p.unidade ? ` (${p.unidade})` : ""}`).join(", ")}
          />
        </div>

        <section className="mt-6 border-t border-border pt-4">
          <h3 className="font-serif text-lg">Alterar status</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              className="rounded-md border border-border bg-input px-3 py-2 text-sm"
              value={novoStatus}
              onChange={(e) => setNovoStatus(e.target.value as DenunciaStatus)}
            >
              <option value="">Selecionar...</option>
              {STATUS_LIST_MANUAL.map((s) => (
                <option key={s} value={s} disabled={s === d.status}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <input
              className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm"
              placeholder="Motivação (obrigatória)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
            <button
              onClick={() => mStatus.mutate()}
              disabled={!novoStatus || motivo.length < 3 || mStatus.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Aplicar
            </button>
          </div>
        </section>

        <section className="mt-6 border-t border-border pt-4">
          <h3 className="font-serif text-lg">Observações</h3>
          <label className="mt-3 block">
            <span className="text-xs uppercase tracking-wider text-primary">
              Ao denunciante · visível na consulta pública
            </span>
            <textarea
              rows={3}
              className="input mt-1"
              value={obsPub}
              onChange={(e) => setObsPub(e.target.value)}
            />
          </label>
          <label className="mt-3 block">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Internas · restritas à Corregedoria
            </span>
            <textarea
              rows={3}
              className="input mt-1"
              value={obsInt}
              onChange={(e) => setObsInt(e.target.value)}
            />
          </label>
          <button
            onClick={() => mObs.mutate()}
            disabled={mObs.isPending}
            className="mt-3 rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2 disabled:opacity-50"
          >
            Salvar observações
          </button>
        </section>

        <div className="mt-6 border-t border-border pt-4">
          <Link
            to="/corregedoria"
            search={{ id: d.id } as never}
            className="text-sm text-primary hover:underline"
          >
            Abrir na Corregedoria →
          </Link>
        </div>

        <style>{`.input{background:var(--input);border:1px solid var(--border);border-radius:6px;padding:.55rem .7rem;font-size:.9rem;color:var(--foreground);width:100%}`}</style>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{k}</span>
      <span>{v || "—"}</span>
    </div>
  );
}

const UNIDADES = OPMS;

type Envolvido = { nome: string; rg_funcional: string; unidade: string };

function OficioModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const instaurarFn = useServerFn(instaurarOficio);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataOcorrencia, setDataOcorrencia] = useState("");
  const [unidade, setUnidade] = useState("");
  const [envolvidos, setEnvolvidos] = useState<Envolvido[]>([
    { nome: "", rg_funcional: "", unidade: "" },
  ]);
  const [linkInput, setLinkInput] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tituloErr = submitted && titulo.trim().length < 3;
  const descricaoErr = submitted && descricao.trim().length < 20;
  const envolvidosErr =
    submitted && envolvidos.every((e) => e.nome.trim() === "");

  const numeroPreview = `AUTO • ${new Date().getFullYear()}`;

  const mutation = useMutation({
    mutationFn: () =>
      instaurarFn({
        data: {
          titulo: titulo.trim(),
          descricao: descricao.trim(),
          ocorrencia_data: dataOcorrencia || null,
          unidade: unidade
            ? (unidade as (typeof UNIDADES)[number])
            : null,
          envolvidos: envolvidos
            .filter((e) => e.nome.trim())
            .map((e) => ({
              nome: e.nome.trim(),
              rg_funcional: e.rg_funcional.trim() || null,
              unidade: e.unidade
                ? (e.unidade as (typeof UNIDADES)[number])
                : null,
            })),
          links,
        },
      }),
    onSuccess: (res) => {
      toast.success(`Procedimento instaurado com sucesso — ${res.protocolo}`);
      qc.invalidateQueries({ queryKey: ["denuncias"] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Falha ao instaurar.";
      toast.error(msg);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (
      titulo.trim().length < 3 ||
      descricao.trim().length < 20 ||
      envolvidos.every((x) => x.nome.trim() === "")
    ) {
      return;
    }
    mutation.mutate();
  }

  function updateEnv(i: number, patch: Partial<Envolvido>) {
    setEnvolvidos((arr) => arr.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function addEnv() {
    setEnvolvidos((arr) => [...arr, { nome: "", rg_funcional: "", unidade: "" }]);
  }
  function removeEnv(i: number) {
    setEnvolvidos((arr) => (arr.length === 1 ? arr : arr.filter((_, idx) => idx !== i)));
  }

  function addLink() {
    const v = linkInput.trim();
    if (!v) return;
    try {
      new URL(v);
    } catch {
      toast.error("URL inválida.");
      return;
    }
    setLinks((l) => [...l, v]);
    setLinkInput("");
  }

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="oficio-title"
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={handleSubmit}
        className="surface max-h-[92vh] w-full max-w-3xl overflow-y-auto p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow text-primary">Instauração de ofício</div>
            <h2 id="oficio-title" className="mt-1 font-serif text-2xl">
              Nova denúncia de ofício
            </h2>
            <p className="text-xs text-muted-foreground">
              Registro pela própria Corregedoria com base em conhecimento próprio dos fatos.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 hover:bg-surface-2"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Nº do procedimento
            </span>
            <input
              readOnly
              value={numeroPreview}
              className="mt-1 w-full cursor-not-allowed rounded-md border border-border bg-muted/40 px-3 py-2 text-sm tabular text-muted-foreground"
            />
            <span className="mt-1 block text-[10px] text-muted-foreground">
              O protocolo definitivo é gerado ao salvar.
            </span>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Data da ocorrência
            </span>
            <input
              type="date"
              value={dataOcorrencia}
              onChange={(e) => setDataOcorrencia(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Título <span className="text-destructive">*</span>
            </span>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Abordagem irregular em via pública"
              className={`mt-1 w-full rounded-md border bg-input px-3 py-2 text-sm ${
                tituloErr ? "border-destructive" : "border-border"
              }`}
              aria-invalid={tituloErr || undefined}
            />
            {tituloErr && (
              <span className="mt-1 block text-xs text-destructive">Informe um título com pelo menos 3 caracteres.</span>
            )}
          </label>

          <label className="block md:col-span-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Descrição detalhada dos fatos <span className="text-destructive">*</span>
            </span>
            <textarea
              rows={6}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className={`mt-1 w-full rounded-md border bg-input px-3 py-2 text-sm ${
                descricaoErr ? "border-destructive" : "border-border"
              }`}
              aria-invalid={descricaoErr || undefined}
            />
            {descricaoErr && (
              <span className="mt-1 block text-xs text-destructive">Descreva os fatos com pelo menos 20 caracteres.</span>
            )}
          </label>

          <label className="block md:col-span-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Unidade de origem
            </span>
            <select
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
            >
              <option value="">— não informar —</option>
              {UNIDADES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="mt-6 rounded-md border border-border p-3">
          <legend className="px-1 text-xs uppercase tracking-wider text-muted-foreground">
            Envolvidos <span className="text-destructive">*</span>
          </legend>
          <div className="space-y-2">
            {envolvidos.map((env, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_140px_140px_auto]">
                <input
                  placeholder="Nome"
                  value={env.nome}
                  onChange={(e) => updateEnv(i, { nome: e.target.value })}
                  className={`rounded-md border bg-input px-3 py-2 text-sm ${
                    envolvidosErr && !env.nome.trim() ? "border-destructive" : "border-border"
                  }`}
                />
                <input
                  placeholder="RG funcional"
                  value={env.rg_funcional}
                  onChange={(e) => updateEnv(i, { rg_funcional: e.target.value })}
                  className="rounded-md border border-border bg-input px-3 py-2 text-sm"
                />
                <select
                  value={env.unidade}
                  onChange={(e) => updateEnv(i, { unidade: e.target.value })}
                  className="rounded-md border border-border bg-input px-3 py-2 text-sm"
                >
                  <option value="">Unidade</option>
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeEnv(i)}
                  disabled={envolvidos.length === 1}
                  className="rounded-md border border-border px-2 py-2 text-muted-foreground hover:bg-surface-2 disabled:opacity-40"
                  aria-label="Remover envolvido"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addEnv}
            className="mt-3 inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar envolvido
          </button>
          {envolvidosErr && (
            <div className="mt-2 text-xs text-destructive">Informe pelo menos um envolvido.</div>
          )}
        </fieldset>

        <fieldset className="mt-4 rounded-md border border-border p-3">
          <legend className="px-1 text-xs uppercase tracking-wider text-muted-foreground">
            Links de documentos (opcional)
          </legend>
          <div className="flex gap-2">
            <input
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="https://... (PDF, imagem, drive)"
              className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addLink}
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-2"
            >
              Adicionar
            </button>
          </div>
          {links.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {links.map((l, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded bg-surface-2/60 px-2 py-1">
                  <span className="truncate">{l}</span>
                  <button
                    type="button"
                    onClick={() => setLinks((arr) => arr.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remover link"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 disabled:opacity-60"
          >
            {mutation.isPending && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
            )}
            {mutation.isPending ? "Instaurando..." : "Instaurar procedimento"}
          </button>
        </div>
      </form>
    </div>
  );
}

function RedirectPendente() {
  return (

    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-md px-4 py-24 text-center text-sm text-muted-foreground">
        Seu cadastro ainda não foi aprovado.{" "}
        <Link to="/pendente" className="underline">
          Ver status
        </Link>
      </div>
    </div>
  );
}
