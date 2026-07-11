import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const STATUS_VALUES = [
  "recebida",
  "aguardando_analise",
  "em_analise",
  "em_investigacao",
  "concluida",
  "arquivada",
] as const;

const UNIDADES = [
  "DEIC",
  "CORREGEPOL",
  "DECAP",
  "DHPP",
  "CERCO",
  "GARRA",
  "DENARC",
  "GER",
  "SAT",
] as const;

const ESPECIES = ["despacho", "decisao", "ipc"] as const;
const ESPECIES_PORTARIA = "portaria" as const;

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    },
  );
}

// ============ CANAL PÚBLICO ============

const submitSchema = z.object({
  denunciante_nome: z.string().trim().max(200).optional().nullable(),
  denunciante_identificador: z.string().trim().max(200).optional().nullable(),
  denunciante_contato: z.string().trim().max(200).optional().nullable(),
  denunciante_anonimo: z.boolean().default(false),
  ocorrencia_tipo: z.string().trim().max(200).optional().nullable(),
  ocorrencia_local: z.string().trim().max(500).optional().nullable(),
  ocorrencia_data: z.string().optional().nullable(),
  ocorrencia_hora: z.string().optional().nullable(),
  relato: z.string().trim().min(20, "Descreva o fato com pelo menos 20 caracteres.").max(10000),
  info_adicional: z.string().trim().max(5000).optional().nullable(),
  links: z.array(z.string().url().max(500)).max(20).default([]),
  policiais: z
    .array(
      z.object({
        nome: z.string().trim().min(1).max(200),
        rg_funcional: z.string().trim().max(50).optional().nullable(),
        unidade: z.enum(UNIDADES).optional().nullable(),
      }),
    )
    .min(1, "Informe pelo menos um policial denunciado.")
    .max(20),
});

export const submitDenuncia = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: den, error } = await sb
      .from("denuncias")
      .insert({
        denunciante_nome: data.denunciante_anonimo ? null : data.denunciante_nome,
        denunciante_identificador: data.denunciante_anonimo ? null : data.denunciante_identificador,
        denunciante_contato: data.denunciante_anonimo ? null : data.denunciante_contato,
        denunciante_anonimo: data.denunciante_anonimo,
        ocorrencia_tipo: data.ocorrencia_tipo,
        ocorrencia_local: data.ocorrencia_local,
        ocorrencia_data: data.ocorrencia_data || null,
        ocorrencia_hora: data.ocorrencia_hora || null,
        relato: data.relato,
        info_adicional: data.info_adicional,
        links: data.links,
      })
      .select("id, numero_protocolo")
      .single();
    if (error) throw new Error(error.message);

    if (data.policiais.length) {
      const rows = data.policiais.map((p) => ({
        denuncia_id: den.id,
        nome: p.nome,
        rg_funcional: p.rg_funcional ?? null,
        unidade: p.unidade ?? null,
      }));
      await sb.from("denuncia_policiais").insert(rows);
    }

    return { protocolo: den.numero_protocolo };
  });

export const consultarPublica = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ protocolo: z.string().trim().min(3).max(40) }).parse(data))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: den } = await sb
      .from("denuncias")
      .select("numero_protocolo, status, obs_denunciante, created_at")
      .eq("numero_protocolo", data.protocolo)
      .maybeSingle();
    if (!den) return null;
    return den;
  });

// ============ INTERNAS (staff) ============

export const listDenuncias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("denuncias")
      .select(
        "id, numero_protocolo, status, unidade, ocorrencia_tipo, termo_inicial, acrescimos_dias, interrupcoes_count, created_at, denunciante_nome, denuncia_policiais(nome, unidade)",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getDenuncia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    // Projeta explicitamente as colunas (evita SELECT * porque obs_internas
    // tem GRANT revogado por segurança).
    const cols =
      "id, numero_protocolo, denunciante_nome, denunciante_identificador, denunciante_contato, denunciante_anonimo, ocorrencia_tipo, ocorrencia_local, ocorrencia_data, ocorrencia_hora, relato, info_adicional, anexos, links, status, unidade, obs_denunciante, termo_inicial, acrescimos_dias, interrupcoes_count, created_at, instaurada_em, owner_id";
    const { data: den, error } = await context.supabase
      .from("denuncias")
      .select(cols)
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    // obs_internas só é retornada para staff ativo (função SECURITY DEFINER).
    const { data: obsInt } = await context.supabase.rpc("get_obs_internas", {
      _denuncia_id: data.id,
    });
    const [pols, movs, ois] = await Promise.all([
      context.supabase.from("denuncia_policiais").select("*").eq("denuncia_id", data.id),
      context.supabase
        .from("movimentos")
        .select("*")
        .eq("denuncia_id", data.id)
        .order("criado_em", { ascending: false }),
      context.supabase.from("oitivas").select("*").eq("denuncia_id", data.id).order("created_at", { ascending: false }),
    ]);
    return {
      denuncia: { ...den, obs_internas: (obsInt as string | null) ?? null },
      policiais: pols.data ?? [],
      movimentos: movs.data ?? [],
      oitivas: ois.data ?? [],
    };
  });


async function getProlator(context: { supabase: ReturnType<typeof publicClient>; userId: string }) {
  const [{ data: prof }, { data: role }] = await Promise.all([
    context.supabase.from("profiles").select("nome, status").eq("id", context.userId).maybeSingle(),
    context.supabase.from("user_roles").select("role").eq("user_id", context.userId).maybeSingle(),
  ]);
  if (!prof || prof.status !== "ativo" || !role) {
    throw new Error("Usuário sem cargo ativo.");
  }
  return { prolator_id: context.userId, prolator_nome: prof.nome, prolator_cargo: role.role };
}

export const lancarMovimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        denuncia_id: z.string().uuid(),
        especie: z.enum(ESPECIES),
        teor: z.string().trim().min(3).max(20000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const p = await getProlator(context);
    const { error } = await context.supabase.from("movimentos").insert({
      denuncia_id: data.denuncia_id,
      especie: data.especie,
      teor: data.teor,
      ...p,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const alterarStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        denuncia_id: z.string().uuid(),
        novo_status: z.enum(STATUS_VALUES),
        motivo: z.string().trim().min(3).max(4000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const p = await getProlator(context);
    const { data: atual } = await context.supabase
      .from("denuncias")
      .select("status")
      .eq("id", data.denuncia_id)
      .single();
    if (!atual) throw new Error("Denúncia não encontrada.");

    const { error: updErr } = await context.supabase
      .from("denuncias")
      .update({ status: data.novo_status })
      .eq("id", data.denuncia_id);
    if (updErr) throw new Error(updErr.message);

    await context.supabase.from("movimentos").insert({
      denuncia_id: data.denuncia_id,
      especie: "status",
      teor: `Status alterado de ${atual.status} para ${data.novo_status}. Motivação: ${data.motivo}`,
      ...p,
    });
    return { ok: true };
  });

export const receberDenuncia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        denuncia_id: z.string().uuid(),
        teor: z.string().trim().min(3).max(4000).default("Despacho de recebimento da denúncia."),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const p = await getProlator(context);
    const agora = new Date().toISOString();
    const { data: atual } = await context.supabase
      .from("denuncias")
      .select("interrupcoes_count, instaurada_em")
      .eq("id", data.denuncia_id)
      .single();
    if (!atual) throw new Error("Denúncia não encontrada.");

    const { error: updErr } = await context.supabase
      .from("denuncias")
      .update({
        termo_inicial: agora,
        acrescimos_dias: 0,
        interrupcoes_count: (atual.interrupcoes_count ?? 0) + 1,
        instaurada_em: atual.instaurada_em ?? agora,
      })
      .eq("id", data.denuncia_id);
    if (updErr) throw new Error(updErr.message);

    await context.supabase.from("movimentos").insert({
      denuncia_id: data.denuncia_id,
      especie: "despacho",
      teor: `RECEBIMENTO — interrompe a prescrição. ${data.teor}`,
      interrompe: true,
      ...p,
    });
    return { ok: true };
  });

export const prorrogar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        denuncia_id: z.string().uuid(),
        justificativa: z.string().trim().min(10, "Justifique a remarcação.").max(4000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const p = await getProlator(context);
    const { data: atual } = await context.supabase
      .from("denuncias")
      .select("acrescimos_dias")
      .eq("id", data.denuncia_id)
      .single();
    if (!atual) throw new Error("Denúncia não encontrada.");

    const { error: updErr } = await context.supabase
      .from("denuncias")
      .update({ acrescimos_dias: (atual.acrescimos_dias ?? 0) + 30 })
      .eq("id", data.denuncia_id);
    if (updErr) throw new Error(updErr.message);

    await context.supabase.from("movimentos").insert({
      denuncia_id: data.denuncia_id,
      especie: "despacho",
      teor: `PRORROGAÇÃO +30 DIAS — remarcação de oitiva. Justificativa: ${data.justificativa}`,
      prorroga: true,
      ...p,
    });
    return { ok: true };
  });

export const juntarOitiva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        denuncia_id: z.string().uuid(),
        identificacao: z.string().trim().min(2).max(300),
        url: z.string().url().max(1000),
        data: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const p = await getProlator(context);
    const { error } = await context.supabase.from("oitivas").insert({
      denuncia_id: data.denuncia_id,
      identificacao: data.identificacao,
      url: data.url,
      data: data.data || null,
    });
    if (error) throw new Error(error.message);

    await context.supabase.from("movimentos").insert({
      denuncia_id: data.denuncia_id,
      especie: "despacho",
      teor: `Junte-se a gravação da oitiva de ${data.identificacao}. Disponível em: ${data.url}`,
      ...p,
    });
    return { ok: true };
  });

export const desentranharOitiva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        oitiva_id: z.string().uuid(),
        motivo: z.string().trim().min(3).max(4000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const p = await getProlator(context);
    const { data: oit } = await context.supabase
      .from("oitivas")
      .select("*")
      .eq("id", data.oitiva_id)
      .single();
    if (!oit) throw new Error("Oitiva não encontrada.");

    await context.supabase.from("oitivas").update({ ativa: false }).eq("id", data.oitiva_id);
    await context.supabase.from("movimentos").insert({
      denuncia_id: oit.denuncia_id,
      especie: "despacho",
      teor: `Desentranhada a oitiva de ${oit.identificacao}. Motivo: ${data.motivo}`,
      ...p,
    });
    return { ok: true };
  });

export const atualizarObservacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        denuncia_id: z.string().uuid(),
        obs_internas: z.string().max(20000).optional().nullable(),
        obs_denunciante: z.string().max(20000).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("denuncias")
      .update({
        obs_internas: data.obs_internas ?? null,
        obs_denunciante: data.obs_denunciante ?? null,
      })
      .eq("id", data.denuncia_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const atualizarUnidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ denuncia_id: z.string().uuid(), unidade: z.enum(UNIDADES) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("denuncias")
      .update({ unidade: data.unidade })
      .eq("id", data.denuncia_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const retificarDenunciado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        policial_id: z.string().uuid(),
        nome: z.string().trim().min(1).max(200),
        rg_funcional: z.string().trim().max(50).optional().nullable(),
        motivo: z.string().trim().max(2000).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const p = await getProlator(context);
    if (p.prolator_cargo !== "delegado_geral" && p.prolator_cargo !== "delegado_corregedor") {
      throw new Error("Apenas Delegado Geral ou Delegado Corregedor podem retificar o denunciado.");
    }

    const { data: pol, error: polErr } = await context.supabase
      .from("denuncia_policiais")
      .select("*")
      .eq("id", data.policial_id)
      .single();
    if (polErr || !pol) throw new Error("Denunciado não encontrado.");

    const novoNome = data.nome.trim();
    const novaMat = (data.rg_funcional ?? "").trim() || null;
    const antigoNome = pol.nome;
    const antigaMat = pol.rg_funcional ?? null;

    if (novoNome === antigoNome && novaMat === antigaMat) {
      return { changed: false };
    }

    const { error: updErr } = await context.supabase
      .from("denuncia_policiais")
      .update({ nome: novoNome, rg_funcional: novaMat })
      .eq("id", data.policial_id);
    if (updErr) throw new Error(updErr.message);

    const fmt = (n: string, m: string | null) => `"${n} (${m ?? "sem matrícula"})"`;
    const motivoTxt = data.motivo?.trim() ? ` Motivo: ${data.motivo.trim()}.` : "";
    const teor =
      `Denunciado retificado de ${fmt(antigoNome, antigaMat)} para ${fmt(novoNome, novaMat)}.` +
      motivoTxt;

    const { error: movErr } = await context.supabase.from("movimentos").insert({
      denuncia_id: pol.denuncia_id,
      especie: "retificacao",
      teor,
      ...p,
    });
    if (movErr) throw new Error(movErr.message);

    return { changed: true };
  });

export const lavrarPortaria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        denuncia_id: z.string().uuid(),
        corpo: z.string().trim().min(50).max(30000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const p = await getProlator(context);
    const agora = new Date().toISOString();

    const { data: atual } = await context.supabase
      .from("denuncias")
      .select("interrupcoes_count")
      .eq("id", data.denuncia_id)
      .single();
    if (!atual) throw new Error("Denúncia não encontrada.");

    const { error: updErr } = await context.supabase
      .from("denuncias")
      .update({
        termo_inicial: agora,
        acrescimos_dias: 0,
        interrupcoes_count: (atual.interrupcoes_count ?? 0) + 1,
        instaurada_em: agora,
      })
      .eq("id", data.denuncia_id);
    if (updErr) throw new Error(updErr.message);

    const { error: movErr } = await context.supabase.from("movimentos").insert({
      denuncia_id: data.denuncia_id,
      especie: ESPECIES_PORTARIA,
      teor: data.corpo,
      interrompe: true,
      ...p,
    });
    if (movErr) throw new Error(movErr.message);

    return { ok: true };
  });

// Envio de denúncia por Cidadão autenticado — vincula owner_id.
export const submitDenunciaCidadao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data, context }) => {
    const anon = data.denunciante_anonimo;
    const { data: den, error } = await context.supabase
      .from("denuncias")
      .insert({
        owner_id: context.userId,
        denunciante_nome: anon ? null : data.denunciante_nome,
        denunciante_identificador: anon ? null : data.denunciante_identificador,
        denunciante_contato: anon ? null : data.denunciante_contato,
        denunciante_anonimo: anon,
        ocorrencia_tipo: data.ocorrencia_tipo,
        ocorrencia_local: data.ocorrencia_local,
        ocorrencia_data: data.ocorrencia_data || null,
        ocorrencia_hora: data.ocorrencia_hora || null,
        relato: data.relato,
        info_adicional: data.info_adicional,
        links: data.links,
      })
      .select("id, numero_protocolo")
      .single();
    if (error) throw new Error(error.message);

    if (data.policiais.length) {
      const rows = data.policiais.map((p) => ({
        denuncia_id: den.id,
        nome: p.nome,
        rg_funcional: p.rg_funcional ?? null,
        unidade: p.unidade ?? null,
      }));
      await context.supabase.from("denuncia_policiais").insert(rows);
    }
    return { protocolo: den.numero_protocolo };
  });

// Publica/despublica um IPC para o denunciante.
export const alternarPublicacaoIpc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ movimento_id: z.string().uuid(), publicado: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: mov } = await context.supabase
      .from("movimentos")
      .select("id, especie")
      .eq("id", data.movimento_id)
      .single();
    if (!mov) throw new Error("Movimento não encontrado.");
    if (mov.especie !== "ipc") throw new Error("Apenas movimentos IPC podem ser publicados.");
    const { error } = await context.supabase
      .from("movimentos")
      .update({ ipc_publicado: data.publicado })
      .eq("id", data.movimento_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Painel do Cidadão.
export const listMinhasDenuncias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: dens, error } = await context.supabase
      .from("denuncias")
      .select("id, numero_protocolo, status, obs_denunciante, created_at, ocorrencia_tipo")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (dens ?? []).map((d) => d.id);
    let ipcs: Array<{
      id: string;
      denuncia_id: string;
      teor: string;
      criado_em: string;
      prolator_nome: string;
      prolator_cargo: string;
    }> = [];
    if (ids.length) {
      const { data: movs } = await context.supabase
        .from("movimentos")
        .select("id, denuncia_id, teor, criado_em, prolator_nome, prolator_cargo")
        .in("denuncia_id", ids)
        .eq("especie", "ipc")
        .eq("ipc_publicado", true)
        .order("criado_em", { ascending: false });
      ipcs = (movs ?? []) as typeof ipcs;
    }
    return { denuncias: dens ?? [], ipcs };
  });



