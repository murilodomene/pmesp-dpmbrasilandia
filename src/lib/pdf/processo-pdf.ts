/**
 * Monta o PDF do processo completo em texto vetorial, no padrão do modelo
 * oficial (timbre da SSP, "DESPACHO - CORREGPM", rodapé com referência do
 * procedimento, emblema da PM e "Página X de Y").
 *
 * Função pura: recebe os dados e as imagens já carregadas, não acessa rede
 * nem banco. NÃO inclui observações internas.
 */
import type { jsPDF } from "jspdf";
import { calcularPrescricao, formatarDiasRestantes, type DenunciaStatus } from "@/lib/prescricao";
import { ROLE_LABELS, type AppRole } from "@/lib/access-roles";
import {
  PdfWriter,
  MARGEM_ESQ,
  PAGE_W,
  LARGURA_UTIL,
  LIMITE_INFERIOR,
  CINZA,
  PRETO,
  type Cor,
} from "@/lib/pdf/pdf-writer";
import { teorParaParagrafos, textoPuro, type Paragraph } from "@/lib/pdf/pdf-text";
import { rotuloDesfechoPdo, rotuloEstadoPdo, rotuloItemPdo } from "@/lib/pdo-rotulos";

/* ------------ tipos ------------ */

export interface PdfImagem {
  dataUrl: string;
  width: number;
  height: number;
}

export interface PdfAssets {
  brasao: PdfImagem;
  emblema: PdfImagem;
  /** Anexos-prova já carregados, por caminho no storage. */
  anexos?: Map<string, PdfImagem>;
}

export interface PdfPolicial {
  id?: string;
  nome: string;
  rg_funcional: string | null;
  unidade: string | null;
  cargo?: string | null;
}

export interface PdfMovimento {
  id: string;
  especie: string;
  teor: string;
  prolator_nome: string;
  prolator_cargo: string;
  criado_em: string;
  cancelado_em?: string | null;
  cancelado_por_nome?: string | null;
  motivo_cancelamento?: string | null;
  anexos?: Array<{ nome: string; path: string }> | null;
  portaria_dados?: unknown;
}

export interface PdfDenuncia {
  numero_protocolo: string;
  /** Número interno (ex.: "IPM nº 001/2026"), quando existir. */
  numero_procedimento?: string | null;
  tipo_procedimento?: string | null;
  denunciante_nome: string | null;
  denunciante_anonimo: boolean | null;
  ocorrencia_tipo: string | null;
  unidade: string | null;
  status: string;
  termo_inicial: string;
  acrescimos_dias: number;
  interrupcoes_count?: number;
  instaurada_em: string | null;
  created_at: string;
}

export interface PdfProcessoData {
  denuncia: PdfDenuncia;
  policiais: PdfPolicial[];
  movimentos: PdfMovimento[];
}

interface PortariaDadosPdf {
  chave: string;
  ipmNumero: string;
  dataInstauracao?: string;
  dataFato?: string;
  encarregado?: string;
  municipioInstauracao?: string;
  naturezas: string[];
  indiciados: string[];
  localFatos?: string;
  corpo: string;
  localData?: string;
  signatarioNome?: string;
  signatarioPosto?: string;
  tipoProcedimento?: string;
}

/* ------------ rótulos e formatos ------------ */

const STATUS: Record<string, string> = {
  novo: "Novo",
  recebida: "Recebida",
  aguardando_analise: "Aguardando análise",
  em_analise: "Em análise",
  em_recurso: "Em recurso",
  em_investigacao: "Em investigação",
  concluso: "Concluso",
  ag_decurso_prazo: "Aguardando decurso do prazo",
  transito_julgado: "Trânsito em julgado",
  concluida: "Concluída",
  arquivada: "Arquivada",
};

function statusLabel(s: string): string {
  return STATUS[s] ?? s;
}

function cargoLabel(c: string | null | undefined): string {
  if (!c) return "";
  if (c in ROLE_LABELS) return ROLE_LABELS[c as AppRole];
  return c;
}

function dataExtenso(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

function dataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isPortaria(v: unknown): v is PortariaDadosPdf {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const d = v as Partial<PortariaDadosPdf>;
  return (
    typeof d.chave === "string" &&
    typeof d.ipmNumero === "string" &&
    typeof d.corpo === "string" &&
    Array.isArray(d.naturezas) &&
    Array.isArray(d.indiciados)
  );
}

/** Identificação do procedimento: sigla (IPM/SINDPM) e número curto (001/2026). */
export function identificacaoProcedimento(d: PdfDenuncia): {
  sigla: string;
  numero: string;
  rodape: string;
  temNumero: boolean;
} {
  const interno = d.numero_procedimento?.trim();
  if (interno) {
    const m = interno.match(/^([A-Za-zÀ-ú]+)\s*(?:n[ºo°.]*)?\s*(\d+\/\d{4})$/i);
    if (m) {
      const sigla = m[1].toUpperCase();
      return { sigla, numero: m[2], rodape: `${sigla}/${m[2]}`, temNumero: true };
    }
    return { sigla: "", numero: interno, rodape: interno, temNumero: true };
  }
  const sigla = d.tipo_procedimento === "sindicancia" ? "SINDPM" : "IPM";
  if (/^\d+\/\d{4}$/.test(d.numero_protocolo)) {
    return {
      sigla,
      numero: d.numero_protocolo,
      rodape: `${sigla}/${d.numero_protocolo}`,
      temNumero: true,
    };
  }
  return { sigla: "", numero: d.numero_protocolo, rodape: d.numero_protocolo, temNumero: false };
}

function tituloAto(especie: string, d: PdfDenuncia): string {
  switch (especie) {
    case "despacho":
      return "DESPACHO";
    case "decisao":
      return "DECISÃO";
    case "certidao":
    case "evento":
      return "CERTIDÃO";
    case "mandado":
      return "MANDADO";
    case "ata":
      return "TERMO DE DEPOIMENTO";
    case "ipc":
      return d.tipo_procedimento === "sindicancia"
        ? "SINDPM"
        : d.tipo_procedimento === "apfd"
          ? "APFD"
          : "IPM";
    case "nota_culpa":
      return "NOTA DE CULPA";
    case "termo_declaracoes":
      return "TERMO DE DECLARAÇÕES";
    case "auto_interrogatorio":
      return "AUTO DE QUALIFICAÇÃO DE INTERROGATÓRIO";
    default:
      return especie.toUpperCase();
  }
}

function rotuloRegistro(especie: string): string {
  switch (especie) {
    case "status":
      return "MUDANÇA DE STATUS";
    case "retificacao":
      return "RETIFICAÇÃO";
    case "cancelamento":
      return "CANCELAMENTO DE MOVIMENTAÇÃO";
    case "evento":
      return "REGISTRO";
    default:
      return especie.toUpperCase();
  }
}

const ESPECIES_ATO = new Set([
  "despacho",
  "decisao",
  "certidao",
  "mandado",
  "ata",
  "ipc",
  "portaria",
  "nota_culpa",
  "termo_declaracoes",
  "auto_interrogatorio",
]);

/** Atos do APFD: título sublinhado e sem o sufixo "- CORREGPM" (como nos modelos). */
const ATOS_TITULO_SUBLINHADO = new Set(["nota_culpa", "termo_declaracoes", "auto_interrogatorio"]);

function ehCertidaoDeEvento(m: PdfMovimento): boolean {
  return m.especie === "evento" && /^\s*(<p>)?\s*Certifico e dou f[ée]/i.test(m.teor);
}

/** Troca códigos internos de status pelos nomes ("em_investigacao" → "Em investigação"). */
function humanizarStatus(texto: string): string {
  return texto.replace(
    /\b(novo|recebida|aguardando_analise|em_analise|em_recurso|em_investigacao|concluso|ag_decurso_prazo|transito_julgado|concluida|arquivada)\b/g,
    (c) => statusLabel(c),
  );
}

/** Linha "São Paulo/SP, 18 de outubro de 2026." digitada no texto vai à direita, como no modelo. */
function alinharLocalData(paragrafos: Paragraph[]): Paragraph[] {
  return paragrafos.map((p) => {
    const t = p.runs
      .map((r) => r.text)
      .join("")
      .trim();
    if (p.align !== "center" && /^S[ãa]o Paulo\s*\/\s*SP\s*,.{3,60}\d{4}\.?$/i.test(t)) {
      return { ...p, align: "right" as const, textIndent: 0 };
    }
    return p;
  });
}

/* ------------ blocos de página ------------ */

const CINZA_BARRA: Cor = [199, 199, 199];
const CORREGPM = "CORREGPM";

/** Chave "xxx-xxxxxxxxxxxxx" estável, derivada de um id (UUID) ou de um texto. */
function chaveIdentificadora(id: string, semente = ""): string {
  let hex = id.replace(/[^0-9a-f]/gi, "").toLowerCase();
  if (hex.length < 16) {
    // Ids fora do padrão UUID: deriva uma chave estável a partir do texto.
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    for (const ch of `${id}|${semente}`) {
      h1 = Math.imul(h1 ^ ch.charCodeAt(0), 16777619) >>> 0;
      h2 = Math.imul(h2 ^ ch.charCodeAt(0), 2246822519) >>> 0;
    }
    hex = (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")).slice(0, 16);
  }
  return `${hex.slice(0, 3)}-${hex.slice(3, 16)}`;
}

/* ------------ PDO e Ficha funcional: tipos ------------ */

export interface PdfPdo {
  id: string;
  numero: string;
  abordagem_em: string;
  local: string;
  vtr_prefixo?: string | null;
  vtr_placa?: string | null;
  vtr_unidade?: string | null;
  desfecho: string;
  relato?: string | null;
  equipe: Array<{ cargo?: string | null; nome?: string | null; matricula?: string | null }>;
  abordados: Array<{ nome?: string | null; matricula?: string | null; cargo?: string | null }>;
  itens: Array<{ chave: string; estado: string; observacao?: string | null }>;
  lavrado_por_nome: string;
  lavrado_por_cargo: string;
  assinado_em: string;
  /** Número do procedimento gerado (ex.: "IPM nº 176/2026"), quando houver. */
  procedimento_numero?: string | null;
}

export interface PdfFichaFuncional {
  policial: { nome: string; posto?: string | null; re?: string | null; opm?: string | null };
  emitidaPor: { nome: string; cargo?: string | null };
  emitidaEm: string;
  procedimentos: Array<{
    numero: string;
    natureza?: string | null;
    instaurado_em?: string | null;
    status: string;
  }>;
  pdos: Array<{ numero: string; data: string; local: string; desfecho: string; papel: "fiscalizado" | "equipe" }>;
  observacoes: Array<{ data: string; autor: string; corpo: string; processos?: string[] }>;
}

export interface PdfAviso {
  id: string;
  numero: string;
  titulo: string;
  corpo: string;
  autor_nome: string;
  autor_cargo: string;
  created_at: string;
}

interface ColunaTabela {
  titulo: string;
  /** Largura em mm (a soma deve dar a largura útil). */
  largura: number;
  align?: "left" | "center" | "right";
}

class ProcessoPdf {
  w: PdfWriter;
  d: PdfProcessoData;
  a: PdfAssets;
  ident: ReturnType<typeof identificacaoProcedimento>;

  constructor(w: PdfWriter, d: PdfProcessoData, a: PdfAssets) {
    this.w = w;
    this.d = d;
    this.a = a;
    this.ident = identificacaoProcedimento(d.denuncia);
  }

  get denunciados(): string {
    const pol = this.d.policiais;
    if (!pol.length) return "Não identificado";
    return pol.map((p) => `${p.nome}${p.rg_funcional ? ` - RE ${p.rg_funcional}` : ""}`).join("; ");
  }

  /** Timbre dos atos: brasão da SSP à esquerda e três linhas em negrito. */
  timbreAto(): void {
    const { w, a } = this;
    const bw = 23.6;
    const bh = (bw * a.brasao.height) / a.brasao.width;
    w.imagem(a.brasao.dataUrl, 23.4, 18.3, bw, bh);
    const linhas = [
      "SECRETARIA DA SEGURANÇA PÚBLICA",
      "POLÍCIA MILITAR DO ESTADO DE SÃO PAULO",
      "CORREGEDORIA - Correg PM",
    ];
    linhas.forEach((t, i) => w.textoEm(t, 51.7, 19.4 + i * 5.6, { size: 12, bold: true }));
    w.y = Math.max(18.3 + bh, 36) + 8;
  }

  /** PROCEDIMENTO / DENUNCIADO + referência do evento à direita. */
  identificacaoAto(evento?: { numero: number | null; quando: string }, usarSigla = false): void {
    const { w } = this;
    w.y = Math.max(w.y, 54.5);
    const topo = w.y;
    const rotulo = usarSigla && this.ident.sigla ? this.ident.sigla : "PROCEDIMENTO";
    const proc = this.ident.temNumero
      ? `${rotulo} nº ${this.ident.numero}`
      : `PROTOCOLO: ${this.ident.numero}`;
    w.texto(proc, { size: 11, bold: true, width: LARGURA_UTIL - 48 });
    const plural = this.d.policiais.length > 1;
    w.texto(`${plural ? "DENUNCIADOS" : "DENUNCIADO"}: ${this.denunciados}`, {
      size: 11,
      bold: true,
      lineHeight: 1,
    });
    if (evento) {
      const ref =
        evento.numero != null
          ? `Evento nº ${String(evento.numero).padStart(2, "0")} · ${evento.quando}`
          : evento.quando;
      w.textoEm(ref, PAGE_W - 20, topo + 0.6, { size: 8, color: CINZA, align: "right" });
    }
  }

  titulo(texto: string, sublinhado = false): void {
    const { w } = this;
    w.pular(4.5);
    w.paragrafo(
      {
        align: "center",
        lineHeight: 1.15,
        runs: [{ text: texto, bold: true, underline: sublinhado }],
      },
      { size: 12 },
    );
    w.pular(4.5);
  }

  corpo(teor: string, size = 12): void {
    const paragrafos = alinharLocalData(
      teorParaParagrafos(teor, { align: "justify", lineHeight: 1.15 }),
    );
    const opts = (p: Paragraph) => ({ size, after: p.runs.some((r) => r.text.trim()) ? 1.4 : 0 });
    // Fecho escrito no próprio teor ("São Paulo/SP, ..." + assinatura): mantém junto.
    let fecho = -1;
    paragrafos.forEach((p, i) => {
      if (/S[ãa]o Paulo\s*\/\s*SP\s*,/i.test(p.runs.map((r) => r.text).join(""))) fecho = i;
    });
    if (fecho >= 0 && paragrafos.length - fecho > 6) fecho = -1;
    paragrafos.forEach((p, i) => {
      if (i === fecho) {
        const resto = paragrafos
          .slice(i)
          .reduce((s, q) => s + this.w.alturaParagrafo(q, opts(q)), 0);
        if (resto < 80) this.w.garantir(resto);
      }
      this.w.paragrafo(p, opts(p));
    });
  }

  /** Data à direita + nome e cargo de quem assinou, mantidos juntos. */
  assinatura(m: PdfMovimento): void {
    const { w } = this;
    const nome = m.prolator_nome?.trim() ?? "";
    const cargo = cargoLabel(m.prolator_cargo);
    const alturaBloco = 6 + 5.6 + 12 + 5.6 + 5.6;
    w.pular(4);
    w.garantir(alturaBloco);
    w.texto(`São Paulo/SP, ${dataExtenso(m.criado_em)}.`, { size: 12, align: "right" });
    w.pular(10);
    w.texto(nome.toUpperCase(), { size: 11, bold: true, align: "center" });
    if (cargo) w.texto(cargo.toUpperCase(), { size: 11, align: "center" });
  }

  avisoCancelado(m: PdfMovimento): void {
    if (!m.cancelado_em) return;
    const { w } = this;
    const texto =
      `MOVIMENTAÇÃO CANCELADA em ${dataHora(m.cancelado_em)}` +
      (m.cancelado_por_nome ? ` por ${m.cancelado_por_nome}` : "") +
      (m.motivo_cancelamento ? `. Justificativa: ${m.motivo_cancelamento}` : ".");
    const p: Paragraph = { align: "left", lineHeight: 1.1, runs: [{ text: texto }] };
    const h = w.alturaParagrafo(p, { size: 9.5, width: LARGURA_UTIL - 6 }) + 4;
    w.garantir(h + 2);
    w.retangulo(MARGEM_ESQ, w.y, LARGURA_UTIL, h, {
      fill: [254, 226, 226],
      stroke: [185, 28, 28],
      espessura: 0.3,
    });
    w.pular(2);
    w.paragrafo(p, { size: 9.5, indent: 3, width: LARGURA_UTIL - 6, color: [127, 29, 29] });
    w.pular(4);
  }

  /* ---------- capa ---------- */

  capa(): void {
    const { w, d } = this;
    const den = d.denuncia;
    this.timbreAto();
    const tituloCapa =
      den.tipo_procedimento === "sindicancia"
        ? "SINDICÂNCIA"
        : den.tipo_procedimento === "apfd" || this.ident.sigla === "APFD"
          ? "AUTO DE PRISÃO EM FLAGRANTE DELITO"
          : den.tipo_procedimento === "ipm" || this.ident.sigla === "IPM"
            ? "INQUÉRITO POLICIAL MILITAR"
            : "PROCESSO ADMINISTRATIVO DISCIPLINAR";
    w.y = 72;
    w.texto(tituloCapa, { size: 17, bold: true, align: "center" });
    w.pular(3);
    const numero = this.ident.temNumero
      ? `${this.ident.sigla ? `${this.ident.sigla} ` : ""}Nº ${this.ident.numero}`
      : this.ident.numero;
    w.texto(numero, { size: 20, bold: true, align: "center" });
    w.pular(12);

    const p = calcularPrescricao({
      termo_inicial: den.termo_inicial,
      acrescimos_dias: den.acrescimos_dias,
      status: den.status as DenunciaStatus,
    });
    const prescricao = p.prescrita
      ? `Prescrição consumada há ${Math.abs(p.diasRestantes)} dia(s)`
      : p.suspenso
        ? "Relógio suspenso"
        : `${formatarDiasRestantes(p)} (base ${p.totalPrazo} dias)`;
    const linhas: Array<[string, string]> = [
      [
        "DENUNCIANTE:",
        den.denunciante_anonimo ? "Anônimo" : den.denunciante_nome || "Não informado",
      ],
      [
        this.d.policiais.length > 1 ? "DENUNCIADOS:" : "DENUNCIADO:",
        this.d.policiais.length
          ? this.d.policiais
              .map((x) =>
                [x.nome, x.rg_funcional ? `RE ${x.rg_funcional}` : "", x.unidade ?? ""]
                  .filter(Boolean)
                  .join(" · "),
              )
              .join("\n")
          : "Não identificado",
      ],
      ["NATUREZA:", den.ocorrencia_tipo || "—"],
      ["UNIDADE:", den.unidade || "—"],
      ...(den.numero_procedimento
        ? ([["PROTOCOLO:", den.numero_protocolo]] as Array<[string, string]>)
        : []),
      ["INSTAURAÇÃO:", dataExtenso(den.instaurada_em ?? den.created_at)],
      ["STATUS ATUAL:", statusLabel(den.status)],
      ["PRESCRIÇÃO:", prescricao],
    ];
    const xRot = MARGEM_ESQ + 6;
    const xVal = MARGEM_ESQ + 48;
    const larguraVal = LARGURA_UTIL - 54;
    const topoCaixa = w.y;
    w.pular(6);
    for (const [rot, val] of linhas) {
      const yLinha = w.y;
      w.textoEm(rot, xRot, yLinha + 0.4, { size: 11, bold: true });
      w.y = yLinha;
      w.texto(val, { size: 11, indent: xVal - MARGEM_ESQ, width: larguraVal, after: 2.2 });
    }
    w.pular(3);
    w.retangulo(MARGEM_ESQ, topoCaixa, LARGURA_UTIL, w.y - topoCaixa, {
      stroke: [107, 114, 128],
      espessura: 0.35,
      raio: 1,
    });
    w.pular(14);
    w.texto("Capa de autuação gerada automaticamente pelo sistema.", {
      size: 8.5,
      italic: true,
      align: "center",
      color: CINZA,
    });
  }

  /* ---------- Portaria e Solução (modelo com chave identificadora) ---------- */

  /** Cabeçalho com brasão, linhas da SSP/PM, código de barras e chave. */
  private async cabecalhoChave(
    chave: string,
    m: PdfMovimento,
    numeroEvento: number | null,
  ): Promise<void> {
    const { w, a } = this;
    const bw = 22.7;
    const bh = (bw * a.brasao.height) / a.brasao.width;
    w.imagem(a.brasao.dataUrl, 36.5, 28.6, bw, bh);
    w.textoEm("SECRETARIA DA SEGURANÇA PÚBLICA", 62.3, 25.3, { size: 13, bold: true });
    w.textoEm("POLÍCIA MILITAR DO ESTADO DE SÃO PAULO", 62.3, 31.4, { size: 12, bold: true });
    w.textoEm("CHAVE IDENTIFICADORA", 62.3, 37.7, { size: 6.5, bold: true });
    await this.codigoDeBarras(chave, 64.6, 41.3, 74.2, 12.7);
    w.textoEm(chave, 62.3, 55.7, { size: 8.5 });
    w.textoEm(
      numeroEvento != null
        ? `Evento nº ${String(numeroEvento).padStart(2, "0")} · ${dataHora(m.criado_em)}`
        : dataHora(m.criado_em),
      PAGE_W - 20,
      15,
      { size: 8, color: CINZA, align: "right" },
    );
  }

  /** Título (IPM/SINDPM Nº …) e subtítulo (PORTARIA, SOLUÇÃO). */
  private titulosChave(numero: string, subtitulo: string | null): void {
    const { w } = this;
    w.y = 63.6;
    w.texto(numero, { size: 15, bold: true, align: "center", lineHeight: 1 });
    if (!subtitulo) {
      // Sem subtítulo (APFD): os campos sobem para logo abaixo do número.
      w.y = 73.4;
      return;
    }
    w.y = 74.1;
    w.texto(subtitulo, { size: 15, bold: true, align: "center", lineHeight: 1 });
    w.y = 84.0;
  }

  /** Linha "RÓTULO: valor" com espaçamento simples (como no modelo). */
  private campo(rotulo: string, valor: string | undefined): void {
    this.w.paragrafo(
      {
        align: "left",
        lineHeight: 1.15,
        runs: [{ text: `${rotulo} `, bold: true }, { text: valor || "—" }],
      },
      { size: 11 },
    );
  }

  /** Faixa cinza com título centralizado (NATUREZAS, PARTES, SOLUÇÃO…). */
  private faixa(titulo: string, antes: number): void {
    const { w } = this;
    const altura = 7.2;
    w.pular(antes);
    w.garantir(altura + 10);
    w.retangulo(MARGEM_ESQ - 0.4, w.y, LARGURA_UTIL + 0.8, altura, { fill: CINZA_BARRA });
    w.textoEm(titulo, PAGE_W / 2, w.y + 1.1, { size: 11, bold: true, align: "center" });
    w.y += altura;
  }

  /** Conteúdo curto abaixo de uma faixa: espaçamento simples e uniforme. */
  private itensFaixa(itens: string[]): void {
    const { w } = this;
    w.pular(4.2);
    for (const item of itens.length ? itens : ["—"]) {
      w.texto(item, { size: 11, lineHeight: 1.0, align: "justify" });
    }
  }

  /** Corpo justificado no padrão do modelo (11 pt, 1,15, espaço entre parágrafos). */
  private corpoChave(html: string): void {
    // Uma linha em branco entre parágrafos já é o espaçamento do modelo;
    // só linhas em branco adicionais (2ª em diante) viram espaço extra.
    const brutos = teorParaParagrafos(html, { align: "justify", lineHeight: 1.15 });
    const cheio = (p: Paragraph) => p.runs.some((r) => r.text.trim());
    const paragrafos = alinharLocalData(
      brutos.filter((p, i) => cheio(p) || (i > 0 && !cheio(brutos[i - 1]))),
    );
    let fecho = -1;
    paragrafos.forEach((p, i) => {
      if (/S[ãa]o Paulo\s*\/\s*SP\s*,/i.test(p.runs.map((r) => r.text).join(""))) fecho = i;
    });
    if (fecho >= 0 && paragrafos.length - fecho > 6) fecho = -1;
    const opts = (p: Paragraph) => ({
      size: 11,
      after: p.runs.some((r) => r.text.trim()) ? 4.2 : 0,
    });
    paragrafos.forEach((p, i) => {
      if (i === fecho) {
        const resto = paragrafos
          .slice(i)
          .reduce((s, q) => s + this.w.alturaParagrafo(q, opts(q)), 0);
        if (resto < 80) this.w.garantir(resto);
      }
      this.w.paragrafo(p, opts(p));
    });
  }

  /** Local/data à direita + assinatura centralizada (mantidos juntos). */
  private fechoChave(
    localData: string | undefined,
    nome: string | undefined,
    cargo: string | undefined,
  ): void {
    const { w } = this;
    w.garantir(6 + 14 + 5.2 * 2);
    if (localData) w.texto(localData, { size: 11, align: "right" });
    w.pular(12);
    if (nome) w.texto(nome.toUpperCase(), { size: 11, bold: true, align: "center", after: 3.6 });
    if (cargo) w.texto(cargo.toUpperCase(), { size: 11, align: "center" });
  }

  async portaria(m: PdfMovimento, p: PortariaDadosPdf, numeroEvento: number | null): Promise<void> {
    const { w } = this;
    await this.cabecalhoChave(p.chave, m, numeroEvento);
    const tipo = p.tipoProcedimento || this.d.denuncia.tipo_procedimento || "ipm";
    const apfd = tipo === "apfd";
    const sigla = tipo === "sindicancia" ? "SINDPM" : apfd ? "APFD" : "IPM";
    this.titulosChave(`${sigla} Nº ${p.ipmNumero}`, apfd ? null : "PORTARIA");
    this.campo("DATA DE INSTAURAÇÃO:", p.dataInstauracao);
    this.campo("DATA DO FATO:", p.dataFato);
    w.pular(5.2);
    this.campo("ENCARREGADO:", p.encarregado);
    this.campo("MUNICÍPIO DE INSTAURAÇÃO:", p.municipioInstauracao);

    this.faixa("NATUREZAS", 5.2);
    this.itensFaixa(p.naturezas);
    this.faixa("POLICIAIS MILITARES INDICIADOS", 4.2);
    this.itensFaixa(p.indiciados);
    this.faixa("LOCAL DOS FATOS", 4.2);
    this.itensFaixa(p.localFatos ? [p.localFatos] : []);
    this.faixa(apfd ? "AUTO DE PRISÃO EM FLAGRANTE DELITO" : "PORTARIA", 4.2);
    w.pular(3.6);
    this.corpoChave(p.corpo);
    this.fechoChave(p.localData, p.signatarioNome, p.signatarioPosto);
  }

  /** Portaria mais recente (não cancelada) lavrada antes do movimento. */
  private portariaAnterior(m: PdfMovimento): PortariaDadosPdf | null {
    const limite = new Date(m.criado_em).getTime();
    const lista = this.d.movimentos
      .filter((x) => x.especie === "portaria" && !x.cancelado_em && isPortaria(x.portaria_dados))
      .sort((x, y) => new Date(y.criado_em).getTime() - new Date(x.criado_em).getTime());
    const antes = lista.find((x) => new Date(x.criado_em).getTime() <= limite) ?? lista[0];
    return antes ? (antes.portaria_dados as PortariaDadosPdf) : null;
  }

  /** Solução do IPM/Sindicância (ato final), no modelo SOLUÇÃO. */
  async solucao(m: PdfMovimento, numeroEvento: number | null): Promise<void> {
    const { w, d } = this;
    const den = d.denuncia;
    const portaria = this.portariaAnterior(m);

    // Chave identificadora própria do ato, derivada do id do movimento.
    const chave = chaveIdentificadora(m.id, m.criado_em);
    await this.cabecalhoChave(chave, m, numeroEvento);

    const sigla = this.ident.sigla || (den.tipo_procedimento === "sindicancia" ? "SINDPM" : "IPM");
    const numero = this.ident.temNumero ? `${sigla} Nº ${this.ident.numero}` : this.ident.numero;
    this.titulosChave(numero, "SOLUÇÃO");
    this.campo("ENCARREGADO:", portaria?.encarregado || m.prolator_nome);
    this.campo("MUNICÍPIO DE INSTAURAÇÃO:", portaria?.municipioInstauracao || "São Paulo/SP");

    // PARTES: um bloco por policial denunciado.
    this.faixa("PARTES", 5.2);
    w.pular(4.2);
    const partes = d.policiais.length ? d.policiais : [];
    if (!partes.length) w.texto("Não identificado", { size: 11, lineHeight: 1.0 });
    partes.forEach((pol, i) => {
      const patente = (pol.cargo ?? "").trim().toUpperCase();
      const nome = pol.nome.trim().toUpperCase();
      const re = pol.rg_funcional ? ` RE ${pol.rg_funcional}` : "";
      const opm = pol.unidade || den.unidade || "—";
      const bloco = w.passoLinha(11, 1.0) * 2 + (i ? 2.2 : 0);
      w.garantir(bloco);
      if (i) w.pular(2.2);
      w.texto(`${patente ? `${patente} - ` : ""}${nome}${re}`, {
        size: 11,
        bold: true,
        lineHeight: 1.0,
      });
      w.texto(`Policial Militar | OPM: ${opm}`, { size: 11, lineHeight: 1.0 });
    });

    this.faixa("SOLUÇÃO", 4.2);
    w.pular(8.6);
    this.avisoCancelado(m);

    let teor = m.teor;
    const relato = teor.match(
      /\|\s*3º\s+RELATO\s+DO\s+FATO\s*:\s*\n([\s\S]*?)(?:\n\s*\n\|\s*4º|$)/i,
    );
    if (relato) teor = relato[1].trim();
    this.corpoChave(teor);

    // Se o próprio texto já traz local/data ou a assinatura, não duplica.
    const puro = textoPuro(teor);
    const jaAssinado =
      /S[ãa]o Paulo\s*\/\s*SP\s*,/i.test(puro) ||
      (!!m.prolator_nome &&
        puro.toUpperCase().includes(m.prolator_nome.trim().toUpperCase()) &&
        /CORREGEDOR/i.test(puro.slice(-400)));
    if (!jaAssinado) {
      this.fechoChave(
        `São Paulo/SP, ${dataExtenso(m.criado_em)}.`,
        m.prolator_nome,
        cargoLabel(m.prolator_cargo),
      );
    }
  }

  async codigoDeBarras(
    valor: string,
    x: number,
    y: number,
    largura: number,
    altura: number,
  ): Promise<void> {
    if (!valor) return;
    const { default: JsBarcode } = await import("jsbarcode");
    const alvo: { encodings?: Array<{ data: string }> } = {};
    try {
      JsBarcode(alvo as never, valor, { format: "CODE128" });
    } catch {
      return;
    }
    const bits = (alvo.encodings ?? []).map((e) => e.data).join("");
    if (!bits) return;
    const modulo = largura / bits.length;
    const pdf = this.w.pdf;
    pdf.setFillColor(17, 17, 17);
    let i = 0;
    while (i < bits.length) {
      if (bits[i] === "1") {
        let j = i;
        while (j < bits.length && bits[j] === "1") j++;
        pdf.rect(x + i * modulo, y, (j - i) * modulo, altura, "F");
        i = j;
      } else i++;
    }
  }

  /* ---------- atos ---------- */

  ato(m: PdfMovimento, numeroEvento: number | null): void {
    const { w, d } = this;
    this.timbreAto();
    const atoApfd = ATOS_TITULO_SUBLINHADO.has(m.especie);
    this.identificacaoAto(
      { numero: numeroEvento, quando: dataHora(m.criado_em) },
      m.especie === "nota_culpa",
    );

    const teor = m.teor;

    this.titulo(
      atoApfd
        ? tituloAto(m.especie, d.denuncia)
        : `${tituloAto(m.especie, d.denuncia)} - ${CORREGPM}`,
      atoApfd,
    );
    this.avisoCancelado(m);
    this.corpo(teor);

    // Se o próprio teor já traz local/data ou a assinatura, não duplica.
    const puro = textoPuro(teor);
    const jaAssinado =
      m.especie === "mandado" ||
      /S[ãa]o Paulo\s*\/\s*SP\s*,/i.test(puro) ||
      (!!m.prolator_nome &&
        puro.toUpperCase().includes(m.prolator_nome.trim().toUpperCase()) &&
        /CORREGEDOR/i.test(puro.slice(-400)));
    if (!jaAssinado) this.assinatura(m);

    this.provas(m, numeroEvento);
  }

  private contadorProvas = 0;
  /** Indica que o último elemento desenhado foi uma imagem (dá mais respiro). */
  aposImagem = false;

  provas(m: PdfMovimento, numeroEvento: number | null): void {
    const lista = Array.isArray(m.anexos) ? m.anexos : [];
    if (!lista.length) return;
    const { w, a } = this;
    for (const anexo of lista) {
      const img = a.anexos?.get(anexo.path);
      this.contadorProvas += 1;
      const legenda = `${(anexo.nome || `Prova ${String(this.contadorProvas).padStart(2, "0")}`).toUpperCase()}${numeroEvento != null ? ` — juntada no Evento nº ${String(numeroEvento).padStart(2, "0")}` : ""}`;
      if (!img) {
        w.pular(4);
        w.texto(`${legenda} (imagem indisponível para exportação)`, {
          size: 9.5,
          italic: true,
          color: CINZA,
        });
        continue;
      }
      let largura = LARGURA_UTIL;
      let altura = (largura * img.height) / img.width;
      const alturaMax = 190;
      if (altura > alturaMax) {
        altura = alturaMax;
        largura = (altura * img.width) / img.height;
      }
      // Imagens pequenas não são ampliadas além de ~2x o tamanho original.
      const larguraNatural = img.width * 0.2;
      if (largura > larguraNatural && larguraNatural > 40) {
        largura = larguraNatural;
        altura = (largura * img.height) / img.width;
      }
      w.pular(6);
      w.garantir(altura + 9);
      w.texto(legenda, { size: 9.5, bold: true, align: "center", after: 2 });
      const x = (PAGE_W - largura) / 2;
      w.imagem(img.dataUrl, x, w.y, largura, altura);
      w.retangulo(x, w.y, largura, altura, { stroke: [209, 213, 219], espessura: 0.2 });
      w.y += altura;
      this.aposImagem = true;
    }
  }

  /* ---------- registros curtos (status, retificações, cancelamentos) ---------- */

  registro(m: PdfMovimento, numeroEvento: number): void {
    const { w } = this;
    const rotulo =
      m.especie === "evento" && /^\s*Instaurad[oa]\b/i.test(textoPuro(m.teor))
        ? "INSTAURAÇÃO"
        : rotuloRegistro(m.especie);
    const cabecalho = `EVENTO Nº ${String(numeroEvento).padStart(2, "0")} · ${rotulo} · ${dataHora(m.criado_em)}`;
    const teor = m.especie === "status" ? humanizarStatus(m.teor) : m.teor;
    const paragrafos = teorParaParagrafos(teor, { align: "left", lineHeight: 1.1 });
    const rodape = `Registrado por ${m.prolator_nome}${m.prolator_cargo ? ` — ${cargoLabel(m.prolator_cargo)}` : ""}.`;
    const largura = LARGURA_UTIL - 5;
    const opt = { size: 10, indent: 4, width: largura };
    const altura =
      w.passoLinha(8.5) +
      paragrafos.reduce((s, p) => s + w.alturaParagrafo(p, opt), 0) +
      w.passoLinha(8, 1.1) +
      3;
    w.pular(this.aposImagem ? 8 : 5);
    this.aposImagem = false;
    w.garantir(Math.min(altura, 60));
    const topo = w.y;
    w.texto(cabecalho, { size: 8.5, bold: true, indent: 4, color: [55, 65, 81] });
    w.pular(0.6);
    for (const p of paragrafos) w.paragrafo(p, opt);
    w.texto(rodape, { size: 8, italic: true, indent: 4, color: CINZA, lineHeight: 1.1 });
    // Fio lateral identificando o bloco (apenas na página onde ele começa).
    const fim = Math.min(w.y, LIMITE_INFERIOR);
    if (fim > topo) {
      w.pdf.setDrawColor(148, 163, 184);
      w.pdf.setLineWidth(0.8);
      w.pdf.line(MARGEM_ESQ + 0.4, topo + 0.5, MARGEM_ESQ + 0.4, fim - 0.5);
    }
  }

  /* ---------- tabela simples (cabeçalho cinza, linhas com fio) ---------- */

  private tabela(colunas: ColunaTabela[], linhas: string[][], vazio = "Nada consta."): void {
    const { w } = this;
    const size = 9.5;
    const pad = 1.8;
    const desenharLinha = (celulas: string[], cabecalho: boolean) => {
      const paras = celulas.map((t, i) => ({
        align: (colunas[i].align ?? "left") as "left" | "center" | "right",
        lineHeight: 1.1,
        runs: [{ text: t || "—", bold: cabecalho }],
      }));
      const alturas = paras.map((pp, i) =>
        w.alturaParagrafo(pp, { size, width: colunas[i].largura - pad * 2 }),
      );
      const h = Math.max(...alturas) + pad * 2;
      w.garantir(h);
      const topo = w.y;
      if (cabecalho) w.retangulo(MARGEM_ESQ, topo, LARGURA_UTIL, h, { fill: [235, 235, 235] });
      let x = 0;
      paras.forEach((pp, i) => {
        w.y = topo + pad;
        w.paragrafo(pp, { size, indent: x + pad, width: colunas[i].largura - pad * 2 });
        x += colunas[i].largura;
      });
      w.y = topo + h;
      w.linhaHorizontal(w.y, [190, 190, 190], 0.2, MARGEM_ESQ, MARGEM_ESQ + LARGURA_UTIL);
    };
    w.pular(3);
    desenharLinha(
      colunas.map((c) => c.titulo.toUpperCase()),
      true,
    );
    if (!linhas.length) {
      desenharLinha([vazio, ...colunas.slice(1).map(() => "")], false);
      return;
    }
    for (const l of linhas) desenharLinha(l, false);
  }

  /* ---------- PDO (Patrulhamento Disciplinar Ostensivo) ---------- */

  async pdo(p: PdfPdo): Promise<void> {
    const { w } = this;
    const fake = { id: p.id, criado_em: p.assinado_em } as PdfMovimento;
    await this.cabecalhoChave(chaveIdentificadora(p.id, p.numero), fake, null);
    const numero = p.numero.replace(/^\s*PDO\s*(n[ºo°.]*)?\s*/i, "");
    this.titulosChave(`PDO Nº ${numero}`, "PATRULHAMENTO DISCIPLINAR OSTENSIVO");
    this.campo("DATA/HORA DA ABORDAGEM:", dataHora(p.abordagem_em));
    this.campo("LOCAL:", p.local);
    const vtr = [p.vtr_prefixo, p.vtr_placa, p.vtr_unidade].filter((x) => x && String(x).trim()).join(" · ");
    this.campo("VTR:", vtr || "—");
    this.campo("DESFECHO:", rotuloDesfechoPdo(p.desfecho).toUpperCase());
    if (p.procedimento_numero) this.campo("PROCEDIMENTO GERADO:", p.procedimento_numero);

    const pessoa = (x: { cargo?: string | null; nome?: string | null; matricula?: string | null }) =>
      [x.cargo?.trim().toUpperCase(), x.nome?.trim().toUpperCase()].filter(Boolean).join(" ") +
      (x.matricula ? `, RE ${x.matricula}` : "");

    this.faixa("EQUIPE CORREGEDORA", 5.2);
    this.itensFaixa(p.equipe.filter((x) => x.nome?.trim()).map(pessoa));
    this.faixa("POLICIAIS FISCALIZADOS", 4.2);
    this.itensFaixa(p.abordados.filter((x) => x.nome?.trim()).map((x, i) => `P${i + 1} — ${pessoa(x)}`));

    this.faixa("ITENS VERIFICADOS", 4.2);
    this.tabela(
      [
        { titulo: "Item", largura: 62 },
        { titulo: "Situação", largura: 32, align: "center" },
        { titulo: "Observação", largura: LARGURA_UTIL - 94 },
      ],
      p.itens.map((it) => [rotuloItemPdo(it.chave), rotuloEstadoPdo(it.estado).toUpperCase(), it.observacao?.trim() || "—"]),
    );

    this.faixa("RELATO", 6);
    w.pular(4.2);
    this.corpoChave(p.relato?.trim() ? p.relato : "Sem alteração.");
    w.pular(4);
    this.fechoChave(`São Paulo/SP, ${dataExtenso(p.assinado_em)}.`, p.lavrado_por_nome, cargoLabel(p.lavrado_por_cargo));
  }

  /* ---------- Aviso interno ---------- */

  aviso(a: PdfAviso): void {
    const { w } = this;
    this.timbreAto();
    w.y = Math.max(w.y, 54.5);
    w.textoEm(dataHora(a.created_at), PAGE_W - 20, w.y + 0.6, { size: 8, color: CINZA, align: "right" });
    this.titulo(`AVISO Nº ${a.numero.replace(/^\s*AVISO\s*(n[ºo°.]*)?\s*/i, "")}`);
    w.texto(a.titulo, { size: 12, bold: true, align: "center", after: 3 });
    this.corpo(a.corpo);
    const puro = textoPuro(a.corpo);
    if (!/S[ãa]o Paulo\s*\/\s*SP\s*,/i.test(puro)) {
      this.assinatura({
        id: a.id,
        especie: "aviso",
        teor: "",
        prolator_nome: a.autor_nome,
        prolator_cargo: a.autor_cargo,
        criado_em: a.created_at,
      });
    }
  }

  /* ---------- Ficha funcional do policial ---------- */

  async fichaFuncional(f: PdfFichaFuncional): Promise<void> {
    const { w } = this;
    const id = `${f.policial.re ?? ""}|${f.policial.nome}`;
    const fake = { id, criado_em: f.emitidaEm } as PdfMovimento;
    await this.cabecalhoChave(chaveIdentificadora(id, f.emitidaEm), fake, null);
    this.titulosChave("FICHA FUNCIONAL", null);
    const nome = [f.policial.posto?.trim().toUpperCase(), f.policial.nome.trim().toUpperCase()].filter(Boolean).join(" ");
    this.campo("POLICIAL MILITAR:", nome);
    this.campo("RE:", f.policial.re || "—");
    this.campo("OPM:", f.policial.opm || "—");
    w.pular(5.2);
    this.campo("EMITIDA EM:", dataHora(f.emitidaEm));
    this.campo("EMITIDA POR:", `${f.emitidaPor.nome}${f.emitidaPor.cargo ? ` — ${cargoLabel(f.emitidaPor.cargo)}` : ""}`);

    const emAndamento = f.procedimentos.filter((x) => !["arquivada", "transito_julgado"].includes(x.status)).length;
    this.faixa("RESUMO", 5.2);
    this.itensFaixa([
      `Procedimentos disciplinares como denunciado: ${f.procedimentos.length}${f.procedimentos.length ? ` (${emAndamento} em andamento)` : ""}`,
      `PDOs como policial fiscalizado: ${f.pdos.filter((x) => x.papel === "fiscalizado").length}`,
      `Observações registradas pela Corregedoria: ${f.observacoes.length}`,
    ]);

    this.faixa("PROCEDIMENTOS DISCIPLINARES", 4.2);
    this.tabela(
      [
        { titulo: "Procedimento", largura: 38 },
        { titulo: "Natureza", largura: 58 },
        { titulo: "Instauração", largura: 33, align: "center" },
        { titulo: "Situação", largura: LARGURA_UTIL - 129 },
      ],
      f.procedimentos.map((x) => [
        x.numero,
        x.natureza || "—",
        x.instaurado_em ? new Date(x.instaurado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—",
        statusLabel(x.status),
      ]),
    );

    this.faixa("PDO — PATRULHAMENTO DISCIPLINAR OSTENSIVO", 6);
    this.tabela(
      [
        { titulo: "PDO", largura: 28 },
        { titulo: "Data", largura: 26, align: "center" },
        { titulo: "Local", largura: 62 },
        { titulo: "Desfecho", largura: LARGURA_UTIL - 116 },
      ],
      f.pdos.map((x) => [
        x.numero,
        new Date(x.data).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        x.local,
        `${rotuloDesfechoPdo(x.desfecho)}${x.papel === "equipe" ? " (integrou a equipe)" : ""}`,
      ]),
    );

    this.faixa("OBSERVAÇÕES DA CORREGEDORIA", 6);
    if (!f.observacoes.length) this.itensFaixa(["Nada consta."]);
    f.observacoes.forEach((o, i) => {
      w.pular(i ? 3 : 4.2);
      const cab = `${new Date(o.data).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} — ${o.autor}${o.processos?.length ? ` · ${o.processos.join(", ")}` : ""}`;
      w.garantir(14);
      w.texto(cab, { size: 10, bold: true, lineHeight: 1.1, after: 1.2 });
      const paras = teorParaParagrafos(o.corpo, { align: "justify", lineHeight: 1.15 });
      for (const pp of paras) w.paragrafo(pp, { size: 10.5, after: pp.runs.some((r) => r.text.trim()) ? 1.4 : 0 });
    });

    w.pular(8);
    this.fechoChave(`São Paulo/SP, ${dataExtenso(f.emitidaEm)}.`, f.emitidaPor.nome, cargoLabel(f.emitidaPor.cargo));
    w.pular(6);
    w.texto("Documento de uso interno da Corregedoria da Polícia Militar — reservado.", {
      size: 8.5,
      italic: true,
      align: "center",
      color: CINZA,
    });
  }

  /* ---------- rodapé ---------- */

  rodapes(): void {
    const { w, a } = this;
    const pdf = w.pdf;
    const total = pdf.getNumberOfPages();
    const ew = 13;
    const eh = (ew * a.emblema.height) / a.emblema.width;
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i);
      w.textoEm(this.ident.rodape, MARGEM_ESQ + 0.4, 266.6, { size: 8, color: PRETO });
      w.textoEm(`Página ${i} de ${total}`, PAGE_W - 20, 266.6, {
        size: 8,
        color: PRETO,
        align: "right",
      });
      w.imagem(a.emblema.dataUrl, (PAGE_W - ew) / 2, 273.6, ew, eh);
    }
  }
}

/* ------------ montagem ------------ */

export async function gerarProcessoPdf(data: PdfProcessoData, assets: PdfAssets): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  pdf.setProperties({
    title: `Processo ${identificacaoProcedimento(data.denuncia).rodape}`,
    subject: "Corregedoria da Polícia Militar do Estado de São Paulo",
    creator: "Corregedoria PMESP",
  });
  const w = new PdfWriter(pdf);
  const doc = new ProcessoPdf(w, data, assets);

  doc.capa();

  const movs = [...data.movimentos].sort(
    (x, y) => new Date(x.criado_em).getTime() - new Date(y.criado_em).getTime(),
  );
  let ultimo: "capa" | "ato" | "registro" = "capa";
  for (let i = 0; i < movs.length; i++) {
    const m = movs[i];
    const n = i + 1;
    const ehAto = ESPECIES_ATO.has(m.especie) || ehCertidaoDeEvento(m);
    if (ehAto) {
      w.novaPagina();
      if (m.especie === "portaria" && isPortaria(m.portaria_dados)) {
        await doc.portaria(m, m.portaria_dados, n);
        doc.provas(m, n);
      } else if (m.especie === "ipc") {
        await doc.solucao(m, n);
      } else {
        doc.ato(m, n);
      }
      ultimo = "ato";
    } else {
      // Registros iniciais (ex.: instauração) cabem na própria capa.
      if (ultimo === "capa") w.pular(4);
      doc.registro(m, n);
      ultimo = "registro";
    }
  }

  doc.rodapes();
  return pdf;
}

/** Dados para exportar um único ato (sem capa nem demais eventos). */
export interface PdfAtoData extends PdfProcessoData {
  /** Movimento a exportar (precisa estar em `movimentos`). */
  movimentoId: string;
  /**
   * Número do evento no processo. Se omitido, é calculado pela posição do
   * movimento na linha do tempo; `null` omite a referência ao evento.
   */
  numeroEvento?: number | null;
}

function numeroDoEvento(data: PdfAtoData, m: PdfMovimento): number | null {
  if (data.numeroEvento !== undefined) return data.numeroEvento;
  const movs = [...data.movimentos].sort(
    (x, y) => new Date(x.criado_em).getTime() - new Date(y.criado_em).getTime(),
  );
  const i = movs.findIndex((x) => x.id === m.id);
  return i >= 0 ? i + 1 : null;
}

/**
 * Exporta somente um ato (despacho, decisão, portaria, solução, certidão…)
 * no mesmo modelo usado no processo completo: timbre, título, corpo,
 * assinatura, provas anexadas e rodapé com o número do procedimento.
 */
export async function gerarAtoPdf(data: PdfAtoData, assets: PdfAssets): Promise<jsPDF> {
  const m = data.movimentos.find((x) => x.id === data.movimentoId);
  if (!m) throw new Error("Ato não encontrado para exportação.");
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const ident = identificacaoProcedimento(data.denuncia);
  pdf.setProperties({
    title: `${tituloAto(m.especie, data.denuncia)} - ${ident.rodape}`,
    subject: "Corregedoria da Polícia Militar do Estado de São Paulo",
    creator: "Corregedoria PMESP",
  });
  const w = new PdfWriter(pdf);
  const doc = new ProcessoPdf(w, data, assets);
  const n = numeroDoEvento(data, m);

  if (m.especie === "portaria" && isPortaria(m.portaria_dados)) {
    await doc.portaria(m, m.portaria_dados, n);
    doc.provas(m, n);
  } else if (m.especie === "ipc") {
    await doc.solucao(m, n);
  } else {
    doc.ato(m, n);
  }

  doc.rodapes();
  return pdf;
}

export function nomeArquivoAto(especie: string, d: PdfDenuncia, portariaDados?: unknown): string {
  const titulo =
    especie === "portaria"
      ? (isPortaria(portariaDados) ? portariaDados.tipoProcedimento : d.tipo_procedimento) ===
        "apfd"
        ? "APFD"
        : "PORTARIA"
      : especie === "ipc"
        ? "SOLUCAO"
        : tituloAto(especie, d);
  const limpar = (t: string) =>
    t
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  const id = limpar(identificacaoProcedimento(d).rodape);
  return `${limpar(titulo) || "Ato"}-${id || "sem-numero"}.pdf`;
}

export function nomeArquivoProcesso(d: PdfDenuncia): string {
  const id = identificacaoProcedimento(d)
    .rodape.replace(/[^\w-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `Processo-${id || "sem-numero"}.pdf`;
}

/* ------------ PDO e Ficha funcional ------------ */

async function novoDocumento(titulo: string): Promise<{ pdf: jsPDF; w: PdfWriter }> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  pdf.setProperties({
    title: titulo,
    subject: "Corregedoria da Polícia Militar do Estado de São Paulo",
    creator: "Corregedoria PMESP",
  });
  return { pdf, w: new PdfWriter(pdf) };
}

function documentoAvulso(w: PdfWriter, assets: PdfAssets, rodape: string): ProcessoPdf {
  const vazio: PdfProcessoData = {
    denuncia: {
      numero_protocolo: rodape,
      numero_procedimento: null,
      denunciante_nome: null,
      denunciante_anonimo: null,
      ocorrencia_tipo: null,
      unidade: null,
      status: "",
      termo_inicial: new Date().toISOString(),
      acrescimos_dias: 0,
      instaurada_em: null,
      created_at: new Date().toISOString(),
    },
    policiais: [],
    movimentos: [],
  };
  const doc = new ProcessoPdf(w, vazio, assets);
  doc.ident = { sigla: "", numero: rodape, rodape, temNumero: true };
  return doc;
}

/** PDF do PDO no modelo do sistema (cabeçalho com chave identificadora). */
export async function gerarPdoPdf(p: PdfPdo, assets: PdfAssets): Promise<jsPDF> {
  const numero = p.numero.replace(/^\s*PDO\s*(n[ºo°.]*)?\s*/i, "");
  const { pdf, w } = await novoDocumento(`PDO nº ${numero}`);
  const doc = documentoAvulso(w, assets, `PDO/${numero}`);
  await doc.pdo(p);
  doc.rodapes();
  return pdf;
}

/** Ficha funcional do policial: procedimentos, PDOs e observações. */
export async function gerarFichaFuncionalPdf(f: PdfFichaFuncional, assets: PdfAssets): Promise<jsPDF> {
  const { pdf, w } = await novoDocumento(`Ficha funcional — ${f.policial.nome}`);
  const doc = documentoAvulso(w, assets, `FICHA FUNCIONAL${f.policial.re ? ` · RE ${f.policial.re}` : ""}`);
  await doc.fichaFuncional(f);
  doc.rodapes();
  return pdf;
}

export function nomeArquivoPdo(numero: string): string {
  const n = numero.replace(/^\s*PDO\s*(n[ºo°.]*)?\s*/i, "").replace(/[^\w-]+/g, "-");
  return `PDO-${n || "sem-numero"}.pdf`;
}

export function nomeArquivoFicha(policial: { nome: string; re?: string | null }): string {
  const base = `${policial.nome}${policial.re ? `-RE-${policial.re}` : ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w-]+/g, "-")
    .replace(/-+/g, "-");
  return `Ficha-funcional-${base}.pdf`;
}

/** Aviso interno no modelo dos atos (timbre, título, texto e assinatura). */
export async function gerarAvisoPdf(a: PdfAviso, assets: PdfAssets): Promise<jsPDF> {
  const numero = a.numero.replace(/^\s*AVISO\s*(n[ºo°.]*)?\s*/i, "");
  const { pdf, w } = await novoDocumento(`Aviso nº ${numero}`);
  const doc = documentoAvulso(w, assets, `AVISO/${numero}`);
  doc.aviso(a);
  doc.rodapes();
  return pdf;
}

export function nomeArquivoAviso(numero: string): string {
  const n = numero.replace(/^\s*AVISO\s*(n[ºo°.]*)?\s*/i, "").replace(/[^\w-]+/g, "-");
  return `Aviso-${n || "sem-numero"}.pdf`;
}
