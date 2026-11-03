/**
 * Modelos de texto para ofícios. {PROCEDIMENTO} é preenchido com o processo
 * vinculado (ou fica "[número do procedimento]"); trechos entre colchetes
 * são para completar.
 */
export interface ModeloOficio {
  id: string;
  nome: string;
  assunto: string;
  texto: string;
}

const p = (t: string) => `<p style="text-align: justify; text-indent: 2.5em">${t}</p>`;
const vazio = "<p></p>";
const fecho = p("Aproveito o ensejo para renovar protestos de estima e consideração.");

export const MODELOS_OFICIO: ModeloOficio[] = [
  {
    id: "solicitacao",
    nome: "Solicitação de documentos/informações",
    assunto: "Solicitação de [documentos / informações]",
    texto: [
      "<p>Senhor [Comandante / Diretor],</p>",
      vazio,
      p(
        "Com a finalidade de instruir os autos do {PROCEDIMENTO}, em trâmite nesta Corregedoria, solicito a Vossa Senhoria que encaminhe, no prazo de [X] dias, [descrever os documentos ou informações: escala de serviço, imagens, relatório de ocorrência…] referentes a [fatos / data / local].",
      ),
      p(
        "As informações deverão ser remetidas a esta Corregedoria com a indicação do número deste ofício.",
      ),
      vazio,
      fecho,
    ].join(""),
  },
  {
    id: "apresentacao",
    nome: "Requisição de apresentação de policial",
    assunto: "Apresentação de policial militar para oitiva",
    texto: [
      "<p>Senhor Comandante,</p>",
      vazio,
      p(
        "Requisito a Vossa Senhoria a apresentação do(a) [posto/graduação e nome], RE [número], pertencente a essa OPM, na sede da Corregedoria da Polícia Militar do Estado de São Paulo, no dia [data], às [hora], a fim de ser ouvido(a) nos autos do {PROCEDIMENTO}.",
      ),
      p(
        "Solicito, ainda, que o(a) policial seja cientificado(a) da faculdade de se fazer acompanhar de advogado.",
      ),
      vazio,
      fecho,
    ].join(""),
  },
  {
    id: "remessa",
    nome: "Remessa de autos/cópias",
    assunto: "Remessa de [cópia / autos] do {PROCEDIMENTO}",
    texto: [
      "<p>[Excelentíssimo(a) Senhor(a) / Senhor(a)],</p>",
      vazio,
      p(
        "Encaminho a Vossa [Excelência / Senhoria] [cópia integral / os autos] do {PROCEDIMENTO}, instaurado nesta Corregedoria para apurar [síntese dos fatos], para [conhecimento e providências que entender cabíveis / instrução do procedimento nº …].",
      ),
      vazio,
      fecho,
    ].join(""),
  },
  {
    id: "comunicacao",
    nome: "Comunicação de instauração",
    assunto: "Comunicação de instauração do {PROCEDIMENTO}",
    texto: [
      "<p>Senhor Comandante,</p>",
      vazio,
      p(
        "Comunico a Vossa Senhoria a instauração, nesta Corregedoria, do {PROCEDIMENTO}, em desfavor do(a) [posto/graduação e nome], RE [número], integrante dessa OPM, para apurar [síntese dos fatos].",
      ),
      p("Solicito que o(a) policial seja cientificado(a) do presente ofício."),
      vazio,
      fecho,
    ].join(""),
  },
];

export function aplicarModeloOficio(
  m: ModeloOficio,
  procedimento: string | null,
): { assunto: string; texto: string } {
  const proc = procedimento?.trim() || "[número do procedimento]";
  return {
    assunto: m.assunto.replaceAll("{PROCEDIMENTO}", proc),
    texto: m.texto.replaceAll("{PROCEDIMENTO}", proc),
  };
}
