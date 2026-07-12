import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TIPOS = ["processos", "pdos", "avisos", "observacoes"] as const;
const CONFIRMACOES: Record<(typeof TIPOS)[number], string> = {
  processos: "PROCESSOS",
  pdos: "PDOS",
  avisos: "AVISOS",
  observacoes: "OBSERVACOES",
};

async function requireDelegadoCorregedor(context: { supabase: any; userId: string }) {
  const { data: role, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!role || (role as { role: string }).role !== "delegado_corregedor") {
    throw new Error("Apenas o Delegado Corregedor pode acessar a Manutenção.");
  }
}


export const limparDados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tipo: z.enum(TIPOS),
        confirmacao: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireDelegadoCorregedor(context as any);
    if (data.confirmacao.trim().toUpperCase() !== CONFIRMACOES[data.tipo]) {
      throw new Error(`Digite exatamente ${CONFIRMACOES[data.tipo]} para confirmar.`);
    }
    const rpc =
      data.tipo === "processos"
        ? "manutencao_limpar_processos"
        : data.tipo === "pdos"
          ? "manutencao_limpar_pdos"
          : data.tipo === "avisos"
            ? "manutencao_limpar_avisos"
            : "manutencao_limpar_observacoes";
    const { data: res, error } = await (context.supabase as any).rpc(rpc);
    if (error) throw new Error(error.message);
    return res as { removidos: number };
  });
