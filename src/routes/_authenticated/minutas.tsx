import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  CornerUpLeft,
  Download,
  ExternalLink,
  Eye,
  FileSignature,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { Header } from "@/components/Header";
import { RichTextEditor, sanitizeAtoHtml } from "@/components/RichTextEditor";
import { AtoAnexosLinks } from "@/components/AtoAnexosLinks";
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
import { getDenuncia } from "@/lib/denuncias.functions";
import {
  assinarMinuta,
  cancelarMinuta,
  devolverMinuta,
  listAssinantesMinuta,
  listMinutas,
  type Minuta,
  type StatusMinuta,
} from "@/lib/minutas.functions";
import { montarTeorAto, textoCurto } from "@/lib/teor-ato";
import { previsualizarAtoPdf, type PreviaAtoPdf } from "@/lib/exportProcesso";
import { ROLE_LABELS, isAdminRole, isInternalRole } from "@/lib/access-roles";
import { OPMS } from "@/lib/personnel-options";

export const Route = createFileRoute("/_authenticated/minutas")({
  validateSearch: z.object({ id: z.string().uuid().optional() }),
  component: MinutasPage,
});

/* ---------- categorias ---------- */

type Categoria =
  "despacho" | "decisao" | "certidao" | "ata" | "portaria" | "solucao" | "apfd" | "mandado";

const CATEGORIAS: { id: Categoria; rotulo: string }[] = [
  { id: "despacho", rotulo: "Despacho" },
  { id: "decisao", rotulo: "Decisão" },
  { id: "certidao", rotulo: "Certidão" },
  { id: "ata", rotulo: "Ata" },
  { id: "portaria", rotulo: "Portaria" },
  { id: "solucao", rotulo: "IPM / Solução" },
  { id: "apfd", rotulo: "Atos do APFD" },
  { id: "mandado", rotulo: "Mandado" },
];

function categoriaDe(especie: string): Categoria {
  if (especie === "ipc") return "solucao";
  if (
    especie === "nota_culpa" ||
    especie === "termo_declaracoes" ||
    especie === "auto_interrogatorio"
  )
    return "apfd";
  return (CATEGORIAS.some((c) => c.id === especie) ? especie : "despacho") as Categoria;
}

function rotuloAto(especie: string, tipo: string | null | undefined): string {
  switch (especie) {
    case "despacho":
      return "Despacho";
    case "decisao":
      return "Decisão";
    case "certidao":
      return "Certidão";
    case "ata":
      return "Ata";
    case "mandado":
      return "Mandado";
    case "nota_culpa":
      return "Nota de Culpa";
    case "termo_declaracoes":
      return "Termo de Declarações";
    case "auto_interrogatorio":
      return "Auto de Qualificação de Interrogatório";
    case "portaria":
      return tipo === "apfd" ? "Auto de Prisão em Flagrante Delito" : "Portaria";
    case "ipc":
      return tipo === "apfd"
        ? "APFD — Solução"
        : tipo === "sindicancia"
          ? "SINDPM — Solução"
          : "IPM — Solução";
    default:
      return especie;
  }
}

const STATUS_INFO: Record<StatusMinuta, { rotulo: string; cls: string }> = {
  pendente: {
    rotulo: "Aguardando assinatura",
    cls: "border-amber-500/55 bg-amber-500/10 text-amber-200",
  },
  assinada: { rotulo: "Assinada", cls: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" },
  devolvida: { rotulo: "Devolvida", cls: "border-destructive/55 bg-destructive/10 text-red-300" },
  cancelada: { rotulo: "Cancelada", cls: "border-border bg-muted text-muted-foreground" },
};

const rotuloCargo = (c: string | null | undefined) =>
  c ? ((ROLE_LABELS as Record<string, string>)[c] ?? c) : "";
const nomeComPosto = (posto: string | null | undefined, nome: string | null | undefined) =>
  [posto?.trim(), nome?.trim()].filter(Boolean).join(" ");
const procedimentoDe = (m: Minuta) =>
  m.denuncias?.numero_procedimento ?? m.denuncias?.numero_protocolo ?? "—";

function quando(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(Date.now() - 864e5);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === hoje.toDateString()) return `hoje, ${hora}`;
  if (d.toDateString() === ontem.toDateString()) return `ontem, ${hora}`;
  return `${d.toLocaleDateString("pt-BR")} ${hora}`;
}

function StatusChip({ status }: { status: StatusMinuta }) {
  const s = STATUS_INFO[status];
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.cls}`}
    >
      {s.rotulo}
    </span>
  );
}

/* ---------- página ---------- */

type Aba = "assinar" | "enviadas" | "assinadas" | "devolvidas" | "todas";

function MinutasPage() {
  const { id } = Route.useSearch();
  const sessionFn = useServerFn(getSessionInfo);
  const { data: session } = useQuery({ queryKey: ["session-info"], queryFn: () => sessionFn() });
  const listFn = useServerFn(listMinutas);
  const cargo = session?.cargo ?? null;
  const ativo = (session?.profile as { status?: string } | null | undefined)?.status === "ativo";
  const interno = ativo && isInternalRole(cargo);
  const { data, isLoading, error } = useQuery({
    queryKey: ["minutas"],
    queryFn: () => listFn(),
    enabled: interno,
    refetchInterval: 60_000,
  });
  const assinantesFn = useServerFn(listAssinantesMinuta);
  const { data: assinantes } = useQuery({
    queryKey: ["assinantes-minuta"],
    queryFn: () => assinantesFn(),
    enabled: interno,
  });

  if (session && !interno) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-5xl p-8 text-sm text-muted-foreground">
          As minutas são restritas a usuários internos ativos.
        </div>
      </div>
    );
  }

  const minutas = data?.minutas ?? [];
  const uid = session?.userId ?? "";
  const nomes = new Map((assinantes ?? []).map((a) => [a.id, a]));
  const aberta = id ? (minutas.find((m) => m.id === id) ?? null) : null;

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
        {error ? (
          <div className="surface p-6 text-sm">
            <div className="font-semibold">Não foi possível carregar as minutas.</div>
            <div className="mt-1 text-muted-foreground">{(error as Error).message}</div>
          </div>
        ) : isLoading || !session ? (
          <div className="surface p-6 text-sm text-muted-foreground">Carregando minutas…</div>
        ) : id ? (
          aberta ? (
            <MinutaDetalhe
              key={aberta.id}
              minuta={aberta}
              uid={uid}
              cargo={cargo}
              session={session}
              nomes={nomes}
            />
          ) : (
            <div className="surface space-y-3 p-6 text-sm">
              <div>Minuta não encontrada ou sem acesso.</div>
              <Link to="/minutas" className="text-primary hover:underline">
                Voltar para as minutas
              </Link>
            </div>
          )
        ) : (
          <ListaMinutas minutas={minutas} uid={uid} cargo={cargo} nomes={nomes} />
        )}
      </div>
    </div>
  );
}

/* ---------- lista organizada por categoria ---------- */

function ListaMinutas({
  minutas,
  uid,
  cargo,
  nomes,
}: {
  minutas: Minuta[];
  uid: string;
  cargo: string | null;
  nomes: Map<string, { nome: string; posto_graduacao: string | null }>;
}) {
  const navigate = useNavigate();
  const assinante = isAdminRole(cargo);
  const filtros: Record<Aba, (m: Minuta) => boolean> = {
    assinar: (m) => m.status === "pendente" && m.destinatarios.includes(uid),
    enviadas: (m) => m.autor_id === uid && m.status !== "cancelada",
    assinadas: (m) => m.status === "assinada",
    devolvidas: (m) => m.status === "devolvida",
    todas: (m) => m.status !== "cancelada",
  };
  const abas: { id: Aba; rotulo: string }[] = [
    ...(assinante ? [{ id: "assinar" as const, rotulo: "Para eu assinar" }] : []),
    { id: "enviadas", rotulo: "Encaminhadas por mim" },
    { id: "assinadas", rotulo: "Assinadas" },
    { id: "devolvidas", rotulo: "Devolvidas" },
    ...(assinante ? [{ id: "todas" as const, rotulo: "Todas" }] : []),
  ];
  const [aba, setAba] = useState<Aba>(() =>
    assinante && minutas.some(filtros.assinar) ? "assinar" : assinante ? "assinar" : "enviadas",
  );
  const [cat, setCat] = useState<Categoria | "todas">("todas");
  const [busca, setBusca] = useState("");

  const daAba = minutas.filter(filtros[aba]);
  const q = busca.trim().toLowerCase();
  const filtradas = daAba.filter(
    (m) =>
      (cat === "todas" || categoriaDe(m.especie) === cat) &&
      (!q ||
        `${procedimentoDe(m)} ${m.autor_nome} ${textoCurto(m.teor, 400)} ${rotuloAto(m.especie, m.denuncias?.tipo_procedimento)}`
          .toLowerCase()
          .includes(q)),
  );
  const grupos = CATEGORIAS.map((c) => ({
    ...c,
    itens: filtradas.filter((m) => categoriaDe(m.especie) === c.id),
  })).filter((g) => g.itens.length);
  const contagem = (c: Categoria) => daAba.filter((m) => categoriaDe(m.especie) === c).length;

  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs transition ${
      on
        ? "border-primary/55 bg-primary/10 font-semibold text-primary"
        : "border-border hover:bg-surface-2"
    }`;

  return (
    <>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Assinaturas
        </div>
        <h1 className="font-serif text-2xl">Minutas</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Atos redigidos e encaminhados para assinatura de uma autoridade. Ao assinar, o ato entra
          no processo com quem encaminhou como Escrivão.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border" role="tablist">
        {abas.map((a) => {
          const n = minutas.filter(filtros[a.id]).length;
          const on = aba === a.id;
          return (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setAba(a.id)}
              className={`-mb-px border-b-2 px-3.5 py-2 text-sm transition ${
                on
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {a.rotulo}
              {n > 0 && <span className="ml-1.5 tabular opacity-80">({n})</span>}
            </button>
          );
        })}
      </div>

      <div className="surface flex flex-wrap items-center gap-2 p-3">
        <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md border border-border bg-input px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Processo, escrivão ou trecho do texto…"
            aria-label="Buscar minuta"
            className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={chip(cat === "todas")} onClick={() => setCat("todas")}>
            Todas <span className="tabular opacity-75">{daAba.length}</span>
          </button>
          {CATEGORIAS.filter((c) => c.id !== "mandado" || contagem("mandado") > 0).map((c) => (
            <button
              key={c.id}
              type="button"
              className={chip(cat === c.id)}
              onClick={() => setCat(c.id)}
            >
              {c.rotulo} <span className="tabular opacity-75">{contagem(c.id)}</span>
            </button>
          ))}
        </div>
      </div>

      {grupos.length === 0 ? (
        <div className="surface p-8 text-center text-sm text-muted-foreground">
          {aba === "assinar"
            ? "Nenhuma minuta aguardando a sua assinatura."
            : "Nenhuma minuta aqui."}
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => (
            <section key={g.id} className="surface overflow-hidden" aria-label={g.rotulo}>
              <div className="flex items-center gap-2 border-b border-border bg-background/40 px-4 py-2.5">
                <h2 className="text-xs font-semibold uppercase tracking-wider">{g.rotulo}</h2>
                <span className="text-xs text-muted-foreground tabular">{g.itens.length}</span>
              </div>
              <ul className="divide-y divide-border">
                {g.itens.map((m) => {
                  const destinos = m.destinatarios
                    .map((d) => nomes.get(d))
                    .filter(Boolean)
                    .map((a) => nomeComPosto(a!.posto_graduacao, a!.nome));
                  const paraMim = m.status === "pendente" && m.destinatarios.includes(uid);
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => navigate({ to: "/minutas", search: { id: m.id } })}
                        className="grid w-full gap-x-4 gap-y-1 px-4 py-3 text-left text-sm transition hover:bg-surface-2 md:grid-cols-[170px_minmax(0,1fr)_200px_150px_auto] md:items-center"
                      >
                        <span className="min-w-0">
                          <span className="block font-medium text-primary">
                            {procedimentoDe(m)}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {rotuloAto(m.especie, m.denuncias?.tipo_procedimento)}
                          </span>
                        </span>
                        <span
                          className="min-w-0 truncate text-foreground/85"
                          title={textoCurto(m.teor, 400)}
                        >
                          {textoCurto(m.teor, 160) || "—"}
                        </span>
                        <span className="min-w-0 text-xs text-muted-foreground">
                          <span className="block truncate">
                            Escrivão: {nomeComPosto(m.autor_posto, m.autor_nome)}
                          </span>
                          <span className="block truncate" title={destinos.join("; ")}>
                            {m.status === "assinada"
                              ? `Assinou: ${m.assinada_por_nome ?? "—"}`
                              : `Para: ${destinos.join("; ") || "—"}`}
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground tabular">
                          {quando(m.status === "assinada" ? m.assinada_em : m.atualizado_em)}
                        </span>
                        <span className="flex items-center gap-2 md:justify-end">
                          <StatusChip status={m.status} />
                          {paraMim && (
                            <span className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                              Revisar
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------- revisão, edição e assinatura ---------- */

type Session = { userId: string; profile: unknown; cargo: string | null };

interface CamposPortaria {
  ipmNumero: string;
  tipoProcedimento?: "ipm" | "sindicancia" | "apfd";
  dataInstauracao: string;
  dataFato: string;
  encarregado: string;
  municipioInstauracao: string;
  naturezas: string[];
  indiciados: string[];
  localFatos: string;
  corpo: string;
}

function MinutaDetalhe({
  minuta,
  uid,
  cargo,
  session,
  nomes,
}: {
  minuta: Minuta;
  uid: string;
  cargo: string | null;
  session: Session;
  nomes: Map<string, { nome: string; posto_graduacao: string | null; cargo?: string }>;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const getFn = useServerFn(getDenuncia);
  const { data: autos } = useQuery({
    queryKey: ["denuncia", minuta.denuncia_id],
    queryFn: () => getFn({ data: { id: minuta.denuncia_id } }),
  });
  const assinarFn = useServerFn(assinarMinuta);
  const devolverFn = useServerFn(devolverMinuta);
  const cancelarFn = useServerFn(cancelarMinuta);

  const perfil = session.profile as { nome?: string; posto_graduacao?: string | null } | null;
  const ehPortaria = minuta.especie === "portaria";
  const podeAssinar =
    minuta.status === "pendente" && minuta.destinatarios.includes(uid) && isAdminRole(cargo);
  const ehAutor = minuta.autor_id === uid;
  const podeCorrigir = ehAutor && (minuta.status === "pendente" || minuta.status === "devolvida");
  const podeCancelar =
    (ehAutor || isAdminRole(cargo)) &&
    (minuta.status === "pendente" || minuta.status === "devolvida");
  const editavel = podeAssinar || podeCorrigir;

  // Texto e campos em edição (começam iguais à minuta).
  const dados = (minuta.dados ?? {}) as Record<string, unknown>;
  const [teor, setTeor] = useState(minuta.teor);
  const [ataDepoente, setAtaDepoente] = useState(String(dados.ataDepoente ?? ""));
  const [ipcUnidade, setIpcUnidade] = useState(String(dados.ipcUnidade ?? ""));
  const [ipcIdent, setIpcIdent] = useState(String(dados.ipcIdent ?? ""));
  const [portaria, setPortaria] = useState<CamposPortaria>(() => ({
    ipmNumero: String(dados.ipmNumero ?? ""),
    tipoProcedimento: dados.tipoProcedimento as CamposPortaria["tipoProcedimento"],
    dataInstauracao: String(dados.dataInstauracao ?? ""),
    dataFato: String(dados.dataFato ?? ""),
    encarregado: String(dados.encarregado ?? ""),
    municipioInstauracao: String(dados.municipioInstauracao ?? "São Paulo/SP"),
    naturezas: Array.isArray(dados.naturezas) ? (dados.naturezas as string[]) : [],
    indiciados: Array.isArray(dados.indiciados) ? (dados.indiciados as string[]) : [],
    localFatos: String(dados.localFatos ?? ""),
    corpo: String(dados.corpo ?? minuta.teor),
  }));

  const [previa, setPrevia] = useState<PreviaAtoPdf | null>(null);
  const [gerando, setGerando] = useState(false);
  const [devolvendo, setDevolvendo] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [confirmarAssinatura, setConfirmarAssinatura] = useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const [reenviando, setReenviando] = useState(false);

  useEffect(() => {
    if (!previa) return;
    const aoTeclar = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      URL.revokeObjectURL(previa.url);
      setPrevia(null);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [previa]);

  const tipo = minuta.denuncias?.tipo_procedimento ?? null;
  const rotulo = rotuloAto(minuta.especie, tipo);
  const procedimento = procedimentoDe(minuta);
  const proximoEvento = (autos?.movimentos.length ?? 0) + 1;
  const proximoEventoLabel = String(proximoEvento).padStart(2, "0");
  const escrivao = nomeComPosto(minuta.autor_posto, minuta.autor_nome);

  // Quem aparece como assinante: eu (se for assinar) ou o primeiro indicado.
  const primeiro = minuta.destinatarios.map((d) => nomes.get(d)).find(Boolean);
  const assinanteNome = podeAssinar ? (perfil?.nome ?? "") : (primeiro?.nome ?? "");
  const assinanteCargo = podeAssinar ? (cargo ?? "") : (primeiro?.cargo ?? "corregedor_geral");

  const listaNaturezas = portaria.naturezas.map((v) => v.trim()).filter(Boolean);
  const listaIndiciados = portaria.indiciados.map((v) => v.trim()).filter(Boolean);
  const textoPuro = (ehPortaria ? portaria.corpo : teor).replace(/<[^>]+>/g, "").trim();
  const completo = ehPortaria
    ? textoPuro.length >= 50 && listaNaturezas.length > 0 && listaIndiciados.length > 0
    : textoPuro.length >= 3 && (minuta.especie !== "ata" || ataDepoente.trim().length >= 2);

  function dadosPortaria(signatario: { nome: string; posto: string }) {
    return {
      ...portaria,
      tipoProcedimento:
        portaria.tipoProcedimento ?? (tipo === "apfd" || tipo === "sindicancia" ? tipo : "ipm"),
      naturezas: listaNaturezas,
      indiciados: listaIndiciados,
      corpo: sanitizeAtoHtml(portaria.corpo),
      localData: `São Paulo/SP, ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}.`,
      signatarioNome: signatario.nome,
      signatarioPosto: signatario.posto,
    };
  }
  function teorFinal(): string {
    if (ehPortaria) return sanitizeAtoHtml(portaria.corpo);
    return montarTeorAto(
      minuta.especie,
      sanitizeAtoHtml(teor),
      { ataDepoente, ipcUnidade, ipcIdent },
      procedimento,
    );
  }
  function camposAto(): Record<string, unknown> {
    if (minuta.especie === "ata") return { ataDepoente: ataDepoente.trim() };
    if (minuta.especie === "ipc") return { ipcUnidade, ipcIdent: ipcIdent.trim() };
    return {};
  }

  async function previsualizar() {
    if (!autos) return;
    let final: string;
    try {
      final = teorFinal();
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }
    setGerando(true);
    try {
      const p = await previsualizarAtoPdf(
        {
          denuncia: autos.denuncia,
          policiais: autos.policiais,
          movimentos: autos.movimentos as never,
        },
        {
          id: "previa",
          especie: minuta.especie,
          teor: final,
          prolator_nome: assinanteNome,
          prolator_cargo: assinanteCargo,
          criado_em: new Date().toISOString(),
          anexos: minuta.anexos,
          escrivao_nome: minuta.autor_nome,
          escrivao_posto: minuta.autor_posto,
          portaria_dados: ehPortaria
            ? {
                ...dadosPortaria({ nome: assinanteNome, posto: rotuloCargo(assinanteCargo) }),
                chave: "000-0000000000000",
              }
            : undefined,
        },
        proximoEvento,
      );
      setPrevia(p);
    } catch (e) {
      toast.error((e as Error)?.message || "Falha ao gerar a pré-visualização.");
    } finally {
      setGerando(false);
    }
  }
  function fecharPrevia() {
    if (previa) URL.revokeObjectURL(previa.url);
    setPrevia(null);
  }

  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ["minutas"] });
    qc.invalidateQueries({ queryKey: ["minutas-pendentes"] });
    qc.invalidateQueries({ queryKey: ["denuncia", minuta.denuncia_id] });
    qc.invalidateQueries({ queryKey: ["denuncias"] });
  };

  const mAssinar = useMutation({
    mutationFn: () =>
      assinarFn({
        data: {
          minuta_id: minuta.id,
          teor: teorFinal(),
          portaria: ehPortaria
            ? dadosPortaria({ nome: perfil?.nome ?? "", posto: rotuloCargo(cargo) })
            : undefined,
        },
      }),
    onSuccess: () => {
      toast.success(`Assinado e lançado como evento nº ${proximoEventoLabel}.`);
      setConfirmarAssinatura(false);
      atualizar();
    },
    onError: (e) => {
      setConfirmarAssinatura(false);
      toast.error((e as Error)?.message || "Não foi possível assinar.");
      atualizar();
    },
  });
  const mDevolver = useMutation({
    mutationFn: () => devolverFn({ data: { minuta_id: minuta.id, observacao } }),
    onSuccess: () => {
      toast.success("Minuta devolvida ao escrivão.");
      setDevolvendo(false);
      atualizar();
      navigate({ to: "/minutas" });
    },
    onError: (e) => toast.error((e as Error)?.message || "Não foi possível devolver."),
  });
  const mCancelar = useMutation({
    mutationFn: () => cancelarFn({ data: { minuta_id: minuta.id } }),
    onSuccess: () => {
      toast.success("Minuta cancelada.");
      atualizar();
      navigate({ to: "/minutas" });
    },
    onError: (e) => toast.error((e as Error)?.message || "Não foi possível cancelar."),
  });

  const rotuloCampo = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/minutas" className="inline-flex items-center gap-1 text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Minutas
        </Link>
        <span>/</span>
        <span>{rotulo}</span>
      </div>

      <div className="surface flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0 space-y-1">
          <div className={rotuloCampo}>Minuta de {rotulo}</div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="font-serif text-2xl">{procedimento}</h1>
            <Link
              to="/corregedoria"
              search={{ id: minuta.denuncia_id }}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              abrir processo <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>
        <StatusChip status={minuta.status} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="surface flex min-w-0 flex-col gap-4 p-5">
          {minuta.status === "devolvida" && (
            <div className="rounded-md border border-destructive/45 bg-destructive/10 p-3 text-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-red-300">
                Devolvida por {minuta.devolvida_por_nome ?? "autoridade"}
              </div>
              <div className="mt-1 whitespace-pre-wrap">{minuta.observacao_devolucao}</div>
              {ehAutor && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Corrija o texto abaixo e use “Salvar e reenviar”.
                </div>
              )}
            </div>
          )}
          {minuta.status === "assinada" && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-500/45 bg-emerald-500/10 p-3 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden />
              <span>
                Assinada por <strong>{minuta.assinada_por_nome}</strong> em{" "}
                {quando(minuta.assinada_em)} e lançada no processo.
              </span>
              <Link
                to="/corregedoria"
                search={{ id: minuta.denuncia_id }}
                className="ml-auto text-primary hover:underline"
              >
                Ver na linha do tempo
              </Link>
            </div>
          )}
          {editavel && (
            <p className="text-xs text-muted-foreground">
              {podeAssinar
                ? "Você pode editar o texto antes de assinar. A versão do escrivão fica guardada na minuta."
                : "Você pode corrigir o texto e reenviar para assinatura."}
            </p>
          )}

          {ehPortaria ? (
            <PortariaCampos valor={portaria} onChange={setPortaria} editavel={editavel} />
          ) : (
            <>
              {minuta.especie === "ipc" && (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1">
                    <span className={rotuloCampo}>Unidade</span>
                    <select
                      value={ipcUnidade}
                      disabled={!editavel}
                      onChange={(ev) => setIpcUnidade(ev.target.value)}
                      className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm"
                    >
                      <option value="">— selecione —</option>
                      {OPMS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className={rotuloCampo}>2º Identificação do policial</span>
                    <textarea
                      value={ipcIdent}
                      readOnly={!editavel}
                      onChange={(ev) => setIpcIdent(ev.target.value)}
                      rows={2}
                      className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm"
                    />
                  </label>
                </div>
              )}
              {minuta.especie === "ata" && (
                <label className="grid gap-1">
                  <span className={rotuloCampo}>Depoente (quem prestou o depoimento)</span>
                  <input
                    className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm read-only:opacity-80"
                    value={ataDepoente}
                    readOnly={!editavel}
                    onChange={(ev) => setAtaDepoente(ev.target.value)}
                  />
                </label>
              )}
              <div className="grid gap-1">
                <span className={rotuloCampo}>
                  {minuta.especie === "ipc" ? "3º Relato do fato" : "Texto do ato"}
                </span>
                {editavel ? (
                  <RichTextEditor
                    value={teor}
                    onChange={setTeor}
                    minHeight={260}
                    enableLineHeight
                  />
                ) : (
                  <div
                    className="ato-body rounded-md border border-border bg-background/40 p-4 text-sm"
                    dangerouslySetInnerHTML={{ __html: sanitizeAtoHtml(teor) }}
                  />
                )}
              </div>
            </>
          )}

          {minuta.anexos.length > 0 && (
            <div className="grid gap-1">
              <span className={rotuloCampo}>Provas anexadas ({minuta.anexos.length})</span>
              <AtoAnexosLinks anexos={minuta.anexos} />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <span className="text-xs text-muted-foreground">
              {podeAssinar ? (
                <>
                  Ao assinar vira o{" "}
                  <strong className="text-primary">evento nº {proximoEventoLabel}</strong> do
                  processo.
                </>
              ) : (
                `Encaminhada em ${quando(minuta.criado_em)}.`
              )}
            </span>
            <div className="flex flex-wrap gap-2">
              {podeCancelar && (
                <button
                  type="button"
                  onClick={() => setConfirmarCancelar(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-surface-2"
                >
                  <Trash2 className="h-4 w-4" aria-hidden /> Cancelar minuta
                </button>
              )}
              <button
                type="button"
                onClick={previsualizar}
                disabled={gerando || !autos || !completo}
                className="inline-flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
              >
                <Eye className="h-4 w-4" aria-hidden />{" "}
                {gerando ? "Gerando..." : "Pré-visualizar PDF"}
              </button>
              {podeAssinar && (
                <button
                  type="button"
                  onClick={() => setDevolvendo(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-destructive/60 px-3 py-2 text-sm text-red-300 hover:bg-destructive/10"
                >
                  <CornerUpLeft className="h-4 w-4" aria-hidden /> Devolver com observação
                </button>
              )}
              {podeCorrigir && (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      teorFinal();
                      setReenviando(true);
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                  disabled={!completo}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  <Send className="h-4 w-4" aria-hidden /> Salvar e reenviar
                </button>
              )}
              {podeAssinar && (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      teorFinal();
                      setConfirmarAssinatura(true);
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                  disabled={!completo || !autos || mAssinar.isPending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  <FileSignature className="h-4 w-4" aria-hidden />{" "}
                  {mAssinar.isPending ? "Assinando..." : "Assinar e lançar"}
                </button>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-3">
          <div className="surface space-y-2 p-4">
            <div className={rotuloCampo}>Encaminhada por (Escrivão)</div>
            <div className="font-semibold">{escrivao}</div>
            <div className="text-xs text-muted-foreground">{quando(minuta.criado_em)}</div>
            {minuta.recado && (
              <div className="rounded-r-md border-l-[3px] border-primary bg-primary/10 px-3 py-2 text-sm">
                “{minuta.recado}”
              </div>
            )}
          </div>
          <div className="surface space-y-1.5 p-4">
            <div className={rotuloCampo}>Assinantes indicados</div>
            {minuta.destinatarios.map((d) => {
              const a = nomes.get(d);
              return (
                <div key={d} className="text-sm">
                  {a ? nomeComPosto(a.posto_graduacao, a.nome) : "Autoridade"}
                  {a?.cargo && (
                    <span className="text-muted-foreground"> · {rotuloCargo(a.cargo)}</span>
                  )}
                  {d === uid && <span className="text-primary"> (você)</span>}
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">
              Quem assinar primeiro lança o ato; a minuta sai da fila dos outros.
            </p>
          </div>
          <div className="surface space-y-1.5 p-4 text-sm">
            <div className={rotuloCampo}>Como sai no ato</div>
            <div>
              <strong className="font-semibold">Assina:</strong>{" "}
              {minuta.status === "assinada"
                ? minuta.assinada_por_nome
                : podeAssinar
                  ? `${nomeComPosto(perfil?.posto_graduacao, perfil?.nome)} — ${rotuloCargo(cargo)}`
                  : "a autoridade que assinar"}
            </div>
            <div>
              <strong className="font-semibold">Escrivão:</strong> {escrivao}
            </div>
          </div>
          {podeAssinar && (
            <div className="surface space-y-1 p-4 text-xs text-muted-foreground">
              <div className={rotuloCampo}>Se devolver</div>A minuta volta para o escrivão com a sua
              observação; ele corrige e reenvia. Nada entra no processo.
            </div>
          )}
        </aside>
      </div>

      {devolvendo && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onClick={(ev) => ev.target === ev.currentTarget && setDevolvendo(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Devolver minuta"
            className="surface w-full max-w-lg space-y-3 p-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg">Devolver ao escrivão</h3>
              <button
                type="button"
                onClick={() => setDevolvendo(false)}
                aria-label="Fechar"
                className="rounded-md p-1 hover:bg-surface-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="grid gap-1.5">
              <span className={rotuloCampo}>Observação para {escrivao}</span>
              <textarea
                value={observacao}
                onChange={(ev) => setObservacao(ev.target.value)}
                rows={5}
                maxLength={2000}
                autoFocus
                placeholder="Ex.: corrigir a data da oitiva e incluir a intimação do defensor."
                className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
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
                {mDevolver.isPending ? "Devolvendo..." : "Devolver minuta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {reenviando && (
        <EncaminharMinutaDialog
          denunciaId={minuta.denuncia_id}
          procedimento={procedimento}
          rotuloAto={rotulo}
          minuta={{ id: minuta.id, destinatarios: minuta.destinatarios, recado: minuta.recado }}
          conteudo={() =>
            ehPortaria
              ? {
                  especie: "portaria",
                  teor: sanitizeAtoHtml(portaria.corpo),
                  dados: dadosPortaria({ nome: "", posto: "" }),
                  anexos: minuta.anexos,
                }
              : {
                  especie: minuta.especie,
                  teor: sanitizeAtoHtml(teor),
                  dados: camposAto(),
                  anexos: minuta.anexos,
                }
          }
          onClose={() => setReenviando(false)}
          onDone={() => navigate({ to: "/minutas" })}
        />
      )}

      <AlertDialog
        open={confirmarAssinatura}
        onOpenChange={(v) => !mAssinar.isPending && setConfirmarAssinatura(v)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assinar e lançar?</AlertDialogTitle>
            <AlertDialogDescription>
              {rotulo} será lançado no {procedimento} como evento nº {proximoEventoLabel}, assinado
              por você, com {escrivao} como Escrivão.
              {ehPortaria && " A prescrição será interrompida (o relógio reinicia)."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mAssinar.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(ev) => {
                ev.preventDefault();
                mAssinar.mutate();
              }}
              disabled={mAssinar.isPending}
            >
              {mAssinar.isPending ? "Assinando..." : "Assinar e lançar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmarCancelar} onOpenChange={setConfirmarCancelar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta minuta?</AlertDialogTitle>
            <AlertDialogDescription>
              Ela sai da fila de assinatura e nada é lançado no processo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => mCancelar.mutate()}>
              Cancelar minuta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {previa && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/75 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Pré-visualização do PDF"
          onClick={(ev) => ev.target === ev.currentTarget && fecharPrevia()}
        >
          <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-border bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Pré-visualização — {rotulo}</div>
                <div className="text-xs text-muted-foreground">
                  Nada foi lançado. Feche para continuar.
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => previa.baixar()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
                >
                  <Download className="h-4 w-4" aria-hidden /> Baixar PDF
                </button>
                <button
                  type="button"
                  onClick={fecharPrevia}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                >
                  <X className="h-4 w-4" aria-hidden /> Fechar
                </button>
              </div>
            </div>
            <iframe
              title="Pré-visualização do PDF"
              src={previa.url}
              className="min-h-0 w-full flex-1 bg-white"
            />
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- campos da portaria ---------- */

function PortariaCampos({
  valor,
  onChange,
  editavel,
}: {
  valor: CamposPortaria;
  onChange: (v: CamposPortaria) => void;
  editavel: boolean;
}) {
  const set = <K extends keyof CamposPortaria>(k: K, v: CamposPortaria[K]) =>
    onChange({ ...valor, [k]: v });
  const campo = (
    rotulo: string,
    k:
      | "ipmNumero"
      | "dataInstauracao"
      | "dataFato"
      | "encarregado"
      | "municipioInstauracao"
      | "localFatos",
  ) => (
    <label className="grid gap-1 text-xs">
      <span className="text-muted-foreground">{rotulo}</span>
      <input
        className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm read-only:opacity-80"
        value={valor[k]}
        readOnly={!editavel}
        onChange={(ev) => set(k, ev.target.value)}
      />
    </label>
  );
  const lista = (rotulo: string, k: "naturezas" | "indiciados") => (
    <label className="grid gap-1 text-xs md:col-span-2">
      <span className="text-muted-foreground">{rotulo} (um por linha)</span>
      <textarea
        className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
        rows={Math.max(2, valor[k].length)}
        value={valor[k].join("\n")}
        readOnly={!editavel}
        onChange={(ev) => set(k, ev.target.value.split("\n"))}
      />
    </label>
  );
  const sigla =
    valor.tipoProcedimento === "sindicancia"
      ? "SINDPM"
      : valor.tipoProcedimento === "apfd"
        ? "APFD"
        : "IPM";
  return (
    <div className="space-y-3">
      <div className="grid gap-3 rounded-md border border-border/60 p-3 md:grid-cols-2">
        {campo(`${sigla} Nº`, "ipmNumero")}
        {campo("Data de instauração", "dataInstauracao")}
        {campo("Data do fato", "dataFato")}
        {campo("Encarregado", "encarregado")}
        {campo("Município de instauração", "municipioInstauracao")}
        {campo("Local dos fatos", "localFatos")}
        {lista("Naturezas", "naturezas")}
        {lista("Policiais militares indiciados", "indiciados")}
        <p className="text-xs text-muted-foreground md:col-span-2">
          O signatário e a data são preenchidos com a autoridade que assinar, no momento da
          assinatura.
        </p>
      </div>
      <div className="grid gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Corpo da portaria
        </span>
        {editavel ? (
          <RichTextEditor value={valor.corpo} onChange={(v) => set("corpo", v)} minHeight={240} />
        ) : (
          <div
            className="ato-body rounded-md border border-border bg-background/40 p-4 text-sm"
            dangerouslySetInnerHTML={{ __html: sanitizeAtoHtml(valor.corpo) }}
          />
        )}
      </div>
    </div>
  );
}
