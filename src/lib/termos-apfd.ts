/**
 * Textos pré-carregados dos termos do APFD (HTML do editor de atos):
 * Termo de Declarações e Auto de Qualificação de Interrogatório.
 * O usuário edita livremente antes de lançar.
 */

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const UNIDADES = [
  "zero",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
];
const DEZENAS = [
  "",
  "",
  "vinte",
  "trinta",
  "quarenta",
  "cinquenta",
  "sessenta",
  "setenta",
  "oitenta",
  "noventa",
];

/** Número por extenso de 0 a 99. */
function ate99(n: number): string {
  if (n < 20) return UNIDADES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d];
}

/** Ano por extenso (2000–2099): 2026 → "dois mil e vinte e seis". */
export function anoPorExtenso(ano: number): string {
  if (ano < 2000 || ano > 2099) return String(ano);
  const resto = ano - 2000;
  return resto ? `dois mil e ${ate99(resto)}` : "dois mil";
}

/** "Aos vinte dias do mês de outubro do ano de dois mil e vinte e seis" (dia 1: "Ao primeiro dia…"). */
export function dataPorExtenso(d: Date): string {
  const dia = d.getDate();
  const mes = MESES[d.getMonth()];
  const ano = anoPorExtenso(d.getFullYear());
  const inicio = dia === 1 ? "Ao primeiro dia" : `Aos ${ate99(dia)} dias`;
  return `${inicio} do mês de ${mes} do ano de ${ano}`;
}

/** "São Paulo/SP, 20 de outubro de 2026." */
export function localDataCurta(d: Date): string {
  return `São Paulo/SP, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}.`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface AutorTermo {
  posto: string | null;
  nome: string;
  /** Rótulo do cargo no sistema (ex.: "Corregedor-Geral"). */
  cargo: string | null;
}

export interface PolicialTermo {
  nome: string;
  cargo: string | null;
}

const P = (html: string, align: "justify" | "left" | "right" | "center" = "justify") =>
  `<p style="text-align: ${align}">${html}</p>`;
const VAZIO = "<p></p>";

/** Bloco de assinatura centralizado e em negrito (nome; cargo). */
export function blocoAssinatura(linha1: string, linha2: string | null): string {
  const l1 = P(`<strong>${esc(linha1.toUpperCase())}</strong>`, "center");
  const l2 = linha2 ? P(`<strong>${esc(linha2.toUpperCase())}</strong>`, "center") : "";
  return l1 + l2;
}

function assinaturaAutor(a: AutorTermo): string {
  const nome = `${a.posto?.trim() ? `${a.posto.trim()} ` : ""}${a.nome.trim()}`;
  return blocoAssinatura(nome, a.cargo);
}

const QUALIFICACAO = [
  "Nome: [preencher]",
  "RG: [preencher]",
  "Idade: [preencher]",
  "Natural: [preencher]",
  "Estado: [preencher]",
  "Estado Civil: [preencher]",
  "Profissão: [preencher]",
];

function abertura(hoje: Date, quem: string): string {
  return P(
    `${dataPorExtenso(hoje)}, nesta Capital de São Paulo/SP, na Delegacia de Polícia Militar (DPM), ` +
      `na Secção de Polícia Judiciária Militar e Disciplina, compareceu ${quem} abaixo qualificado, ` +
      `o qual, às perguntas do encarregado, respondeu.`,
  );
}

function qualificacao(nome: string | null): string {
  const linhas = [...QUALIFICACAO];
  if (nome) linhas[0] = `Nome: ${esc(nome)}`;
  return P(linhas.join("<br>"), "left");
}

/** Termo de Declarações (quem declara é preenchido à mão). */
export function montarTermoDeclaracoes(i: { autor: AutorTermo; hoje: Date }): string {
  return [
    abertura(i.hoje, "[NOME]"),
    VAZIO,
    qualificacao(null),
    VAZIO,
    P("Saber ler e escrever: [SIM] ou [NÃO].", "left"),
    VAZIO,
    P("Junte-se a gravação: [LINK].", "left"),
    VAZIO,
    VAZIO,
    P(esc(localDataCurta(i.hoje)), "right"),
    VAZIO,
    VAZIO,
    assinaturaAutor(i.autor),
  ].join("");
}

/**
 * Auto de Qualificação de Interrogatório. Com um único denunciado, já traz
 * patente e nome dele; com vários, deixa [PATENTE] [NOME] para escolher.
 */
export function montarAutoInterrogatorio(i: {
  autor: AutorTermo;
  policiais: PolicialTermo[];
  hoje: Date;
}): string {
  const unico = i.policiais.length === 1 ? i.policiais[0] : null;
  const patente = unico?.cargo?.trim() ? unico.cargo.trim().toUpperCase() : null;
  const quem = unico
    ? esc(`${patente ? `${patente} ` : ""}${unico.nome.trim()}`)
    : "[PATENTE] [NOME]";
  const assinaturaIndiciado = unico
    ? blocoAssinatura(unico.nome.trim(), patente)
    : blocoAssinatura("[NOME DO INDICIADO]", "[CARGO]");
  return [
    abertura(i.hoje, quem),
    VAZIO,
    qualificacao(unico ? unico.nome.trim() : null),
    VAZIO,
    P("Saber ler e escrever: [SIM] ou [NÃO].", "left"),
    VAZIO,
    P("Junte-se a gravação: [LINK].", "left"),
    VAZIO,
    P(
      "Nada mais disse e nem lhe foi perguntado. Lido o termo e achado conforme, assina abaixo, " +
        "juntamente com a autoridade, o indiciado.",
    ),
    VAZIO,
    VAZIO,
    P(esc(localDataCurta(i.hoje)), "right"),
    VAZIO,
    assinaturaIndiciado,
    VAZIO,
    assinaturaAutor(i.autor),
  ].join("");
}
