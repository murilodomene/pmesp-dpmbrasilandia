import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCircle2,
  CornerUpLeft,
  Download,
  FileSignature,
  Handshake,
  Loader2,
  Plus,
  Search,
  Send,
  Settings2,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { Header } from "@/components/Header";
import { RichTextEditor, sanitizeAtoHtml } from "@/components/RichTextEditor";
import { EncaminharMinutaDialog } from "@/components/EncaminharMinutaDialog";
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
import { getSessionInfo } from "@/lib/usuarios.functions";
import { listDenuncias } from "@/lib/denuncias.functions";
import { listAssinantesMinuta } from "@/lib/minutas.functions";
import {
  assinarTac,
  cancelarTac,
  criarTac,
  devolverTac,
  encerrarTac,
  listTacs,
  reenviarTac,
  salvarTacConfig,
  type DadosTac,
  type StatusTac,
  type Tac,
  type TacConfig,
} from "@/lib/tac.functions";
import { pdfDoTac, rotuloOrigem, somarMeses } from "@/lib/tac-pdf-dados";
import { exportTacPdf, previaTacPdf } from "@/lib/exportProcesso";
import { ROLE_LABELS, isAdminRole, isInternalRole } from "@/lib/access-roles";
import { OPMS, POSTOS_GRADUACOES } from "@/lib/personnel-options";

export const Route = createFileRoute("/_authenticated/tac")({
  validateSearch: z.object({
    id: z.string().uuid().optional(),
    novo: z.coerce.boolean().optional(),
    processo: z.string().uuid().optional(),
  }),
  component: TacPage,
});

/* ---------- utilitários ---------- */

const STATUS_INFO: Record<StatusTac, { rotulo: string; cls: string }> = {
  aguardando_assinatura: {
    rotulo: "Aguardando assinatura",
    cls: "border-amber-500/55 bg-amber-500/10 text-amber-200",
  },
  devolvido: { rotulo: "Devolvido", cls: "border-destructive/55 bg-destructive/10 text-red-300" },
  em_cumprimento: { rotulo: "Em cumprimento", cls: "border-sky-400/50 bg-sky-400/10 text-sky-200" },
  cumprido: { rotulo: "Cumprido", cls: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" },
  descumprido: {
    rotulo: "Descumprido",
    cls: "border-destructive/55 bg-destructive/15 text-red-300",
  },
  cancelado: { rotulo: "Cancelado", cls: "border-border bg-muted text-muted-foreground" },
};

const DIA = 864e5;
const dataBr = (iso: string | null | undefined) =>
  iso
    ? new Date(iso.length === 10 ? `${iso}T12:00:00-03:00` : iso).toLocaleDateString("pt-BR")
    : "—";
const nomeCurto = (posto: string | null | undefined, nome: string | null | undefined) =>
  [posto?.trim(), nome?.trim()].filter(Boolean).join(" ");
const rotuloCargo = (c: string | null | undefined) =>
  c ? ((ROLE_LABELS as Record<string, string>)[c] ?? c) : "";
const textoPuro = (html: string) => html.replace(/<[^>]+>/g, "").trim();
const hojeIso = () => new Date().toISOString().slice(0, 10);

/** Dias até o fim do período de prova (negativo: já venceu). */
function diasRestantes(t: Tac): number | null {
  if (!t.fim) return null;
  return Math.ceil((new Date(`${t.fim}T23:59:59-03:00`).getTime() - Date.now()) / DIA);
}
function progresso(t: Tac): number {
  if (!t.inicio || !t.fim) return 0;
  const ini = new Date(`${t.inicio}T00:00:00-03:00`).getTime();
  const fim = new Date(`${t.fim}T23:59:59-03:00`).getTime();
  return Math.max(0, Math.min(100, Math.round(((Date.now() - ini) / (fim - ini)) * 100)));
}

function StatusChip({ t }: { t: Tac }) {
  const s = STATUS_INFO[t.status];
  const dias = t.status === "em_cumprimento" ? diasRestantes(t) : null;
  const vencendo = dias != null && dias <= 30;
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        vencendo ? "border-amber-500/60 bg-amber-500/10 text-amber-200" : s.cls
      }`}
    >
      {vencendo
        ? dias! < 0
          ? `Prazo encerrado há ${-dias!} dia(s)`
          : `Vence em ${dias} dia(s)`
        : s.rotulo}
    </span>
  );
}

type Session = { userId: string; profile: unknown; cargo: string | null };

/* ---------- página ---------- */

function TacPage() {
  const { id, novo, processo } = Route.useSearch();
  const sessionFn = useServerFn(getSessionInfo);
  const { data: session } = useQuery({ queryKey: ["session-info"], queryFn: () => sessionFn() });
  const cargo = session?.cargo ?? null;
  const ativo = (session?.profile as { status?: string } | null | undefined)?.status === "ativo";
  const interno = ativo && isInternalRole(cargo);
  const listFn = useServerFn(listTacs);
  const { data, isLoading, error } = useQuery({
    queryKey: ["tacs"],
    queryFn: () => listFn(),
    enabled: interno,
    refetchInterval: 60_000,
  });

  if (session && !interno) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-5xl p-8 text-sm text-muted-foreground">
          O TAC é restrito a usuários internos ativos.
        </div>
      </div>
    );
  }

  const tacs = data?.tacs ?? [];
  const aberto = id ? (tacs.find((t) => t.id === id) ?? null) : null;
  const config = data?.config ?? null;
  const prox = data?.proximoNumero ?? null;

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
        {error ? (
          <div className="surface p-6 text-sm">
            <div className="font-semibold">Não foi possível carregar os TACs.</div>
            <div className="mt-1 text-muted-foreground">{(error as Error).message}</div>
          </div>
        ) : isLoading || !session ? (
          <div className="surface p-6 text-sm text-muted-foreground">Carregando TACs…</div>
        ) : novo ? (
          <EditorTac
            key={`novo-${processo ?? ""}`}
            session={session}
            tacs={tacs}
            config={config}
            proximoNumero={prox}
            processoInicial={processo ?? null}
          />
        ) : id ? (
          aberto ? (
            aberto.status === "aguardando_assinatura" || aberto.status === "devolvido" ? (
              <EditorTac
                key={aberto.id}
                session={session}
                tacs={tacs}
                tac={aberto}
                config={config}
                proximoNumero={prox}
              />
            ) : (
              <DetalheTac key={aberto.id} session={session} tac={aberto} config={config} />
            )
          ) : (
            <div className="surface space-y-3 p-6 text-sm">
              <div>TAC não encontrado.</div>
              <Link to="/tac" className="text-primary hover:underline">
                Voltar
              </Link>
            </div>
          )
        ) : (
          <ListaTacs
            tacs={tacs}
            uid={session.userId}
            cargo={cargo}
            proximoNumero={prox}
            config={config}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- lista ---------- */

type Filtro =
  "todos" | "assinar" | "assinatura" | "cumprimento" | "cumpridos" | "descumpridos" | "cancelados";

function ListaTacs({
  tacs,
  uid,
  cargo,
  proximoNumero,
  config,
}: {
  tacs: Tac[];
  uid: string;
  cargo: string | null;
  proximoNumero: string | null;
  config: TacConfig | null;
}) {
  const navigate = useNavigate();
  const cupula = isAdminRole(cargo);
  const paraMim = (t: Tac) => t.status === "aguardando_assinatura" && t.destinatarios.includes(uid);
  const [filtro, setFiltro] = useState<Filtro>(() => (tacs.some(paraMim) ? "assinar" : "todos"));
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(30);
  const [configurando, setConfigurando] = useState(false);

  const ano = new Date().getFullYear();
  const emCumprimento = tacs.filter((t) => t.status === "em_cumprimento");
  const vencendo = emCumprimento.filter((t) => (diasRestantes(t) ?? 999) <= 30);
  const cumpridosAno = tacs.filter((t) => t.status === "cumprido" && t.ano === ano).length;

  const filtros: { id: Filtro; rotulo: string; teste: (t: Tac) => boolean }[] = [
    { id: "todos", rotulo: "Todos", teste: () => true },
    ...(cupula ? [{ id: "assinar" as const, rotulo: "Para eu assinar", teste: paraMim }] : []),
    {
      id: "assinatura",
      rotulo: "Em assinatura",
      teste: (t) => t.status === "aguardando_assinatura" || t.status === "devolvido",
    },
    { id: "cumprimento", rotulo: "Em cumprimento", teste: (t) => t.status === "em_cumprimento" },
    { id: "cumpridos", rotulo: "Cumpridos", teste: (t) => t.status === "cumprido" },
    { id: "descumpridos", rotulo: "Descumpridos", teste: (t) => t.status === "descumprido" },
    { id: "cancelados", rotulo: "Cancelados", teste: (t) => t.status === "cancelado" },
  ];
  const ativo = filtros.find((f) => f.id === filtro) ?? filtros[0];
  const q = busca.trim().toLowerCase();
  const lista = tacs.filter(
    (t) =>
      ativo.teste(t) &&
      (!q ||
        `${t.numero ?? ""} ${t.compromissario_posto ?? ""} ${t.compromissario_nome} ${t.compromissario_re ?? ""} ${t.compromissario_opm ?? ""} ${rotuloOrigem(t) ?? ""}`
          .toLowerCase()
          .includes(q)),
  );
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs transition ${
      on
        ? "border-primary/55 bg-primary/10 font-semibold text-primary"
        : "border-border hover:bg-surface-2"
    }`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Consensualidade disciplinar
          </div>
          <h1 className="font-serif text-2xl">Termos de Ajustamento de Conduta</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {cupula && (
            <button
              type="button"
              onClick={() => setConfigurando(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-2"
            >
              <Settings2 className="h-4 w-4" aria-hidden /> Configurar requisitos
            </button>
          )}
          <Link
            to="/tac"
            search={{ novo: true }}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" aria-hidden /> Novo TAC
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <div className="surface p-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            Em cumprimento
          </div>
          <div className="tabular text-2xl font-semibold">{emCumprimento.length}</div>
        </div>
        <div className={`surface p-3 ${vencendo.length ? "border-amber-500/50" : ""}`}>
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-amber-300/90">
            Vencem em 30 dias
          </div>
          <div className="tabular text-2xl font-semibold">{vencendo.length}</div>
        </div>
        <div className="surface p-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            Cumpridos em {ano}
          </div>
          <div className="tabular text-2xl font-semibold">{cumpridosAno}</div>
        </div>
        <div className="surface p-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            Próximo número
          </div>
          <div className="mt-1 font-mono text-lg text-primary">TAC {proximoNumero ?? "—"}</div>
        </div>
      </div>

      <div className="surface flex flex-wrap items-center gap-2 p-3">
        <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-md border border-border bg-input px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setLimite(30);
            }}
            placeholder="Nº, policial, RE, OPM ou origem…"
            aria-label="Buscar TAC"
            className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {filtros.map((f) => (
            <button
              key={f.id}
              type="button"
              className={chip(filtro === f.id)}
              onClick={() => setFiltro(f.id)}
            >
              {f.rotulo} <span className="tabular opacity-75">{tacs.filter(f.teste).length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="surface overflow-hidden">
        {lista.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum TAC aqui.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-border bg-background/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Número</th>
                  <th className="px-3 py-2.5 font-semibold">Compromissário</th>
                  <th className="px-3 py-2.5 font-semibold">Origem</th>
                  <th className="px-3 py-2.5 font-semibold">Período de prova</th>
                  <th className="px-4 py-2.5 font-semibold">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lista.slice(0, limite).map((t) => {
                  const pct = progresso(t);
                  const dias = diasRestantes(t);
                  const cor =
                    t.status === "descumprido"
                      ? "bg-destructive"
                      : t.status === "cumprido"
                        ? "bg-emerald-400"
                        : dias != null && dias <= 30
                          ? "bg-amber-400"
                          : "bg-sky-400";
                  return (
                    <tr
                      key={t.id}
                      onClick={() => navigate({ to: "/tac", search: { id: t.id } })}
                      className={`cursor-pointer hover:bg-surface-2 ${t.status === "cancelado" ? "opacity-60" : ""}`}
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12.5px] text-primary">
                        {t.numero ?? "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium">
                          {nomeCurto(t.compromissario_posto, t.compromissario_nome)}
                          {t.compromissario_re ? ` · RE ${t.compromissario_re}` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t.compromissario_opm ?? "—"}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                        {t.origem_denuncia_id ? (
                          <Link
                            to="/corregedoria"
                            search={{ id: t.origem_denuncia_id }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-primary hover:underline"
                          >
                            {rotuloOrigem(t)}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">{rotuloOrigem(t) ?? "—"}</span>
                        )}
                      </td>
                      <td className="min-w-[210px] px-3 py-2.5">
                        {t.inicio ? (
                          <>
                            <div className="text-xs text-muted-foreground tabular">
                              {dataBr(t.inicio)} → {dataBr(t.fim)}
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
                              <div
                                className={`h-full ${cor}`}
                                style={{ width: `${t.status === "cumprido" ? 100 : pct}%` }}
                              />
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {t.prazo_meses} meses após a celebração
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusChip t={t} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {lista.length > limite && (
          <div className="border-t border-border p-3 text-center">
            <button
              type="button"
              onClick={() => setLimite((l) => l + 30)}
              className="rounded-md border border-border px-4 py-1.5 text-xs hover:bg-surface-2"
            >
              Mostrar mais ({lista.length - limite})
            </button>
          </div>
        )}
      </div>

      {configurando && config && (
        <ConfigTac config={config} onClose={() => setConfigurando(false)} />
      )}
    </>
  );
}

/* ---------- novo / revisão / assinatura ---------- */

function EditorTac({
  session,
  tacs,
  tac,
  config,
  proximoNumero,
  processoInicial,
}: {
  session: Session;
  tacs: Tac[];
  tac?: Tac;
  config: TacConfig | null;
  proximoNumero: string | null;
  processoInicial?: string | null;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const uid = session.userId;
  const cargo = session.cargo;
  const perfil = session.profile as { nome?: string; posto_graduacao?: string | null } | null;
  const cupula = isAdminRole(cargo);

  const denunciasFn = useServerFn(listDenuncias);
  const { data: denuncias } = useQuery({ queryKey: ["denuncias"], queryFn: () => denunciasFn() });
  const assinantesFn = useServerFn(listAssinantesMinuta);
  const { data: assinantes } = useQuery({
    queryKey: ["assinantes-minuta"],
    queryFn: () => assinantesFn(),
  });
  const nomes = new Map((assinantes ?? []).map((a) => [a.id, a]));

  const criarFn = useServerFn(criarTac);
  const assinarFn = useServerFn(assinarTac);
  const reenviarFn = useServerFn(reenviarTac);
  const devolverFn = useServerFn(devolverTac);
  const cancelarFn = useServerFn(cancelarTac);

  const ehRedator = !tac || tac.redator_id === uid;
  const podeAssinar =
    !!tac && tac.status === "aguardando_assinatura" && tac.destinatarios.includes(uid) && cupula;
  const podeCorrigir =
    !!tac && ehRedator && (tac.status === "aguardando_assinatura" || tac.status === "devolvido");
  const editavel = !tac || podeAssinar || podeCorrigir;
  const podeCancelar = !!tac && (ehRedator || cupula);

  // Campos
  const [posto, setPosto] = useState(tac?.compromissario_posto ?? "");
  const [nome, setNome] = useState(tac?.compromissario_nome ?? "");
  const [re, setRe] = useState(tac?.compromissario_re ?? "");
  const [opm, setOpm] = useState(tac?.compromissario_opm ?? "");
  const [origemId, setOrigemId] = useState<string | null>(
    tac?.origem_denuncia_id ?? processoInicial ?? null,
  );
  const [origemTexto, setOrigemTexto] = useState(tac?.origem_texto ?? "");
  const [dataFato, setDataFato] = useState(tac?.data_fato ?? "");
  const [capitulacao, setCapitulacao] = useState(tac?.capitulacao ?? "");
  const [fato, setFato] = useState(tac?.fato ?? "");
  const [requisitos, setRequisitos] = useState<string[]>(
    tac?.requisitos ?? config?.requisitos ?? [],
  );
  const [marcados, setMarcados] = useState<boolean[]>(() =>
    tac ? tac.requisitos.map(() => true) : (config?.requisitos ?? []).map(() => false),
  );
  const [novoReq, setNovoReq] = useState("");
  const [obrigacoes, setObrigacoes] = useState<string[]>(
    tac?.obrigacoes ?? config?.obrigacoes ?? [""],
  );
  const [prazo, setPrazo] = useState(tac?.prazo_meses ?? 6);
  const [acompanhamento, setAcompanhamento] = useState(
    tac?.acompanhamento ??
      "Corregedoria da Polícia Militar, com informação do comandante imediato ao final do período.",
  );

  // TAC anterior do mesmo policial nos últimos 12 meses (pelo RE; sem RE, pelo nome).
  const anterior = useMemo(() => {
    const chave = re.trim() || nome.trim().toLowerCase();
    if (!chave) return null;
    const limite = Date.now() - 365 * DIA;
    return (
      tacs.find(
        (t) =>
          t.id !== tac?.id &&
          t.celebrado_em &&
          t.status !== "cancelado" &&
          new Date(t.celebrado_em).getTime() >= limite &&
          (re.trim()
            ? t.compromissario_re === re.trim()
            : t.compromissario_nome.trim().toLowerCase() === chave),
      ) ?? null
    );
  }, [re, nome, tacs, tac?.id]);
  const idxSemTac = requisitos.findIndex((r) => /TAC nos [úu]ltimos/i.test(r));
  // Marca sozinho "não celebrou TAC nos últimos 12 meses" quando a ficha confirma.
  useEffect(() => {
    if (tac || idxSemTac < 0 || !(re.trim() || nome.trim())) return;
    setMarcados((m) => m.map((v, i) => (i === idxSemTac ? !anterior : v)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anterior, idxSemTac]);

  const procNumero = (did: string | null) => {
    const d = (denuncias ?? []).find((x: { id: string }) => x.id === did) as
      { numero_procedimento?: string | null; numero_protocolo: string } | undefined;
    return d ? (d.numero_procedimento ?? d.numero_protocolo) : null;
  };

  const obrigacoesValidas = obrigacoes.map((o) => o.trim()).filter(Boolean);
  const todosMarcados =
    requisitos.length > 0 && marcados.length === requisitos.length && marcados.every(Boolean);
  const completo =
    nome.trim().length >= 3 &&
    textoPuro(fato).length >= 10 &&
    obrigacoesValidas.length > 0 &&
    todosMarcados;

  const dados = (): DadosTac => ({
    compromissario_nome: nome.trim(),
    compromissario_posto: posto.trim() || null,
    compromissario_re: re.trim() || null,
    compromissario_opm: opm.trim() || null,
    origem_denuncia_id: origemId,
    origem_texto: origemTexto.trim() || null,
    data_fato: dataFato || null,
    capitulacao: capitulacao.trim() || null,
    fato: sanitizeAtoHtml(fato),
    requisitos: requisitos.map((r) => r.trim()).filter(Boolean),
    obrigacoes: obrigacoesValidas,
    prazo_meses: prazo,
    acompanhamento: acompanhamento.trim() || null,
  });

  // Prévia ao vivo
  const eu = { nome: perfil?.nome ?? "", posto: perfil?.posto_graduacao ?? null, cargo };
  const autoridadePrevia = podeAssinar || (!tac && cupula) ? eu : null;
  const tacPrevia: Tac = useMemo(
    () =>
      ({
        ...(tac ?? ({} as Tac)),
        id: tac?.id ?? "previa",
        status: "aguardando_assinatura",
        numero: null,
        celebrado_em: null,
        inicio: null,
        fim: null,
        compromissario_nome: nome || "[compromissário]",
        compromissario_posto: posto || null,
        compromissario_re: re || null,
        compromissario_opm: opm || null,
        origem_denuncia_id: origemId,
        origem_texto: origemTexto || null,
        denuncias: origemId
          ? { numero_procedimento: procNumero(origemId), numero_protocolo: "" }
          : null,
        data_fato: dataFato || null,
        capitulacao: capitulacao || null,
        fato: fato || "<p>[síntese do fato]</p>",
        requisitos,
        obrigacoes: obrigacoesValidas.length ? obrigacoesValidas : ["[obrigação]"],
        prazo_meses: prazo,
        acompanhamento,
        clausula_descumprimento: null,
        disposicoes_finais: null,
        signatario_nome: autoridadePrevia?.nome ?? null,
        signatario_posto: autoridadePrevia?.posto ?? null,
        signatario_cargo: autoridadePrevia?.cargo ?? null,
      }) as Tac,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      nome,
      posto,
      re,
      opm,
      origemId,
      origemTexto,
      dataFato,
      capitulacao,
      fato,
      requisitos,
      obrigacoes,
      prazo,
      acompanhamento,
      denuncias,
      autoridadePrevia?.nome,
    ],
  );
  const [previaUrl, setPreviaUrl] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const baixarRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    let cancelado = false;
    const t = setTimeout(async () => {
      setGerando(true);
      try {
        const p = await previaTacPdf(pdfDoTac(tacPrevia, config, proximoNumero));
        if (cancelado) {
          URL.revokeObjectURL(p.url);
          return;
        }
        baixarRef.current = p.baixar;
        setPreviaUrl((antiga) => {
          if (antiga) URL.revokeObjectURL(antiga);
          return p.url;
        });
      } catch {
        /* tenta de novo na próxima alteração */
      } finally {
        if (!cancelado) setGerando(false);
      }
    }, 800);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [tacPrevia, config, proximoNumero]);

  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ["tacs"] });
    qc.invalidateQueries({ queryKey: ["tacs-pendentes"] });
    if (origemId) qc.invalidateQueries({ queryKey: ["denuncia", origemId] });
  };

  const [confirmar, setConfirmar] = useState(false);
  const [encaminhando, setEncaminhando] = useState(false);
  const [devolvendo, setDevolvendo] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [cancelando, setCancelando] = useState(false);

  const mCelebrar = useMutation({
    mutationFn: async () => {
      if (tac) {
        const r = await assinarFn({ data: { tac_id: tac.id, dados: dados() } });
        return { id: tac.id, numero: r.numero };
      }
      return criarFn({ data: { dados: dados(), destinatarios: [] } });
    },
    onSuccess: (r) => {
      toast.success(`TAC nº ${r.numero} celebrado.`);
      setConfirmar(false);
      atualizar();
      navigate({ to: "/tac", search: { id: r.id } });
    },
    onError: (e) => {
      setConfirmar(false);
      toast.error((e as Error)?.message || "Não foi possível celebrar.");
      atualizar();
    },
  });
  const mDevolver = useMutation({
    mutationFn: () => devolverFn({ data: { tac_id: tac!.id, observacao } }),
    onSuccess: () => {
      toast.success("TAC devolvido ao redator.");
      setDevolvendo(false);
      atualizar();
      navigate({ to: "/tac" });
    },
    onError: (e) => toast.error((e as Error)?.message || "Não foi possível devolver."),
  });
  const mCancelar = useMutation({
    mutationFn: () => cancelarFn({ data: { tac_id: tac!.id, motivo: null } }),
    onSuccess: () => {
      toast.success("TAC cancelado.");
      setCancelando(false);
      atualizar();
      navigate({ to: "/tac" });
    },
    onError: (e) => toast.error((e as Error)?.message || "Não foi possível cancelar."),
  });

  const rotulo = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
  const campoCls =
    "w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm read-only:opacity-80 disabled:opacity-80";
  const secao = "surface space-y-3 p-5";
  const falta = requisitos.length - marcados.filter(Boolean).length;
  const fimPrevisto = somarMeses(new Date(), prazo);

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/tac" className="inline-flex items-center gap-1 text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden /> TAC
        </Link>
        <span>/</span>
        <span>{tac ? "Em assinatura" : "Novo termo"}</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-serif text-xl">
              {tac ? "TAC em assinatura" : "Novo Termo de Ajustamento de Conduta"}
            </h1>
            {tac ? (
              <StatusChip t={tac} />
            ) : (
              <span className="rounded-md border border-primary/45 px-2 py-0.5 font-mono text-xs text-primary">
                TAC Nº {proximoNumero ?? "—"} ao celebrar
              </span>
            )}
          </div>

          {tac?.status === "devolvido" && (
            <div className="rounded-md border border-destructive/45 bg-destructive/10 p-3 text-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-red-300">
                Devolvido por {tac.devolvido_por_nome ?? "autoridade"}
              </div>
              <div className="mt-1 whitespace-pre-wrap">{tac.observacao_devolucao}</div>
            </div>
          )}
          {tac && (
            <div className="surface grid gap-1 p-3 text-xs text-muted-foreground">
              <span>
                Redigido por{" "}
                <strong className="text-foreground">
                  {nomeCurto(tac.redator_posto, tac.redator_nome)}
                </strong>{" "}
                em {dataBr(tac.criado_em)}.
              </span>
              <span>
                Para assinatura de:{" "}
                {tac.destinatarios
                  .map((d) => {
                    const a = nomes.get(d);
                    return a
                      ? `${nomeCurto(a.posto_graduacao, a.nome)}${d === uid ? " (você)" : ""}`
                      : "autoridade";
                  })
                  .join("; ")}
              </span>
              {tac.recado && <span className="text-foreground">“{tac.recado}”</span>}
            </div>
          )}

          <section className={secao}>
            <h2 className={rotulo}>1. Compromissário e fato</h2>
            <div className="grid gap-3 md:grid-cols-[170px_minmax(0,1fr)]">
              <label className="grid gap-1.5 text-xs">
                <span className="text-muted-foreground">Posto/graduação</span>
                <select
                  className={campoCls}
                  value={posto}
                  disabled={!editavel}
                  onChange={(e) => setPosto(e.target.value)}
                >
                  <option value="">—</option>
                  {POSTOS_GRADUACOES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                  {posto && !(POSTOS_GRADUACOES as readonly string[]).includes(posto) && (
                    <option value={posto}>{posto}</option>
                  )}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs">
                <span className="text-muted-foreground">Nome do policial</span>
                <input
                  className={campoCls}
                  value={nome}
                  readOnly={!editavel}
                  maxLength={150}
                  onChange={(e) => setNome(e.target.value)}
                />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1.5 text-xs">
                <span className="text-muted-foreground">RE</span>
                <input
                  className={campoCls}
                  value={re}
                  readOnly={!editavel}
                  maxLength={30}
                  onChange={(e) => setRe(e.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-xs">
                <span className="text-muted-foreground">OPM</span>
                <input
                  className={campoCls}
                  value={opm}
                  readOnly={!editavel}
                  list="tac-opms"
                  maxLength={120}
                  onChange={(e) => setOpm(e.target.value)}
                />
                <datalist id="tac-opms">
                  {OPMS.map((o) => (
                    <option key={o} value={o} />
                  ))}
                </datalist>
              </label>
            </div>
            {(re.trim() || nome.trim()) && (
              <div
                className={`flex items-start gap-2 rounded-md border p-2.5 text-xs ${
                  anterior
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-100"
                    : "border-emerald-500/40 bg-emerald-500/5 text-emerald-100"
                }`}
              >
                {anterior ? (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                )}
                {anterior
                  ? `Atenção: este policial celebrou o TAC nº ${anterior.numero} em ${dataBr(anterior.celebrado_em)}.`
                  : "Nenhum TAC deste policial nos últimos 12 meses."}
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1.5 text-xs">
                <span className="text-muted-foreground">Processo de origem (fica suspenso)</span>
                <select
                  className={campoCls}
                  value={origemId ?? ""}
                  disabled={!editavel}
                  onChange={(e) => setOrigemId(e.target.value || null)}
                >
                  <option value="">— nenhum —</option>
                  {(denuncias ?? [])
                    .filter((d: { numero_procedimento?: string | null }) => d.numero_procedimento)
                    .map((d: { id: string; numero_procedimento?: string | null }) => (
                      <option key={d.id} value={d.id}>
                        {d.numero_procedimento}
                      </option>
                    ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs">
                <span className="text-muted-foreground">Outra origem (ex.: PDO nº 012/2026)</span>
                <input
                  className={campoCls}
                  value={origemTexto}
                  readOnly={!editavel}
                  maxLength={150}
                  onChange={(e) => setOrigemTexto(e.target.value)}
                />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-[170px_minmax(0,1fr)]">
              <label className="grid gap-1.5 text-xs">
                <span className="text-muted-foreground">Data do fato</span>
                <input
                  type="date"
                  className={campoCls}
                  value={dataFato}
                  max={hojeIso()}
                  readOnly={!editavel}
                  onChange={(e) => setDataFato(e.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-xs">
                <span className="text-muted-foreground">Capitulação</span>
                <input
                  className={campoCls}
                  value={capitulacao}
                  readOnly={!editavel}
                  maxLength={300}
                  placeholder="[artigo/inciso do RDPM] — transgressão de natureza leve"
                  onChange={(e) => setCapitulacao(e.target.value)}
                />
              </label>
            </div>
            <div className="grid gap-1.5 text-xs">
              <span className="text-muted-foreground">Síntese do fato</span>
              {editavel ? (
                <RichTextEditor value={fato} onChange={setFato} minHeight={150} />
              ) : (
                <div
                  className="ato-body rounded-md border border-border p-3 text-sm"
                  dangerouslySetInnerHTML={{ __html: sanitizeAtoHtml(fato) }}
                />
              )}
            </div>
          </section>

          <section className={secao}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className={rotulo}>2. Requisitos (todos obrigatórios)</h2>
              <span
                className={`text-xs font-semibold ${falta ? "text-amber-300" : "text-emerald-300"}`}
              >
                {marcados.filter(Boolean).length} de {requisitos.length}
              </span>
            </div>
            {requisitos.map((r, i) => (
              <div key={`${i}-${r}`} className="flex items-center gap-2">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={!!marcados[i]}
                  disabled={!editavel}
                  onClick={() => setMarcados((m) => m.map((v, j) => (j === i ? !v : v)))}
                  className={`flex min-h-[40px] flex-1 items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition ${
                    marcados[i]
                      ? "border-primary/55 bg-primary/10"
                      : "border-border bg-background/40 hover:bg-surface-2"
                  }`}
                >
                  <span
                    className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded ${
                      marcados[i] ? "bg-primary text-primary-foreground" : "border border-border"
                    }`}
                  >
                    {marcados[i] && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span className="flex-1">
                    {r}
                    {!tac && i === idxSemTac && (re.trim() || nome.trim()) && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        · conferido pelo sistema
                      </span>
                    )}
                  </span>
                </button>
                {editavel && (config?.requisitos ?? []).indexOf(r) < 0 && (
                  <button
                    type="button"
                    aria-label="Remover requisito específico"
                    onClick={() => {
                      setRequisitos((l) => l.filter((_, j) => j !== i));
                      setMarcados((m) => m.filter((_, j) => j !== i));
                    }}
                    className="rounded-md p-2 text-muted-foreground hover:bg-surface-2"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
            ))}
            {editavel && (
              <div className="flex gap-2">
                <input
                  className={campoCls}
                  value={novoReq}
                  maxLength={500}
                  placeholder="Requisito específico deste caso (opcional)"
                  onChange={(e) => setNovoReq(e.target.value)}
                />
                <button
                  type="button"
                  disabled={novoReq.trim().length < 3}
                  onClick={() => {
                    setRequisitos((l) => [...l, novoReq.trim()]);
                    setMarcados((m) => [...m, false]);
                    setNovoReq("");
                  }}
                  className="whitespace-nowrap rounded-md border border-border px-3 text-sm hover:bg-surface-2 disabled:opacity-50"
                >
                  Adicionar
                </button>
              </div>
            )}
          </section>

          <section className={secao}>
            <h2 className={rotulo}>3. Obrigações do compromissário</h2>
            {obrigacoes.map((o, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="pt-2.5 font-mono text-xs text-primary">{i + 1}.</span>
                <textarea
                  rows={2}
                  className={campoCls}
                  value={o}
                  readOnly={!editavel}
                  maxLength={800}
                  onChange={(e) =>
                    setObrigacoes((l) => l.map((x, j) => (j === i ? e.target.value : x)))
                  }
                />
                {editavel && obrigacoes.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Remover obrigação ${i + 1}`}
                    onClick={() => setObrigacoes((l) => l.filter((_, j) => j !== i))}
                    className="rounded-md p-2 text-muted-foreground hover:bg-surface-2"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
            ))}
            {editavel && (
              <button
                type="button"
                onClick={() => setObrigacoes((l) => [...l, ""])}
                className="rounded-md border border-dashed border-border px-3 py-1.5 text-xs hover:bg-surface-2"
              >
                + Adicionar obrigação
              </button>
            )}
          </section>

          <section className={secao}>
            <h2 className={rotulo}>4. Prazo e acompanhamento</h2>
            <div className="flex flex-wrap items-center gap-2">
              {[3, 6, 12].map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={!editavel}
                  onClick={() => setPrazo(m)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm ${
                    prazo === m
                      ? "border-primary/60 bg-primary/10 font-semibold text-primary"
                      : "border-border hover:bg-surface-2"
                  }`}
                >
                  {m} meses
                </button>
              ))}
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                outro:
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={prazo}
                  readOnly={!editavel}
                  onChange={(e) => setPrazo(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
                  className="w-16 rounded-md border border-border bg-surface-2 px-2 py-1 text-sm"
                />
                meses
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Começa na data da celebração; se celebrado hoje, vai até{" "}
              {fimPrevisto.toLocaleDateString("pt-BR")}.
            </p>
            <label className="grid gap-1.5 text-xs">
              <span className="text-muted-foreground">Acompanhamento</span>
              <input
                className={campoCls}
                value={acompanhamento}
                readOnly={!editavel}
                maxLength={500}
                onChange={(e) => setAcompanhamento(e.target.value)}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              As cláusulas de descumprimento e as disposições finais entram como estão na
              configuração do TAC.
            </p>
          </section>

          <div className="surface flex flex-wrap items-center justify-end gap-2 p-4">
            <span className="mr-auto text-xs text-muted-foreground">
              {falta > 0
                ? `Marque todos os requisitos para prosseguir (faltam ${falta}).`
                : "Requisitos conferidos."}
            </span>
            {podeCancelar && (
              <button
                type="button"
                onClick={() => setCancelando(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-surface-2"
              >
                <Trash2 className="h-4 w-4" aria-hidden /> Cancelar
              </button>
            )}
            {podeAssinar && (
              <button
                type="button"
                onClick={() => setDevolvendo(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-destructive/60 px-3 py-2 text-sm text-red-300 hover:bg-destructive/10"
              >
                <CornerUpLeft className="h-4 w-4" aria-hidden /> Devolver com observação
              </button>
            )}
            {(!tac || podeCorrigir) && (
              <button
                type="button"
                onClick={() => setEncaminhando(true)}
                disabled={!completo}
                className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                  cupula && !tac
                    ? "border border-primary bg-primary/15 text-primary hover:bg-primary/25"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                <Send className="h-4 w-4" aria-hidden />{" "}
                {tac ? "Salvar e reenviar" : "Encaminhar para assinatura"}
              </button>
            )}
            {((!tac && cupula) || podeAssinar) && (
              <button
                type="button"
                onClick={() => setConfirmar(true)}
                disabled={!completo || mCelebrar.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                <FileSignature className="h-4 w-4" aria-hidden />
                {podeAssinar ? "Assinar e celebrar" : `Celebrar TAC nº ${proximoNumero ?? ""}`}
              </button>
            )}
          </div>
          {!tac && !cupula && (
            <p className="text-xs text-muted-foreground">
              O TAC é celebrado pelo Corregedor-Geral, Subcorregedor-Geral ou Corregedor Supervisor.
              Encaminhe para assinatura.
            </p>
          )}
        </div>

        <PreviaPdf
          url={previaUrl}
          gerando={gerando}
          onBaixar={() => baixarRef.current?.()}
          titulo="Prévia do termo (atualiza enquanto você digita)"
        />
      </div>

      {encaminhando && (
        <EncaminharMinutaDialog
          denunciaId={origemId ?? ""}
          procedimento={nomeCurto(posto, nome) || "TAC"}
          rotuloAto="Termo de Ajustamento de Conduta"
          papel="redator do termo"
          minuta={
            tac ? { id: tac.id, destinatarios: tac.destinatarios, recado: tac.recado } : undefined
          }
          conteudo={() => ({ especie: "despacho", teor: "", dados: {}, anexos: [] })}
          enviar={async (destinatarios, recado) => {
            if (tac)
              await reenviarFn({ data: { tac_id: tac.id, dados: dados(), destinatarios, recado } });
            else await criarFn({ data: { dados: dados(), destinatarios, recado } });
          }}
          onClose={() => setEncaminhando(false)}
          onDone={() => {
            atualizar();
            navigate({ to: "/tac" });
          }}
        />
      )}

      <AlertDialog open={confirmar} onOpenChange={(v) => !mCelebrar.isPending && setConfirmar(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {podeAssinar ? "Assinar e celebrar o TAC?" : "Celebrar o TAC?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              O termo recebe o nº {proximoNumero ?? "seguinte"} (ou o próximo livre), com a sua
              assinatura e período de prova de {prazo} meses a partir de hoje.
              {origemId &&
                " O processo de origem fica suspenso e o fato é registrado na linha do tempo."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mCelebrar.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(ev) => {
                ev.preventDefault();
                mCelebrar.mutate();
              }}
              disabled={mCelebrar.isPending}
            >
              {mCelebrar.isPending ? "Celebrando..." : "Celebrar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelando} onOpenChange={setCancelando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar este TAC?</AlertDialogTitle>
            <AlertDialogDescription>
              Ele sai da fila de assinatura e não recebe número.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => mCancelar.mutate()}>Cancelar TAC</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {devolvendo && tac && (
        <Janela titulo="Devolver ao redator" onClose={() => setDevolvendo(false)}>
          <label className="grid gap-1.5">
            <span className={rotulo}>
              Observação para {nomeCurto(tac.redator_posto, tac.redator_nome)}
            </span>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={5}
              maxLength={2000}
              autoFocus
              className={campoCls}
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDevolvendo(false)}
              className="rounded-md border border-border px-4 py-2 text-sm"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={() => mDevolver.mutate()}
              disabled={observacao.trim().length < 3 || mDevolver.isPending}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
            >
              {mDevolver.isPending ? "Devolvendo..." : "Devolver TAC"}
            </button>
          </div>
        </Janela>
      )}
    </>
  );
}

/* ---------- TAC celebrado: acompanhamento e encerramento ---------- */

function DetalheTac({
  session,
  tac,
  config,
}: {
  session: Session;
  tac: Tac;
  config: TacConfig | null;
}) {
  const qc = useQueryClient();
  const cupula = isAdminRole(session.cargo);
  const encerrarFn = useServerFn(encerrarTac);
  const cancelarFn = useServerFn(cancelarTac);
  const [acao, setAcao] = useState<"cumprido" | "descumprido" | "cancelar" | null>(null);
  const [obs, setObs] = useState("");

  const [previaUrl, setPreviaUrl] = useState<string | null>(null);
  const baixarRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    let vivo = true;
    previaTacPdf(pdfDoTac(tac, config))
      .then((p) => {
        if (!vivo) return URL.revokeObjectURL(p.url);
        baixarRef.current = p.baixar;
        setPreviaUrl(p.url);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
      setPreviaUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return null;
      });
    };
  }, [tac, config]);

  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ["tacs"] });
    if (tac.origem_denuncia_id)
      qc.invalidateQueries({ queryKey: ["denuncia", tac.origem_denuncia_id] });
    qc.invalidateQueries({ queryKey: ["denuncias"] });
  };
  const m = useMutation({
    mutationFn: () =>
      acao === "cancelar"
        ? cancelarFn({ data: { tac_id: tac.id, motivo: obs } })
        : encerrarFn({ data: { tac_id: tac.id, cumprido: acao === "cumprido", obs: obs || null } }),
    onSuccess: () => {
      toast.success(
        acao === "cumprido"
          ? "TAC registrado como cumprido."
          : acao === "descumprido"
            ? "TAC revogado por descumprimento."
            : "TAC cancelado.",
      );
      setAcao(null);
      setObs("");
      atualizar();
    },
    onError: (e) => toast.error((e as Error)?.message || "Não foi possível concluir."),
  });

  const dias = diasRestantes(tac);
  const pct = tac.status === "cumprido" ? 100 : progresso(tac);
  const rotulo = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
  const origem = rotuloOrigem(tac);

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/tac" className="inline-flex items-center gap-1 text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden /> TAC
        </Link>
        <span>/</span>
        <span>{tac.numero}</span>
      </div>

      <div className="surface flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0 space-y-1">
          <div className={rotulo}>Termo de Ajustamento de Conduta</div>
          <h1 className="font-serif text-2xl">TAC nº {tac.numero}</h1>
          <div className="text-sm text-muted-foreground">
            {nomeCurto(tac.compromissario_posto, tac.compromissario_nome)}
            {tac.compromissario_re ? ` · RE ${tac.compromissario_re}` : ""}
            {tac.compromissario_opm ? ` · ${tac.compromissario_opm}` : ""}
            {origem && (
              <>
                {" · origem: "}
                {tac.origem_denuncia_id ? (
                  <Link
                    to="/corregedoria"
                    search={{ id: tac.origem_denuncia_id }}
                    className="text-primary hover:underline"
                  >
                    {origem}
                  </Link>
                ) : (
                  origem
                )}
              </>
            )}
          </div>
        </div>
        <div className="min-w-[280px] space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground tabular">
            <span>{dataBr(tac.inicio)}</span>
            <StatusChip t={tac} />
            <span>{dataBr(tac.fim)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <div
              className={`h-full ${tac.status === "descumprido" ? "bg-destructive" : tac.status === "cumprido" ? "bg-emerald-400" : (dias ?? 99) <= 30 ? "bg-amber-400" : "bg-sky-400"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
        <div className="min-w-0 space-y-4">
          <section className="surface space-y-2 p-5">
            <h2 className={rotulo}>Obrigações</h2>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {tac.obrigacoes.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ol>
            <h2 className={`${rotulo} pt-2`}>Acompanhamento</h2>
            <p className="text-sm">{tac.acompanhamento ?? "—"}</p>
          </section>

          <section className="surface space-y-1.5 p-5 text-sm">
            <h2 className={rotulo}>Registro</h2>
            <div>
              Celebrado em {dataBr(tac.celebrado_em)} por{" "}
              <strong>{nomeCurto(tac.signatario_posto, tac.signatario_nome)}</strong> (
              {rotuloCargo(tac.signatario_cargo)})
              {tac.redator_id !== tac.signatario_id &&
                ` · redigido por ${nomeCurto(tac.redator_posto, tac.redator_nome)}`}
              .
            </div>
            {tac.origem_denuncia_id && tac.status === "em_cumprimento" && (
              <div className="text-muted-foreground">
                O processo de origem está suspenso até o fim do período de prova.
              </div>
            )}
            {tac.encerrado_em && (
              <div>
                {tac.status === "cumprido" ? "Cumprimento registrado" : "Descumprimento registrado"}{" "}
                em {dataBr(tac.encerrado_em)} por {tac.encerrado_por_nome}
                {tac.encerramento_obs ? ` — ${tac.encerramento_obs}` : ""}.
              </div>
            )}
            {tac.cancelado_em && (
              <div>
                Cancelado em {dataBr(tac.cancelado_em)} por {tac.cancelado_por_nome}
                {tac.motivo_cancelamento ? ` — ${tac.motivo_cancelamento}` : ""}.
              </div>
            )}
          </section>

          {cupula && tac.status === "em_cumprimento" && (
            <section className="surface space-y-3 p-5">
              <h2 className={rotulo}>Encerrar o período de prova</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAcao("cumprido")}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> Registrar cumprimento e arquivar
                </button>
                <button
                  type="button"
                  onClick={() => setAcao("descumprido")}
                  className="inline-flex items-center gap-1.5 rounded-md border border-destructive/60 px-4 py-2 text-sm text-red-300 hover:bg-destructive/10"
                >
                  <XCircle className="h-4 w-4" aria-hidden /> Registrar descumprimento
                </button>
                <button
                  type="button"
                  onClick={() => setAcao("cancelar")}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-surface-2"
                >
                  <Trash2 className="h-4 w-4" aria-hidden /> Cancelar termo
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Cumprido:{" "}
                {tac.origem_denuncia_id
                  ? "o processo de origem é arquivado."
                  : "o fato é arquivado."}{" "}
                Descumprido ou cancelado: o termo é revogado e o processo de origem retoma o curso,
                com o tempo de suspensão devolvido ao prazo prescricional.
              </p>
            </section>
          )}
        </div>

        <PreviaPdf
          url={previaUrl}
          gerando={!previaUrl}
          onBaixar={() => baixarRef.current?.()}
          titulo="PDF do termo"
        />
      </div>

      {acao && (
        <Janela
          titulo={
            acao === "cumprido"
              ? "Registrar cumprimento"
              : acao === "descumprido"
                ? "Registrar descumprimento"
                : "Cancelar o termo"
          }
          onClose={() => setAcao(null)}
        >
          <p className="text-sm text-muted-foreground">
            {acao === "cumprido"
              ? "O TAC passa a constar como cumprido" +
                (tac.origem_denuncia_id ? " e o processo de origem é arquivado." : ".")
              : "O termo é revogado" +
                (tac.origem_denuncia_id ? " e o processo de origem retoma o curso." : ".")}
          </p>
          <label className="grid gap-1.5">
            <span className={rotulo}>
              {acao === "cumprido"
                ? "Observação (opcional)"
                : acao === "descumprido"
                  ? "O que foi descumprido"
                  : "Motivo"}
            </span>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={4}
              maxLength={2000}
              autoFocus
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAcao(null)}
              className="rounded-md border border-border px-4 py-2 text-sm"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={() => m.mutate()}
              disabled={(acao !== "cumprido" && obs.trim().length < 3) || m.isPending}
              className={`rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                acao === "cumprido"
                  ? "bg-primary text-primary-foreground"
                  : "bg-destructive text-destructive-foreground"
              }`}
            >
              {m.isPending ? "Gravando..." : "Confirmar"}
            </button>
          </div>
        </Janela>
      )}
    </>
  );
}

/* ---------- configuração (cúpula) ---------- */

function ListaEditavel({
  titulo,
  itens,
  onChange,
  placeholder,
}: {
  titulo: string;
  itens: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= itens.length) return;
    const n = itens.slice();
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {titulo}
      </div>
      {itens.map((it, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <span className="pt-2.5 font-mono text-xs text-primary">{i + 1}.</span>
          <textarea
            rows={2}
            value={it}
            maxLength={800}
            onChange={(e) => onChange(itens.map((x, j) => (j === i ? e.target.value : x)))}
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
          />
          <div className="flex flex-col">
            <button
              type="button"
              aria-label="Subir"
              onClick={() => mover(i, -1)}
              className="rounded p-1 hover:bg-surface-2"
            >
              <ArrowUp className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Descer"
              onClick={() => mover(i, 1)}
              className="rounded p-1 hover:bg-surface-2"
            >
              <ArrowDown className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <button
            type="button"
            aria-label={`Remover item ${i + 1}`}
            onClick={() => onChange(itens.filter((_, j) => j !== i))}
            className="rounded-md p-2 text-muted-foreground hover:bg-surface-2"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...itens, ""])}
        className="rounded-md border border-dashed border-border px-3 py-1.5 text-xs hover:bg-surface-2"
      >
        + {placeholder}
      </button>
    </div>
  );
}

function ConfigTac({ config, onClose }: { config: TacConfig; onClose: () => void }) {
  const qc = useQueryClient();
  const salvarFn = useServerFn(salvarTacConfig);
  const [requisitos, setRequisitos] = useState(config.requisitos);
  const [obrigacoes, setObrigacoes] = useState(config.obrigacoes);
  const [descumprimento, setDescumprimento] = useState(config.clausula_descumprimento);
  const [finais, setFinais] = useState(config.disposicoes_finais);
  const m = useMutation({
    mutationFn: () =>
      salvarFn({
        data: {
          requisitos: requisitos.map((r) => r.trim()).filter(Boolean),
          obrigacoes: obrigacoes.map((r) => r.trim()).filter(Boolean),
          clausula_descumprimento: descumprimento,
          disposicoes_finais: finais,
        },
      }),
    onSuccess: () => {
      toast.success("Configuração do TAC salva. Vale para os próximos termos.");
      qc.invalidateQueries({ queryKey: ["tacs"] });
      onClose();
    },
    onError: (e) => toast.error((e as Error)?.message || "Não foi possível salvar."),
  });
  return (
    <Janela titulo="Configurar requisitos e cláusulas do TAC" onClose={onClose} largo>
      <p className="text-sm text-muted-foreground">
        Vale para os próximos termos. Os TACs já celebrados continuam com o texto da época
        {config.atualizado_por_nome
          ? ` · última alteração por ${config.atualizado_por_nome} em ${dataBr(config.atualizado_em)}`
          : ""}
        .
      </p>
      <ListaEditavel
        titulo="Requisitos (todos precisam ser marcados para celebrar)"
        itens={requisitos}
        onChange={setRequisitos}
        placeholder="Adicionar requisito"
      />
      <ListaEditavel
        titulo="Obrigações padrão (vêm preenchidas no novo TAC)"
        itens={obrigacoes}
        onChange={setObrigacoes}
        placeholder="Adicionar obrigação"
      />
      <label className="grid gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Cláusula — Do descumprimento
        </span>
        <textarea
          rows={4}
          value={descumprimento}
          onChange={(e) => setDescumprimento(e.target.value)}
          maxLength={3000}
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Cláusula — Disposições finais
        </span>
        <textarea
          rows={3}
          value={finais}
          onChange={(e) => setFinais(e.target.value)}
          maxLength={3000}
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
        />
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border px-4 py-2 text-sm"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={() => m.mutate()}
          disabled={m.isPending || !requisitos.some((r) => r.trim())}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {m.isPending ? "Salvando..." : "Salvar configuração"}
        </button>
      </div>
    </Janela>
  );
}

/* ---------- peças ---------- */

function PreviaPdf({
  url,
  gerando,
  onBaixar,
  titulo,
}: {
  url: string | null;
  gerando: boolean;
  onBaixar: () => void;
  titulo: string;
}) {
  return (
    <section
      aria-label={titulo}
      className="surface flex min-h-[640px] flex-col overflow-hidden xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Handshake className="h-4 w-4" aria-hidden />
          {titulo}
          {gerando && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
        </div>
        <button
          type="button"
          onClick={onBaixar}
          disabled={!url}
          className="inline-flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" aria-hidden /> Baixar PDF
        </button>
      </div>
      {url ? (
        <iframe
          title={titulo}
          src={`${url}#view=FitH`}
          className="min-h-0 w-full flex-1 bg-white"
        />
      ) : (
        <div className="grid flex-1 place-items-center text-sm text-muted-foreground">Gerando…</div>
      )}
    </section>
  );
}

function Janela({
  titulo,
  onClose,
  children,
  largo = false,
}: {
  titulo: string;
  onClose: () => void;
  children: React.ReactNode;
  largo?: boolean;
}) {
  useEffect(() => {
    const aoTeclar = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={(ev) => ev.target === ev.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`surface max-h-[90vh] w-full space-y-3 overflow-y-auto p-5 ${largo ? "max-w-3xl" : "max-w-lg"}`}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg">{titulo}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 hover:bg-surface-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
