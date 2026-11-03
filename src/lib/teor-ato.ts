/**
 * Montagem do teor gravado de cada ato a partir do formulário do "Lançar ato".
 * Usado no lançamento direto e na assinatura de minutas, para que os dois
 * caminhos gravem exatamente o mesmo texto (e gerem o mesmo PDF).
 */

/** Campos extras do formulário guardados junto da minuta. */
export interface CamposAto {
  /** Ata: quem prestou o depoimento. */
  ataDepoente?: string;
  /** Solução (ipc): unidade e identificação do policial. */
  ipcUnidade?: string;
  ipcIdent?: string;
}

export function montarTeorIpc(params: {
  unidade: string | null;
  protocolo: string;
  identificacao: string;
  relato: string;
}): string {
  return [
    `| UNIDADE: ${params.unidade || "—"}`,
    ``,
    `| 1º PROCESSO NÚMERO: ${params.protocolo}`,
    ``,
    `| 2º IDENTIFICAÇÃO DO POLICIAL: ${params.identificacao || "—"}`,
    ``,
    `| 3º RELATO DO FATO:`,
    params.relato.trim(),
    ``,
    `| 4º CIENTE DOS FATOS:`,
    `Corregedoria da Polícia Militar do Estado de São Paulo`,
  ].join("\n");
}

export function montarTeorAta(params: { depoente: string; relato: string }): string {
  const dep = params.depoente
    .trim()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const relato = params.relato.trim();
  return `<p><strong>DEPOENTE:</strong> ${dep}</p>${relato}`;
}

/**
 * Teor final do ato. `corpo` já deve vir sanitizado (sanitizeAtoHtml).
 * Lança erro com mensagem amigável quando falta um campo obrigatório.
 */
export function montarTeorAto(
  especie: string,
  corpo: string,
  campos: CamposAto,
  procedimento: string,
): string {
  if (especie === "ipc") {
    return montarTeorIpc({
      unidade: campos.ipcUnidade || null,
      protocolo: procedimento,
      identificacao: (campos.ipcIdent ?? "").trim(),
      relato: corpo,
    });
  }
  if (especie === "ata") {
    const depoente = (campos.ataDepoente ?? "").trim();
    if (!depoente) throw new Error("Informe quem prestou o depoimento.");
    return montarTeorAta({ depoente, relato: corpo });
  }
  return corpo;
}

/** Texto puro (sem HTML) para listas e prévias curtas. */
export function textoCurto(html: string, max = 160): string {
  const puro = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h\d)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return puro.length > max ? `${puro.slice(0, max - 1).trimEnd()}…` : puro;
}
