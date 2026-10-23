/**
 * Modelos de texto do painel "Lançar ato" (campo "Modelo de texto").
 *
 * Cada modelo é escrito em texto simples:
 * - parágrafos separados por linha em branco (no ato, viram parágrafos
 *   com uma linha em branco entre eles);
 * - **trecho** vira negrito;
 * - {PROCEDIMENTO}, {DENUNCIADO} e {DATA_EXTENSO} são preenchidos sozinhos;
 * - o que estiver entre [colchetes] é para o usuário completar.
 *
 * Local, data e assinatura NÃO entram no modelo: o PDF acrescenta
 * "São Paulo/SP, <data>." e a assinatura do prolator automaticamente.
 */
import { dataPorExtenso } from "@/lib/termos-apfd";

export type EspecieComModelo = "despacho" | "decisao" | "certidao" | "ata" | "ipc";

export interface ModeloAto {
  id: string;
  nome: string;
  texto: string;
  /** "apfd": só em APFD; "pad": só em IPM/Sindicância; ausente: em todos. */
  somente?: "apfd" | "pad";
}

export interface CamposModelo {
  /** Ex.: "IPM nº 176/2026". */
  procedimento: string;
  policiais: Array<{ nome: string; cargo?: string | null; re?: string | null }>;
  hoje?: Date;
}

const MODELOS: Record<EspecieComModelo, ModeloAto[]> = {
  despacho: [
    {
      id: "juntada-provas",
      nome: "Juntada de provas",
      texto: `Vistos.

Junte-se aos autos do {PROCEDIMENTO} [as imagens / os documentos] encaminhados por [origem], que passam a integrar o conjunto probatório do presente procedimento.

Dê-se ciência a {DENUNCIADO}.

Cumpra-se.`,
    },
    {
      id: "juntada-oitiva",
      nome: "Juntada de gravação de oitiva",
      texto: `Junte-se aos autos a gravação da oitiva de [NOME], realizada em [DATA], disponível em: [LINK].

Cumpra-se.`,
    },
    {
      id: "designa-oitiva-denunciado",
      nome: "Designação de oitiva do denunciado",
      texto: `Vistos.

Designo o dia [DATA], às [HORA], para a oitiva de {DENUNCIADO}, a realizar-se na sede da Corregedoria da Polícia Militar do Estado de São Paulo.

Expeça-se o competente mandado de convocação, cientificando-se o convocado da faculdade de se fazer acompanhar por advogado regularmente inscrito na OAB.

Cumpra-se.`,
    },
    {
      id: "designa-oitiva-testemunha",
      nome: "Designação de oitiva de testemunha",
      texto: `Vistos.

Designo o dia [DATA], às [HORA], para a oitiva de [NOME E QUALIFICAÇÃO DA TESTEMUNHA], na qualidade de testemunha, a realizar-se na sede da Corregedoria da Polícia Militar do Estado de São Paulo.

Expeça-se o competente mandado de convocação.

Cumpra-se.`,
    },
    {
      id: "requisicao-opm",
      nome: "Requisição de informações à OPM",
      texto: `Vistos.

Oficie-se ao Comando do(a) [OPM] para que, no prazo de [X] dias, encaminhe a esta Corregedoria [a escala de serviço / as imagens / o relatório de ocorrência] referente aos fatos apurados no {PROCEDIMENTO}.

Cumpra-se.`,
    },
    {
      id: "prazo-defesa",
      nome: "Abertura de prazo para defesa",
      texto: `Vistos.

Encerrada a fase de instrução, intime-se {DENUNCIADO} para, querendo, apresentar defesa escrita no prazo de [X] dias, podendo juntar documentos e indicar as provas que pretenda produzir.

Decorrido o prazo, com ou sem manifestação, voltem os autos conclusos.

Cumpra-se.`,
    },
    {
      id: "conclusos-solucao",
      nome: "Conclusão para Solução",
      texto: `Vistos.

Encerrada a instrução do {PROCEDIMENTO}, façam-se os autos conclusos para elaboração da Solução.

Cumpra-se.`,
    },
  ],
  decisao: [
    {
      id: "estrutura-padrao",
      nome: "Estrutura padrão",
      texto: `Vistos.

**I. RELATÓRIO**

[Síntese do pedido ou da questão a decidir.]

**II. FUNDAMENTAÇÃO**

[Razões de decidir, com indicação dos dispositivos do RDPM / R-1 PM aplicáveis.]

**III. DISPOSITIVO**

Ante o exposto, **DECIDO** [conclusão].

Intime-se. Cumpra-se.`,
    },
    {
      id: "pedido-defesa",
      nome: "Pedido da defesa (deferimento / indeferimento)",
      texto: `Vistos.

Trata-se de pedido formulado por {DENUNCIADO}, nos autos do {PROCEDIMENTO}, objetivando [descrever o pedido].

[Fundamentação.]

Ante o exposto, **[DEFIRO / INDEFIRO]** o pedido formulado.

Intime-se. Cumpra-se.`,
    },
    {
      id: "afastamento-preventivo",
      nome: "Afastamento preventivo",
      texto: `Vistos.

Considerando a gravidade dos fatos apurados no {PROCEDIMENTO} e a necessidade de preservar a regularidade da apuração, a hierarquia e a disciplina, **DETERMINO** o afastamento preventivo de {DENUNCIADO} das atividades operacionais, pelo prazo de [X] dias ou até ulterior deliberação.

Comunique-se ao Comando da OPM do militar.

Intime-se. Cumpra-se.`,
    },
  ],
  certidao: [
    {
      id: "decurso-prazo",
      nome: "Decurso de prazo sem manifestação",
      texto: `**CERTIFICO**, para os devidos fins, que decorreu o prazo concedido a {DENUNCIADO} sem que houvesse manifestação nos autos do {PROCEDIMENTO}, conforme intimação constante do Evento nº [XX].

O referido é verdade e dou fé.`,
    },
    {
      id: "intimacao-realizada",
      nome: "Intimação realizada",
      texto: `**CERTIFICO** que, nesta data, {DENUNCIADO} foi devidamente intimado(a) do ato constante do Evento nº [XX], por meio de [ticket / Discord / pessoalmente].

O referido é verdade e dou fé.`,
    },
    {
      id: "nao-comparecimento",
      nome: "Não comparecimento à oitiva",
      texto: `**CERTIFICO** que, na data e horário designados ([DATA], às [HORA]), {DENUNCIADO} não compareceu à sede desta Corregedoria para a oitiva, tampouco apresentou justificativa até o presente momento.

O referido é verdade e dou fé.`,
    },
    {
      id: "juntada",
      nome: "Juntada de documento",
      texto: `**CERTIFICO** que, nesta data, foi juntado aos autos do {PROCEDIMENTO} [descrever o documento ou a prova].

O referido é verdade e dou fé.`,
    },
  ],
  ata: [
    {
      id: "testemunha",
      nome: "Depoimento de testemunha",
      texto: `{DATA_EXTENSO}, na sede da Corregedoria da Polícia Militar do Estado de São Paulo, compareceu o(a) depoente acima qualificado(a), na condição de **testemunha**, que, compromissado(a) na forma da lei e advertido(a) das penas cominadas a quem faz afirmação falsa, cala ou oculta a verdade, às perguntas respondeu:

**PERGUNTADO** [pergunta]; **RESPONDEU** [resposta].

Nada mais disse nem lhe foi perguntado. Lido e achado conforme, encerra-se o presente termo.`,
    },
    {
      id: "denunciado",
      nome: "Oitiva do denunciado",
      texto: `{DATA_EXTENSO}, na sede da Corregedoria da Polícia Militar do Estado de São Paulo, compareceu o(a) depoente acima qualificado(a), na condição de **denunciado(a)** no {PROCEDIMENTO}, cientificado(a) dos fatos que lhe são imputados e do direito de permanecer em silêncio, sem que isso importe em prejuízo à sua defesa, que, às perguntas, respondeu:

**PERGUNTADO** [pergunta]; **RESPONDEU** [resposta].

Nada mais disse nem lhe foi perguntado. Lido e achado conforme, encerra-se o presente termo.`,
    },
    {
      id: "denunciante",
      nome: "Declarações do denunciante / ofendido",
      texto: `{DATA_EXTENSO}, na sede da Corregedoria da Polícia Militar do Estado de São Paulo, compareceu o(a) depoente acima qualificado(a), na condição de **denunciante / ofendido(a)**, que, às perguntas, respondeu:

**PERGUNTADO** [pergunta]; **RESPONDEU** [resposta].

Nada mais disse nem lhe foi perguntado. Lido e achado conforme, encerra-se o presente termo.`,
    },
  ],
  ipc: [
    {
      id: "solucao-padrao",
      nome: "Estrutura padrão",
      somente: "pad",
      texto: `Vistos.

**I. DO EXAME DOS AUTOS**

Trata-se de {PROCEDIMENTO} instaurado para apurar [síntese dos fatos], atribuídos a {DENUNCIADO}.

[Resumo da instrução: provas juntadas, oitivas realizadas e defesa apresentada.]

É o relatório. **DECIDO.**

**II. DA VALORAÇÃO JURÍDICA**

[Análise das provas e enquadramento no RDPM / R-1 PM.]

**III. DA SOLUÇÃO**

Ante o exposto, **DECIDO** [conclusão].

Publique-se. Intime-se.`,
    },
    {
      id: "arquivamento",
      nome: "Arquivamento",
      somente: "pad",
      texto: `Vistos.

**I. DO EXAME DOS AUTOS**

Trata-se de {PROCEDIMENTO} instaurado para apurar [síntese dos fatos], atribuídos a {DENUNCIADO}.

[Resumo da instrução.]

É o relatório. **DECIDO.**

**II. DA VALORAÇÃO JURÍDICA**

Da análise do conjunto probatório, não restou demonstrada [a autoria / a materialidade] da transgressão disciplinar imputada, inexistindo elementos suficientes para a responsabilização do militar.

**III. DA SOLUÇÃO**

Ante o exposto, **DETERMINO O ARQUIVAMENTO** do {PROCEDIMENTO}, por [insuficiência de provas / inexistência de transgressão disciplinar].

Publique-se. Intime-se.`,
    },
    {
      id: "sancao",
      nome: "Aplicação de sanção disciplinar",
      somente: "pad",
      texto: `Vistos.

**I. DO EXAME DOS AUTOS**

Trata-se de {PROCEDIMENTO} instaurado para apurar [síntese dos fatos], atribuídos a {DENUNCIADO}.

[Resumo da instrução.]

É o relatório. **DECIDO.**

**II. DA VALORAÇÃO JURÍDICA**

Restou comprovado que o militar [descrever a conduta], incorrendo na transgressão disciplinar prevista no [art. X do RDPM], de natureza [leve / média / grave].

[Circunstâncias atenuantes e agravantes consideradas.]

**III. DA SOLUÇÃO**

Ante o exposto, **APLICO** a {DENUNCIADO} a sanção disciplinar de **[ADVERTÊNCIA / REPREENSÃO / PERMANÊNCIA DISCIPLINAR / DETENÇÃO]** [por X dias].

Publique-se. Intime-se. Anote-se nos assentamentos do militar.`,
    },
    {
      id: "orientacao",
      nome: "Orientação verbal (conduta justificada)",
      somente: "pad",
      texto: `Vistos.

**I. DO EXAME DOS AUTOS**

Trata-se de {PROCEDIMENTO} instaurado para apurar [síntese dos fatos], atribuídos a {DENUNCIADO}.

[Resumo da instrução.]

É o relatório. **DECIDO.**

**II. DA VALORAÇÃO JURÍDICA**

Embora a conduta contrarie formalmente [norma violada], restou demonstrado que o militar agiu [circunstâncias que justificam a conduta], inexistindo desídia deliberada ou intenção de violar o dever funcional.

**III. DA SOLUÇÃO**

Ante o exposto, **DECIDO ORIENTAR VERBALMENTE** {DENUNCIADO} acerca da indispensável observância de [norma], com fundamento nos arts. 28 e 29 do RDPM.

Publique-se. Intime-se.`,
    },
    {
      id: "solucao-apfd",
      nome: "Solução do APFD",
      somente: "apfd",
      texto: `Vistos.

**I. DO EXAME DOS AUTOS**

Trata-se de Auto de Prisão em Flagrante Delito ({PROCEDIMENTO}) lavrado em desfavor de {DENUNCIADO}, pela prática, em tese, de [crime militar e dispositivo legal], em [data e local dos fatos].

[Síntese das peças: nota de culpa, termos de declarações, auto de qualificação e interrogatório, provas juntadas.]

É o relatório. **DECIDO.**

**II. DA VALORAÇÃO JURÍDICA**

[Análise da regularidade formal do auto e dos indícios de autoria e materialidade.]

**III. DA SOLUÇÃO**

Ante o exposto, **[HOMOLOGO O AUTO DE PRISÃO EM FLAGRANTE DELITO / RELAXO A PRISÃO]** e determino [providências: remessa dos autos, comunicação ao Comando da OPM etc.].

Publique-se. Intime-se.`,
    },
  ],
};

/** Modelos disponíveis para a espécie, conforme o tipo do procedimento. */
export function modelosDe(especie: string, opcoes: { apfd: boolean }): ModeloAto[] {
  const lista = MODELOS[especie as EspecieComModelo] ?? [];
  return lista.filter((m) => !m.somente || (m.somente === "apfd") === opcoes.apfd);
}

function escapar(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** "3º SGT PM IVAN SILVA, RE 35065" — vários unidos por vírgula e "e". */
export function denunciadosPorExtenso(policiais: CamposModelo["policiais"]): string {
  const nomes = policiais
    .filter((p) => p.nome?.trim())
    .map((p) => {
      const posto = (p.cargo ?? "").trim().toUpperCase();
      const nome = p.nome.trim().toUpperCase();
      return `${posto ? `${posto} ` : ""}${nome}${p.re ? `, RE ${p.re}` : ""}`;
    });
  if (!nomes.length) return "[DENUNCIADO]";
  if (nomes.length === 1) return nomes[0];
  return `${nomes.slice(0, -1).join("; ")} e ${nomes[nomes.length - 1]}`;
}

/** Monta o HTML do modelo, já com os campos automáticos preenchidos. */
export function aplicarModelo(modelo: ModeloAto, campos: CamposModelo): string {
  const valores: Record<string, string> = {
    PROCEDIMENTO: campos.procedimento?.trim() || "[PROCEDIMENTO]",
    DENUNCIADO: denunciadosPorExtenso(campos.policiais),
    DATA_EXTENSO: dataPorExtenso(campos.hoje ?? new Date()),
  };
  return modelo.texto
    .trim()
    .split(/\n\s*\n/)
    .map((par) => {
      let html = escapar(par.trim()).replace(/\n/g, "<br>");
      html = html.replace(/\{(PROCEDIMENTO|DENUNCIADO|DATA_EXTENSO)\}/g, (_, k: string) =>
        escapar(valores[k]),
      );
      html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      return `<p style="text-align: justify; line-height: 1.15">${html}</p>`;
    })
    // Linha em branco entre parágrafos, como nos atos digitados à mão.
    .join("<p></p>");
}
