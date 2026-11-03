/** Posto/graduação por extenso, como sai na assinatura de ofícios ("Cel PM" → "Coronel PM"). */
const EXTENSO: Array<[RegExp, string]> = [
  [/^cel\.?\s*pm$/i, "Coronel PM"],
  [/^ten[\s-]*cel\.?\s*pm$/i, "Tenente-Coronel PM"],
  [/^maj(or)?\.?\s*pm$/i, "Major PM"],
  [/^cap\.?\s*pm$/i, "Capitão PM"],
  [/^1[ºo°]\s*ten\.?\s*pm$/i, "1º Tenente PM"],
  [/^2[ºo°]\s*ten\.?\s*pm$/i, "2º Tenente PM"],
  [/^asp(irante)?(\s+a\s+oficial)?\.?\s*pm$/i, "Aspirante a Oficial PM"],
  [/^cadete\s*pm$/i, "Cadete PM"],
  [/^sub\s*ten(ente)?\.?\s*pm$/i, "Subtenente PM"],
  [/^1[ºo°]\s*sgt\.?\s*pm$/i, "1º Sargento PM"],
  [/^2[ºo°]\s*sgt\.?\s*pm$/i, "2º Sargento PM"],
  [/^3[ºo°]\s*sgt\.?\s*pm$/i, "3º Sargento PM"],
  [/^(cb|cabo)\.?\s*pm$/i, "Cabo PM"],
  [/^sd\.?\s*pm\s*1[ºoª°]\s*classe$/i, "Soldado PM 1ª Classe"],
  [/^sd\.?\s*pm\s*2[ºoª°]\s*classe$/i, "Soldado PM 2ª Classe"],
  [/^sd\.?\s*pm$/i, "Soldado PM"],
];

export function postoPorExtenso(posto: string | null | undefined): string {
  const p = (posto ?? "").trim().replace(/\s+/g, " ");
  if (!p) return "";
  const achado = EXTENSO.find(([re]) => re.test(p));
  return achado ? achado[1] : p;
}

/** "Coronel PM Murilo Fenix" */
export function nomeComPostoExtenso(
  posto: string | null | undefined,
  nome: string | null | undefined,
): string {
  return [postoPorExtenso(posto), (nome ?? "").trim()].filter(Boolean).join(" ");
}

/** Cargo da autoridade na assinatura do ofício. */
export function cargoNoOficio(role: string | null | undefined): string {
  switch (role) {
    case "corregedor_geral":
      return "Corregedor-Geral da Polícia Militar";
    case "subcorregedor_geral":
      return "Subcorregedor-Geral da Polícia Militar";
    case "corregedor_supervisor":
      return "Corregedor Supervisor da Polícia Militar";
    default:
      return "";
  }
}
