/**
 * Avisos já abertos por este usuário, guardados só no navegador
 * (localStorage). Serve para o selo "NOVO" — não grava nada no banco.
 */
const CHAVE = "corregedoria:avisos-vistos";
const EVENTO = "avisos-vistos-mudou";

function ler(): Set<string> | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    return bruto ? new Set(JSON.parse(bruto) as string[]) : null;
  } catch {
    return null;
  }
}

function gravar(ids: Set<string>): void {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(Array.from(ids).slice(-500)));
    window.dispatchEvent(new Event(EVENTO));
  } catch {
    /* navegador sem armazenamento: o selo apenas não é lembrado */
  }
}

/**
 * Ids ainda não abertos. No primeiro acesso, tudo o que já existe conta
 * como visto (para não marcar o histórico inteiro como novo).
 */
export function avisosNaoVistos(ids: string[]): Set<string> {
  if (typeof window === "undefined") return new Set();
  const vistos = ler();
  if (!vistos) {
    gravar(new Set(ids));
    return new Set();
  }
  return new Set(ids.filter((id) => !vistos.has(id)));
}

export function marcarAvisoVisto(id: string): void {
  if (typeof window === "undefined") return;
  const vistos = ler() ?? new Set<string>();
  if (vistos.has(id)) return;
  vistos.add(id);
  gravar(vistos);
}

export function aoMudarAvisosVistos(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENTO, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENTO, cb);
    window.removeEventListener("storage", cb);
  };
}
