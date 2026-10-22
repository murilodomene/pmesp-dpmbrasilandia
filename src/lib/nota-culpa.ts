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

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface NotaCulpaInput {
  autorPosto: string | null;
  autorNome: string;
  autorRe: string;
  policiais: Array<{ nome: string; cargo: string | null; re: string | null }>;
  hoje: Date;
  /** Rótulo do cargo no sistema (ex.: "Corregedor-Geral"), usado na assinatura. */
  autorCargo?: string | null;
}

function pessoa(p: { nome: string; cargo: string | null; re: string | null }): string {
  const cargo = p.cargo?.trim();
  const re = p.re?.trim();
  return `ao ${cargo ? `${cargo.toUpperCase()} ` : ""}${p.nome.trim()}${re ? `, RE ${re}` : ""}`;
}

export function listarDestinatarios(policiais: NotaCulpaInput["policiais"]): string {
  const itens = policiais.map(pessoa);
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/** Texto pré-carregado da Nota de Culpa (HTML do editor de atos). */
export function montarNotaCulpa(i: NotaCulpaInput): string {
  const plural = i.policiais.length > 1;
  const posto = i.autorPosto?.trim();
  const autor = `${posto ? `${posto.toUpperCase()} ` : ""}${i.autorNome.trim()}`;
  const f = (sing: string, pl: string) => (plural ? pl : sing);
  const p1 =
    `O ${esc(autor)}, RE ${esc(i.autorRe)}, na forma da lei, FAZ SABER ${esc(listarDestinatarios(i.policiais))}, ` +
    `já ${f("qualificado", "qualificados")} nos autos, que se ${f("acha", "acham")} ${f("preso", "presos")} e ` +
    `${f("autuado", "autuados")} em flagrante de delito por haver cometido o crime de <strong>[ESPECIFICAR]</strong> <strong>[NARRAR OS FATOS]</strong>.`;
  const p2 =
    `Dada e lavrada nesta cidade de São Paulo/SP, na Delegacia de Polícia Militar (DPM), aos ${i.hoje.getDate()} dias do mês de ` +
    `${MESES[i.hoje.getMonth()]} de ${i.hoje.getFullYear()}.`;
  // Assinatura (como no modelo): posto + nome e cargo, centralizados em negrito.
  const assinatura =
    `<p></p><p></p><p style="text-align: center"><strong>${esc(autor.toUpperCase())}</strong></p>` +
    (i.autorCargo?.trim()
      ? `<p style="text-align: center"><strong>${esc(i.autorCargo.trim().toUpperCase())}</strong></p>`
      : "");
  return `<p style="text-align: justify">${p1}</p><p></p><p style="text-align: justify">${p2}</p>${assinatura}`;
}
