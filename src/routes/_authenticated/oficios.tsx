import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  FileSignature,
  Loader2,
  Mail,
  Plus,
  Search,
  Send,
  Trash2,
  X,
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
  assinarOficio,
  cancelarOficio,
  criarOficio,
  devolverOficio,
  listOficios,
  reenviarOficio,
  type Oficio,
  type StatusOficio,
} from "@/lib/oficios.functions";
import { MODELOS_OFICIO, aplicarModeloOficio } from "@/lib/modelos-oficio";
import { exportOficioPdf, previaOficioPdf } from "@/lib/exportProcesso";
import { pdfDoOficio, type PdfOficio } from "@/lib/pdf/oficio-pdf";
import { ROLE_LABELS, isAdminRole, isInternalRole } from "@/lib/access-roles";
import { nomeComPostoExtenso } from "@/lib/postos";

export const Route = createFileRoute("/_authenticated/oficios")({
  validateSearch: z.object({
    id: z.string().uuid().optional(),
    novo: z.coerce.boolean().optional(),
    processo: z.string().uuid().optional(),
  }),
  component: OficiosPage,
});

/* ---------- utilitários ---------- */

const STATUS_INFO: Record<StatusOficio, { rotulo: string; cls: string }> = {
  aguardando_assinatura: {
    rotulo: "Aguardando assinatura",
    cls: "border-amber-500/55 bg-amber-500/10 text-amber-200",
  },
  devolvido: { rotulo: "Devolvido", cls: "border-destructive/55 bg-destructive/10 text-red-300" },
  expedido: { rotulo: "Expedido", cls: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" },
  cancelado: { rotulo: "Cancelado", cls: "border-border bg-muted text-muted-foreground" },
};

function StatusChip({ status }: { status: StatusOficio }) {
  const s = STATUS_INFO[status];
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.cls}`}
    >
      {s.rotulo}
    </span>
  );
}

const numeroCurto = (n: string | null | undefined) => (n ? n.replace(/^CORREGPM\s*/i, "") : "—");
const rotuloCargo = (c: string | null | undefined) =>
  c ? ((ROLE_LABELS as Record<string, string>)[c] ?? c) : "";
const nomeCurto = (posto: string | null | undefined, nome: string | null | undefined) =>
  [posto?.trim(), nome?.trim()].filter(Boolean).join(" ");
const dataBr = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
const textoPuro = (html: string) => html.replace(/<[^>]+>/g, "").trim();

type Session = { userId: string; profile: unknown; cargo: string | null };

/* ---------- página ---------- */

function OficiosPage() {
  const { id, novo, processo } = Route.useSearch();
  const sessionFn = useServerFn(getSessionInfo);
  const { data: session } = useQuery({ queryKey: ["session-info"], queryFn: () => sessionFn() });
  const cargo = session?.cargo ?? null;
  const ativo = (session?.profile as { status?: string } | null | undefined)?.status === "ativo";
  const interno = ativo && isInternalRole(cargo);
  const listFn = useServerFn(listOficios);
  const { data, isLoading, error } = useQuery({
    queryKey: ["oficios"],
    queryFn: () => listFn(),
    enabled: interno,
    refetchInterval: 60_000,
  });

  if (session && !interno) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-5xl p-8 text-sm text-muted-foreground">
          Os ofícios são restritos a usuários internos ativos.
        </div>
      </div>
    );
  }

  const oficios = data?.oficios ?? [];
  const aberto = id ? (oficios.find((o) => o.id === id) ?? null) : null;

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
        {error ? (
          <div className="surface p-6 text-sm">
            <div className="font-semibold">Não foi possível carregar os ofícios.</div>
            <div className="mt-1 text-muted-foreground">{(error as Error).message}</div>
          </div>
        ) : isLoading || !session ? (
          <div className="surface p-6 text-sm text-muted-foreground">Carregando ofícios…</div>
        ) : novo ? (
          <EditorOficio
            key={`novo-${processo ?? ""}`}
            session={session}
            proximoNumero={data?.proximoNumero ?? null}
            processoInicial={processo ?? null}
          />
        ) : id ? (
          aberto ? (
            <EditorOficio
              key={aberto.id}
              session={session}
              oficio={aberto}
              proximoNumero={data?.proximoNumero ?? null}
            />
          ) : (
            <div className="surface space-y-3 p-6 text-sm">
              <div>Ofício não encontrado.</div>
              <Link to="/oficios" className="text-primary hover:underline">
                Voltar para os ofícios
              </Link>
            </div>
          )
        ) : (
          <ListaOficios
            oficios={oficios}
            uid={session.userId}
            cargo={cargo}
            proximoNumero={data?.proximoNumero ?? null}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- lista ---------- */

type Filtro = "todos" | "assinar" | "aguardando" | "expedidos" | "cancelados";

function ListaOficios({
  oficios,
  uid,
  cargo,
  proximoNumero,
}: {
  oficios: Oficio[];
  uid: string;
  cargo: string | null;
  proximoNumero: string | null;
}) {
  const navigate = useNavigate();
  const cupula = isAdminRole(cargo);
  const [filtro, setFiltro] = useState<Filtro>(() =>
    oficios.some((o) => o.status === "aguardando_assinatura" && o.destinatarios.includes(uid))
      ? "assinar"
      : "todos",
  );
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(30);
  const [baixando, setBaixando] = useState<string | null>(null);

  const ano = new Date().getFullYear();
  const mes = new Date().getMonth();
  const expedidos = oficios.filter(
    (o) => o.status === "expedido" || (o.status === "cancelado" && o.numero),
  );
  const contagem = {
    ano: expedidos.filter((o) => o.ano === ano).length,
    mes: expedidos.filter(
      (o) => o.expedido_em && new Date(o.expedido_em).getMonth() === mes && o.ano === ano,
    ).length,
    aguardando: oficios.filter(
      (o) => o.status === "aguardando_assinatura" || o.status === "devolvido",
    ).length,
  };
  const filtros: { id: Filtro; rotulo: string; teste: (o: Oficio) => boolean }[] = [
    { id: "todos", rotulo: "Todos", teste: () => true },
    ...(cupula
      ? [
          {
            id: "assinar" as const,
            rotulo: "Para eu assinar",
            teste: (o: Oficio) =>
              o.status === "aguardando_assinatura" && o.destinatarios.includes(uid),
          },
        ]
      : []),
    {
      id: "aguardando",
      rotulo: "Em assinatura",
      teste: (o) => o.status === "aguardando_assinatura" || o.status === "devolvido",
    },
    { id: "expedidos", rotulo: "Expedidos", teste: (o) => o.status === "expedido" },
    { id: "cancelados", rotulo: "Cancelados", teste: (o) => o.status === "cancelado" },
  ];
  const ativo = filtros.find((f) => f.id === filtro) ?? filtros[0];
  const q = busca.trim().toLowerCase();
  const lista = oficios.filter(
    (o) =>
      ativo.teste(o) &&
      (!q ||
        `${o.numero ?? ""} ${o.destinatario} ${o.assunto} ${o.referencia ?? ""} ${o.denuncias?.numero_procedimento ?? ""} ${o.redator_nome} ${o.signatario_nome ?? ""}`
          .toLowerCase()
          .includes(q)),
  );

  async function baixar(o: Oficio) {
    setBaixando(o.id);
    try {
      await exportOficioPdf(pdfDoOficio(o));
    } catch (e) {
      toast.error((e as Error)?.message || "Falha ao gerar o PDF.");
    } finally {
      setBaixando(null);
    }
  }

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
            Expediente
          </div>
          <h1 className="font-serif text-2xl">Ofícios</h1>
        </div>
        <Link
          to="/oficios"
          search={{ novo: true }}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" aria-hidden /> Novo ofício
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {[
          { k: `Expedidos em ${ano}`, v: String(contagem.ano), mono: false },
          { k: "Este mês", v: String(contagem.mes), mono: false },
          { k: "Próximo número", v: numeroCurto(proximoNumero), mono: true },
          { k: "Em assinatura", v: String(contagem.aguardando), mono: false },
        ].map((c) => (
          <div key={c.k} className="surface p-3">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              {c.k}
            </div>
            <div
              className={
                c.mono ? "mt-1 font-mono text-lg text-primary" : "tabular text-2xl font-semibold"
              }
            >
              {c.v}
            </div>
          </div>
        ))}
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
            placeholder="Nº, destinatário, assunto ou processo…"
            aria-label="Buscar ofício"
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
              {f.rotulo}{" "}
              <span className="tabular opacity-75">{oficios.filter(f.teste).length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="surface overflow-hidden">
        {lista.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum ofício aqui.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-border bg-background/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Número</th>
                  <th className="px-3 py-2.5 font-semibold">Data</th>
                  <th className="px-3 py-2.5 font-semibold">Destinatário · Assunto</th>
                  <th className="px-3 py-2.5 font-semibold">Referência</th>
                  <th className="px-3 py-2.5 font-semibold">Assinatura</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lista.slice(0, limite).map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => navigate({ to: "/oficios", search: { id: o.id } })}
                    className={`cursor-pointer hover:bg-surface-2 ${o.status === "cancelado" ? "opacity-60" : ""}`}
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12.5px] text-primary">
                      {numeroCurto(o.numero)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground tabular">
                      {dataBr(o.expedido_em ?? o.criado_em)}
                    </td>
                    <td className="max-w-[360px] px-3 py-2.5">
                      <div className="truncate font-medium" title={o.destinatario}>
                        {o.destinatario.split("\n")[0]}
                      </div>
                      <div className="truncate text-xs text-muted-foreground" title={o.assunto}>
                        {o.assunto}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                      {o.denuncia_id ? (
                        <Link
                          to="/corregedoria"
                          search={{ id: o.denuncia_id }}
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary hover:underline"
                        >
                          {o.denuncias?.numero_procedimento ?? o.referencia ?? "processo"}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{o.referencia || "—"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      <div className="truncate">
                        {o.signatario_nome
                          ? nomeCurto(o.signatario_posto, o.signatario_nome)
                          : `Redigido por ${nomeCurto(o.redator_posto, o.redator_nome)}`}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        {o.status !== "expedido" && <StatusChip status={o.status} />}
                        {(o.status === "expedido" || o.status === "cancelado") && o.numero && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              baixar(o);
                            }}
                            disabled={baixando === o.id}
                            className="inline-flex items-center gap-1 rounded-md border border-primary/50 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                          >
                            {baixando === o.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <Download className="h-3.5 w-3.5" aria-hidden />
                            )}
                            PDF
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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
    </>
  );
}

/* ---------- novo / revisão / assinatura ---------- */

function EditorOficio({
  session,
  oficio,
  proximoNumero,
  processoInicial,
}: {
  session: Session;
  oficio?: Oficio;
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

  const criarFn = useServerFn(criarOficio);
  const assinarFn = useServerFn(assinarOficio);
  const reenviarFn = useServerFn(reenviarOficio);
  const devolverFn = useServerFn(devolverOficio);
  const cancelarFn = useServerFn(cancelarOficio);

  const status = oficio?.status ?? null;
  const ehRedator = !oficio || oficio.redator_id === uid;
  const podeAssinar =
    !!oficio && status === "aguardando_assinatura" && oficio.destinatarios.includes(uid) && cupula;
  const podeCorrigir =
    !!oficio && ehRedator && (status === "aguardando_assinatura" || status === "devolvido");
  const editavel = !oficio || podeAssinar || podeCorrigir;
  const podeCancelar =
    !!oficio &&
    ((status === "expedido" && cupula) ||
      ((status === "aguardando_assinatura" || status === "devolvido") && (ehRedator || cupula)));

  const procNumero = (did: string | null) => {
    const d = (denuncias ?? []).find((x: { id: string }) => x.id === did) as
      { numero_procedimento?: string | null; numero_protocolo: string } | undefined;
    return d ? (d.numero_procedimento ?? d.numero_protocolo) : null;
  };

  const [destinatario, setDestinatario] = useState(oficio?.destinatario ?? "");
  const [denunciaId, setDenunciaId] = useState<string | null>(
    oficio?.denuncia_id ?? processoInicial ?? null,
  );
  const [referencia, setReferencia] = useState(oficio?.referencia ?? "");
  const [assunto, setAssunto] = useState(oficio?.assunto ?? "");
  const [corpo, setCorpo] = useState(oficio?.corpo ?? "");
  const [modeloId, setModeloId] = useState("");
  const refAuto = useRef<string | null>(null);

  // Ao vincular um processo, a referência é preenchida (se estiver vazia ou automática).
  useEffect(() => {
    if (!editavel) return;
    const num = procNumero(denunciaId);
    if (num && (!referencia.trim() || referencia === refAuto.current)) {
      setReferencia(num);
      refAuto.current = num;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [denunciaId, denuncias]);

  // Quem aparece na assinatura da prévia.
  const eu = { id: uid, nome: perfil?.nome ?? "", posto: perfil?.posto_graduacao ?? null, cargo };
  const signatarioPrevia =
    oficio?.signatario_nome != null
      ? {
          id: oficio.signatario_id,
          nome: oficio.signatario_nome,
          posto: oficio.signatario_posto,
          cargo: oficio.signatario_cargo,
        }
      : podeAssinar || (!oficio && cupula)
        ? eu
        : null;
  const redator = oficio
    ? {
        id: oficio.redator_id,
        nome: oficio.redator_nome,
        posto: oficio.redator_posto,
        cargo: oficio.redator_cargo,
      }
    : eu;

  const dadosPdf: PdfOficio = useMemo(
    () => ({
      numero: oficio?.numero ?? proximoNumero ?? "CORREGPM ___/360/__",
      data: oficio?.expedido_em ?? new Date().toISOString(),
      destinatario: destinatario || "[autoridade endereçada]",
      referencia,
      assunto: assunto || "[assunto]",
      corpo: corpo || "<p>[texto]</p>",
      signatario: signatarioPrevia,
      redator,
      cancelado: oficio?.cancelado_em
        ? {
            em: oficio.cancelado_em,
            motivo: oficio.motivo_cancelamento,
            por: oficio.cancelado_por_nome,
          }
        : null,
      previa: !oficio?.numero,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      destinatario,
      referencia,
      assunto,
      corpo,
      proximoNumero,
      oficio,
      signatarioPrevia?.id,
      signatarioPrevia?.nome,
    ],
  );

  // Prévia ao vivo: o PDF verdadeiro, refeito pouco depois de cada alteração.
  const [previaUrl, setPreviaUrl] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const baixarRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    let cancelado = false;
    const t = setTimeout(async () => {
      setGerando(true);
      try {
        const p = await previaOficioPdf(dadosPdf);
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
        /* a prévia tenta de novo na próxima alteração */
      } finally {
        if (!cancelado) setGerando(false);
      }
    }, 700);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [dadosPdf]);
  useEffect(
    () => () => {
      setPreviaUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return null;
      });
    },
    [],
  );

  function escolherModelo(idModelo: string) {
    const m = MODELOS_OFICIO.find((x) => x.id === idModelo);
    if (!m) return;
    if (textoPuro(corpo) && !window.confirm("Substituir o texto atual pelo modelo selecionado?"))
      return;
    const r = aplicarModeloOficio(m, procNumero(denunciaId));
    setModeloId(idModelo);
    setCorpo(r.texto);
    if (!assunto.trim()) setAssunto(r.assunto);
  }

  const completo =
    destinatario.trim().length >= 3 && assunto.trim().length >= 3 && textoPuro(corpo).length >= 3;
  const campos = () => ({
    destinatario: destinatario.trim(),
    referencia: referencia.trim() || null,
    assunto: assunto.trim(),
    corpo: sanitizeAtoHtml(corpo),
    denuncia_id: denunciaId,
  });
  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ["oficios"] });
    qc.invalidateQueries({ queryKey: ["minutas-pendentes"] });
    qc.invalidateQueries({ queryKey: ["oficios-pendentes"] });
    if (denunciaId) qc.invalidateQueries({ queryKey: ["denuncia", denunciaId] });
  };

  const [confirmarExpedir, setConfirmarExpedir] = useState(false);
  const [encaminhando, setEncaminhando] = useState(false);
  const [devolvendo, setDevolvendo] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");

  const mExpedir = useMutation({
    mutationFn: async () => {
      if (oficio) {
        const r = await assinarFn({ data: { oficio_id: oficio.id, ...campos() } });
        return { id: oficio.id, numero: r.numero };
      }
      return criarFn({ data: { ...campos(), destinatarios: [] } });
    },
    onSuccess: (r) => {
      toast.success(`Ofício nº ${r.numero} expedido.`);
      setConfirmarExpedir(false);
      atualizar();
      navigate({ to: "/oficios", search: { id: r.id } });
    },
    onError: (e) => {
      setConfirmarExpedir(false);
      toast.error((e as Error)?.message || "Não foi possível expedir.");
      atualizar();
    },
  });
  const mDevolver = useMutation({
    mutationFn: () => devolverFn({ data: { oficio_id: oficio!.id, observacao } }),
    onSuccess: () => {
      toast.success("Ofício devolvido ao redator.");
      setDevolvendo(false);
      atualizar();
      navigate({ to: "/oficios" });
    },
    onError: (e) => toast.error((e as Error)?.message || "Não foi possível devolver."),
  });
  const mCancelar = useMutation({
    mutationFn: () =>
      cancelarFn({ data: { oficio_id: oficio!.id, motivo: motivo.trim() || null } }),
    onSuccess: () => {
      toast.success("Ofício cancelado.");
      setCancelando(false);
      atualizar();
    },
    onError: (e) => toast.error((e as Error)?.message || "Não foi possível cancelar."),
  });

  const proximoCurto = numeroCurto(proximoNumero);
  const rotuloCampo = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
  const campoCls =
    "w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm read-only:opacity-80 disabled:opacity-80";
  const titulo = oficio?.numero
    ? `Ofício nº ${oficio.numero}`
    : oficio
      ? "Ofício em assinatura"
      : "Novo ofício";

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/oficios" className="inline-flex items-center gap-1 text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Ofícios
        </Link>
        <span>/</span>
        <span>
          {oficio?.numero ? numeroCurto(oficio.numero) : oficio ? "Em assinatura" : "Novo"}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
        <section className="surface flex min-w-0 flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-serif text-xl">{titulo}</h1>
            {oficio ? (
              <StatusChip status={oficio.status} />
            ) : (
              <span className="rounded-md border border-primary/45 px-2 py-0.5 font-mono text-xs text-primary">
                Nº {proximoCurto} ao expedir
              </span>
            )}
          </div>

          {oficio?.status === "devolvido" && (
            <div className="rounded-md border border-destructive/45 bg-destructive/10 p-3 text-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-red-300">
                Devolvido por {oficio.devolvido_por_nome ?? "autoridade"}
              </div>
              <div className="mt-1 whitespace-pre-wrap">{oficio.observacao_devolucao}</div>
            </div>
          )}
          {oficio?.status === "cancelado" && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              Cancelado em {dataBr(oficio.cancelado_em)} por {oficio.cancelado_por_nome}
              {oficio.motivo_cancelamento ? ` — ${oficio.motivo_cancelamento}` : ""}.
            </div>
          )}
          {oficio &&
            (oficio.status === "aguardando_assinatura" || oficio.status === "devolvido") && (
              <div className="grid gap-1 rounded-md border border-border bg-background/40 p-3 text-xs text-muted-foreground">
                <span>
                  Redigido por{" "}
                  <strong className="text-foreground">
                    {nomeCurto(oficio.redator_posto, oficio.redator_nome)}
                  </strong>{" "}
                  em {dataBr(oficio.criado_em)} · consta como Encarregado.
                </span>
                <span>
                  Para assinatura de:{" "}
                  {oficio.destinatarios
                    .map((d) => {
                      const a = nomes.get(d);
                      return a
                        ? `${nomeCurto(a.posto_graduacao, a.nome)}${d === uid ? " (você)" : ""}`
                        : "autoridade";
                    })
                    .join("; ")}
                </span>
                {oficio.recado && <span className="text-foreground">“{oficio.recado}”</span>}
              </div>
            )}

          <label className="grid gap-1.5">
            <span className={rotuloCampo}>Autoridade endereçada</span>
            <textarea
              rows={2}
              className={campoCls}
              value={destinatario}
              readOnly={!editavel}
              maxLength={600}
              onChange={(e) => setDestinatario(e.target.value)}
              placeholder="Ex.: Ao Senhor Comandante do 18º BPM"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1.5">
              <span className={rotuloCampo}>Processo vinculado (opcional)</span>
              <select
                className={campoCls}
                value={denunciaId ?? ""}
                disabled={!editavel}
                onChange={(e) => setDenunciaId(e.target.value || null)}
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
            <label className="grid gap-1.5">
              <span className={rotuloCampo}>Referência (s) (opcional)</span>
              <input
                className={campoCls}
                value={referencia}
                readOnly={!editavel}
                maxLength={300}
                onChange={(e) => setReferencia(e.target.value)}
              />
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className={rotuloCampo}>Assunto</span>
            <input
              className={campoCls}
              value={assunto}
              readOnly={!editavel}
              maxLength={300}
              onChange={(e) => setAssunto(e.target.value)}
            />
          </label>

          <div className="grid gap-1.5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <span className={rotuloCampo}>Texto do ofício</span>
              {editavel && (
                <select
                  value={modeloId}
                  onChange={(e) => escolherModelo(e.target.value)}
                  className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs"
                  aria-label="Modelo de texto"
                >
                  <option value="">— Modelo de texto —</option>
                  {MODELOS_OFICIO.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {editavel ? (
              <RichTextEditor value={corpo} onChange={setCorpo} minHeight={260} enableLineHeight />
            ) : (
              <div
                className="ato-body rounded-md border border-border bg-background/40 p-4 text-sm"
                dangerouslySetInnerHTML={{ __html: sanitizeAtoHtml(corpo) }}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
            {podeCancelar && (
              <button
                type="button"
                onClick={() => setCancelando(true)}
                className="mr-auto inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-surface-2"
              >
                <Trash2 className="h-4 w-4" aria-hidden /> Cancelar ofício
              </button>
            )}
            {oficio?.denuncia_id && (
              <Link
                to="/corregedoria"
                search={{ id: oficio.denuncia_id }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-2"
              >
                <ExternalLink className="h-4 w-4" aria-hidden /> Abrir processo
              </Link>
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
            {(!oficio || podeCorrigir) && (
              <button
                type="button"
                onClick={() => setEncaminhando(true)}
                disabled={!completo}
                className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                  cupula && !oficio
                    ? "border border-primary bg-primary/15 text-primary hover:bg-primary/25"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                <Send className="h-4 w-4" aria-hidden />{" "}
                {oficio ? "Salvar e reenviar" : "Encaminhar para assinatura"}
              </button>
            )}
            {((!oficio && cupula) || podeAssinar) && (
              <button
                type="button"
                onClick={() => setConfirmarExpedir(true)}
                disabled={!completo || mExpedir.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                <FileSignature className="h-4 w-4" aria-hidden />
                {podeAssinar ? "Assinar e expedir" : `Expedir ofício nº ${proximoCurto}`}
              </button>
            )}
          </div>
          {!oficio && !cupula && (
            <p className="text-xs text-muted-foreground">
              Ofícios são expedidos pelo Corregedor-Geral, Subcorregedor-Geral ou Corregedor
              Supervisor. Encaminhe para assinatura; você constará como Encarregado.
            </p>
          )}
        </section>

        <section
          aria-label="Prévia do ofício"
          className="surface flex min-h-[640px] flex-col overflow-hidden xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-4 w-4" aria-hidden />
              {oficio?.numero
                ? "PDF do ofício"
                : "Prévia no timbre (atualiza enquanto você digita)"}
              {gerando && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            </div>
            <button
              type="button"
              onClick={() => baixarRef.current?.()}
              disabled={!previaUrl}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" aria-hidden /> Baixar PDF
            </button>
          </div>
          {previaUrl ? (
            <iframe
              title="Prévia do ofício em PDF"
              src={`${previaUrl}#view=FitH`}
              className="min-h-0 w-full flex-1 bg-white"
            />
          ) : (
            <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
              Gerando prévia…
            </div>
          )}
        </section>
      </div>

      {encaminhando && (
        <EncaminharMinutaDialog
          denunciaId={denunciaId ?? ""}
          procedimento={assunto || "Ofício"}
          rotuloAto="Ofício"
          papel="Encarregado"
          minuta={
            oficio
              ? { id: oficio.id, destinatarios: oficio.destinatarios, recado: oficio.recado }
              : undefined
          }
          conteudo={() => ({ especie: "despacho", teor: "", dados: {}, anexos: [] })}
          enviar={async (destinatarios, recado) => {
            if (oficio)
              await reenviarFn({
                data: { oficio_id: oficio.id, ...campos(), destinatarios, recado },
              });
            else await criarFn({ data: { ...campos(), destinatarios, recado } });
          }}
          onClose={() => setEncaminhando(false)}
          onDone={() => {
            atualizar();
            navigate({ to: "/oficios" });
          }}
        />
      )}

      <AlertDialog
        open={confirmarExpedir}
        onOpenChange={(v) => !mExpedir.isPending && setConfirmarExpedir(v)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {podeAssinar ? "Assinar e expedir?" : "Expedir o ofício?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              O ofício recebe o número {proximoNumero ?? "seguinte"} (ou o próximo livre), com a
              data de hoje e a sua assinatura
              {podeAssinar && oficio
                ? `; ${nomeCurto(oficio.redator_posto, oficio.redator_nome)} consta como Encarregado`
                : ""}
              . Depois de expedido, o texto não pode mais ser alterado — só cancelado.
              {denunciaId && " O ofício também é registrado na linha do tempo do processo."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mExpedir.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(ev) => {
                ev.preventDefault();
                mExpedir.mutate();
              }}
              disabled={mExpedir.isPending}
            >
              {mExpedir.isPending ? "Expedindo..." : podeAssinar ? "Assinar e expedir" : "Expedir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {devolvendo && oficio && (
        <Janela titulo="Devolver ao redator" onClose={() => setDevolvendo(false)}>
          <label className="grid gap-1.5">
            <span className={rotuloCampo}>
              Observação para {nomeCurto(oficio.redator_posto, oficio.redator_nome)}
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
              {mDevolver.isPending ? "Devolvendo..." : "Devolver ofício"}
            </button>
          </div>
        </Janela>
      )}

      {cancelando && oficio && (
        <Janela
          titulo={oficio.numero ? `Cancelar o ofício nº ${oficio.numero}` : "Cancelar o ofício"}
          onClose={() => setCancelando(false)}
        >
          <p className="text-sm text-muted-foreground">
            {oficio.numero
              ? "O ofício continua registrado com o número, marcado como CANCELADO. O número não é reaproveitado."
              : "O ofício sai da fila de assinatura e não recebe número."}
          </p>
          <label className="grid gap-1.5">
            <span className={rotuloCampo}>Motivo{oficio.numero ? "" : " (opcional)"}</span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              maxLength={1000}
              autoFocus
              className={campoCls}
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCancelando(false)}
              className="rounded-md border border-border px-4 py-2 text-sm"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={() => mCancelar.mutate()}
              disabled={(!!oficio.numero && motivo.trim().length < 3) || mCancelar.isPending}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
            >
              {mCancelar.isPending ? "Cancelando..." : "Cancelar ofício"}
            </button>
          </div>
        </Janela>
      )}

      {oficio?.status === "expedido" && oficio.signatario_nome && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden />
          Expedido em {dataBr(oficio.expedido_em)} · assinado por{" "}
          {nomeComPostoExtenso(oficio.signatario_posto, oficio.signatario_nome)} (
          {rotuloCargo(oficio.signatario_cargo)})
          {oficio.redator_id !== oficio.signatario_id &&
            ` · Encarregado: ${nomeComPostoExtenso(oficio.redator_posto, oficio.redator_nome)}`}
        </div>
      )}
    </>
  );
}

function Janela({
  titulo,
  onClose,
  children,
}: {
  titulo: string;
  onClose: () => void;
  children: React.ReactNode;
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
        className="surface w-full max-w-lg space-y-3 p-5"
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
