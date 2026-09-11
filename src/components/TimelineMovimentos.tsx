import { useState } from "react";
import { Gavel, FileText, Scale, Pencil, Stamp, ShieldCheck, Bell, Download, Mic } from "lucide-react";
import { DocumentTemplate, exportDocumentToPdf, useDocumentRef } from "@/components/DocumentTemplate";
import { isHtmlAto, sanitizeAtoHtml } from "@/components/RichTextEditor";
import { AtoAnexosLinks } from "@/components/AtoAnexosLinks";
import { PortariaTemplate, exportPortariaToPdf, isPortariaDados } from "@/components/PortariaTemplate";

/**
 * Componente compartilhado de renderização da linha do tempo dos processos —
 * usa a mesma estética (timbrado, cartões, marcadores de Evento) da tela da
 * Corregedoria. Sempre em modo somente leitura (sem cancelar/excluir).
 */

type Movimento = {
  id: string;
  especie: string;
  teor: string;
  criado_em: string;
  prolator_nome: string;
  prolator_cargo: string | null;
  interrompe?: boolean | null;
  prorroga?: boolean | null;
  ipc_publicado?: boolean | null;
  cancelado_em?: string | null;
  cancelado_por_nome?: string | null;
  cancelado_por_cargo?: string | null;
  motivo_cancelamento?: string | null;
  anexos?: unknown;
  portaria_dados?: unknown;
};

type Policial = { id: string; nome: string; rg_funcional?: string | null };

export function TimelineMovimentos({
  movimentos,
  procedimento,
  unidade,
  policiais,
}: {
  movimentos: Movimento[];
  procedimento: string;
  unidade: string;
  policiais: Policial[];
}) {
  const denunciadoStr = policiais.length
    ? policiais.map((p) => `${p.nome}${p.rg_funcional ? ` — ${p.rg_funcional}` : ""}`).join("; ")
    : "Não identificado";

  return (
    <div className="surface p-5">
      <h3 className="font-serif text-lg">Linha do tempo</h3>
      <ul className="mt-4 space-y-3">
        {movimentos.length === 0 && (
          <li className="text-xs text-muted-foreground">Nenhum movimento ainda.</li>
        )}
        {movimentos.map((m, idx) => {
          const eventoNo = movimentos.length - idx;
          const eventoLabel = `Evento nº ${String(eventoNo).padStart(2, "0")}`;
          const isAto =
            m.especie === "despacho" ||
            m.especie === "decisao" ||
            m.especie === "portaria" ||
            m.especie === "mandado" ||
            m.especie === "ata" ||
            m.especie === "certidao";
          const isIpc = m.especie === "ipc";
          const isCertidao =
            m.especie === "evento" &&
            typeof m.teor === "string" &&
            /^\s*Certifico e dou f[ée] que foi interposto recurso administrativo/i.test(m.teor);

          const canceladoEm = m.cancelado_em ?? null;
          const canceladoBadge = canceladoEm && (
            <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-destructive-foreground">
              Cancelada
            </span>
          );
          const canceladoFooter = canceladoEm && (
            <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive-foreground">
              Cancelada em{" "}
              <span className="tabular">{new Date(canceladoEm).toLocaleString("pt-BR")}</span> por{" "}
              {m.cancelado_por_nome} · {cargoLabel(m.cancelado_por_cargo as string)}
              {m.motivo_cancelamento && (
                <>
                  <br />
                  <span className="opacity-90">Justificativa: {m.motivo_cancelamento}</span>
                </>
              )}
            </div>
          );

          if (isAto) {
            const anexosRaw = (m.anexos as Array<{ nome: string; path: string }> | undefined) ?? [];
            const anexos = Array.isArray(anexosRaw) ? anexosRaw : [];
            return (
              <li key={m.id} className={`flex gap-3 ${canceladoEm ? "opacity-60" : ""}`}>
                <MovMarker especie={m.especie} />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                      {eventoLabel}
                    </span>
                    <span className="font-medium uppercase tracking-wider">{labelEspecie(m.especie)}</span>
                    {canceladoBadge}
                    <span className="ml-auto text-muted-foreground tabular">
                      {new Date(m.criado_em).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className={canceladoEm ? "line-through decoration-destructive/60" : ""}>
                    <TimelineAtoCard
                      especie={m.especie as "despacho" | "decisao" | "portaria" | "mandado" | "ata" | "certidao"}
                      teor={m.teor}
                      quando={m.criado_em}
                      prolator={m.prolator_nome}
                      cargo={m.prolator_cargo as string}
                      procedimento={procedimento}
                      denunciado={denunciadoStr}
                      portariaDados={m.portaria_dados}
                    />
                  </div>
                  {anexos.length > 0 && <AtoAnexosLinks anexos={anexos} />}
                  {canceladoFooter}
                </div>
              </li>
            );
          }
          if (isIpc) {
            return (
              <li key={m.id} className={`flex gap-3 ${canceladoEm ? "opacity-60" : ""}`}>
                <MovMarker especie={m.especie} />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                      {eventoLabel}
                    </span>
                    <span className="font-medium uppercase tracking-wider">{labelEspecie(m.especie)}</span>
                    <span className="rounded-full bg-status-investigacao/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-status-investigacao-fg">
                      Decisão final
                    </span>
                    {canceladoBadge}
                    <span className="ml-auto text-muted-foreground tabular">
                      {new Date(m.criado_em).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className={canceladoEm ? "line-through decoration-destructive/60" : ""}>
                    <TimelineIpcCard
                      teor={m.teor}
                      quando={m.criado_em}
                      prolator={m.prolator_nome}
                      cargo={m.prolator_cargo as string}
                      unidade={unidade}
                      procedimento={procedimento}
                      identificacao={denunciadoStr}
                    />
                  </div>
                  {canceladoFooter}
                </div>
              </li>
            );
          }
          if (isCertidao) {
            return (
              <li key={m.id} className={`flex gap-3 ${canceladoEm ? "opacity-60" : ""}`}>
                <MovMarker especie={m.especie} />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                      {eventoLabel}
                    </span>
                    <span className="font-medium uppercase tracking-wider">{labelEspecie(m.especie)}</span>
                    {canceladoBadge}
                    <span className="ml-auto text-muted-foreground tabular">
                      {new Date(m.criado_em).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className={canceladoEm ? "line-through decoration-destructive/60" : ""}>
                    <TimelineCertidaoCard
                      teor={m.teor}
                      quando={m.criado_em}
                      prolator={m.prolator_nome}
                      cargo={(m.prolator_cargo as string) ?? "corregedor_geral"}
                      procedimento={procedimento}
                      denunciado={denunciadoStr}
                    />
                  </div>
                  {canceladoFooter}
                </div>
              </li>
            );
          }
          return (
            <li key={m.id} className={`flex gap-3 ${canceladoEm ? "opacity-60" : ""}`}>
              <MovMarker especie={m.especie} />
              <div className="flex-1 rounded-md border border-border/60 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                    {eventoLabel}
                  </span>
                  <span className="font-medium uppercase tracking-wider">{labelEspecie(m.especie)}</span>
                  {canceladoBadge}
                  {m.interrompe && (
                    <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-destructive-foreground">
                      Interrompe
                    </span>
                  )}
                  {m.prorroga && (
                    <span className="rounded-full bg-primary/20 px-2 py-0.5 text-primary">+30 dias</span>
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
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {m.prolator_nome} · {cargoLabel(m.prolator_cargo as string)}
                </div>
                {canceladoFooter}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ==================== helpers (copiados de corregedoria.tsx) ====================

function labelEspecie(e: string): string {
  return e === "despacho"
    ? "Despacho"
    : e === "decisao"
      ? "Decisão"
      : e === "ipc"
        ? "IPC"
        : e === "ata"
          ? "Ata"
          : e === "retificacao"
            ? "Retificação"
            : e === "portaria"
              ? "Portaria Inaugural"
              : e === "mandado"
                ? "Mandado"
                : e === "certidao"
                  ? "Certidão"
                  : "Status";
}

function cargoLabel(c: string | null | undefined): string {
  if (!c) return "";
  return c === "ssp"
    ? "SSP"
    : c === "cmtg"
      ? "CMTG"
    : c === "corregedor_geral"
      ? "Corregedor-Geral"
      : c === "subcorregedor_geral"
        ? "Subcorregedor-Geral"
        : "Corregedor";
}

function cargoLabelFull(c: string | null | undefined): string {
  return cargoLabel(c);
}

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

function MovMarker({ especie }: { especie: string }) {
  const style: Record<string, string> = {
    despacho: "bg-status-analise text-status-analise-fg",
    decisao: "bg-destructive text-destructive-foreground",
    ipc: "bg-status-investigacao text-status-investigacao-fg",
    ata: "bg-sky-600 text-white",
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
        : especie === "ata"
          ? Mic
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
    <div
      className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-full ${
        style[especie] ?? "bg-surface-2 text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
    </div>
  );
}

const ATO_ASSUNTO: Record<"despacho" | "decisao" | "portaria" | "mandado" | "ata" | "certidao", string> = {
  despacho: "Despacho",
  decisao: "Decisão",
  portaria: "Portaria Inaugural",
  mandado: "Mandado de Citação",
  ata: "Termo de Depoimento",
  certidao: "Certidão",
};
const ATO_TIPO: Record<
  "despacho" | "decisao" | "portaria" | "mandado" | "ata" | "certidao",
  "DESPACHO" | "DECISÃO" | "PORTARIA" | "MANDADO" | "TERMO DE DEPOIMENTO" | "CERTIDÃO"
> = { despacho: "DESPACHO", decisao: "DECISÃO", portaria: "PORTARIA", mandado: "MANDADO", ata: "TERMO DE DEPOIMENTO", certidao: "CERTIDÃO" };
const ATO_MARKER: Record<"despacho" | "decisao" | "portaria" | "mandado" | "ata" | "certidao", string> = {
  despacho: "bg-status-analise",
  decisao: "bg-destructive",
  portaria: "bg-primary",
  mandado: "bg-primary",
  ata: "bg-sky-600",
  certidao: "bg-emerald-600",
};

function renderAtoBody(
  _especie: "despacho" | "decisao" | "portaria" | "mandado" | "ata" | "certidao",
  teor: string,
  pdf = false,
): React.ReactNode {
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
  portariaDados,
}: {
  especie: "despacho" | "decisao" | "portaria" | "mandado" | "ata" | "certidao";
  teor: string;
  quando: string;
  prolator: string;
  cargo: string;
  procedimento: string;
  denunciado: string;
  portariaDados?: unknown;
}) {
  const pdfRef = useDocumentRef();
  const [gerando, setGerando] = useState(false);
  const assunto = ATO_ASSUNTO[especie];
  const portariaEstruturada = especie === "portaria" && isPortariaDados(portariaDados) ? portariaDados : null;

  async function exportarPdf() {
    if (!pdfRef.current) return;
    setGerando(true);
    try {
      const fname = `${assunto.replace(/\s+/g, "_")}_${procedimento.replace(/[^\w-]/g, "_")}.pdf`;
      if (portariaEstruturada) await exportPortariaToPdf(pdfRef.current, fname);
      else await exportDocumentToPdf(pdfRef.current, fname);
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="space-y-2">
      {portariaEstruturada ? (
        <PortariaTemplate ref={pdfRef} dados={portariaEstruturada} />
      ) : (
        <>
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
        </>
      )}

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
        <p key={i} className="whitespace-pre-wrap">
          {renderTeorComLinks(p)}
        </p>
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
        <p key={i} className="whitespace-pre-wrap">
          {renderTeorComLinks(p)}
        </p>
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
