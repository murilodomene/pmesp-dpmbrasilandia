/** Rótulos do PDO (Patrulhamento Disciplinar Ostensivo), usados na tela e no PDF. */
export const ITENS_PDO = [
  { chave: "documentacao", label: "Documentação funcional" },
  { chave: "armamento", label: "Armamento" },
  { chave: "colete", label: "Colete balístico" },
  { chave: "fardamento", label: "Fardamento / uniforme" },
  { chave: "viatura", label: "Estado geral da viatura" },
] as const;

export const ESTADOS_PDO = [
  { v: "conforme", l: "Conforme" },
  { v: "nao_conforme", l: "Não conforme" },
  { v: "nao_aplicavel", l: "N/A" },
] as const;

export const DESFECHOS_PDO = [
  { v: "regular", l: "Regular — nada a apontar" },
  { v: "sanada", l: "Irregularidade sanada no local" },
  { v: "gera_procedimento", l: "Irregularidade que origina procedimento" },
] as const;

export function rotuloItemPdo(chave: string): string {
  return ITENS_PDO.find((x) => x.chave === chave)?.label ?? chave;
}
export function rotuloEstadoPdo(v: string): string {
  return ESTADOS_PDO.find((x) => x.v === v)?.l ?? v;
}
export function rotuloDesfechoPdo(v: string): string {
  return DESFECHOS_PDO.find((x) => x.v === v)?.l ?? v;
}
