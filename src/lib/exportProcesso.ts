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
import { supabase } from "@/integrations/supabase/client";
import { isPortariaDados } from "@/components/PortariaTemplate";
import crestAsset from "@/assets/brasao-corregedoria-pmesp-transparente.png.asset.json";
import { appendPdfElement } from "@/lib/pdf-export";
import { ROLE_LABELS, type AppRole } from "@/lib/access-roles";
import { gerarProcessoPdf, nomeArquivoProcesso, type PdfDenuncia, type PdfImagem } from "@/lib/pdf/processo-pdf";

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
  portaria_dados?: unknown;
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

const BRASAO_SRC = crestAsset.url;

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
        ? "IPM"
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
  if (c in ROLE_LABELS) return ROLE_LABELS[c as AppRole];
  return c === "delegado_geral"
    ? "Delegado Geral"
    : c === "delegado_corregedor"
      ? "Delegado Corregedor"
      : c === "coordenador"
        ? "Coordenador"
        : c === "corregedor"
        ? "Corregedor"
        : c;
}

function statusLabel(s: string): string {
  const m: Record<string, string> = {
    novo: "Novo",
    recebida: "Recebida",
    aguardando_analise: "Aguardando análise",
    em_analise: "Em análise",
    em_investigacao: "Em investigação",
    concluso: "Concluso",
    ag_decurso_prazo: "Aguardando Decurso do Prazo",
    transito_julgado: "Trânsito em Julgado",
    concluida: "Concluída",
    arquivada: "Arquivada",
  };
  return m[s] ?? s;
}

function bodyHtml(teor: string): string {
  if (isHtmlAto(teor)) return `<div class="ato-body-pdf">${sanitizeAtoHtml(teor)}</div>`;
  return `<div class="ato-body-pdf" style="white-space:pre-wrap">${esc(teor)}</div>`;
}

function extrairRelatoIpc(teor: string): string {
  const m = teor.match(/\|\s*3º\s+RELATO\s+DO\s+FATO\s*:\s*\n([\s\S]*?)(?:\n\s*\n\|\s*4º|$)/i);
  return m ? m[1].trim() : teor;
}

/* ------------ blocos HTML por página ------------ */

const HEADER_HTML = `
  <header style="display:flex;flex-direction:column;align-items:center;gap:6px;border-bottom:2px solid #94a3b8;padding-bottom:10px;text-align:center">
    <img src="${BRASAO_SRC}" alt="" crossorigin="anonymous" style="height:70px;width:auto" />
    <div style="font-family:Arial,sans-serif;font-size:11px;font-weight:bold;text-transform:uppercase;line-height:1.35;color:#374151">
      <div>Secretaria da Segurança Pública</div>
      <div>Polícia Militar do Estado de São Paulo</div>
      <div>Corregedoria da Polícia Militar do Estado de São Paulo</div>
      <div style="text-transform:none">corregedoriageral@pmesp.sp</div>
    </div>
  </header>`;

function pageWrap(inner: string): string {
  return `
    <section class="pdf-page" style="
      box-sizing:border-box;width:794px;min-height:1123px;background:#ffffff;color:#111827;
      font-family:Arial,sans-serif;padding:76px 76px 0;position:relative;overflow-wrap:anywhere;
    ">${inner}</section>`;
}

// Preserve the approved Portaria geometry independently of the other templates.
function portariaPageWrap(inner: string): string {
  return `<section class="pdf-page" style="box-sizing:border-box;width:794px;min-height:1123px;background:#ffffff;color:#111827;font-family:Georgia,'Times New Roman',serif;padding:56px 64px 96px;position:relative">${inner}</section>`;
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
      <div style="margin-top:14px;font-size:26px;letter-spacing:.15em;font-weight:bold">Nº ${esc((d as any).numero_procedimento ?? d.numero_protocolo)}</div>
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
    <div style="margin-top:80px;text-align:center;font-size:10.5px;color:#6b7280;font-style:italic">
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
        : especie === "mandado"
          ? "MANDADO"
          : especie === "ata"
            ? "TERMO DE DEPOIMENTO"
            : especie === "certidao"
              ? "CERTIDÃO"
              : "IPM";
}

function atoContentPage(
  m: ExportMovimento,
  d: ExportDenuncia,
  policiais: ExportPolicial[],
): string {
  if (m.especie === "portaria" && isPortariaDados(m.portaria_dados)) {
    const p = m.portaria_dados;
    const lista = (itens: string[]) => itens.map((item) => `<div style="margin:2px 0 2px 22px">${esc(item)}</div>`).join("");
    const secao = (titulo: string) => `<div style="background:#c7c7c7;text-align:center;font-weight:bold;margin:6px 0;padding:1px 0">${titulo}</div>`;
    return portariaPageWrap(`
      <div style="display:grid;grid-template-columns:145px 1fr;align-items:center;font-family:Arial,sans-serif;color:#111">
        <div style="text-align:center"><img src="${BRASAO_SRC}" style="width:91px;height:106px;object-fit:contain" /></div>
        <div><div style="font-size:17px;font-weight:bold">SECRETARIA DA SEGURANÇA PÚBLICA</div><div style="font-size:16px;font-weight:bold">POLÍCIA MILITAR DO ESTADO DE SÃO PAULO</div><div style="font-size:9px;font-weight:bold;margin-top:2px">CHAVE IDENTIFICADORA</div><svg class="portaria-barcode" data-value="${esc(p.chave)}"></svg><div style="font:12px 'Courier New',monospace">${esc(p.chave)}</div></div>
      </div>
      <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.28;color:#111">
        <h2 style="text-align:center;font-size:20px;margin:26px 0 14px">${(p as any).tipoProcedimento === "sindicancia" ? "SINDPM" : "IPM"} Nº ${esc(p.ipmNumero)}</h2>
        <p><strong>DATA DE INSTAURAÇÃO:</strong> ${esc(p.dataInstauracao)}</p><p><strong>DATA DO FATO:</strong> ${esc(p.dataFato)}</p><div style="height:14px"></div>
        <p><strong>ENCARREGADO:</strong> ${esc(p.encarregado)}</p><p><strong>MUNICÍPIO DE INSTAURAÇÃO:</strong> ${esc(p.municipioInstauracao)}</p>
        ${secao("NATUREZAS")}${lista(p.naturezas)}${secao("POLICIAIS MILITARES INDICIADOS")}${lista(p.indiciados)}${secao("LOCAL DOS FATOS")}<p>${esc(p.localFatos)}</p>${secao("PORTARIA")}
        <main style="margin-top:26px;text-align:justify">${sanitizeAtoHtml(p.corpo)}</main><p style="margin-top:34px;text-align:justify">${esc(p.localData)}</p><div style="margin-top:34px;text-align:center"><p>${esc(p.signatarioNome.toUpperCase())}</p><p>${esc(p.signatarioPosto.toUpperCase())}</p></div>
      </div>
    `);
  }
  const denunciado = policiais.length
    ? policiais.map((p) => `${p.nome}${p.rg_funcional ? ` — ${p.rg_funcional}` : ""}`).join("; ")
    : "Não identificado";

  const camposHtml =
    m.especie === "ipc"
      ? `
        <div><strong>UNIDADE:</strong> ${esc(d.unidade) || "—"}</div>
        <div><strong>PROCESSO Nº:</strong> ${esc((d as any).numero_procedimento ?? d.numero_protocolo)}</div>
        <div><strong>IDENTIFICAÇÃO DO POLICIAL:</strong> ${esc(denunciado)}</div>
      `
      : `
        <div><strong>PROCEDIMENTO:</strong> ${esc((d as any).numero_procedimento ?? d.numero_protocolo)}</div><div><strong>PROTOCOLO:</strong> ${esc(d.numero_protocolo)}</div>
        <div><strong>DENUNCIADO:</strong> ${esc(denunciado)}</div>
      `;

  const corpo =
    m.especie === "ipc"
      ? `
        ${bodyHtml(extrairRelatoIpc(m.teor))}
        <div style="margin-top:18px"><strong>CIENTE DOS FATOS:</strong> Corregedoria da Polícia Militar do Estado de São Paulo</div>
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

/* ------------ anexos (imagens-prova) ------------ */

async function anexoImagePage(nome: string, dataUrl: string): Promise<string> {
  return pageWrap(`
    ${HEADER_HTML}
    <div style="text-align:center;margin-top:10px">
      <div style="font-size:12px;letter-spacing:.15em;font-weight:bold;color:#374151">PROVA JUNTADA AOS AUTOS</div>
      <div style="margin-top:4px;font-size:15px;font-weight:bold">${esc(nome)}</div>
    </div>
    <div style="margin-top:22px;display:flex;align-items:center;justify-content:center">
      <img src="${dataUrl}" alt="${esc(nome)}" style="max-width:100%;max-height:820px;object-fit:contain;border:1px solid #d1d5db" />
    </div>
  `);
}

async function fetchAnexoDataUrl(path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from("atos-anexos")
      .createSignedUrl(path, 60 * 10);
    if (error || !data) return null;
    const resp = await fetch(data.signedUrl);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/* ------------ export vetorial (novo) ------------ */

function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Carrega a imagem, mede e, se não for PNG/JPEG, converte para JPEG. */
async function normalizarImagem(dataUrl: string): Promise<PdfImagem | null> {
  const el = new Image();
  const ok = await new Promise<boolean>((resolve) => {
    el.onload = () => resolve(true);
    el.onerror = () => resolve(false);
    el.src = dataUrl;
  });
  if (!ok || !el.naturalWidth || !el.naturalHeight) return null;
  let url = dataUrl;
  if (!/^data:image\/(png|jpe?g)/i.test(dataUrl)) {
    const canvas = document.createElement("canvas");
    canvas.width = el.naturalWidth;
    canvas.height = el.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(el, 0, 0);
    url = canvas.toDataURL("image/jpeg", 0.92);
  }
  return { dataUrl: url, width: el.naturalWidth, height: el.naturalHeight };
}

async function carregarImagemPublica(caminho: string): Promise<PdfImagem> {
  const resp = await fetch(caminho);
  if (!resp.ok) throw new Error("Não foi possível carregar o timbre do PDF. Tente novamente.");
  const img = await normalizarImagem(await blobParaDataUrl(await resp.blob()));
  if (!img) throw new Error("Não foi possível carregar o timbre do PDF. Tente novamente.");
  return img;
}

/**
 * Exportação do processo completo em texto vetorial (nítido e pesquisável),
 * no padrão do modelo oficial: timbre da SSP, "DESPACHO - CORREGPM" e rodapé
 * com IPM/SINDPM, emblema da PM e "Página X de Y". NÃO inclui observações internas.
 */
export async function exportProcessoCompletoV2(
  data: Omit<ExportProcessoData, "denuncia"> & { denuncia: PdfDenuncia },
): Promise<void> {
  const [brasao, emblema] = await Promise.all([
    carregarImagemPublica("/pdf/brasao-ssp.png"),
    carregarImagemPublica("/pdf/emblema-pm.png"),
  ]);
  const anexos = new Map<string, PdfImagem>();
  const caminhos = Array.from(
    new Set(data.movimentos.flatMap((m) => (Array.isArray(m.anexos) ? m.anexos.map((a) => a.path) : []))),
  );
  await Promise.all(
    caminhos.map(async (path) => {
      const url = await fetchAnexoDataUrl(path);
      const img = url ? await normalizarImagem(url) : null;
      if (img) anexos.set(path, img);
    }),
  );
  const pdf = await gerarProcessoPdf(
    { denuncia: data.denuncia, policiais: data.policiais, movimentos: data.movimentos },
    { brasao, emblema, anexos },
  );
  pdf.save(nomeArquivoProcesso(data.denuncia));
}

/* ------------ export principal (versão anterior, por imagem) ------------ */

export async function exportProcessoCompleto(data: ExportProcessoData): Promise<void> {
  const [{ default: jsPDF }, { default: JsBarcode }] = await Promise.all([
    import("jspdf"),
    import("jsbarcode"),
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
      .ato-body-pdf p{margin:0;min-height:1.15em;line-height:1.15}
      .ato-body-pdf p:empty::before{content:"\\00a0"}
      .ato-body-pdf strong,.ato-body-pdf b{font-weight:700}
      .ato-body-pdf em,.ato-body-pdf i{font-style:italic}
      .ato-body-pdf u{text-decoration:underline}
      .ato-body-pdf a{color:#1e40af;text-decoration:underline}
    </style></head><body></body></html>`;
  });

  const doc = iframe.contentDocument;
  if (!doc) { iframe.remove(); throw new Error("Não foi possível preparar o PDF."); }
  const pages: string[] = [];
  pages.push(coverPage(data.denuncia, data.policiais));
  for (let i = 0; i < movsAsc.length; i++) {
    const m = movsAsc[i];
    const eventoNo = i + 1;
    pages.push(separatorPage(eventoNo, m));
    const isAto =
      m.especie === "despacho" ||
      m.especie === "decisao" ||
      m.especie === "portaria" ||
      m.especie === "mandado" ||
      m.especie === "ata" ||
      m.especie === "certidao" ||
      m.especie === "ipc";
    pages.push(isAto ? atoContentPage(m, data.denuncia, data.policiais) : genericContentPage(m));
    // Anexos-prova (só despacho/decisão/certidão) — cada imagem em página própria.
    if ((m.especie === "despacho" || m.especie === "decisao" || m.especie === "certidao") && Array.isArray(m.anexos)) {
      for (const a of m.anexos) {
        const dataUrl = await fetchAnexoDataUrl(a.path);
        if (dataUrl) pages.push(await anexoImagePage(a.nome, dataUrl));
      }
    }
  }
  doc.body.innerHTML = pages.join("");
  doc.querySelectorAll<SVGSVGElement>(".portaria-barcode").forEach((element) => {
    JsBarcode(element, element.dataset.value ?? "", { format: "CODE128", displayValue: false, height: 42, width: 1.45, margin: 0, lineColor: "#111111" });
  });

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

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const pageEls = Array.from(doc.querySelectorAll<HTMLElement>(".pdf-page"));
    for (let i = 0; i < pageEls.length; i++) {
      await appendPdfElement(pdf, pageEls[i], i > 0);
    }

    const total = pdf.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i);
      pdf.setFontSize(9);
      pdf.setTextColor(120);
      pdf.text(`Página ${i} de ${total}`, pageW / 2, pageH - 8, { align: "center" });
    }

    const nomeArquivo = `PAD-${((data.denuncia as any).numero_procedimento ?? data.denuncia.numero_protocolo).replace(/[^\w-]+/g, "-")}.pdf`;
    pdf.save(nomeArquivo);
  } finally {
    iframe.remove();
  }
}

