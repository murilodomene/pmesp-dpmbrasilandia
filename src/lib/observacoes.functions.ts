import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CARGOS_INTERNOS = ["delegado_geral", "delegado_corregedor", "corregedor"] as const;

const AnexoSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  path: z.string().trim().min(1).max(500),
});

const ObsInput = z.object({
  policial_nome: z.string().trim().max(200).optional().nullable(),
  policial_matricula: z.string().trim().max(50).optional().nullable(),
  policial_cargo: z.string().trim().max(60).optional().nullable(),
  policial_unidade: z.string().trim().max(60).optional().nullable(),
  corpo: z.string().trim().min(3).max(20000),
  anexos: z.array(AnexoSchema).max(20).default([]),
  pads: z.array(z.string().uuid()).max(50).default([]),
});

async function assertInterno(context: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}) {
  const { data: prof } = await context.supabase
    .from("profiles")
    .select("nome, status")
    .eq("id", context.userId)
    .maybeSingle();
  if (!prof || (prof as { status: string }).status !== "ativo") {
    throw new Error("Usuário sem cadastro ativo.");
  }
  const { data: ur } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .maybeSingle();
  const cargo = (ur as { role: string } | null)?.role;
  if (!cargo || !CARGOS_INTERNOS.includes(cargo as (typeof CARGOS_INTERNOS)[number])) {
    throw new Error("Acesso restrito à Corregedoria.");
  }
  return { nome: (prof as { nome: string }).nome, cargo };
}

export const listObservacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertInterno(context);
    const { data: obs, error } = await context.supabase
      .from("observacoes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (obs ?? []).map((o) => (o as { id: string }).id);
    let vinculos: { observacao_id: string; denuncia_id: string; numero_protocolo: string }[] = [];
    if (ids.length > 0) {
      const { data: links, error: lErr } = await context.supabase
        .from("observacao_pads")
        .select("observacao_id, denuncia_id, denuncias(numero_protocolo)")
        .in("observacao_id", ids);
      if (lErr) throw new Error(lErr.message);
      vinculos = (links ?? []).map((l) => {
        const row = l as {
          observacao_id: string;
          denuncia_id: string;
          denuncias: { numero_protocolo: string } | null;
        };
        return {
          observacao_id: row.observacao_id,
          denuncia_id: row.denuncia_id,
          numero_protocolo: row.denuncias?.numero_protocolo ?? "",
        };
      });
    }
    return (obs ?? []).map((o) => {
      const row = o as Record<string, unknown> & { id: string };
      const pads = vinculos.filter((v) => v.observacao_id === row.id);
      return { ...row, pads };
    });
  });

export const criarObservacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ObsInput.parse(data))
  .handler(async ({ data, context }) => {
    const { nome, cargo } = await assertInterno(context);
    const { data: row, error } = await context.supabase
      .from("observacoes")
      .insert({
        autor_id: context.userId,
        autor_nome: nome,
        autor_cargo: cargo as "delegado_geral" | "delegado_corregedor" | "corregedor",
        policial_nome: data.policial_nome,
        policial_matricula: data.policial_matricula || null,
        policial_cargo: data.policial_cargo || null,
        policial_unidade: data.policial_unidade || null,
        corpo: data.corpo,
        anexos: data.anexos,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const obsId = (row as { id: string }).id;
    if (data.pads.length > 0) {
      const { error: lErr } = await context.supabase
        .from("observacao_pads")
        .insert(data.pads.map((d) => ({ observacao_id: obsId, denuncia_id: d })));
      if (lErr) throw new Error(lErr.message);
    }
    return { id: obsId };
  });

export const atualizarObservacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    ObsInput.extend({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertInterno(context);
    const { error } = await context.supabase
      .from("observacoes")
      .update({
        policial_nome: data.policial_nome,
        policial_matricula: data.policial_matricula || null,
        policial_cargo: data.policial_cargo || null,
        policial_unidade: data.policial_unidade || null,
        corpo: data.corpo,
        anexos: data.anexos,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    // Resincroniza vínculos
    const { error: dErr } = await context.supabase
      .from("observacao_pads")
      .delete()
      .eq("observacao_id", data.id);
    if (dErr) throw new Error(dErr.message);
    if (data.pads.length > 0) {
      const { error: iErr } = await context.supabase
        .from("observacao_pads")
        .insert(data.pads.map((d) => ({ observacao_id: data.id, denuncia_id: d })));
      if (iErr) throw new Error(iErr.message);
    }
    return { ok: true };
  });

export const excluirObservacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertInterno(context);
    const { error } = await context.supabase
      .from("observacoes")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const buscarPoliciais = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ termo: z.string().trim().max(120).default("") }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertInterno(context);
    const t = data.termo.trim();
    let q = context.supabase
      .from("denuncia_policiais")
      .select("nome, rg_funcional, unidade, cargo")
      .limit(50);
    if (t) {
      q = q.or(`nome.ilike.%${t}%,rg_funcional.ilike.%${t}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    // Deduplica por matricula/nome
    const seen = new Set<string>();
    const uniq: {
      nome: string;
      matricula: string | null;
      cargo: string | null;
      unidade: string | null;
    }[] = [];
    for (const r of rows ?? []) {
      const row = r as {
        nome: string;
        rg_funcional: string | null;
        unidade: string | null;
        cargo: string | null;
      };
      const key = `${row.rg_funcional ?? ""}|${row.nome.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push({
        nome: row.nome,
        matricula: row.rg_funcional,
        cargo: row.cargo,
        unidade: row.unidade,
      });
    }
    return uniq.slice(0, 20);
  });

export const buscarPads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ termo: z.string().trim().max(60).default("") }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertInterno(context);
    const t = data.termo.trim();
    let q = context.supabase
      .from("denuncias")
      .select("id, numero_protocolo")
      .order("created_at", { ascending: false })
      .limit(20);
    if (t) q = q.ilike("numero_protocolo", `%${t}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as { id: string; numero_protocolo: string }[];
  });

export const contarObservacoesPorPad = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ denuncia_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    // Só cargos internos veem, garantido pela RLS de observacoes/observacao_pads.
    const { data: rows, error } = await context.supabase
      .from("observacao_pads")
      .select("observacao_id")
      .eq("denuncia_id", data.denuncia_id);
    if (error) return { count: 0 };
    return { count: (rows ?? []).length };
  });

export const contarObservacoesPorPolicial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        nome: z.string().trim().max(200).optional().nullable(),
        matricula: z.string().trim().max(50).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    try {
      await assertInterno(context);
    } catch {
      return { count: 0 };
    }
    const nome = (data.nome ?? "").trim();
    const mat = (data.matricula ?? "").trim();
    if (!nome && !mat) return { count: 0 };
    let q = context.supabase.from("observacoes").select("id", { count: "exact", head: true });
    if (mat) {
      q = q.eq("policial_matricula", mat);
    } else {
      q = q.ilike("policial_nome", nome);
    }
    const { count, error } = await q;
    if (error) return { count: 0 };
    return { count: count ?? 0 };
  });
