import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Header } from "@/components/Header";
import { StatusBadge, STATUS_LABEL } from "@/components/StatusBadge";
import { RelogioPrescricao } from "@/components/RelogioPrescricao";
import {
  calcularPrescricao,
  calcularDecursoPrazo,
  isEncerrado,
  type DenunciaStatus,
} from "@/lib/prescricao";
import {
  listDenuncias,
  getDenuncia,
  lancarMovimento,
  alterarStatus,
  prorrogar,
  juntarOitiva,
  desentranharOitiva,
  atualizarObservacoes,
  atualizarNatureza,
  
  retificarDenunciado,
  lavrarPortaria,
  alternarPublicacaoIpc,
  listMembrosMp,
  listAcessosMp,
  concederAcessoMp,
  revogarAcessoMp,
  excluirDenuncia,
  cancelarMovimento,
  registrarRecurso,
} from "@/lib/denuncias.functions";



import { getSessionInfo } from "@/lib/usuarios.functions";
import { Gavel, FileText, Scale, ExternalLink, X, Users, Pencil, Stamp, Eye, Trash2, Download, ShieldCheck, Bell } from "lucide-react";
import { DocumentTemplate, exportDocumentToPdf, useDocumentRef } from "@/components/DocumentTemplate";
import { RichTextEditor, isHtmlAto, sanitizeAtoHtml } from "@/components/RichTextEditor";
import { exportProcessoCompleto } from "@/lib/exportProcesso";
import { AtoAnexosUploader, type AtoAnexo } from "@/components/AtoAnexosUploader";
import { AtoAnexosLinks } from "@/components/AtoAnexosLinks";
import { IntimarDialog } from "@/components/IntimarDialog";
import { TarjasManager, TarjasStrip, type CorTarja } from "@/components/Tarja";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/corregedoria")({
  validateSearch: z.object({ id: z.string().uuid().optional() }),
  component: Corregedoria,
});

const STATUS_LIST: DenunciaStatus[] = [
  "novo",
  "aguardando_analise",
  "recebida",
  "em_analise",
  "em_investigacao",
  "ag_decurso_prazo",
  "transito_julgado",
  "arquivada",
];
// Opções selecionáveis manualmente em "Movimentar status".
// "Trânsito em Julgado" NÃO aparece — só é atingido automaticamente pelo decurso.
const STATUS_LIST_MANUAL: DenunciaStatus[] = [
  "novo",
  "aguardando_analise",
  "recebida",
  "em_investigacao",
  "ag_decurso_prazo",
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
  const [abaAtiva, setAbaAtiva] = useState<"tramitacao" | "decurso" | "concluidos">("tramitacao");

  useEffect(() => {
    if (search.id) setSelecionada(search.id);
  }, [search.id]);

  const isPendente = session && (session.profile?.status !== "ativo" || !session.cargo);

  const listaFiltrada = useMemo(() => {
    if (!denuncias) return [];
    const q = busca.toLowerCase().trim();
    return denuncias.filter((d) => {
      if (filtro && d.status !== filtro) return false;
      if (!q) return true;
      const alvo = [
        d.numero_protocolo,
        d.denunciante_nome,
        d.unidade,
        d.ocorrencia_tipo,
        ...(d.denuncia_policiais ?? []).map((p) => `${p.nome} ${p.unidade ?? ""}`),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return alvo.includes(q);
    });
  }, [denuncias, busca, filtro]);

  const grupos = useMemo(() => {
    const tramitacao: DenunciaStatus[] = ["novo", "recebida", "aguardando_analise", "em_analise", "em_investigacao"];
    const decurso: DenunciaStatus[] = ["ag_decurso_prazo"];
    const concluidos: DenunciaStatus[] = ["transito_julgado", "arquivada"];
    const tram = listaFiltrada
      .filter((d) => tramitacao.includes(d.status as DenunciaStatus))
      .slice()
      .sort((a, b) => {
        const pa = calcularPrescricao({ termo_inicial: a.termo_inicial, acrescimos_dias: a.acrescimos_dias, status: a.status as DenunciaStatus });
        const pb = calcularPrescricao({ termo_inicial: b.termo_inicial, acrescimos_dias: b.acrescimos_dias, status: b.status as DenunciaStatus });
        return pa.diasRestantes - pb.diasRestantes;
      });
    return {
      tramitacao: tram,
      decurso: listaFiltrada.filter((d) => decurso.includes(d.status as DenunciaStatus)),
      concluidos: listaFiltrada.filter((d) => concluidos.includes(d.status as DenunciaStatus)),
    };
  }, [listaFiltrada]);

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

  const carregando = !denuncias;

  function onSelect(idSel: string) {
    setSelecionada(idSel);
    navigate({ search: { id: idSel } });
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    }
  }

  function onVoltar() {
    setSelecionada(null);
    navigate({ search: {} });
  }

  const abas: { key: "tramitacao" | "decurso" | "concluidos"; label: string; itens: ItemKanban[]; vazio: string; modo: "prescricao" | "decurso" | "suspenso" }[] = [
    { key: "tramitacao", label: "Em Tramitação", itens: grupos.tramitacao, vazio: "Nada em tramitação.", modo: "prescricao" },
    { key: "decurso", label: "Ag. Decurso do Prazo", itens: grupos.decurso, vazio: "Nenhum procedimento aguardando decurso.", modo: "decurso" },
    { key: "concluidos", label: "Concluídas", itens: grupos.concluidos, vazio: "Nenhum procedimento concluído.", modo: "suspenso" },
  ];
  const abaCorrente = abas.find((a) => a.key === abaAtiva)!;

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-[1400px] px-4 py-6">
        {selecionada ? (
          <>
            <div className="mb-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onVoltar}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
              >
                ← Voltar
              </button>
              {isDelegado && (
                <Link
                  to="/usuarios"
                  className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-surface-2"
                >
                  <Users className="h-3.5 w-3.5" /> Usuários
                </Link>
              )}
            </div>
            <Autuacao id={selecionada} cargo={session?.cargo ?? null} onDeleted={onVoltar} />
          </>
        ) : (
          <>
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

            {/* Busca e filtros rápidos */}
            <div className="surface mb-4 flex flex-wrap items-center gap-2 p-3">
              <input
                placeholder="Buscar por protocolo, denunciante, policial, natureza..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="min-w-[220px] flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap gap-1">
                <FiltroChip label="Todos" ativo={filtro === ""} onClick={() => setFiltro("")} />
                {STATUS_LIST.map((s) => (
                  <FiltroChip
                    key={s}
                    label={STATUS_LABEL[s]}
                    ativo={filtro === s}
                    onClick={() => setFiltro(filtro === s ? "" : s)}
                  />
                ))}
              </div>
            </div>

            {/* Abas */}
            <div className="mb-3 flex flex-wrap items-center gap-1 border-b border-border">
              {abas.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setAbaAtiva(a.key)}
                  className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm transition ${
                    abaAtiva === a.key
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {a.label}
                  <span className="tabular rounded-full bg-surface-2 px-2 py-0.5 text-[11px]">
                    {a.itens.length}
                  </span>
                </button>
              ))}
            </div>

            <ListaProcessos
              itens={abaCorrente.itens}
              carregando={carregando}
              vazioLabel={abaCorrente.vazio}
              modo={abaCorrente.modo}
              onSelect={onSelect}
            />
          </>
        )}
      </div>
    </div>
  );
}

function FiltroChip({ label, ativo, onClick }: { label: string; ativo: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs transition ${
        ativo
          ? "border-primary/60 bg-primary/15 text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-surface-2"
      }`}
    >
      {label}
    </button>
  );
}

interface ItemKanban {
  id: string;
  numero_protocolo: string;
  status: string;
  ocorrencia_tipo: string | null;
  unidade: string | null;
  termo_inicial: string;
  acrescimos_dias: number;
  concluido_em?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  denuncia_policiais?: { nome: string; unidade: string | null }[] | null;
  denuncia_tarjas?: { id: string; cor: string; texto: string }[] | null;
}



function ListaProcessos({
  itens,
  carregando,
  vazioLabel,
  modo,
  onSelect,
}: {
  itens: ItemKanban[];
  carregando: boolean;
  vazioLabel: string;
  modo: "prescricao" | "decurso" | "suspenso";
  onSelect: (id: string) => void;
}) {
  if (carregando) {
    return (
      <div className="surface overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse border-b border-border/60 p-3 last:border-0">
            <div className="h-4 w-full rounded bg-surface-2" />
          </div>
        ))}
      </div>
    );
  }
  if (itens.length === 0) {
    return (
      <div className="surface grid place-items-center p-16 text-center text-sm text-muted-foreground">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-full border border-border text-lg opacity-70">∅</div>
        {vazioLabel}
      </div>
    );
  }
  return (
    <div className="surface overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-surface-2/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Número</th>
            <th className="px-3 py-2 font-medium">Natureza</th>
            <th className="px-3 py-2 font-medium">Denunciado · Unidade</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 text-right font-medium">Prazo</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((d) => (
            <LinhaProcesso key={d.id} d={d} modo={modo} onSelect={onSelect} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LinhaProcesso({
  d,
  modo,
  onSelect,
}: {
  d: ItemKanban;
  modo: "prescricao" | "decurso" | "suspenso";
  onSelect: (id: string) => void;
}) {
  const prescr = calcularPrescricao({
    termo_inicial: d.termo_inicial,
    acrescimos_dias: d.acrescimos_dias,
    status: d.status as DenunciaStatus,
  });
  const decurso = modo === "decurso" ? calcularDecursoPrazo(d.concluido_em ?? null) : null;
  const denunciados = (d.denuncia_policiais ?? []).map((p) => p.nome).join(", ") || "—";

  let prazoCell: React.ReactNode = <span className="text-muted-foreground">—</span>;
  if (modo === "prescricao") {
    const cls = prescr.prescrita
      ? "text-clock-danger"
      : prescr.nivel === "danger"
        ? "text-clock-danger"
        : prescr.nivel === "warn"
          ? "text-clock-warn"
          : "text-clock-safe";
    prazoCell = (
      <span className={`tabular ${cls}`}>
        {prescr.prescrita
          ? `Prescrita há ${Math.abs(prescr.diasRestantes)}d`
          : `${prescr.diasRestantes}d`}
      </span>
    );
  } else if (modo === "decurso" && decurso) {
    prazoCell = (
      <span className={`tabular ${decurso.vencido ? "text-clock-danger" : "text-clock-warn"}`}>
        {decurso.vencido ? "Prazo vencido" : `${decurso.diasRestantes}d`}
      </span>
    );
  } else if (modo === "suspenso") {
    prazoCell = <span className="text-xs text-muted-foreground">Relógio suspenso</span>;
  }

  return (
    <tr
      onClick={() => onSelect(d.id)}
      className="relative cursor-pointer border-b border-border/60 transition hover:bg-surface-2 last:border-0"
    >
      <td className="relative px-3 py-2.5 tabular text-xs text-muted-foreground whitespace-nowrap">
        <TarjasStrip tarjas={(d.denuncia_tarjas ?? []) as { id: string; cor: CorTarja; texto: string }[]} />
        {d.numero_protocolo}

      </td>
      <td className="px-3 py-2.5">
        <div className="line-clamp-1 font-medium">{d.ocorrencia_tipo || "Sem natureza"}</div>
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">
        <div className="line-clamp-1">{denunciados} · {d.unidade || "sem unidade"}</div>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <StatusBadge status={d.status as DenunciaStatus} />
      </td>
      <td className="px-3 py-2.5 text-right whitespace-nowrap">{prazoCell}</td>
    </tr>
  );
}







function Autuacao({ id, cargo, onDeleted }: { id: string; cargo: string | null; onDeleted?: () => void }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getDenuncia);
  const { data, isLoading } = useQuery({
    queryKey: ["denuncia", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const podeRetificar = cargo === "delegado_geral" || cargo === "delegado_corregedor";

  const podeExcluir = cargo === "delegado_geral" || cargo === "delegado_corregedor";

  const [dialog, setDialog] = useState<
    | { kind: "status" }
    | { kind: "portaria" }
    | {
        kind: "verAto";
        especie: "despacho" | "decisao" | "portaria";
        teor: string;
        quando: string;
        prolator: string;
        cargo: string;
      }
    | { kind: "prorrogar" }
    | { kind: "oitiva" }
    | { kind: "retificar"; policial: { id: string; nome: string; rg_funcional: string | null; unidade: string | null } }
    | { kind: "excluir" }
    | { kind: "cancelarMov"; movimento_id: string; resumo: string }
    | { kind: "recurso" }
    | { kind: "intimar" }
    | null
  >(null);


  const lancarFn = useServerFn(lancarMovimento);
  const [especie, setEspecie] = useState<"despacho" | "decisao" | "ipc" | null>(null);
  const [teor, setTeor] = useState("");
  const [ipcUnidade, setIpcUnidade] = useState<string>("");
  const [ipcIdent, setIpcIdent] = useState<string>("");
  const [anexos, setAnexos] = useState<AtoAnexo[]>([]);

  const obsFn = useServerFn(atualizarObservacoes);
  const [obsPub, setObsPub] = useState<string | null>(null);
  const [obsInt, setObsInt] = useState<string | null>(null);
  useEffect(() => {
    if (data?.denuncia) {
      setObsPub(data.denuncia.obs_denunciante ?? "");
      setObsInt(data.denuncia.obs_internas ?? "");
    }
  }, [data?.denuncia]);

  

  const mLancar = useMutation({
    mutationFn: () => {
      if (!especie) throw new Error("Selecione uma espécie.");
      let teorFinal: string;
      if (especie === "ipc") {
        teorFinal = montarTeorIpc({
          unidade: ipcUnidade || null,
          protocolo: data?.denuncia.numero_protocolo ?? "",
          identificacao: ipcIdent.trim(),
          relato: sanitizeAtoHtml(teor),
        });
      } else {
        teorFinal = sanitizeAtoHtml(teor);
      }
      const anexosPayload =
        especie === "despacho" || especie === "decisao" ? anexos : [];
      return lancarFn({
        data: { denuncia_id: id, especie, teor: teorFinal, anexos: anexosPayload },
      });
    },
    onSuccess: () => {
      setTeor("");
      setAnexos([]);
      setEspecie(null);
      qc.invalidateQueries({ queryKey: ["denuncia", id] });
      qc.invalidateQueries({ queryKey: ["denuncias"] });
    },
  });
  const mObs = useMutation({
    mutationFn: () =>
      obsFn({ data: { denuncia_id: id, obs_denunciante: obsPub, obs_internas: obsInt } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["denuncia", id] }),
  });
  const desentranharFn = useServerFn(desentranharOitiva);
  const mDesentranhar = useMutation({
    mutationFn: (oitiva_id: string) =>
      desentranharFn({
        data: { oitiva_id, motivo: "Desentranhada por decisão do condutor." },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["denuncia", id] }),
  });

  const publicarFn = useServerFn(alternarPublicacaoIpc);
  const mPublicar = useMutation({
    mutationFn: (args: { id: string; publicado: boolean }) =>
      publicarFn({ data: { movimento_id: args.id, publicado: args.publicado } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["denuncia", id] }),
  });
  const excluirFn = useServerFn(excluirDenuncia);
  const mExcluir = useMutation({
    mutationFn: (protocolo: string) => excluirFn({ data: { id, confirmar_protocolo: protocolo } }),
    onSuccess: () => {
      setDialog(null);
      qc.invalidateQueries({ queryKey: ["denuncias"] });
      qc.removeQueries({ queryKey: ["denuncia", id] });
      onDeleted?.();
    },
  });

  if (isLoading || !data) {
    return <div className="surface p-8 text-sm text-muted-foreground">Carregando autos...</div>;
  }

  const { denuncia, policiais, movimentos, oitivas } = data;
  const status = denuncia.status as DenunciaStatus;
  const suspenso = isEncerrado(status);
  const decurso =
    status === "ag_decurso_prazo" ? calcularDecursoPrazo(denuncia.concluido_em ?? null) : null;
  const podeRegistrarRecurso =
    status === "ag_decurso_prazo" &&
    !denuncia.certidao_gerada &&
    (cargo === "delegado_geral" || cargo === "delegado_corregedor" || cargo === "corregedor");

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="tabular text-xs text-muted-foreground">{denuncia.numero_protocolo}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusBadge status={status} />
              <NaturezaInline
                denunciaId={denuncia.id}
                valor={denuncia.ocorrencia_tipo ?? null}
                podeEditar={cargo === "delegado_geral" || cargo === "delegado_corregedor"}
              />

              {decurso && (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
                  {decurso.vencido
                    ? "Prazo de recurso vencido"
                    : `Recurso: ${decurso.diasRestantes === 1 ? "1 dia restante" : `${decurso.diasRestantes} dias restantes`}`}
                </span>
              )}
            </div>
            <div className="mt-2">
              <TarjasManager
                denunciaId={denuncia.id}
                tarjas={((data.tarjas ?? []) as { id: string; cor: string; texto: string }[]).map((t) => ({
                  id: t.id,
                  cor: t.cor as CorTarja,
                  texto: t.texto,
                }))}
                podeEditar={cargo === "delegado_corregedor" || cargo === "corregedor"}
              />
            </div>

          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDialog({ kind: "status" })}
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
            >
              Movimentar status
            </button>
            {(cargo === "delegado_geral" || cargo === "delegado_corregedor" || cargo === "corregedor") && (
              <button
                onClick={() => setDialog({ kind: "intimar" })}
                title="Intimar usuário interno"
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
              >
                <Bell className="h-3.5 w-3.5" /> Intimar
              </button>
            )}
            {podeRegistrarRecurso && (
              <button
                onClick={() => setDialog({ kind: "recurso" })}
                title="Certificar e juntar recurso administrativo aos autos"
                className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/20"
              >
                Registrar recurso
              </button>
            )}
            {(cargo === "delegado_geral" || cargo === "delegado_corregedor") && (
              <ExportarProcessoBtn
                denuncia={denuncia}
                policiais={policiais}
                movimentos={movimentos as never}
              />
            )}
            {podeExcluir && (
              <button
                onClick={() => setDialog({ kind: "excluir" })}
                title="Excluir procedimento definitivamente"
                className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </button>
            )}
          </div>
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
              <div className="flex flex-col gap-1">
                {policiais.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span>
                      {p.nome}
                      {p.rg_funcional && <span className="text-muted-foreground"> · {p.rg_funcional}</span>}
                      {p.unidade && <span className="text-muted-foreground"> · {p.unidade}</span>}
                    </span>
                    {podeRetificar && (
                      <button
                        type="button"
                        title="Retificar denunciado"
                        aria-label={`Retificar ${p.nome}`}
                        onClick={() =>
                          setDialog({
                            kind: "retificar",
                            policial: {
                              id: p.id,
                              nome: p.nome,
                              rg_funcional: p.rg_funcional ?? null,
                              unidade: p.unidade ?? null,
                            },
                          })
                        }
                        className="rounded-md border border-border p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
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
          {(() => {
            const portariaMov = movimentos.find((m) => m.especie === "portaria");
            return (
              <div className="rounded-md border border-border p-3">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Stamp className="h-3.5 w-3.5" /> Portaria Inaugural
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {portariaMov
                    ? "Já lavrada — interrompe a prescrição"
                    : "Instaura o PAD e interrompe a prescrição"}
                </div>
                <div className="mt-2 flex flex-col gap-1.5">
                  {portariaMov && (
                    <button
                      onClick={() =>
                        setDialog({
                          kind: "verAto",
                          especie: "portaria",
                          teor: portariaMov.teor,
                          quando: portariaMov.criado_em,
                          prolator: portariaMov.prolator_nome,
                          cargo: portariaMov.prolator_cargo as string,
                        })
                      }
                      className="flex items-center justify-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
                    >
                      <Eye className="h-3.5 w-3.5" /> Ver portaria
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (portariaMov) {
                        if (
                          !window.confirm(
                            "Já existe uma portaria lavrada. Lavrar outra irá interromper o prazo novamente. Deseja prosseguir?",
                          )
                        )
                          return;
                      }
                      setDialog({ kind: "portaria" });
                    }}
                    disabled={suspenso}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
                  >
                    {portariaMov ? "Lavrar nova portaria" : "Lavrar portaria"}
                  </button>
                </div>
              </div>
            );
          })()}
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
              onClick={() => {
                if (especie === e.v) {
                  // Recolher ao clicar na espécie ativa
                  setEspecie(null);
                  setTeor("");
                  setAnexos([]);
                } else {
                  setTeor("");
                  setAnexos([]);
                  if (e.v === "ipc") {
                    setIpcUnidade((denuncia.unidade as string | null) ?? "");
                    setIpcIdent(
                      policiais.length
                        ? policiais
                            .map((p) => `${p.nome}${p.rg_funcional ? ` — ${p.rg_funcional}` : ""}`)
                            .join("; ")
                        : "",
                    );
                  }
                  setEspecie(e.v);
                }
              }}
              className={`flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs transition ${
                especie === e.v ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-surface-2"
              }`}
            >
              <e.icon className="h-3.5 w-3.5" /> {e.l}
            </button>
          ))}
        </div>
        {especie !== null && (
          <>
            {especie === "ipc" ? (
              <div className="mt-3 space-y-2">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Unidade
                  </span>
                  <select
                    value={ipcUnidade}
                    onChange={(ev) => setIpcUnidade(ev.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm"
                  >
                    <option value="">— selecione —</option>
                    {UNIDADES.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <IpcCampoAuto label="1º Processo número" valor={denuncia.numero_protocolo} />
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    2º Identificação do policial
                  </span>
                  <textarea
                    value={ipcIdent}
                    onChange={(ev) => setIpcIdent(ev.target.value)}
                    rows={2}
                    placeholder="Nome — RG; Nome — RG"
                    className="mt-1 w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    3º Relato do fato
                  </span>
                  <div className="mt-1">
                    <RichTextEditor
                      value={teor}
                      onChange={setTeor}
                      placeholder="Descreva o fato. Use a barra acima para formatação."
                      minHeight={160}
                    />
                  </div>
                </div>
                <IpcCampoAuto
                  label="4º Ciente dos fatos"
                  valor="Corregedoria Geral da Polícia Civil"
                />
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <RichTextEditor
                  value={teor}
                  onChange={setTeor}
                  placeholder="Redija o teor do ato. Use a barra acima para formatação."
                  minHeight={160}
                />
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                    Provas (imagens)
                  </div>
                  <AtoAnexosUploader
                    denunciaId={id}
                    value={anexos}
                    onChange={setAnexos}
                    disabled={mLancar.isPending}
                  />
                </div>
              </div>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEspecie(null);
                  setTeor("");
                  setAnexos([]);
                }}
                className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-2"
              >
                Cancelar
              </button>
              <button
                onClick={() => mLancar.mutate()}
                disabled={
                  teor.replace(/<[^>]+>/g, "").trim().length < 3 || mLancar.isPending
                }
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {mLancar.isPending ? "Lançando..." : "Lançar"}
              </button>
            </div>
          </>
        )}
      </div>



      {/* Timeline */}
      <div className="surface p-5">
        <h3 className="font-serif text-lg">Linha do tempo</h3>
        <ul className="mt-4 space-y-3">
          {movimentos.length === 0 && (
            <li className="text-xs text-muted-foreground">Nenhum movimento ainda.</li>
          )}
          {/* Numeração de Eventos por procedimento (permanente, por ordem de criação).
              movimentos vem ordenado DESC por criado_em → Evento nº = total - índice. */}

          {movimentos.map((mRaw, idx) => {
            const eventoNo = movimentos.length - idx;
            const eventoLabel = `Evento nº ${String(eventoNo).padStart(2, "0")}`;

            const m = mRaw as typeof mRaw & {
              cancelado_em?: string | null;
              cancelado_por_nome?: string | null;
              cancelado_por_cargo?: string | null;
              motivo_cancelamento?: string | null;
            };
            const isAto =
              m.especie === "despacho" || m.especie === "decisao" || m.especie === "portaria";
            const isIpc = m.especie === "ipc";

            const canceladoEm = m.cancelado_em ?? null;
            const podeCancelar =
              podeExcluir && !canceladoEm && m.especie !== "cancelamento";
            const resumoMov = `${labelEspecie(m.especie as string)} de ${new Date(
              m.criado_em,
            ).toLocaleString("pt-BR")}`;
            const canceladoBadge = canceladoEm && (
              <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-destructive-foreground">
                Cancelada
              </span>
            );
            const canceladoFooter = canceladoEm && (
              <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive-foreground">
                Cancelada em{" "}
                <span className="tabular">
                  {new Date(canceladoEm).toLocaleString("pt-BR")}
                </span>{" "}
                por {m.cancelado_por_nome} · {cargoLabel(m.cancelado_por_cargo as string)}
                {m.motivo_cancelamento && (
                  <>
                    <br />
                    <span className="opacity-90">Justificativa: {m.motivo_cancelamento}</span>
                  </>
                )}
              </div>
            );
            const btnCancelar = podeCancelar && (
              <button
                type="button"
                onClick={() =>
                  setDialog({ kind: "cancelarMov", movimento_id: m.id, resumo: resumoMov })
                }
                aria-label="Cancelar movimentação"
                title="Cancelar movimentação (Delegado Corregedor)"
                className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
              >
                <Trash2 className="h-3.5 w-3.5" /> Cancelar
              </button>
            );

            if (isAto) {
              return (
                <li key={m.id} className={`flex gap-3 ${canceladoEm ? "opacity-60" : ""}`}>
                  <MovMarker especie={m.especie as string} />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary" title="Número permanente do evento no procedimento">
                        {eventoLabel}
                      </span>
                      <span className="font-medium uppercase tracking-wider">
                        {labelEspecie(m.especie as string)}
                      </span>

                      {canceladoBadge}
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
                      {btnCancelar}
                    </div>
                    <div className={canceladoEm ? "line-through decoration-destructive/60" : ""}>
                      <TimelineAtoCard
                        especie={m.especie as "despacho" | "decisao" | "portaria"}
                        teor={m.teor}
                        quando={m.criado_em}
                        prolator={m.prolator_nome}
                        cargo={m.prolator_cargo as string}
                        procedimento={denuncia.numero_protocolo}
                        denunciado={
                          policiais.length
                            ? policiais
                                .map((p) => `${p.nome}${p.rg_funcional ? ` — ${p.rg_funcional}` : ""}`)
                                .join("; ")
                            : "Não identificado"
                        }
                      />
                    </div>
                    {(() => {
                      const raw = (m as unknown as { anexos?: unknown }).anexos;
                      const list = Array.isArray(raw)
                        ? (raw as Array<{ nome: string; path: string }>)
                        : [];
                      return list.length > 0 ? <AtoAnexosLinks anexos={list} /> : null;
                    })()}
                    {canceladoFooter}
                  </div>
                </li>
              );
            }
            if (isIpc) {
              return (
                <li key={m.id} className={`flex gap-3 ${canceladoEm ? "opacity-60" : ""}`}>
                  <MovMarker especie={m.especie as string} />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary" title="Número permanente do evento no procedimento">
                        {eventoLabel}
                      </span>
                      <span className="font-medium uppercase tracking-wider">
                        {labelEspecie(m.especie as string)}
                      </span>

                      <span className="rounded-full bg-status-investigacao/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-status-investigacao-fg">
                        Decisão final
                      </span>
                      {canceladoBadge}
                      <span
                        className={`rounded-full px-2 py-0.5 ${
                          m.ipc_publicado
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {m.ipc_publicado ? "Publicado ao denunciante" : "Não publicado"}
                      </span>
                      <span className="ml-auto text-muted-foreground tabular">
                        {new Date(m.criado_em).toLocaleString("pt-BR")}
                      </span>
                      {btnCancelar}
                    </div>
                    <div className={canceladoEm ? "line-through decoration-destructive/60" : ""}>
                      <TimelineIpcCard
                        teor={m.teor}
                        quando={m.criado_em}
                        prolator={m.prolator_nome}
                        cargo={m.prolator_cargo as string}
                        unidade={denuncia.unidade || "—"}
                        procedimento={denuncia.numero_protocolo}
                        identificacao={
                          policiais.length
                            ? policiais
                                .map((p) => `${p.nome}${p.rg_funcional ? ` — ${p.rg_funcional}` : ""}`)
                                .join("; ")
                            : "Não identificado"
                        }
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => mPublicar.mutate({ id: m.id, publicado: !m.ipc_publicado })}
                        disabled={mPublicar.isPending}
                        className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-surface-2 disabled:opacity-50"
                      >
                        {m.ipc_publicado ? "Despublicar" : "Publicar para o denunciante"}
                      </button>
                    </div>
                    {canceladoFooter}
                  </div>
                </li>
              );
            }
            return (
              <li key={m.id} className={`flex gap-3 ${canceladoEm ? "opacity-60" : ""}`}>
                <MovMarker especie={m.especie as string} />
                <div className="flex-1 rounded-md border border-border/60 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary" title="Número permanente do evento no procedimento">
                      {eventoLabel}
                    </span>
                    <span className="font-medium uppercase tracking-wider">
                      {labelEspecie(m.especie as string)}
                    </span>

                    {canceladoBadge}
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
                  <p
                    className={`mt-2 whitespace-pre-wrap text-sm ${
                      canceladoEm ? "line-through decoration-destructive/60" : ""
                    }`}
                  >
                    {m.teor}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>
                      {m.prolator_nome} · {cargoLabel(m.prolator_cargo as string)}
                    </span>
                    <div className="flex items-center gap-2">
                      {btnCancelar}
                    </div>
                  </div>
                  {canceladoFooter}
                </div>
              </li>
            );

          })}
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

      {/* Acesso do Ministério Público — apenas Delegado Geral / Delegado Corregedor */}
      {(cargo === "delegado_geral" || cargo === "delegado_corregedor") && (
        <AcessoMpSection denunciaId={id} />
      )}

      </div>

      {dialog?.kind === "status" && (
        <StatusDialog id={id} statusAtual={status} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "portaria" && (
        <PortariaDialog
          id={id}
          policiais={policiais}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "verAto" && (
        <VerAtoDialog
          especie={dialog.especie}
          teor={dialog.teor}
          quando={dialog.quando}
          prolator={dialog.prolator}
          cargo={dialog.cargo}
          procedimento={denuncia.numero_protocolo}
          denunciado={
            policiais.length
              ? policiais
                  .map((p) => `${p.nome}${p.rg_funcional ? ` — ${p.rg_funcional}` : ""}`)
                  .join("; ")
              : "Não identificado"
          }
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "prorrogar" && <ProrrogarDialog id={id} onClose={() => setDialog(null)} />}
      {dialog?.kind === "oitiva" && <OitivaDialog id={id} onClose={() => setDialog(null)} />}
      {dialog?.kind === "intimar" && (
        <IntimarDialog denunciaId={id} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "retificar" && (
        <RetificarDialog
          denunciaId={id}
          policial={dialog.policial}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "excluir" && (
        <ExcluirDenunciaDialog
          protocolo={denuncia.numero_protocolo}
          pending={mExcluir.isPending}
          erro={mExcluir.error instanceof Error ? mExcluir.error.message : null}
          onConfirm={(protocolo) => mExcluir.mutate(protocolo)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "cancelarMov" && (
        <CancelarMovDialog
          movimentoId={dialog.movimento_id}
          resumo={dialog.resumo}
          denunciaId={id}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "recurso" && (
        <RecursoDialog id={id} onClose={() => setDialog(null)} />
      )}




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

function IpcCampoAuto({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-surface-2 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 whitespace-pre-wrap text-sm">{valor}</div>
    </div>
  );
}

function montarTeorIpc(params: {
  unidade: string | null;
  protocolo: string;
  identificacao: string;
  relato: string;
}): string {
  return [
    `| UNIDADE: ${params.unidade || "—"}`,
    ``,
    `| 1º PROCESSO NÚMERO: ${params.protocolo}`,
    ``,
    `| 2º IDENTIFICAÇÃO DO POLICIAL: ${params.identificacao || "—"}`,
    ``,
    `| 3º RELATO DO FATO:`,
    params.relato.trim(),
    ``,
    `| 4º CIENTE DOS FATOS:`,
    `Corregedoria Geral da Polícia Civil`,
  ].join("\n");
}


function labelEspecie(e: string): string {
  return e === "despacho"
    ? "Despacho"
    : e === "decisao"
      ? "Decisão"
      : e === "ipc"
        ? "IPC"
        : e === "retificacao"
          ? "Retificação"
          : e === "portaria"
            ? "Portaria Inaugural"
            : "Status";
}

// Reconhece referências a artigos do Manual — incluindo incisos, parágrafos e
// citações combinadas ("arts. X e Y", "art. X c/c Y") — e transforma cada
// artigo citado em link para a âncora correspondente na aba Manual.
const ART_MAIN_SRC =
  "(art(?:s|igo|igos)?\\.?)\\s*(\\d+)([ºo°]?)((?:\\s*,\\s*(?:(?:inciso[s]?\\s+)?[IVXLCDM]+(?:\\s*(?:e|,)\\s*[IVXLCDM]+)*|§\\s*\\d+[ºo°]?|parágrafo\\s+único))*)(?:\\s+e\\s+seguintes)?";
const ART_CONN_RE = /^(\s+(?:e|c\/c)\s+)(\d+)([ºo°]?)/i;

const artLinkClass =
  "text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid";

function renderTeorComLinks(teor: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const RE = new RegExp(ART_MAIN_SRC, "gi");
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  const mkLink = (label: string, num: string) => (
    <a
      key={key++}
      href={`/documentos?open=manual#art-${num}`}
      target="_blank"
      rel="noreferrer"
      className={artLinkClass}
    >
      {label}
    </a>
  );
  while ((m = RE.exec(teor)) !== null) {
    if (m.index > last) parts.push(teor.slice(last, m.index));
    parts.push(mkLink(m[0], m[2]));
    last = m.index + m[0].length;
    let cm = ART_CONN_RE.exec(teor.slice(last));
    while (cm) {
      parts.push(cm[1]);
      parts.push(mkLink(cm[2] + (cm[3] ?? ""), cm[2]));
      last += cm[0].length;
      RE.lastIndex = last;
      cm = ART_CONN_RE.exec(teor.slice(last));
    }
  }
  if (last < teor.length) parts.push(teor.slice(last));
  return parts;
}

// Mesmo destaque/link aplicado a um HTML já sanitizado, sem tocar em tags.
function linkifyArticlesHtml(html: string): string {
  const MAIN = new RegExp(ART_MAIN_SRC + "(?![^<]*>)", "gi");
  const anchor = (label: string, num: string) =>
    `<a href="/documentos?open=manual#art-${num}" target="_blank" rel="noreferrer" class="${artLinkClass}">${label}</a>`;
  let out = html.replace(MAIN, (match, _p1, num) => anchor(match, num));
  const CONN = /(<\/a>)(\s+(?:e|c\/c)\s+)(\d+)([ºo°]?)(?![^<]*>)/gi;
  let prev = "";
  while (prev !== out) {
    prev = out;
    out = out.replace(CONN, (_all, close, sep, num, suf) =>
      `${close}${sep}${anchor(`${num}${suf ?? ""}`, num)}`,
    );
  }
  return out;
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
    retificacao: "bg-status-aguardando text-status-aguardando-fg",
    portaria: "bg-primary text-primary-foreground",
    certidao: "bg-emerald-600 text-white",
    evento: "bg-amber-500 text-black",
    cancelamento: "bg-muted text-muted-foreground",
  };
  const Icon =
    especie === "decisao"
      ? Scale
      : especie === "ipc"
        ? Gavel
        : especie === "retificacao"
          ? Pencil
          : especie === "portaria"
            ? Stamp
            : especie === "certidao"
              ? ShieldCheck
              : especie === "evento"
                ? Bell
                : FileText;

  return (
    <div className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-full ${style[especie] ?? "bg-surface-2 text-foreground"}`}>
      <Icon className="h-4 w-4" />
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  size = "md",
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  size?: "md" | "lg" | "xl" | "2xl" | "3xl";
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const maxW = {
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-3xl",
    "2xl": "max-w-4xl",
    "3xl": "max-w-5xl",
  }[size];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className={`surface w-full ${maxW} flex max-h-[90vh] flex-col p-5`}>
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h3 className="font-serif text-lg">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-surface-2">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
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
  const m = useMutation({
    mutationFn: () =>
      fn({ data: { denuncia_id: id, novo_status: novoStatus as DenunciaStatus } }),
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
          className="input rounded-md transition-colors"
        >
          <option value="">Selecionar...</option>
          {STATUS_LIST_MANUAL.map((s) => (
            <option key={s} value={s} disabled={s === statusAtual}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm transition-colors hover:bg-surface-2">
          Cancelar
        </button>
        <button
          onClick={() => m.mutate()}
          disabled={!novoStatus || m.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
        >
          Confirmar
        </button>
      </div>
    </Modal>
  );
}

function RecursoDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const fn = useServerFn(registrarRecurso);
  const [certificacao, setCertificacao] = useState(
    "Certifico e dou fé que, dentro do prazo legal, foi interposto recurso administrativo em face da decisão proferida nos autos.",
  );
  const [link, setLink] = useState("");
  const m = useMutation({
    mutationFn: () =>
      fn({ data: { denuncia_id: id, certificacao, recurso_link: link || null } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["denuncia", id] });
      qc.invalidateQueries({ queryKey: ["denuncias"] });
      onClose();
    },
  });
  return (
    <Modal title="Registrar recurso administrativo" onClose={onClose}>
      <p className="text-xs text-muted-foreground">
        Ao confirmar, o decurso automático é interrompido, o procedimento retorna
        para "Em análise" e a certificação é juntada aos autos como Evento.
      </p>
      <label className="mt-3 grid gap-1.5">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Certificação (obrigatória)
        </span>
        <textarea
          rows={4}
          className="input"
          value={certificacao}
          onChange={(e) => setCertificacao(e.target.value)}
        />
      </label>
      <label className="mt-3 grid gap-1.5">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Link / referência do recurso juntado (opcional)
        </span>
        <input
          className="input"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://... ou nº do documento anexado"
        />
      </label>
      {m.error instanceof Error && (
        <p className="mt-2 text-xs text-destructive">{m.error.message}</p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">
          Cancelar
        </button>
        <button
          onClick={() => m.mutate()}
          disabled={certificacao.trim().length < 10 || m.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {m.isPending ? "Registrando..." : "Registrar recurso"}
        </button>
      </div>
    </Modal>
  );
}

function cargoLabelFull(c: string | null | undefined): string {
  if (!c) return "";
  return c === "delegado_geral"
    ? "Delegado Geral"
    : c === "delegado_corregedor"
      ? "Delegado Corregedor"
      : "Corregedor";
}

const PROVIDENCIAS_PADRAO = `I - Juntar aos autos a apuração preliminar;
II - Deliberar a Cúpula da Corregedoria pela existência de elementos de justa causa da presente denúncia, caso necessário;
III - A seguir, tornem os autos conclusos.`;

type DenunciadoPortaria = {
  nome: string;
  matricula: string;
  cargo: string;
  artigos: string;
};

function montarModeloPortaria(params: {
  cargoProlator: string;
  nomeProlator: string;
  matriculaProlator: string;
  denunciados: DenunciadoPortaria[];
  providencias: string;
}): string {
  const preamblePrefix = `A Corregedoria Geral da Polícia Civil do Estado de São Paulo, por intermédio do ${params.cargoProlator}, ${params.nomeProlator}, ${params.matriculaProlator}, com fundamento nos arts. 78, inciso I c/c 79 do Manual de Procedimentos, instaura o presente PROCESSO ADMINISTRATIVO DISCIPLINAR`;
  const providencias = params.providencias.trim() || PROVIDENCIAS_PADRAO;
  const dataFmt = new Date().toLocaleDateString("pt-BR");
  const fecho = `\n\nCumpra-se.\n\nDatado e assinado digitalmente em ${dataFmt}.\n\n${params.nomeProlator}\n${params.cargoProlator}`;

  const dens = params.denunciados.length > 0
    ? params.denunciados
    : [{ nome: "[NOME_DENUNCIADO]", matricula: "matrícula não informada", cargo: "", artigos: "" }];

  if (dens.length === 1) {
    const d = dens[0];
    const cargoDen = d.cargo.trim() || "[CARGO_DENUNCIADO]";
    const artigos = d.artigos.trim() || "[ARTIGOS_ENQUADRADOS]";
    return `${preamblePrefix} com a finalidade de apurar a conduta do policial civil ${d.nome}, ${d.matricula || "matrícula não informada"}, ${cargoDen}, em face do suposto cometimento da(s) infração(ões) administrativa(s) relatada(s).

Com efeito, a partir dos fatos constantes da presente denúncia, os comportamentos supramencionados configuram, em tese, infração aos dispositivos ${artigos}.

Pelo exposto, para que o denunciado venha se defender das imputações acima descritas segundo os princípios do contraditório e da ampla defesa, de acordo com o rito estabelecido nos arts. 80 e seguintes, deverá a CORREGEPOL, logo após esta Portaria, tomar as seguintes providências:

${providencias}${fecho}`;
  }

  const blocos = dens
    .map((d) => {
      const cargoDen = d.cargo.trim() || "[CARGO_DENUNCIADO]";
      const artigos = d.artigos.trim() || "[ARTIGOS_ENQUADRADOS]";
      return `Quanto ao policial civil ${d.nome}, ${d.matricula || "matrícula não informada"}, ${cargoDen}, imputa-se-lhe, em tese, a infração aos dispositivos ${artigos}.`;
    })
    .join("\n\n");

  return `${preamblePrefix} com a finalidade de apurar a conduta dos policiais civis a seguir identificados, em face do suposto cometimento das infrações administrativas relatadas:

${blocos}

Pelo exposto, para que os denunciados venham se defender das imputações acima descritas segundo os princípios do contraditório e da ampla defesa, de acordo com o rito estabelecido nos arts. 80 e seguintes, deverá a CORREGEPOL, logo após esta Portaria, tomar as seguintes providências:

${providencias}${fecho}`;
}

function PortariaDialog({
  id,
  policiais,
  onClose,
}: {
  id: string;
  policiais: Array<{ id: string; nome: string; rg_funcional: string | null; unidade: string | null }>;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const fn = useServerFn(lavrarPortaria);
  const sessionFn = useServerFn(getSessionInfo);
  const { data: session } = useQuery({ queryKey: ["session-info"], queryFn: () => sessionFn() });

  const [denunciados, setDenunciados] = useState<DenunciadoPortaria[]>(
    policiais.length > 0
      ? policiais.map((p) => ({
          nome: p.nome,
          matricula: p.rg_funcional ?? "",
          cargo: "",
          artigos: "",
        }))
      : [{ nome: "", matricula: "", cargo: "", artigos: "" }],
  );
  const [providencias, setProvidencias] = useState(PROVIDENCIAS_PADRAO);
  const [corpo, setCorpo] = useState("");
  const [modeloAplicado, setModeloAplicado] = useState(false);

  function updateDen(idx: number, patch: Partial<DenunciadoPortaria>) {
    setDenunciados((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }

  function aplicarModelo() {
    if (!session?.profile || !session.cargo) return;
    const texto = montarModeloPortaria({
      cargoProlator: cargoLabelFull(session.cargo),
      nomeProlator: session.profile.nome,
      matriculaProlator: session.profile.matricula || "matrícula não informada",
      denunciados: denunciados.map((d) => ({
        nome: d.nome || "[NOME_DENUNCIADO]",
        matricula: d.matricula,
        cargo: d.cargo,
        artigos: d.artigos,
      })),
      providencias,
    });
    const html = texto
      .split(/\n{2,}/)
      .map((par) => `<p>${par.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>")}</p>`)
      .join("");
    setCorpo(html);
    setModeloAplicado(true);
  }

  const m = useMutation({
    mutationFn: () => fn({ data: { denuncia_id: id, corpo: sanitizeAtoHtml(corpo) } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["denuncia", id] });
      qc.invalidateQueries({ queryKey: ["denuncias"] });
      onClose();
    },
  });

  return (
    <Modal title="Portaria Inaugural" onClose={onClose} size="3xl">
      <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">
        Ao confirmar, a portaria é lançada na linha do tempo, a data de instauração é
        preenchida e a <strong>prescrição é interrompida</strong> (relógio reinicia em 15 dias).
      </div>

      <div className="grid gap-3 rounded-md border border-border/60 p-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Denunciados ({denunciados.length}) — artigos enquadrados por policial
        </div>
        <div className="grid gap-3">
          {denunciados.map((d, idx) => (
            <div key={idx} className="grid gap-2 rounded-md border border-border/50 bg-surface-2/40 p-2 md:grid-cols-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-primary md:col-span-2">
                Denunciado {idx + 1}
              </div>
              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground">Nome</span>
                <input className="input" value={d.nome} onChange={(e) => updateDen(idx, { nome: e.target.value })} />
              </label>
              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground">Matrícula</span>
                <input className="input" value={d.matricula} onChange={(e) => updateDen(idx, { matricula: e.target.value })} />
              </label>
              <label className="grid gap-1 text-xs md:col-span-2">
                <span className="text-muted-foreground">Cargo (opcional)</span>
                <input
                  className="input"
                  value={d.cargo}
                  onChange={(e) => updateDen(idx, { cargo: e.target.value })}
                  placeholder="ex.: Investigador de Polícia"
                />
              </label>
              <label className="grid gap-1 text-xs md:col-span-2">
                <span className="text-muted-foreground">
                  Artigos enquadrados deste policial (ex.: art. 12, inciso III)
                </span>
                <input
                  className="input"
                  value={d.artigos}
                  onChange={(e) => updateDen(idx, { artigos: e.target.value })}
                  placeholder="art. 12, inciso III"
                />
              </label>
            </div>
          ))}
        </div>
        <label className="grid gap-1 text-xs">
          <span className="text-muted-foreground">Providências (comuns a todos os denunciados)</span>
          <textarea
            rows={4}
            className="input"
            value={providencias}
            onChange={(e) => setProvidencias(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={aplicarModelo}
          disabled={!session?.profile || !session.cargo}
          className="rounded-md border border-primary/60 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
        >
          Usar modelo pré-formatado
        </button>
      </div>

      <div className="mt-3 grid gap-1">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Corpo da portaria (editável — formatação disponível)
        </span>
        <RichTextEditor
          value={corpo}
          onChange={setCorpo}
          placeholder={
            modeloAplicado
              ? ""
              : "Clique em «Usar modelo pré-formatado» ou digite a portaria livremente."
          }
          minHeight={200}
        />
      </div>

      {m.isError && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive-foreground">
          {(m.error as Error)?.message || "Não foi possível lavrar a portaria."}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">
          Cancelar
        </button>
        <button
          onClick={() => m.mutate()}
          disabled={corpo.replace(/<[^>]+>/g, "").trim().length < 50 || m.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {m.isPending ? "Lavrando..." : "Confirmar e lavrar portaria"}
        </button>
      </div>
    </Modal>
  );
}



const ATO_ASSUNTO: Record<"despacho" | "decisao" | "portaria", string> = {
  despacho: "Despacho",
  decisao: "Decisão",
  portaria: "Portaria Inaugural",
};

const ATO_TIPO: Record<"despacho" | "decisao" | "portaria", "DESPACHO" | "DECISÃO" | "PORTARIA"> = {
  despacho: "DESPACHO",
  decisao: "DECISÃO",
  portaria: "PORTARIA",
};

const ATO_MARKER: Record<"despacho" | "decisao" | "portaria", string> = {
  despacho: "bg-status-analise",
  decisao: "bg-destructive",
  portaria: "bg-primary",
};

/**
 * Renderiza o corpo do ato: HTML sanitizado quando salvo como rich text,
 * ou texto plano (com links, se portaria) para registros legados.
 */
function renderAtoBody(_especie: "despacho" | "decisao" | "portaria", teor: string, pdf = false): React.ReactNode {
  if (isHtmlAto(teor)) {
    return (
      <div
        className={pdf ? "ato-body-pdf" : "ato-body"}
        dangerouslySetInnerHTML={{ __html: linkifyArticlesHtml(sanitizeAtoHtml(teor)) }}
      />
    );
  }
  return <div className="whitespace-pre-wrap">{renderTeorComLinks(teor)}</div>;
}

function TimelineAtoCard({
  especie,
  teor,
  quando,
  prolator,
  cargo,
  procedimento,
  denunciado,
}: {
  especie: "despacho" | "decisao" | "portaria";
  teor: string;
  quando: string;
  prolator: string;
  cargo: string;
  procedimento: string;
  denunciado: string;
}) {
  const pdfRef = useDocumentRef();
  const [gerando, setGerando] = useState(false);
  const assunto = ATO_ASSUNTO[especie];

  async function exportarPdf() {
    if (!pdfRef.current) return;
    setGerando(true);
    try {
      const fname = `${assunto.replace(/\s+/g, "_")}_${procedimento.replace(/[^\w-]/g, "_")}.pdf`;
      await exportDocumentToPdf(pdfRef.current, fname);
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* Exibição integrada ao sistema (tema escuro) */}
      <DocumentTemplate
        variant="screen"
        procedimento={procedimento}
        denunciado={denunciado}
        tipo={ATO_TIPO[especie]}
        prolatorNome={prolator}
        prolatorCargo={cargoLabelFull(cargo)}
        data={quando}
        markerClass={ATO_MARKER[especie]}
      >
        {renderAtoBody(especie, teor)}
      </DocumentTemplate>

      {/* Versão para PDF, fora da tela, sem alterar o layout */}
      <div className="pointer-events-none fixed left-[-10000px] top-0" aria-hidden>
        <DocumentTemplate
          ref={pdfRef}
          variant="pdf"
          procedimento={procedimento}
          denunciado={denunciado}
          assunto={assunto}
          prolatorNome={prolator}
          prolatorCargo={cargoLabelFull(cargo)}
          data={quando}
          markerClass={ATO_MARKER[especie]}
        >
          {renderAtoBody(especie, teor, true)}
        </DocumentTemplate>
      </div>

      <div className="flex justify-end">
        <button
          onClick={exportarPdf}
          disabled={gerando}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface-2 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" /> {gerando ? "Gerando..." : "Exportar PDF"}
        </button>
      </div>
    </div>
  );
}

function TimelineCertidaoCard({
  teor,
  quando,
  prolator,
  cargo,
  procedimento,
  denunciado,
}: {
  teor: string;
  quando: string;
  prolator: string;
  cargo: string;
  procedimento: string;
  denunciado: string;
}) {
  const pdfRef = useDocumentRef();
  const [gerando, setGerando] = useState(false);

  async function exportarPdf() {
    if (!pdfRef.current) return;
    setGerando(true);
    try {
      const fname = `Certidao_${procedimento.replace(/[^\w-]/g, "_")}.pdf`;
      await exportDocumentToPdf(pdfRef.current, fname);
    } finally {
      setGerando(false);
    }
  }

  const body = <div className="whitespace-pre-wrap">{renderTeorComLinks(teor)}</div>;

  return (
    <div className="space-y-2">
      <DocumentTemplate
        variant="screen"
        procedimento={procedimento}
        denunciado={denunciado}
        tipo="CERTIDÃO"
        prolatorNome={prolator}
        prolatorCargo={cargoLabelFull(cargo)}
        data={quando}
        markerClass="bg-emerald-600"
      >
        {body}
      </DocumentTemplate>

      <div className="pointer-events-none fixed left-[-10000px] top-0" aria-hidden>
        <DocumentTemplate
          ref={pdfRef}
          variant="pdf"
          procedimento={procedimento}
          denunciado={denunciado}
          assunto="Certidão"
          prolatorNome={prolator}
          prolatorCargo={cargoLabelFull(cargo)}
          data={quando}
          markerClass="bg-emerald-600"
        >
          <div className="whitespace-pre-wrap">{renderTeorComLinks(teor)}</div>
        </DocumentTemplate>
      </div>

      <div className="flex justify-end">
        <button
          onClick={exportarPdf}
          disabled={gerando}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface-2 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" /> {gerando ? "Gerando..." : "Exportar PDF"}
        </button>
      </div>
    </div>
  );
}



/**
 * Extrai a seção do RELATO DOS FATOS do teor estruturado do IPC
 * (produzido por montarTeorIpc). Preserva HTML se houver.
 */
function extrairRelatoIpc(teor: string): string {
  const m = teor.match(/\|\s*3º\s+RELATO\s+DO\s+FATO\s*:\s*\n([\s\S]*?)(?:\n\s*\n\|\s*4º|$)/i);
  if (m) return m[1].trim();
  return teor;
}

function TimelineIpcCard({
  teor,
  quando,
  prolator,
  cargo,
  unidade,
  procedimento,
  identificacao,
}: {
  teor: string;
  quando: string;
  prolator: string;
  cargo: string;
  unidade: string;
  procedimento: string;
  identificacao: string;
}) {
  const pdfRef = useDocumentRef();
  const [gerando, setGerando] = useState(false);
  const relato = extrairRelatoIpc(teor);

  const relatoParas = relato.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const relatoNode = isHtmlAto(relato) ? (
    <div
      className="ato-body"
      dangerouslySetInnerHTML={{ __html: linkifyArticlesHtml(sanitizeAtoHtml(relato)) }}
    />
  ) : (
    <div className="ato-body">
      {relatoParas.map((p, i) => (
        <p key={i} className="whitespace-pre-wrap">{renderTeorComLinks(p)}</p>
      ))}
    </div>
  );
  const relatoNodePdf = isHtmlAto(relato) ? (
    <div
      className="ato-body-pdf"
      dangerouslySetInnerHTML={{ __html: linkifyArticlesHtml(sanitizeAtoHtml(relato)) }}
    />
  ) : (
    <div className="ato-body-pdf">
      {relatoParas.map((p, i) => (
        <p key={i} className="whitespace-pre-wrap">{renderTeorComLinks(p)}</p>
      ))}
    </div>
  );


  const camposBase = [
    { label: "Unidade", valor: unidade },
    { label: "Processo Nº", valor: procedimento },
    { label: "Identificação do policial", valor: identificacao },
  ];

  async function exportarPdf() {
    if (!pdfRef.current) return;
    setGerando(true);
    try {
      const fname = `IPC_${procedimento.replace(/[^\w-]/g, "_")}.pdf`;
      await exportDocumentToPdf(pdfRef.current, fname);
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="space-y-2">
      <DocumentTemplate
        variant="screen"
        procedimento={procedimento}
        denunciado={identificacao}
        tipo="IPC"
        subtitulo="Resolução final do inquérito"
        prolatorNome={prolator}
        prolatorCargo={cargoLabelFull(cargo)}
        data={quando}
        markerClass="bg-status-investigacao"
        campos={[
          ...camposBase,
          { label: "Relato dos fatos", valor: relatoNode, block: true },
          { label: "Ciente dos fatos", valor: "Corregedoria Geral da Polícia Civil" },
        ]}
      />

      <div className="pointer-events-none fixed left-[-10000px] top-0" aria-hidden>
        <DocumentTemplate
          ref={pdfRef}
          variant="pdf"
          procedimento={procedimento}
          denunciado={identificacao}
          tipo="IPC"
          subtitulo="Resolução final do inquérito"
          prolatorNome={prolator}
          prolatorCargo={cargoLabelFull(cargo)}
          data={quando}
          markerClass="bg-status-investigacao"
          campos={[
            ...camposBase,
            { label: "Relato dos fatos", valor: relatoNodePdf, block: true },
            { label: "Ciente dos fatos", valor: "Corregedoria Geral da Polícia Civil" },
          ]}
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={exportarPdf}
          disabled={gerando}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface-2 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" /> {gerando ? "Gerando..." : "Exportar PDF"}
        </button>
      </div>
    </div>
  );
}




function VerAtoDialog({
  especie,
  teor,
  quando,
  prolator,
  cargo,
  procedimento,
  denunciado,
  onClose,
}: {
  especie: "despacho" | "decisao" | "portaria";
  teor: string;
  quando: string;
  prolator: string;
  cargo: string;
  procedimento: string;
  denunciado: string;
  onClose: () => void;
}) {
  const pdfRef = useDocumentRef();
  const [gerando, setGerando] = useState(false);

  const assunto =
    especie === "portaria" ? "Portaria Inaugural" : especie === "decisao" ? "Decisão" : "Despacho";
  const titulo = assunto;

  async function baixarPdf() {
    if (!pdfRef.current) return;
    setGerando(true);
    try {
      const fname = `${assunto.replace(/\s+/g, "_")}_${procedimento.replace(/[^\w-]/g, "_")}.pdf`;
      await exportDocumentToPdf(pdfRef.current, fname);
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-start overflow-y-auto bg-black/70 p-4">
      <div className="mx-auto w-full max-w-[220mm]">
        <div className="mb-3 flex items-center justify-between rounded-md bg-surface p-3">
          <div>
            <h3 className="font-serif text-lg">{titulo}</h3>
            <div className="text-xs text-muted-foreground">
              {prolator} · {cargoLabelFull(cargo)} ·{" "}
              <span className="tabular">{new Date(quando).toLocaleString("pt-BR")}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={baixarPdf}
              disabled={gerando}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" /> {gerando ? "Gerando..." : "Baixar PDF"}
            </button>
            <button onClick={onClose} className="rounded-md border border-border p-1.5 hover:bg-surface-2">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="surface p-5">
          <DocumentTemplate
            variant="screen"
            procedimento={procedimento}
            denunciado={denunciado}
            tipo={ATO_TIPO[especie]}
            prolatorNome={prolator}
            prolatorCargo={cargoLabelFull(cargo)}
            data={quando}
            markerClass={ATO_MARKER[especie]}
          >
            {renderAtoBody(especie, teor)}
          </DocumentTemplate>
        </div>

        {/* PDF invisível */}
        <div className="pointer-events-none fixed left-[-10000px] top-0" aria-hidden>
          <DocumentTemplate
            ref={pdfRef}
            variant="pdf"
            procedimento={procedimento}
            denunciado={denunciado}
            assunto={assunto}
            prolatorNome={prolator}
            prolatorCargo={cargoLabelFull(cargo)}
            data={quando}
          >
            {renderAtoBody(especie, teor, true)}
          </DocumentTemplate>
        </div>
      </div>
    </div>
  );
}

function ProrrogarDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const fn = useServerFn(prorrogar);
  const TEXTO_PADRAO =
    "Prorrogue-se por 30 (trinta) dias o presente procedimento, considerando a remarcação da oitiva por parte do(s) denunciado(s), nos termos do art.93-C do Manual de Procedimentos.";
  const [j, setJ] = useState(TEXTO_PADRAO);
  const [anexos, setAnexos] = useState<AtoAnexo[]>([]);
  const m = useMutation({
    mutationFn: () => fn({ data: { denuncia_id: id, justificativa: j, anexos } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["denuncia", id] });
      qc.invalidateQueries({ queryKey: ["denuncias"] });
      onClose();
    },
  });
  return (
    <Modal title="Prorrogar prazo em 30 dias" onClose={onClose}>
      <div className="mb-2 text-xs text-muted-foreground">
        Aplicável somente por remarcação de oitiva a pedido do denunciado. Texto padronizado abaixo — ajuste se necessário ao caso concreto.
      </div>
      <textarea
        rows={6}
        className="input"
        value={j}
        onChange={(e) => setJ(e.target.value)}
      />
      <div className="mt-3">
        <div className="mb-1 text-[0.7rem] uppercase tracking-wider text-muted-foreground">
          Anexos (imagens-prova)
        </div>
        <AtoAnexosUploader denunciaId={id} value={anexos} onChange={setAnexos} />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">
          Cancelar
        </button>
        <button
          onClick={() => m.mutate()}
          disabled={j.trim().length < 10 || m.isPending}
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

function RetificarDialog({
  denunciaId,
  policial,
  onClose,
}: {
  denunciaId: string;
  policial: { id: string; nome: string; rg_funcional: string | null; unidade: string | null };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const fn = useServerFn(retificarDenunciado);
  const [nome, setNome] = useState(policial.nome);
  const [mat, setMat] = useState(policial.rg_funcional ?? "");
  const [unidade, setUnidade] = useState<string>(policial.unidade ?? "");
  const [motivo, setMotivo] = useState("");
  const m = useMutation({
    mutationFn: () =>
      fn({
        data: {
          policial_id: policial.id,
          nome,
          rg_funcional: mat || null,
          unidade: (unidade || null) as typeof UNIDADES[number] | null,
          motivo: motivo || null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["denuncia", denunciaId] });
      qc.invalidateQueries({ queryKey: ["denuncias"] });
      onClose();
    },
  });
  const semMudanca =
    nome.trim() === policial.nome &&
    (mat.trim() || null) === (policial.rg_funcional ?? null) &&
    (unidade || null) === (policial.unidade ?? null);
  return (
    <Modal title="Retificar denunciado" onClose={onClose}>
      <label className="grid gap-1.5">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Nome</span>
        <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} />
      </label>
      <label className="mt-3 grid gap-1.5">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Matrícula</span>
        <input className="input" value={mat} onChange={(e) => setMat(e.target.value)} />
      </label>
      <label className="mt-3 grid gap-1.5">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Unidade</span>
        <select
          className="input"
          value={unidade}
          onChange={(e) => setUnidade(e.target.value)}
        >
          <option value="">Selecionar...</option>
          {UNIDADES.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3 grid gap-1.5">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Motivo (opcional)
        </span>
        <textarea
          rows={3}
          className="input"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </label>
      {m.isError && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive-foreground">
          {(m.error as Error)?.message || "Não foi possível retificar."}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">
          Cancelar
        </button>
        <button
          onClick={() => m.mutate()}
          disabled={!nome.trim() || semMudanca || m.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Confirmar retificação
        </button>
      </div>
    </Modal>
  );
}

// ============ Acesso do Ministério Público ============
function AcessoMpSection({ denunciaId }: { denunciaId: string }) {
  const qc = useQueryClient();
  const listMembrosFn = useServerFn(listMembrosMp);
  const listAcessosFn = useServerFn(listAcessosMp);
  const concederFn = useServerFn(concederAcessoMp);
  const revogarFn = useServerFn(revogarAcessoMp);
  const [selected, setSelected] = useState<string>("");

  const { data: membros } = useQuery({
    queryKey: ["mp-membros"],
    queryFn: () => listMembrosFn(),
  });
  const { data: acessos } = useQuery({
    queryKey: ["mp-acessos", denunciaId],
    queryFn: () => listAcessosFn({ data: { denuncia_id: denunciaId } }),
  });

  const jaConcedidos = new Set((acessos ?? []).map((a) => a.mp_user_id));
  const disponiveis = (membros ?? []).filter((m) => !jaConcedidos.has(m.id));

  const mConceder = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      await concederFn({ data: { denuncia_id: denunciaId, mp_user_id: selected } });
    },
    onSuccess: () => {
      setSelected("");
      qc.invalidateQueries({ queryKey: ["mp-acessos", denunciaId] });
    },
  });

  const mRevogar = useMutation({
    mutationFn: (id: string) => revogarFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mp-acessos", denunciaId] }),
  });

  return (
    <div className="surface p-5">
      <h3 className="font-serif text-lg">Acesso do Ministério Público</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Conceda leitura deste processo a um membro do MP já cadastrado. O acesso é
        exclusivo deste processo — não vale para nenhum outro.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="input flex-1"
        >
          <option value="">
            {disponiveis.length === 0
              ? "Nenhum membro do MP disponível"
              : "Selecionar membro do MP..."}
          </option>
          {disponiveis.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
        <button
          onClick={() => mConceder.mutate()}
          disabled={!selected || mConceder.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Conceder acesso
        </button>
      </div>

      <div className="mt-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Concessões ativas
        </div>
        {!acessos || acessos.length === 0 ? (
          <div className="mt-2 text-xs text-muted-foreground">
            Ninguém tem acesso a este processo além da Corregedoria.
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {acessos.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 p-3"
              >
                <div>
                  <div className="text-sm font-medium">{a.mp_nome}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Concedido por {a.concedido_por_nome} em{" "}
                    {new Date(a.concedido_em).toLocaleString("pt-BR")}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm("Revogar o acesso deste membro do MP a este processo?")) {
                      mRevogar.mutate(a.id);
                    }
                  }}
                  className="rounded-md border border-destructive/40 px-3 py-1 text-xs text-destructive-foreground hover:bg-destructive/10"
                >
                  Revogar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ExcluirDenunciaDialog({
  protocolo,
  onConfirm,
  onClose,
  pending,
  erro,
}: {
  protocolo: string;
  onConfirm: (protocolo: string) => void;
  onClose: () => void;
  pending: boolean;
  erro: string | null;
}) {
  const [texto, setTexto] = useState("");
  const bate = texto.trim() === protocolo;
  return (
    <Modal title="Excluir procedimento definitivamente" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive">
          Esta ação é <strong>definitiva e irreversível</strong>. Todos os dados do
          procedimento — movimentação, oitivas, denunciados, concessões ao MP e
          vínculo com o cidadão — serão apagados do banco e não poderão ser recuperados.
          O número <strong>{protocolo}</strong> não será reaproveitado.
        </p>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Para confirmar, digite o número do procedimento
          </span>
          <input
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={protocolo}
            className="input mt-1 tabular"
          />
        </label>
        {erro && <p className="text-xs text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!bate || pending}
            onClick={() => onConfirm(texto.trim())}
            className="inline-flex items-center gap-1 rounded-md bg-destructive px-3 py-1.5 text-xs text-destructive-foreground disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {pending ? "Excluindo..." : "Excluir definitivamente"}
          </button>
        </div>
      </div>
    </Modal>
  );
}




function CancelarMovDialog({
  movimentoId,
  resumo,
  denunciaId,
  onClose,
}: {
  movimentoId: string;
  resumo: string;
  denunciaId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const fn = useServerFn(cancelarMovimento);
  const [motivo, setMotivo] = useState("");

  const m = useMutation({
    mutationFn: () => fn({ data: { movimento_id: movimentoId, motivo } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["denuncia", denunciaId] });
      qc.invalidateQueries({ queryKey: ["denuncias"] });
      toast.success("Movimentação cancelada com sucesso.");
      onClose();
    },
    onError: (e) => {
      toast.error(
        e instanceof Error && e.message
          ? e.message
          : "Falha ao cancelar movimentação. Tente novamente.",
      );
    },
  });

  return (
    <AlertDialog open onOpenChange={(o) => !o && !m.isPending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar movimentação</AlertDialogTitle>
          <AlertDialogDescription>
            A movimentação <strong>{resumo}</strong> permanecerá no histórico marcada como
            cancelada, e um novo lançamento de auditoria será criado. A ação é irreversível.
            Informe a justificativa.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="mt-2 grid gap-1">
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Justificativa
          </label>
          <textarea
            rows={4}
            className="input"
            autoFocus
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Explique o motivo do cancelamento..."
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={m.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={motivo.trim().length < 3 || m.isPending}
            onClick={(e) => {
              e.preventDefault();
              m.mutate();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {m.isPending ? "Cancelando..." : "Confirmar cancelamento"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ExportarProcessoBtn({
  denuncia,
  policiais,
  movimentos,
}: {
  denuncia: {
    numero_protocolo: string;
    denunciante_nome: string | null;
    denunciante_anonimo: boolean | null;
    ocorrencia_tipo: string | null;
    unidade: string | null;
    status: string;
    termo_inicial: string;
    acrescimos_dias: number;
    interrupcoes_count: number;
    instaurada_em: string | null;
    created_at: string;
  };
  policiais: Array<{ id: string; nome: string; rg_funcional: string | null; unidade: string | null }>;
  movimentos: Array<{
    id: string;
    especie: string;
    teor: string;
    prolator_nome: string;
    prolator_cargo: string;
    criado_em: string;
    interrompe?: boolean | null;
    prorroga?: boolean | null;
    cancelado_em?: string | null;
    cancelado_por_nome?: string | null;
    motivo_cancelamento?: string | null;
    anexos?: Array<{ nome: string; path: string }> | null;
  }>;
}) {
  const [gerando, setGerando] = useState(false);
  async function onClick() {
    setGerando(true);
    try {
      await exportProcessoCompleto({ denuncia, policiais, movimentos, oitivas: [] });
    } catch (e) {
      toast.error((e as Error)?.message || "Falha ao gerar o PDF do processo.");
    } finally {
      setGerando(false);
    }
  }
  return (
    <button
      onClick={onClick}
      disabled={gerando}
      title="Exportar processo completo em PDF"
      className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2 disabled:opacity-50"
    >
      <Download className="h-3.5 w-3.5" /> {gerando ? "Gerando PDF..." : "Exportar processo (PDF)"}
    </button>
  );
}

function NaturezaInline({
  denunciaId,
  valor,
  podeEditar,
}: {
  denunciaId: string;
  valor: string | null;
  podeEditar: boolean;
}) {
  const qc = useQueryClient();
  const fn = useServerFn(atualizarNatureza);
  const [editando, setEditando] = useState(false);
  const [txt, setTxt] = useState(valor ?? "");
  useEffect(() => setTxt(valor ?? ""), [valor]);

  const m = useMutation({
    mutationFn: (novo: string) => fn({ data: { denuncia_id: denunciaId, ocorrencia_tipo: novo } }),
    onSuccess: () => {
      setEditando(false);
      qc.invalidateQueries({ queryKey: ["denuncia", denunciaId] });
      qc.invalidateQueries({ queryKey: ["denuncias"] });
      toast.success("Natureza atualizada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!podeEditar || !editando) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        {valor || "Sem natureza"}
        {podeEditar && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            title="Editar natureza"
            className="text-muted-foreground/70 hover:text-foreground"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        autoFocus
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && txt.trim()) m.mutate(txt.trim());
          if (e.key === "Escape") { setTxt(valor ?? ""); setEditando(false); }
        }}
        className="min-w-[220px] rounded-md border border-border bg-input px-2 py-1 text-sm"
      />
      <button
        type="button"
        disabled={m.isPending || !txt.trim()}
        onClick={() => m.mutate(txt.trim())}
        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-2 disabled:opacity-50"
      >
        Salvar
      </button>
      <button
        type="button"
        onClick={() => { setTxt(valor ?? ""); setEditando(false); }}
        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-2"
      >
        Cancelar
      </button>
    </span>
  );
}


