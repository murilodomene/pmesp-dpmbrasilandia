import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OPMS } from "@/lib/personnel-options";

const ROLES = ["ssp", "corregedor_geral", "subcorregedor_geral", "corregedor", "cidadao", "mp"] as const;
const EDITABLE_ROLES = ["ssp", "corregedor_geral", "subcorregedor_geral", "corregedor", "cidadao", "mp"] as const;
const STATUS = ["pendente", "ativo", "inativo"] as const;
const DELEGADO_ROLES = ["ssp", "corregedor_geral", "subcorregedor_geral"] as const;

async function assertCorregedor(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .in("role", ["corregedor_geral", "subcorregedor_geral"])
    .maybeSingle();
  if (!data) {
    throw new Error("403: Acesso Negado. Apenas Corregedor-Geral ou Subcorregedor-Geral.");
  }
}
const assertDelegado = assertCorregedor;

export const excluirUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertDelegado(context as never);
    if (data.user_id === context.userId) {
      throw new Error("Você não pode excluir a si mesmo.");
    }
    const { data: alvo } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (alvo && (alvo.role === "corregedor_geral" || alvo.role === "subcorregedor_geral")) {
      throw new Error("O Corregedor-Geral/Subcorregedor-Geral não pode ser excluído por esta ação.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

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
    (roles ?? []).forEach((r: { user_id: string; role: string }) => roleMap.set(r.user_id, r.role));

    // fetch emails via admin
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const emailMap = new Map<string, string>();
    let page = 1;
    while (true) {
      const { data, error: adminErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (adminErr) break;
      data.users.forEach((u) => u.email && emailMap.set(u.id, u.email));
      if (!data.users.length || data.users.length < 200) break;
      page += 1;
      if (page > 20) break;
    }

    return (profs ?? []).map((p) => ({
      ...p,
      cargo: roleMap.get(p.id) ?? null,
      email: emailMap.get(p.id) ?? null,
    }));
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
    // Corregedor não altera o próprio cargo
    const { data: alvo } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (alvo && (alvo.role === "corregedor_geral" || alvo.role === "subcorregedor_geral")) {
      throw new Error("O Corregedor-Geral/Subcorregedor-Geral não pode ter seu status alterado por esta ação.");
    }
    const { error } = await context.supabase
      .from("profiles")
      .update({ status: data.status })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const editarUsuarioPublico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        nome: z.string().trim().min(2).max(200),
        email: z.string().trim().email().max(200),
        cargo: z.enum(EDITABLE_ROLES),
        rg: z.string().trim().max(50).optional().nullable(),
        discord_id: z.string().trim().max(100).optional().nullable(),
        telefone: z.string().trim().max(30).optional().nullable(),
        foto_path: z.string().trim().max(500).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertDelegado(context as never);

    const { data: alvo } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (!alvo || !(EDITABLE_ROLES as readonly string[]).includes(alvo.role)) {
      throw new Error("Este usuário não pode ser editado por esta ação.");
    }

    const updates: Record<string, any> = { nome: data.nome };
    if (data.rg !== undefined) updates.rg = data.rg;
    if (data.discord_id !== undefined) updates.discord_id = data.discord_id;
    if (data.telefone !== undefined) updates.telefone = data.telefone;
    if (data.foto_path !== undefined) updates.foto_path = data.foto_path;

    const { error: e1 } = await context.supabase
      .from("profiles")
      .update(updates as any)
      .eq("id", data.user_id);
    if (e1) throw new Error(e1.message);

    if (alvo.role !== data.cargo) {
      await context.supabase.from("user_roles").delete().eq("user_id", data.user_id);
      const { error: e2 } = await context.supabase
        .from("user_roles")
        .insert({ user_id: data.user_id, role: data.cargo });
      if (e2) throw new Error(e2.message);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: e3 } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      email: data.email,
    });
    if (e3) throw new Error(e3.message);

    return { ok: true };
  });

export const atualizarPerfil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        nome: z.string().trim().min(2).max(200).optional(),
        matricula: z.string().trim().min(1).max(50).optional(),
        rg: z.string().trim().max(50).optional().nullable(),
        discord_id: z.string().trim().max(100).optional().nullable(),
        telefone: z.string().trim().max(30).optional().nullable(),
        foto_path: z.string().trim().max(500).optional().nullable(),
        unidade: z.enum(OPMS).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();
    const isCorregedor = roleRow?.role === "corregedor_geral" || roleRow?.role === "subcorregedor_geral";

    const updates: Record<string, any> = {};
    if (data.telefone !== undefined) updates.telefone = data.telefone;
    if (data.foto_path !== undefined) updates.foto_path = data.foto_path;

    if (isCorregedor) {
      if (data.nome !== undefined) updates.nome = data.nome;
      if (data.matricula !== undefined) updates.matricula = data.matricula;
      if (data.rg !== undefined) updates.rg = data.rg;
      if (data.discord_id !== undefined) updates.discord_id = data.discord_id;
      if (data.unidade !== undefined) updates.unidade = data.unidade ?? null;
    }

    if (Object.keys(updates).length === 0) return { ok: true };

    const { error } = await context.supabase
      .from("profiles")
      .update(updates as any)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
