import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES = ["delegado_geral", "delegado_corregedor", "corregedor"] as const;
const STATUS = ["pendente", "ativo", "inativo"] as const;

async function assertDelegado(context: {
  supabase: {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => { in: (k: string, v: readonly string[]) => Promise<{ data: unknown }> };
      };
    };
  };
  userId: string;
}) {
  // simpler: just call user_roles with in-clause
  const { data } = await (
    context.supabase.from("user_roles") as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          in: (k: string, v: readonly string[]) => Promise<{ data: Array<{ role: string }> | null }>;
        };
      };
    }
  )
    .select("role")
    .eq("user_id", context.userId)
    .in("role", ["delegado_geral", "delegado_corregedor"] as const);
  if (!data || data.length === 0) throw new Error("Apenas Delegado Geral ou Corregedor pode gerenciar usuários.");
}

export const getSessionInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: prof }, { data: role }] = await Promise.all([
      context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId).maybeSingle(),
    ]);
    return {
      userId: context.userId,
      profile: prof,
      cargo: role?.role ?? null,
    };
  });

export const listUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertDelegado(context as never);
    const { data: profs, error } = await context.supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: roles } = await context.supabase.from("user_roles").select("user_id, role");
    const roleMap = new Map<string, string>();
    (roles ?? []).forEach((r) => roleMap.set(r.user_id, r.role));
    return (profs ?? []).map((p) => ({ ...p, cargo: roleMap.get(p.id) ?? null }));
  });

export const aprovarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ user_id: z.string().uuid(), cargo: z.enum(ROLES) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertDelegado(context as never);
    const { error: e1 } = await context.supabase
      .from("profiles")
      .update({ status: "ativo" })
      .eq("id", data.user_id);
    if (e1) throw new Error(e1.message);
    // remove eventual cargo existente e insere o novo
    await context.supabase.from("user_roles").delete().eq("user_id", data.user_id);
    const { error: e2 } = await context.supabase
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.cargo });
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

export const alterarStatusUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ user_id: z.string().uuid(), status: z.enum(STATUS) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertDelegado(context as never);
    const { error } = await context.supabase
      .from("profiles")
      .update({ status: data.status })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const atualizarPerfil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        nome: z.string().trim().min(2).max(200),
        matricula: z.string().trim().min(1).max(50),
        unidade: z
          .enum(["DEIC", "CORREGEPOL", "DECAP", "DHPP", "CERCO", "GARRA", "DENARC", "GER", "SAT"])
          .optional()
          .nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ nome: data.nome, matricula: data.matricula, unidade: data.unidade ?? null })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
