import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listAvisos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("avisos")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getAviso = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("avisos")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Aviso não encontrado.");
    return row;
  });

const AvisoInput = z.object({
  titulo: z.string().trim().min(3).max(200),
  corpo: z.string().trim().min(3).max(20000),
});

export const criarAviso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AvisoInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: prof, error: pErr } = await context.supabase
      .from("profiles")
      .select("nome, status")
      .eq("id", context.userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prof || prof.status !== "ativo") throw new Error("Usuário sem cadastro ativo.");

    const { data: ur, error: rErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    const cargo = ur?.role;
    if (cargo !== "ssp" && cargo !== "cmtg" && cargo !== "corregedor_geral" && (cargo !== "subcorregedor_geral" && cargo !== "corregedor_supervisor")) {
      throw new Error("Apenas SSP ou Corregedor-Geral podem publicar avisos.");
    }

    const { data: numero, error: nErr } = await context.supabase.rpc("gerar_numero_aviso");
    if (nErr) throw new Error(nErr.message);

    const { data: row, error } = await context.supabase
      .from("avisos")
      .insert({
        autor_id: context.userId,
        autor_nome: prof.nome,
        autor_cargo: cargo,
        numero: numero as string,
        titulo: data.titulo,
        corpo: data.corpo,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const atualizarAviso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        titulo: z.string().trim().min(3).max(200),
        corpo: z.string().trim().min(3).max(20000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("avisos")
      .update({ titulo: data.titulo, corpo: data.corpo })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirAviso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("avisos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
