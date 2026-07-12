import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const INTERNOS = ["delegado_geral", "delegado_corregedor", "corregedor"] as const;
const PUBLICADORES = ["delegado_geral", "delegado_corregedor"] as const;

async function getCargoNome(ctx: { supabase: any; userId: string }) {
  const [{ data: r }, { data: p }] = await Promise.all([
    ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId).maybeSingle(),
    ctx.supabase.from("profiles").select("nome, status").eq("id", ctx.userId).maybeSingle(),
  ]);
  return {
    cargo: (r?.role ?? null) as string | null,
    nome: (p?.nome ?? null) as string | null,
    ativo: p?.status === "ativo",
  };
}

export const listAvisos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { cargo, ativo } = await getCargoNome(context as never);
    if (!ativo || !cargo || !(INTERNOS as readonly string[]).includes(cargo)) return [];
    const { data, error } = await context.supabase
      .from("avisos")
      .select("id, numero, titulo, corpo, autor_id, autor_nome, autor_cargo, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getAviso = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("avisos")
      .select("id, numero, titulo, corpo, autor_id, autor_nome, autor_cargo, created_at, updated_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const criarAviso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      titulo: z.string().trim().min(1).max(200),
      corpo: z.string().trim().min(1).max(20000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { cargo, nome, ativo } = await getCargoNome(context as never);
    if (!ativo || !cargo || !(PUBLICADORES as readonly string[]).includes(cargo)) {
      throw new Error("Apenas Delegado Geral ou Delegado Corregedor podem publicar avisos.");
    }
    const { data: row, error } = await context.supabase
      .from("avisos")
      .insert({
        titulo: data.titulo,
        corpo: data.corpo,
        autor_id: context.userId,
        autor_nome: nome ?? "",
        autor_cargo: cargo as "delegado_geral" | "delegado_corregedor",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const atualizarAviso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      titulo: z.string().trim().min(1).max(200),
      corpo: z.string().trim().min(1).max(20000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { cargo, ativo } = await getCargoNome(context as never);
    if (!ativo || !cargo || !(PUBLICADORES as readonly string[]).includes(cargo)) {
      throw new Error("Sem permissão.");
    }
    const { error } = await context.supabase
      .from("avisos")
      .update({ titulo: data.titulo, corpo: data.corpo })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removerAviso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { cargo, ativo } = await getCargoNome(context as never);
    if (!ativo || !cargo || !(PUBLICADORES as readonly string[]).includes(cargo)) {
      throw new Error("Sem permissão.");
    }
    const { error } = await context.supabase.from("avisos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
