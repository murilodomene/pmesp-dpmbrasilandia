import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const INTERNOS = ["delegado_geral", "delegado_corregedor", "corregedor"] as const;

async function getCargo(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .maybeSingle();
  return (data?.role ?? null) as string | null;
}

export const listNotificacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const cargo = await getCargo(context as never);
    if (!cargo || !(INTERNOS as readonly string[]).includes(cargo)) return [];
    const { data, error } = await context.supabase
      .from("notificacoes")
      .select("id, denuncia_id, aviso_id, tipo, titulo, teor, remetente_nome, remetente_cargo, lido, lida_em, created_at, denuncias(numero_protocolo)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const marcarNotificacaoLida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("marcar_notificacao_lida", { _notif_id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const criarIntimacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      denuncia_id: z.string().uuid(),
      destinatario_id: z.string().uuid(),
      teor: z.string().trim().min(1).max(2000),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("criar_intimacao", {
      _denuncia_id: data.denuncia_id,
      _destinatario_id: data.destinatario_id,
      _teor: data.teor,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const buscarInternos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ termo: z.string().max(200) }).parse(data))
  .handler(async ({ data, context }) => {
    const cargo = await getCargo(context as never);
    if (!cargo || !(INTERNOS as readonly string[]).includes(cargo)) return [];
    const { data: rows, error } = await context.supabase.rpc("buscar_internos", { _termo: data.termo });
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{ id: string; nome: string; cargo: string }>;
  });
