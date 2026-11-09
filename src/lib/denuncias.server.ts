/* eslint-disable @typescript-eslint/no-explicit-any -- cliente de serviço sem tipagem estrita aqui */
/**
 * Rotinas só do servidor (chave de serviço) para denúncias. Importadas
 * dinamicamente pelos handlers de denuncias.functions.ts; nunca vão ao navegador.
 */

export interface DadosDenunciante {
  denunciante_anonimo: boolean;
  denunciante_nome?: string | null;
  denunciante_identificador?: string | null;
  denunciante_contato?: string | null;
}

/**
 * Grava o denunciante exatamente como informado no formulário público,
 * depois de criada a denúncia (o canal anônimo do banco só devolve o
 * protocolo). Garante que o nome nunca seja o de quem está logado.
 */
export async function gravarDenunciante(
  ref: { id?: string | null; protocolo?: string | null },
  d: DadosDenunciante,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as any;
  const anon = !!d.denunciante_anonimo;
  const limpo = (v: string | null | undefined) => (anon ? null : v?.trim() || null);
  let q = sb.from("denuncias").update({
    denunciante_anonimo: anon,
    denunciante_nome: limpo(d.denunciante_nome),
    denunciante_identificador: limpo(d.denunciante_identificador),
    denunciante_contato: limpo(d.denunciante_contato),
  });
  if (ref.id) q = q.eq("id", ref.id);
  else if (ref.protocolo) q = q.eq("numero_protocolo", ref.protocolo);
  else return;
  const { error } = await q;
  if (error) throw error;
}
