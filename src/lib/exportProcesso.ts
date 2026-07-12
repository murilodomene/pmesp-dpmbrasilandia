/**
 * Exportação do processo administrativo completo em PDF, estilo e-proc:
 * capa de autuação → para cada Evento (ordem crescente), página de separação
 * seguida do conteúdo do movimento (atos timbrados em papel branco, demais
 * movimentos em página institucional simples). Numeração de páginas no rodapé.
 *
 * NÃO inclui observações internas em hipótese alguma.
 */
import { calcularPrescricao, type DenunciaStatus, formatarDiasRestantes } from "@/lib/prescricao";
import { sanitizeAtoHtml, isHtmlAto } from "@/components/RichTextEditor";

export interface ExportPolicial {
  id: string;
  nome: string;
  rg_funcional: string | null;
  unidade: string | null;
}
export interface ExportMovimento {
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
}
export interface ExportOitiva {
  id: string;
  identificacao: string;
  url: string;
  data: string | null;
  ativa: boolean;
}
export interface ExportDenuncia {
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
}

export interface ExportProcessoData {
  denuncia: ExportDenuncia;
  policiais: ExportPolicial[];
  movimentos: ExportMovimento[]; // qualquer ordem — a função ordena asc
  oitivas: ExportOitiva[];
}

const BRASAO_SRC = "/brasao-pcsp.png";

/* ------------ helpers ------------ */

function esc(v: string | null | undefined): string {
  if (v == null) return "";
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}
function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return "—";
  }
}

function labelEspecie(e: string): string {
  return e === "despacho"
    ? "Despacho"
    : e === "decisao"
      ? "Decisão"
      : e === "ipc"
        ? "IPC"
        : e === "portaria"
          ? "Portaria Inaugural"
          : e === "retificacao"
            ? "Retificação de denunciado"
            : e === "cancelamento"
              ? "Cancelamento"
              : e === "status"
                ? "Mudança de status"
                : e;
}

function cargoLabel(c: string | null | undefined): string {
  if (!c) return "";
  return c === "delegado_geral"
    ? "Delegado Geral"
    : c === "delegado_corregedor"
      ? "Delegado Corregedor"
      : c === "corregedor"
        ? "Corregedor"
        : c;
}

function statusLabel(s: string): string {
  const m: Record<string, string> = {
    recebida: "Recebida",
    aguardando_analise: "Aguardando análise",
    em_analise: "Em análise",
    em_investigacao: "Em investigação",
    ag_decurso_prazo: "Aguardando Decurso do Prazo",
    transito_julgado: "Trânsito em Julgado",
    concluida: "Concluída",
    arquivada: "Arquivada",
  };
  return m[s] ?? s;
}

function bodyHtml(teor: string): string {
  if (isHtmlAto(teor)) return sanitizeAtoHtml(teor);
  return `<div style="white-space:pre-wrap">${esc(teor)}</div>`;
}

function extrairRelatoIpc(teor: string): string {
  const m = teor.match(/\|\s*3º\s+RELATO\s+DO\s+FATO\s*:\s*\n([\s\S]*?)(?:\n\s*\n\|\s*4º|$)/i);
  return m ? m[1].trim() : teor;
}

/* ------------ blocos HTML por página ------------ */

const HEADER_HTML = `
  <header style="display:flex;flex-direction:column;align-items:center;gap:6px;border-bottom:2px solid #94a3b8;padding-bottom:10px;text-align:center">
    <img src="${BRASAO_SRC}" alt="" crossorigin="anonymous" style="height:70px;width:auto" />
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:10.5px;font-weight:bold;text-transform:uppercase;line-height:1.35;color:#374151">
      <div>Secretaria da Segurança Pública</div>
      <div>Polícia Civil do Estado de São Paulo</div>
      <div>Corregedoria Geral da Polícia Civil</div>
      <div>1ª Corregedoria da Capital</div>
      <div style="text-transform:none">corregedoriageral@policiacivil.sp</div>
    </div>
  </header>`;

function pageWrap(inner: string): string {
  return `
    <section class="pdf-page" style="
      box-sizing:border-box;width:794px;min-height:1123px;background:#ffffff;color:#111827;
      font-family:Georgia,'Times New Roman',serif;padding:56px 64px 96px;position:relative;
    ">${inner}</section>`;
}

function coverPage(d: ExportDenuncia, policiais: ExportPolicial[]): string {
  const p = calcularPrescricao({
    termo_inicial: d.termo_inicial,
    acrescimos_dias: d.acrescimos_dias,
    status: d.status as DenunciaStatus,
  });
  const denunciante = d.denunciante_anonimo ? "Anônimo" : d.denunciante_nome || "Não informado";
  const denunciadosHtml =
    policiais.length === 0
      ? "—"
      : policiais
          .map(
            (pol) =>
              `<div>${esc(pol.nome)}${
                pol.rg_funcional ? ` <span style="color:#4b5563">· ${esc(pol.rg_funcional)}</span>` : ""
              }${
                pol.unidade ? ` <span style="color:#4b5563">· ${esc(pol.unidade)}</span>` : ""
              }</div>`,
          )
          .join("");

  const prescr = p.prescrita
    ? `<strong style="color:#b91c1c">Prescrição consumada há ${Math.abs(p.diasRestantes)} dia(s)</strong>`
    : p.suspenso
      ? "Relógio suspenso"
      : `${formatarDiasRestantes(p)} (base ${p.totalPrazo} dias)`;

  return pageWrap(`
    ${HEADER_HTML}
    <div style="text-align:center;margin:72px 0 24px">
      <div style="font-size:22px;font-weight:bold;letter-spacing:.25em">PROCESSO ADMINISTRATIVO DISCIPLINAR</div>
      <div style="margin-top:14px;font-size:26px;letter-spacing:.15em;font-weight:bold">Nº ${esc(d.numero_protocolo)}</div>
    </div>
    <div style="margin-top:32px;border:1.5px solid #6b7280;border-radius:4px;padding:20px 24px;font-size:13px;line-height:1.7">
      <div style="display:grid;grid-template-columns:180px 1fr;gap:8px 16px">
        <div style="font-weight:bold">DENUNCIANTE:</div><div>${esc(denunciante)}</div>
        <div style="font-weight:bold">DENUNCIADO(S):</div><div>${denunciadosHtml}</div>
        <div style="font-weight:bold">NATUREZA:</div><div>${esc(d.ocorrencia_tipo) || "—"}</div>
        <div style="font-weight:bold">UNIDADE:</div><div>${esc(d.unidade) || "—"}</div>
        <div style="font-weight:bold">INSTAURAÇÃO:</div><div>${fmtDate(d.instaurada_em ?? d.created_at)}</div>
        <div style="font-weight:bold">STATUS ATUAL:</div><div>${esc(statusLabel(d.status))}</div>
        <div style="font-weight:bold">PRESCRIÇÃO:</div><div>${prescr}</div>
      </div>
    </div>
    <div style="position:absolute;bottom:44px;left:64px;right:64px;text-align:center;font-size:10.5px;color:#6b7280;font-style:italic">
      Capa de autuação gerada automaticamente pelo sistema.
    </div>
  `);
}

function separatorPage(eventoNo: number, m: ExportMovimento): string {
  const nn = String(eventoNo).padStart(2, "0");
  return pageWrap(`
    <div style="text-align:center">
      <div style="font-size:16px;font-weight:bold;letter-spacing:.02em">Evento nº ${nn}</div>
      <div style="margin-top:6px;font-size:10.5px;color:#6b7280;font-style:italic">
        Página de separação — gerada automaticamente pelo sistema
      </div>
    </div>
    <hr style="margin:20px 0;border:0;border-top:1px solid #d1d5db" />
    <div style="font-size:13px;line-height:1.7;text-align:left">
      <div style="margin-bottom:12px"><div style="font-weight:bold">Espécie:</div><div>${esc(labelEspecie(m.especie))}</div></div>
      <div style="margin-bottom:12px"><div style="font-weight:bold">Data e hora:</div><div>${fmtDateTime(m.criado_em)}</div></div>
      <div style="margin-bottom:12px"><div style="font-weight:bold">Responsável:</div><div>${esc(m.prolator_nome)} — ${esc(cargoLabel(m.prolator_cargo))}</div></div>
      <div style="margin-bottom:12px"><div style="font-weight:bold">Sequência do Evento:</div><div>${nn}</div></div>
    </div>
  `);
}

function atoTipoLabel(especie: string): string {
  return especie === "despacho"
    ? "DESPACHO"
    : especie === "decisao"
      ? "DECISÃO"
      : especie === "portaria"
        ? "PORTARIA"
        : "IPC";
}

function atoContentPage(
  m: ExportMovimento,
  d: ExportDenuncia,
  policiais: ExportPolicial[],
): string {
  const denunciado = policiais.length
    ? policiais.map((p) => `${p.nome}${p.rg_funcional ? ` — ${p.rg_funcional}` : ""}`).join("; ")
    : "Não identificado";

  const camposHtml =
    m.especie === "ipc"
      ? `
        <div><strong>UNIDADE:</strong> ${esc(d.unidade) || "—"}</div>
        <div><strong>PROCESSO Nº:</strong> ${esc(d.numero_protocolo)}</div>
        <div><strong>IDENTIFICAÇÃO DO POLICIAL:</strong> ${esc(denunciado)}</div>
      `
      : `
        <div><strong>PROCEDIMENTO:</strong> ${esc(d.numero_protocolo)}</div>
        <div><strong>DENUNCIADO:</strong> ${esc(denunciado)}</div>
      `;

  const corpo =
    m.especie === "ipc"
      ? `
        ${bodyHtml(extrairRelatoIpc(m.teor))}
        <div style="margin-top:18px"><strong>CIENTE DOS FATOS:</strong> Corregedoria Geral da Polícia Civil</div>
      `
      : bodyHtml(m.teor);

  const subtitulo = m.especie === "ipc" ? "Resolução final do inquérito" : "";
  const canceladoBanner = m.cancelado_em
    ? `<div style="margin-bottom:12px;border:1px solid #b91c1c;background:#fee2e2;color:#7f1d1d;padding:8px 12px;font-size:12px;border-radius:4px">
        <strong>MOVIMENTAÇÃO CANCELADA</strong> em ${fmtDateTime(m.cancelado_em)}${
          m.cancelado_por_nome ? ` por ${esc(m.cancelado_por_nome)}` : ""
        }${m.motivo_cancelamento ? `. Justificativa: ${esc(m.motivo_cancelamento)}` : "."}
      </div>`
    : "";

  return pageWrap(`
    ${HEADER_HTML}
    <div style="text-align:center;margin-top:14px">
      <div style="font-size:16px;font-weight:bold;letter-spacing:.25em">${atoTipoLabel(m.especie)}</div>
      ${subtitulo ? `<div style="font-size:10.5px;font-style:italic;color:#4b5563;margin-top:2px">${subtitulo}</div>` : ""}
    </div>
    <section style="margin-top:18px;font-size:13px;line-height:1.6">${camposHtml}</section>
    ${canceladoBanner}
    <main style="margin:24px 8px;font-size:13px;line-height:1.65;text-align:justify">${corpo}</main>
    <footer style="margin-top:36px;border-top:1px solid #d1d5db;padding-top:10px;text-align:center;font-size:11px;font-style:italic;color:#374151">
      Datado e assinado digitalmente por ${esc(m.prolator_nome)} — ${esc(cargoLabel(m.prolator_cargo))} em ${fmtDate(m.criado_em)}.
    </footer>
  `);
}

function genericContentPage(m: ExportMovimento): string {
  const canceladoBanner = m.cancelado_em
    ? `<div style="margin-bottom:12px;border:1px solid #b91c1c;background:#fee2e2;color:#7f1d1d;padding:8px 12px;font-size:12px;border-radius:4px">
        <strong>MOVIMENTAÇÃO CANCELADA</strong> em ${fmtDateTime(m.cancelado_em)}${
          m.cancelado_por_nome ? ` por ${esc(m.cancelado_por_nome)}` : ""
        }${m.motivo_cancelamento ? `. Justificativa: ${esc(m.motivo_cancelamento)}` : "."}
      </div>`
    : "";
  return pageWrap(`
    ${HEADER_HTML}
    <div style="text-align:center;margin-top:14px">
      <div style="font-size:16px;font-weight:bold;letter-spacing:.25em">${esc(labelEspecie(m.especie).toUpperCase())}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:4px">${fmtDateTime(m.criado_em)}</div>
    </div>
    ${canceladoBanner}
    <main style="margin:28px 8px;font-size:13px;line-height:1.65;text-align:justify">${bodyHtml(m.teor)}</main>
    <footer style="margin-top:36px;border-top:1px solid #d1d5db;padding-top:10px;text-align:center;font-size:11px;font-style:italic;color:#374151">
      Registrado por ${esc(m.prolator_nome)} — ${esc(cargoLabel(m.prolator_cargo))} em ${fmtDateTime(m.criado_em)}.
    </footer>
  `);
}

/* ------------ export principal ------------ */

export async function exportProcessoCompleto(data: ExportProcessoData): Promise<void> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const movsAsc = [...data.movimentos].sort(
    (a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime(),
  );

  // Renderiza dentro de um iframe isolado, sem herdar as folhas de estilo do app
  // (o design system usa oklch(), que o html2canvas ainda não parseia).
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:794px;height:1200px;border:0;background:#ffffff;";
  document.body.appendChild(iframe);
  await new Promise<void>((r) => {
    iframe.addEventListener("load", () => r(), { once: true });
    iframe.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;padding:0;background:#ffffff;color:#111827;font-family:Georgia,'Times New Roman',serif}
      *{box-sizing:border-box}
      img{max-width:100%}
    </style></head><body></body></html>`;
  });

  const doc = iframe.contentDocument!;
  const pages: string[] = [];
  pages.push(coverPage(data.denuncia, data.policiais));
  movsAsc.forEach((m, i) => {
    const eventoNo = i + 1;
    pages.push(separatorPage(eventoNo, m));
    const isAto =
      m.especie === "despacho" ||
      m.especie === "decisao" ||
      m.especie === "portaria" ||
      m.especie === "ipc";
    pages.push(isAto ? atoContentPage(m, data.denuncia, data.policiais) : genericContentPage(m));
  });
  doc.body.innerHTML = pages.join("");

  try {
    const imgs = Array.from(doc.querySelectorAll("img"));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if ((img as HTMLImageElement).complete) resolve();
            else {
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            }
          }),
      ),
    );

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const pageEls = Array.from(doc.querySelectorAll<HTMLElement>(".pdf-page"));
    for (let i = 0; i < pageEls.length; i++) {
      const canvas = await html2canvas(pageEls[i], {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: 794,
      });
      const imgH = (canvas.height * pageW) / canvas.width;
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageW, Math.min(imgH, pageH));
    }

    const total = pdf.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i);
      pdf.setFontSize(9);
      pdf.setTextColor(120);
      pdf.text(`Página ${i} de ${total}`, pageW / 2, pageH - 8, { align: "center" });
    }

    const nomeArquivo = `PAD-${data.denuncia.numero_protocolo.replace(/[^\w-]+/g, "-")}.pdf`;
    pdf.save(nomeArquivo);
  } finally {
    iframe.remove();
  }
}

