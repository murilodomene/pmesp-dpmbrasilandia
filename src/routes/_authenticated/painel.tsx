import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { StatusBadge, STATUS_LABEL } from "@/components/StatusBadge";
import { RelogioPrescricao } from "@/components/RelogioPrescricao";
import { calcularPrescricao, type DenunciaStatus } from "@/lib/prescricao";
import {
  listDenuncias,
  alterarStatus,
  atualizarObservacoes,
  instaurarOficio,
} from "@/lib/denuncias.functions";
import { getSessionInfo } from "@/lib/usuarios.functions";
import { Plus, Trash2, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/painel")({
  component: PainelInterno,
});


const STATUS_LIST: DenunciaStatus[] = [
  "recebida",
  "aguardando_analise",
  "em_analise",
  "em_investigacao",
  "concluida",
  "arquivada",
];

function PainelInterno() {
  const sessionFn = useServerFn(getSessionInfo);
  const listFn = useServerFn(listDenuncias);
  const { data: session } = useQuery({ queryKey: ["session-info"], queryFn: () => sessionFn() });
  const { data: denuncias } = useQuery({ queryKey: ["denuncias"], queryFn: () => listFn() });

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<DenunciaStatus | "">("");
  const [aberta, setAberta] = useState<string | null>(null);

  if (session && (session.profile?.status !== "ativo" || !session.cargo)) {
    return <RedirectPendente />;
  }

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
        </div>

        <div className="surface mt-6 flex flex-wrap gap-2 p-3">
          <input
            placeholder="Buscar por protocolo, nome, unidade..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="min-w-64 flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm"
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

        <div className="mt-4 space-y-2">
          {lista.length === 0 && (
            <div className="surface p-8 text-center text-sm text-muted-foreground">
              Nenhuma denúncia registrada ainda.
            </div>
          )}
          {lista.map((d) => {
            const prescr = calcularPrescricao({
              termo_inicial: d.termo_inicial,
              acrescimos_dias: d.acrescimos_dias,
              status: d.status as DenunciaStatus,
            });
            return (
              <button
                key={d.id}
                onClick={() => setAberta(d.id)}
                className={`surface w-full p-4 text-left hover:bg-surface-2 ${prescr.prescrita ? "border-clock-danger" : ""}`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="tabular text-xs text-muted-foreground">{d.numero_protocolo}</span>
                  <StatusBadge status={d.status as DenunciaStatus} />
                  <RelogioPrescricao
                    termo_inicial={d.termo_inicial}
                    acrescimos_dias={d.acrescimos_dias}
                    status={d.status as DenunciaStatus}
                  />
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
              {STATUS_LIST.map((s) => (
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
