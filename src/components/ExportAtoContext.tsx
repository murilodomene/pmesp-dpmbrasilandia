import { createContext, useContext } from "react";

/**
 * Exportação de um ato individual no modelo vetorial oficial.
 *
 * A tela que conhece o processo completo (denúncia, policiais e movimentos)
 * fornece a função; os cartões de ato só informam o id do movimento. Sem
 * provedor, os cartões usam o exportador anterior (por imagem).
 */
export type ExportarAtoFn = (movimentoId: string) => Promise<void>;

export const ExportAtoContext = createContext<ExportarAtoFn | null>(null);

export function useExportarAto(): ExportarAtoFn | null {
  return useContext(ExportAtoContext);
}
