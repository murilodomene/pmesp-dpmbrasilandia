import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const STATUS_VALUES = [
  "novo",
  "aguardando_analise",
  "recebida",
  "em_analise",
  "em_investigacao",
  "concluso",
  "ag_decurso_prazo",
  "arquivada",
] as const;
// "transito_julgado" NÃO é selecionável manualmente — só via decurso automático.
// "concluida" foi removido do fluxo — permanece no enum apenas para compatibilidade histórica.

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

const ESPECIES = ["despacho", "decisao", "ipc", "mandado", "ata"] as const;
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
    // A função de banco grava tudo atomicamente e devolve apenas o protocolo.
    // Isso evita que o INSERT dependa de uma política pública de SELECT.
    const sb = publicClient();
    const { data: protocolo, error } = await sb.rpc(
      "submeter_denuncia_anonima",
      { _payload: data },
    );
    if (error) throw new Error(error.message);
    if (!protocolo) throw new Error("Não foi possível gerar o protocolo da denúncia.");
    return { protocolo };
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
    // Salvaguarda: aplica transição de decurso de prazo antes de listar,
    // caso o cron não tenha rodado.
    await context.supabase.rpc("transitar_pendentes" as never).then(() => undefined, () => undefined);
    const { data, error } = await context.supabase
      .from("denuncias")
      .select(
        "id, numero_protocolo, status, unidade, ocorrencia_tipo, termo_inicial, acrescimos_dias, interrupcoes_count, concluido_em, certidao_gerada, created_at, denunciante_nome, denuncia_policiais(nome, unidade), denuncia_tarjas(id, cor, texto)",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });


export const getDenuncia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const cols =
      "id, numero_protocolo, denunciante_nome, denunciante_identificador, denunciante_contato, denunciante_anonimo, ocorrencia_tipo, ocorrencia_local, ocorrencia_data, ocorrencia_hora, relato, info_adicional, anexos, links, status, unidade, obs_denunciante, termo_inicial, acrescimos_dias, interrupcoes_count, concluido_em, certidao_gerada, created_at, instaurada_em, owner_id";
    // Salvaguarda: se o prazo de 7 dias já venceu, transita antes de ler.
    await context.supabase
      .rpc("transitar_denuncia" as never, { _denuncia_id: data.id } as never)
      .then(() => undefined, () => undefined);
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
    const [pols, movs, ois, tarj] = await Promise.all([
      context.supabase.from("denuncia_policiais").select("*").eq("denuncia_id", data.id),
      context.supabase
        .from("movimentos")
        .select("*")
        .eq("denuncia_id", data.id)
        .order("criado_em", { ascending: false }),
      context.supabase.from("oitivas").select("*").eq("denuncia_id", data.id).order("created_at", { ascending: false }),
      context.supabase
        .from("denuncia_tarjas")
        .select("id, cor, texto, created_at")
        .eq("denuncia_id", data.id)
        .order("created_at", { ascending: true }),
    ]);
    return {
      denuncia: { ...den, obs_internas: (obsInt as string | null) ?? null },
      policiais: pols.data ?? [],
      movimentos: movs.data ?? [],
      oitivas: ois.data ?? [],
      tarjas: tarj.data ?? [],
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
        anexos: z
          .array(
            z.object({
              nome: z.string().trim().min(1).max(120),
              path: z.string().trim().min(1).max(500),
            }),
          )
          .max(30)
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const p = await getProlator(context);
    const anexos = data.anexos ?? [];
    const { error } = await context.supabase.from("movimentos").insert({
      denuncia_id: data.denuncia_id,
      especie: data.especie,
      teor: data.teor,
      anexos: anexos as never,
      ...p,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// URL assinada temporária (60 min) para abrir um anexo (imagem-prova).
// A policy de storage já garante que só staff ativo ou MP com acesso ao processo consegue ler.
export const getAnexoSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ path: z.string().trim().min(1).max(500) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("atos-anexos")
      .createSignedUrl(data.path, 60 * 60);
    if (error || !signed) throw new Error(error?.message ?? "Sem acesso ao anexo.");
    return { url: signed.signedUrl };
  });

export const alterarStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        denuncia_id: z.string().uuid(),
        novo_status: z.enum(STATUS_VALUES),
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

    const patch: {
      status: typeof data.novo_status;
      concluido_em: string | null;
      certidao_gerada?: boolean;
    } = { status: data.novo_status, concluido_em: null };
    if (data.novo_status === "ag_decurso_prazo") {
      patch.concluido_em = new Date().toISOString();
      patch.certidao_gerada = false;
    }

    const { error: updErr } = await context.supabase
      .from("denuncias")
      .update(patch)
      .eq("id", data.denuncia_id);
    if (updErr) throw new Error(updErr.message);

    await context.supabase.from("movimentos").insert({
      denuncia_id: data.denuncia_id,
      especie: "status",
      teor: `Status alterado de ${atual.status} para ${data.novo_status}.`,
      ...p,
    });
    return { ok: true };
  });

export const registrarRecurso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        denuncia_id: z.string().uuid(),
        certificacao: z.string().trim().min(10, "Descreva a certificação com no mínimo 10 caracteres.").max(4000),
        recurso_link: z.string().trim().max(1000).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("registrar_recurso" as never, {
      _denuncia_id: data.denuncia_id,
      _certificacao: data.certificacao,
      _recurso_link: data.recurso_link ?? "",
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const certificarResultadoRecurso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        denuncia_id: z.string().uuid(),
        resultado: z.enum(["provido", "parcialmente_provido", "indeferido", "nao_conhecido"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("certificar_resultado_recurso" as never, {
      _denuncia_id: data.denuncia_id,
      _resultado: data.resultado,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const certificarTransitoAdministrativo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ denuncia_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc(
      "certificar_transito_administrativo" as never,
      { _denuncia_id: data.denuncia_id } as never,
    );
    if (error) throw new Error(error.message);
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
        justificativa: z.string().trim().min(10).max(4000),
        anexos: z
          .array(
            z.object({
              nome: z.string().trim().min(1).max(120),
              path: z.string().trim().min(1).max(500),
            }),
          )
          .max(30)
          .optional(),
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

    const anexos = data.anexos ?? [];
    await context.supabase.from("movimentos").insert({
      denuncia_id: data.denuncia_id,
      especie: "despacho",
      teor: data.justificativa,
      prorroga: true,
      anexos: anexos as never,
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

export const atualizarNatureza = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        denuncia_id: z.string().uuid(),
        ocorrencia_tipo: z.string().trim().min(1).max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const p = await getProlator(context);
    if (p.prolator_cargo !== "delegado_geral" && p.prolator_cargo !== "delegado_corregedor" && p.prolator_cargo !== "coordenador") {
      throw new Error("Apenas Delegado Geral ou Delegado Corregedor podem editar a natureza.");
    }
    const { data: atual } = await context.supabase
      .from("denuncias")
      .select("ocorrencia_tipo")
      .eq("id", data.denuncia_id)
      .single();
    const antigo = atual?.ocorrencia_tipo ?? null;
    const novo = data.ocorrencia_tipo.trim();
    if (antigo === novo) return { changed: false };

    const { error } = await context.supabase
      .from("denuncias")
      .update({ ocorrencia_tipo: novo })
      .eq("id", data.denuncia_id);
    if (error) throw new Error(error.message);

    await context.supabase.from("movimentos").insert({
      denuncia_id: data.denuncia_id,
      especie: "retificacao",
      teor: `Natureza retificada de "${antigo ?? "—"}" para "${novo}".`,
      ...p,
    });
    return { changed: true };
  });


export const CARGOS_POLICIAIS = [
  "ACADEPOL",
  "Agente de 3º Classe",
  "Agente de 2º Classe",
  "Agente de 1º Classe",
  "Agente de Classe Especial",
  "Investigador",
  "Investigador-Chefe",
  "Perito",
  "Escrivão",
  "Delegado",
] as const;

export const retificarDenunciado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        policial_id: z.string().uuid(),
        nome: z.string().trim().min(1).max(200),
        rg_funcional: z.string().trim().max(50).optional().nullable(),
        unidade: z.enum(UNIDADES).optional().nullable(),
        cargo: z.enum(CARGOS_POLICIAIS).optional().nullable(),
        motivo: z.string().trim().max(2000).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const p = await getProlator(context);
    const podeRetificar =
      p.prolator_cargo === "delegado_geral" ||
      p.prolator_cargo === "delegado_corregedor" ||
      p.prolator_cargo === "corregedor" ||
      p.prolator_cargo === "coordenador";
    if (!podeRetificar) {
      throw new Error("Apenas Delegado Geral, Delegado Corregedor ou Corregedor podem retificar o denunciado.");
    }

    const { data: pol, error: polErr } = await context.supabase
      .from("denuncia_policiais")
      .select("*")
      .eq("id", data.policial_id)
      .single();
    if (polErr || !pol) throw new Error("Denunciado não encontrado.");

    const novoNome = data.nome.trim();
    const novaMat = (data.rg_funcional ?? "").trim() || null;
    const novaUnidade = data.unidade ?? null;
    const novoCargo = data.cargo ?? null;
    const antigoNome = pol.nome;
    const antigaMat = pol.rg_funcional ?? null;
    const antigaUnidade = pol.unidade ?? null;
    const antigoCargo = (pol as { cargo?: string | null }).cargo ?? null;

    const cargoMudou = novoCargo !== antigoCargo;
    if (
      novoNome === antigoNome &&
      novaMat === antigaMat &&
      novaUnidade === antigaUnidade &&
      !cargoMudou
    ) {
      return { changed: false };
    }

    if (
      cargoMudou &&
      p.prolator_cargo !== "delegado_corregedor" &&
      p.prolator_cargo !== "corregedor" &&
      p.prolator_cargo !== "coordenador"
    ) {
      throw new Error("Apenas Delegado Corregedor, Coordenador ou Corregedor podem alterar o cargo do denunciado.");
    }

    const { error: updErr } = await context.supabase
      .from("denuncia_policiais")
      .update({ nome: novoNome, rg_funcional: novaMat, unidade: novaUnidade, cargo: novoCargo })
      .eq("id", data.policial_id);
    if (updErr) throw new Error(updErr.message);

    const outrosMudaram =
      novoNome !== antigoNome || novaMat !== antigaMat || novaUnidade !== antigaUnidade;

    if (outrosMudaram) {
      const fmt = (n: string, m: string | null, u: string | null, c: string | null) =>
        `"${n} (${m ?? "sem matrícula"}${u ? `, ${u}` : ""}${c ? `, ${c}` : ""})"`;
      const motivoTxt = data.motivo?.trim() ? ` Motivo: ${data.motivo.trim()}.` : "";
      const teor =
        `Denunciado retificado de ${fmt(antigoNome, antigaMat, antigaUnidade, antigoCargo)} para ${fmt(novoNome, novaMat, novaUnidade, novoCargo)}.` +
        motivoTxt;

      const { error: movErr } = await context.supabase.from("movimentos").insert({
        denuncia_id: pol.denuncia_id,
        especie: "retificacao",
        teor,
        ...p,
      });
      if (movErr) throw new Error(movErr.message);
    }


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
        status: "recebida",
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

// Instauração de ofício pela Corregedoria (Delegado Geral, Corregedor
// ou Delegado Corregedor). Cria a denúncia já instaurada, com termo inicial
// no momento da criação e status 'em_investigacao', e registra um despacho
// inicial identificando a origem de ofício.
const oficioSchema = z.object({
  titulo: z.string().trim().min(3, "Informe o título.").max(300),
  descricao: z.string().trim().min(20, "Descreva os fatos.").max(20000),
  ocorrencia_data: z.string().optional().nullable(),
  unidade: z.enum(UNIDADES).optional().nullable(),
  envolvidos: z
    .array(
      z.object({
        nome: z.string().trim().min(1).max(200),
        rg_funcional: z.string().trim().max(50).optional().nullable(),
        unidade: z.enum(UNIDADES).optional().nullable(),
      }),
    )
    .min(1, "Adicione pelo menos um envolvido.")
    .max(20),
  links: z.array(z.string().url().max(1000)).max(20).default([]),
});

export const instaurarOficio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => oficioSchema.parse(data))
  .handler(async ({ data, context }) => {
    const p = await getProlator(context);
    if (
      p.prolator_cargo !== "delegado_geral" &&
      p.prolator_cargo !== "delegado_corregedor" &&
      p.prolator_cargo !== "corregedor" &&
      p.prolator_cargo !== "coordenador"
    ) {
      throw new Error("Apenas Delegado Geral, Delegado Corregedor, Coordenador ou Corregedor podem instaurar de ofício.");
    }

    const agora = new Date().toISOString();
    const { data: den, error } = await context.supabase
      .from("denuncias")
      .insert({
        owner_id: context.userId,
        denunciante_nome: p.prolator_nome,
        denunciante_anonimo: false,
        ocorrencia_tipo: data.titulo,
        ocorrencia_data: data.ocorrencia_data || null,
        relato: data.descricao,
        unidade: data.unidade ?? null,
        links: data.links,
        status: "novo",
        termo_inicial: agora,
        instaurada_em: agora,
        interrupcoes_count: 0,

      })
      .select("id, numero_protocolo")
      .single();
    if (error) throw new Error(error.message);

    const rows = data.envolvidos.map((e) => ({
      denuncia_id: den.id,
      nome: e.nome,
      rg_funcional: e.rg_funcional ?? null,
      unidade: e.unidade ?? null,
    }));
    await context.supabase.from("denuncia_policiais").insert(rows);

    await context.supabase.from("movimentos").insert({
      denuncia_id: den.id,
      especie: "despacho",
      teor:
        `INSTAURAÇÃO DE OFÍCIO — Procedimento instaurado pela Corregedoria com base em conhecimento próprio dos fatos.\n\n` +
        `Título: ${data.titulo}\n` +
        `Descrição: ${data.descricao}`,
      interrompe: false,
      ...p,
    });

    return { id: den.id, protocolo: den.numero_protocolo };
  });


// Envio de denúncia por Cidadão autenticado — vincula owner_id.
export const submitDenunciaCidadao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data, context }) => {
    const anon = data.denunciante_anonimo;
    const unidadeAuto = data.policiais.find((p) => p.unidade)?.unidade ?? null;
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
        unidade: unidadeAuto,
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

// ============ MINISTÉRIO PÚBLICO ============

// Lista todos os membros do MP cadastrados (para o painel de concessão).
// Só serve utilidade quando quem chama é Delegado — a RLS de profiles/user_roles
// já impede que MP ou Cidadão vejam outras contas.
export const listMembrosMp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as unknown as ReturnType<typeof publicClient>;
    const { data: roles, error } = await sb
      .from("user_roles")
      .select("user_id")
      .eq("role", "mp" as never);
    if (error) throw new Error(error.message);
    const ids = (roles ?? []).map((r: { user_id: string }) => r.user_id);
    if (!ids.length) return [] as Array<{ id: string; nome: string }>;
    const { data: profs } = await sb
      .from("profiles")
      .select("id, nome")
      .in("id", ids);
    return (profs ?? []) as Array<{ id: string; nome: string }>;
  });

// Lista quem tem acesso a uma denúncia.
export const listAcessosMp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ denuncia_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as ReturnType<typeof publicClient>;
    const { data: rows, error } = await sb
      .from("mp_acessos" as never)
      .select("id, mp_user_id, concedido_por, concedido_em")
      .eq("denuncia_id", data.denuncia_id)
      .order("concedido_em", { ascending: false });
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<{
      id: string;
      mp_user_id: string;
      concedido_por: string;
      concedido_em: string;
    }>;
    const userIds = Array.from(new Set(list.flatMap((r) => [r.mp_user_id, r.concedido_por])));
    if (!userIds.length) return [];
    const { data: profs } = await sb
      .from("profiles")
      .select("id, nome")
      .in("id", userIds);
    const nomes = new Map((profs ?? []).map((p: { id: string; nome: string }) => [p.id, p.nome]));
    return list.map((r) => ({
      id: r.id,
      mp_user_id: r.mp_user_id,
      mp_nome: nomes.get(r.mp_user_id) ?? "—",
      concedido_por: r.concedido_por,
      concedido_por_nome: nomes.get(r.concedido_por) ?? "—",
      concedido_em: r.concedido_em,
    }));
  });

export const concederAcessoMp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ denuncia_id: z.string().uuid(), mp_user_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as ReturnType<typeof publicClient>;
    const { error } = await sb.rpc("conceder_acesso_mp" as never, {
      _denuncia_id: data.denuncia_id,
      _mp_user_id: data.mp_user_id,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revogarAcessoMp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as ReturnType<typeof publicClient>;
    const { error } = await sb.from("mp_acessos" as never).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Painel MP — lista processos concedidos ao usuário logado.
export const listMeusProcessosMp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as unknown as ReturnType<typeof publicClient>;
    // A RLS já limita denuncias visíveis ao MP às concedidas.
    const { data, error } = await sb
      .from("denuncias")
      .select(
        "id, numero_protocolo, status, ocorrencia_tipo, unidade, created_at, instaurada_em",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Exclusão definitiva de denúncia (Delegado Geral / Delegado Corregedor).
// A permissão real é aplicada pela RLS (policy "Delegados excluem denuncias").
// FKs em movimentos, oitivas, denuncia_policiais e mp_acessos são ON DELETE CASCADE.
export const excluirDenuncia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        confirmar_protocolo: z.string().trim().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as ReturnType<typeof publicClient>;
    const { data: den, error: e1 } = await sb
      .from("denuncias")
      .select("id, numero_protocolo")
      .eq("id", data.id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!den) throw new Error("Denúncia não encontrada.");
    if (den.numero_protocolo !== data.confirmar_protocolo) {
      throw new Error("Número do procedimento não confere.");
    }
    const { error } = await sb.from("denuncias").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Cancela (anula) uma movimentação. Não apaga: marca como cancelada e gera
// um novo lançamento de auditoria de espécie "cancelamento".
// Autorização de cargo é validada dentro da SECURITY DEFINER `cancelar_movimento`.
export const cancelarMovimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        movimento_id: z.string().uuid(),
        motivo: z.string().trim().min(3, "Descreva a justificativa.").max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("cancelar_movimento", {
      _movimento_id: data.movimento_id,
      _motivo: data.motivo,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Exclusão silenciosa de movimentação — SOMENTE Delegado Corregedor.
// Não gera notificação nem registro de auditoria. Uso restrito e discricionário.
export const excluirMovimentoSilencioso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ movimento_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as ReturnType<typeof createClient<Database>>;
    const { data: rows, error: eRole } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .limit(1);
    if (eRole) throw new Error(eRole.message);
    const role = rows?.[0]?.role;
    if (role !== "delegado_corregedor" && role !== "coordenador") {
      throw new Error("Apenas o Delegado Corregedor pode executar esta ação.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("movimentos")
      .delete()
      .eq("id", data.movimento_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });



// ============ TARJAS DE SINALIZAÇÃO ============

const CORES_TARJA = ["vermelho", "amarelo", "verde", "azul"] as const;

export const adicionarTarja = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        denuncia_id: z.string().uuid(),
        cor: z.enum(CORES_TARJA),
        texto: z.string().trim().min(1).max(26),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("denuncia_tarjas")
      .insert({
        denuncia_id: data.denuncia_id,
        cor: data.cor,
        texto: data.texto,
        criado_por: context.userId,
      })
      .select("id, cor, texto")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const editarTarja = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        cor: z.enum(CORES_TARJA),
        texto: z.string().trim().min(1).max(26),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("denuncia_tarjas")
      .update({ cor: data.cor, texto: data.texto })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removerTarja = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("denuncia_tarjas")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });



