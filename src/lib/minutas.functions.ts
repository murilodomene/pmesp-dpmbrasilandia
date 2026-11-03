/* eslint-disable @typescript-eslint/no-explicit-any -- tabela e funções novas: o cliente tipado pode ainda não conhecê-las */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ESPECIES, portariaDadosSchema } from "@/lib/denuncias.functions";
import type { Json } from "@/integrations/supabase/types";

/**
 * Minutas para assinatura: quem redige encaminha o ato para uma ou mais
 * autoridades; uma delas revisa, pode editar e assina. O ato entra no
 * processo com a autoridade como assinante e quem encaminhou como Escrivão.
 * Toda gravação passa pelas funções SECURITY DEFINER do banco
 * (encaminhar_minuta, assinar_minuta, …), que conferem cargo e situação.
 */

export const ESPECIES_MINUTA = [...ESPECIES, "portaria"] as const;
export type EspecieMinuta = (typeof ESPECIES_MINUTA)[number];
export type StatusMinuta = "pendente" | "assinada" | "devolvida" | "cancelada";

export interface Minuta {
  id: string;
  denuncia_id: string;
  especie: EspecieMinuta;
  teor: string;
  dados: { [key: string]: Json | undefined };
  anexos: Array<{ nome: string; path: string }>;
  autor_id: string;
  autor_nome: string;
  autor_posto: string | null;
  autor_cargo: string;
  destinatarios: string[];
  recado: string | null;
  status: StatusMinuta;
  observacao_devolucao: string | null;
  devolvida_por_nome: string | null;
  assinada_por_id: string | null;
  assinada_por_nome: string | null;
  assinada_em: string | null;
  movimento_id: string | null;
  criado_em: string;
  atualizado_em: string;
  denuncias: {
    numero_procedimento: string | null;
    numero_protocolo: string;
    tipo_procedimento: string | null;
  } | null;
}

export interface AssinanteMinuta {
  id: string;
  nome: string;
  posto_graduacao: string | null;
  cargo: string;
}

/** Mensagem amigável quando o script do banco ainda não foi rodado. */
function erroMinutas(error: { message?: string; code?: string } | null): Error {
  const msg = error?.message ?? "Falha ao processar a minuta.";
  if (
    error?.code === "42P01" ||
    error?.code === "PGRST202" ||
    error?.code === "PGRST205" ||
    (/minutas|minuta_/i.test(msg) && /does not exist|could not find|schema cache/i.test(msg))
  ) {
    return new Error(
      "As minutas ainda não foram instaladas no banco deste site (falta rodar o script SQL).",
    );
  }
  return new Error(msg);
}

const anexosSchema = z
  .array(
    z.object({ nome: z.string().trim().min(1).max(120), path: z.string().trim().min(1).max(500) }),
  )
  .max(30)
  .default([]);

/** Campos extras do formulário (ata e solução) ou os campos da portaria. */
const camposSchema = z
  .object({
    ataDepoente: z.string().trim().max(500).optional(),
    ipcUnidade: z.string().trim().max(120).optional(),
    ipcIdent: z.string().trim().max(2000).optional(),
  })
  .strict();

/** Portaria encaminhada: o signatário é preenchido por quem assinar. */
const portariaMinutaSchema = portariaDadosSchema.extend({
  signatarioNome: z.string().trim().max(200).optional().default(""),
  signatarioPosto: z.string().trim().max(100).optional().default(""),
  localData: z.string().trim().max(150).optional().default(""),
});

const conteudoSchema = z.object({
  especie: z.enum(ESPECIES_MINUTA),
  teor: z.string().trim().min(3, "A minuta está vazia.").max(30000),
  dados: z.unknown().optional(),
  anexos: anexosSchema,
  destinatarios: z.array(z.string().uuid()).min(1, "Escolha ao menos uma autoridade.").max(10),
  recado: z.string().trim().max(500).optional().nullable(),
});

/** Confere os campos extras conforme o tipo de ato. */
function normalizarDados<T extends z.infer<typeof conteudoSchema>>(
  v: T,
): T & { dados: Record<string, unknown> } {
  const dados =
    v.especie === "portaria"
      ? (portariaMinutaSchema.parse(v.dados) as Record<string, unknown>)
      : (camposSchema.parse(v.dados ?? {}) as Record<string, unknown>);
  return { ...v, dados };
}

export const listAssinantesMinuta = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any).rpc("listar_assinantes_minuta");
    if (error) throw erroMinutas(error);
    return (data ?? []) as AssinanteMinuta[];
  });

export const listMinutas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("minutas")
      .select("*, denuncias(numero_procedimento, numero_protocolo, tipo_procedimento)")
      .order("atualizado_em", { ascending: false })
      .limit(500);
    if (error) throw erroMinutas(error);
    return { userId: context.userId, minutas: (data ?? []) as Minuta[] };
  });

/** Quantas minutas aguardam a assinatura do usuário (0 se o banco ainda não tem minutas). */
export const contarMinutasParaAssinar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error } = await (context.supabase as any)
      .from("minutas")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente")
      .contains("destinatarios", [context.userId]);
    if (error) return 0;
    return count ?? 0;
  });

export const encaminharMinuta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    normalizarDados(conteudoSchema.extend({ denuncia_id: z.string().uuid() }).parse(d)),
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await (context.supabase as any).rpc("encaminhar_minuta", {
      _denuncia_id: data.denuncia_id,
      _especie: data.especie,
      _teor: data.teor,
      _dados: data.dados,
      _anexos: data.anexos,
      _destinatarios: data.destinatarios,
      _recado: data.recado ?? null,
    });
    if (error) throw erroMinutas(error);
    return { id: id as string };
  });

export const reenviarMinuta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    normalizarDados(conteudoSchema.extend({ minuta_id: z.string().uuid() }).parse(d)),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("reenviar_minuta", {
      _minuta_id: data.minuta_id,
      _teor: data.teor,
      _dados: data.dados,
      _anexos: data.anexos,
      _destinatarios: data.destinatarios,
      _recado: data.recado ?? null,
    });
    if (error) throw erroMinutas(error);
    return { ok: true };
  });

/**
 * Assina a minuta e lança o ato. `teor` é o texto final já revisado
 * (montado como no "Lançar ato"); na Portaria vão também os campos.
 */
export const assinarMinuta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        minuta_id: z.string().uuid(),
        teor: z.string().trim().min(3, "O texto do ato está vazio.").max(30000),
        portaria: portariaDadosSchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: movimentoId, error } = await (context.supabase as any).rpc("assinar_minuta", {
      _minuta_id: data.minuta_id,
      _teor: data.portaria ? data.portaria.corpo : data.teor,
      _dados: data.portaria ?? {},
    });
    if (error) throw erroMinutas(error);
    return { movimento_id: movimentoId as string };
  });

export const devolverMinuta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        minuta_id: z.string().uuid(),
        observacao: z.string().trim().min(3, "Escreva a observação para o escrivão.").max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("devolver_minuta", {
      _minuta_id: data.minuta_id,
      _observacao: data.observacao,
    });
    if (error) throw erroMinutas(error);
    return { ok: true };
  });

export const cancelarMinuta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ minuta_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("cancelar_minuta", {
      _minuta_id: data.minuta_id,
    });
    if (error) throw erroMinutas(error);
    return { ok: true };
  });
