import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMinhasNotificacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notificacoes")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const contarNaoLidasNotif = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error } = await context.supabase
      .from("notificacoes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("lido", false);
    if (error) throw new Error(error.message);
    return count ?? 0;
  });

export const marcarNotificacaoLida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ notif_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("marcar_notificacao_lida", {
      _notif_id: data.notif_id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const buscarInternos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ termo: z.string().trim().max(100) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("buscar_internos", {
      _termo: data.termo,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []) as { id: string; nome: string; cargo: string }[];
  });

export const criarIntimacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        denuncia_id: z.string().uuid(),
        destinatario_id: z.string().uuid(),
        teor: z.string().trim().min(3).max(4000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("criar_intimacao", {
      _denuncia_id: data.denuncia_id,
      _destinatario_id: data.destinatario_id,
      _teor: data.teor,
    });
    if (error) throw new Error(error.message);
    return { id };
  });
