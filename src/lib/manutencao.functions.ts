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
  if (!role || ((role as { role: string }).role !== "corregedor_geral" && (role as { role: string }).role !== "subcorregedor_geral")) {
    throw new Error("Apenas o Corregedor-Geral pode acessar a Manutenção.");
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

    // Para observações, também remove as imagens do bucket privado via Storage API.
    if (data.tipo === "observacoes") {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const walk = async (prefix: string): Promise<string[]> => {
          const { data: entries } = await supabaseAdmin.storage
            .from("atos-anexos")
            .list(prefix, { limit: 1000 });
          const paths: string[] = [];
          for (const e of entries ?? []) {
            const full = `${prefix}/${e.name}`;
            if ((e as { id: string | null }).id === null || e.metadata === null) {
              paths.push(...(await walk(full)));
            } else {
              paths.push(full);
            }
          }
          return paths;
        };
        const files = await walk("observacoes");
        if (files.length > 0) {
          await supabaseAdmin.storage.from("atos-anexos").remove(files);
        }
      } catch (e) {
        console.error("[manutencao] falha ao limpar storage de observações", e);
      }
    }

    return res as { removidos: number };
  });
