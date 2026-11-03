/* eslint-disable @typescript-eslint/no-explicit-any -- tabela e funções novas: o cliente tipado pode ainda não conhecê-las */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Ofícios: numeração CORREGPM 001/360/26 (reinicia a cada ano), guardados
 * no banco e exportados no timbre oficial. A cúpula (CG, SubCG, Supervisor)
 * expede direto; os demais redigem e encaminham para assinatura. Toda gravação
 * passa pelas funções SECURITY DEFINER do banco (criar_oficio, assinar_oficio…).
 */

export type StatusOficio = "aguardando_assinatura" | "devolvido" | "expedido" | "cancelado";

export interface Oficio {
  id: string;
  status: StatusOficio;
  numero: string | null;
  ano: number | null;
  sequencia: number | null;
  expedido_em: string | null;
  destinatario: string;
  referencia: string | null;
  assunto: string;
  corpo: string;
  denuncia_id: string | null;
  movimento_id: string | null;
  redator_id: string;
  redator_nome: string;
  redator_posto: string | null;
  redator_cargo: string;
  signatario_id: string | null;
  signatario_nome: string | null;
  signatario_posto: string | null;
  signatario_cargo: string | null;
  destinatarios: string[];
  recado: string | null;
  observacao_devolucao: string | null;
  devolvido_por_nome: string | null;
  cancelado_em: string | null;
  cancelado_por_nome: string | null;
  motivo_cancelamento: string | null;
  criado_em: string;
  atualizado_em: string;
  denuncias: { numero_procedimento: string | null; numero_protocolo: string } | null;
}

function erroOficios(error: { message?: string; code?: string } | null): Error {
  const msg = error?.message ?? "Falha ao processar o ofício.";
  if (
    error?.code === "42P01" ||
    error?.code === "PGRST202" ||
    error?.code === "PGRST205" ||
    (/oficio/i.test(msg) && /does not exist|could not find|schema cache/i.test(msg))
  ) {
    return new Error(
      "Os ofícios ainda não foram instalados no banco deste site (falta rodar o script SQL).",
    );
  }
  return new Error(msg);
}

const conteudo = z.object({
  destinatario: z.string().trim().min(3, "Informe a autoridade endereçada.").max(600),
  referencia: z.string().trim().max(300).optional().nullable(),
  assunto: z.string().trim().min(3, "Informe o assunto.").max(300),
  corpo: z.string().trim().min(3, "O texto do ofício está vazio.").max(30000),
  denuncia_id: z.string().uuid().optional().nullable(),
});
const encaminhamento = z.object({
  destinatarios: z.array(z.string().uuid()).max(10).default([]),
  recado: z.string().trim().max(500).optional().nullable(),
});

const SELECT = "*, denuncias(numero_procedimento, numero_protocolo)";

export const listOficios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const [{ data, error }, prox] = await Promise.all([
      sb.from("oficios").select(SELECT).order("criado_em", { ascending: false }).limit(1000),
      sb.rpc("oficio_proximo_numero"),
    ]);
    if (error) throw erroOficios(error);
    return {
      userId: context.userId,
      oficios: (data ?? []) as Oficio[],
      proximoNumero: (prox?.data as string | null) ?? null,
    };
  });

export const getOficio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().uuid().optional(), numero: z.string().trim().max(40).optional() })
      .refine((v) => v.id || v.numero, "Informe o ofício.")
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = (context.supabase as any).from("oficios").select(SELECT);
    q = data.id ? q.eq("id", data.id) : q.eq("numero", data.numero);
    const { data: row, error } = await q.maybeSingle();
    if (error) throw erroOficios(error);
    if (!row) throw new Error("Ofício não encontrado.");
    return row as Oficio;
  });

/** Quantos ofícios aguardam a assinatura do usuário (0 se o banco ainda não tem ofícios). */
export const contarOficiosParaAssinar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error } = await (context.supabase as any)
      .from("oficios")
      .select("id", { count: "exact", head: true })
      .eq("status", "aguardando_assinatura")
      .contains("destinatarios", [context.userId]);
    if (error) return 0;
    return count ?? 0;
  });

/** Sem destinatários: a cúpula expede na hora. Com destinatários: vai para assinatura. */
export const criarOficio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => conteudo.merge(encaminhamento).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await (context.supabase as any).rpc("criar_oficio", {
      _destinatario: data.destinatario,
      _referencia: data.referencia ?? null,
      _assunto: data.assunto,
      _corpo: data.corpo,
      _denuncia_id: data.denuncia_id ?? null,
      _destinatarios: data.destinatarios,
      _recado: data.recado ?? null,
    });
    if (error) throw erroOficios(error);
    return r as { id: string; numero: string | null };
  });

export const assinarOficio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => conteudo.extend({ oficio_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: numero, error } = await (context.supabase as any).rpc("assinar_oficio", {
      _oficio_id: data.oficio_id,
      _destinatario: data.destinatario,
      _referencia: data.referencia ?? null,
      _assunto: data.assunto,
      _corpo: data.corpo,
      _denuncia_id: data.denuncia_id ?? null,
    });
    if (error) throw erroOficios(error);
    return { numero: numero as string };
  });

export const reenviarOficio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    conteudo.merge(encaminhamento).extend({ oficio_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("reenviar_oficio", {
      _oficio_id: data.oficio_id,
      _destinatario: data.destinatario,
      _referencia: data.referencia ?? null,
      _assunto: data.assunto,
      _corpo: data.corpo,
      _denuncia_id: data.denuncia_id ?? null,
      _destinatarios: data.destinatarios,
      _recado: data.recado ?? null,
    });
    if (error) throw erroOficios(error);
    return { ok: true };
  });

export const devolverOficio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        oficio_id: z.string().uuid(),
        observacao: z.string().trim().min(3, "Escreva a observação para o redator.").max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("devolver_oficio", {
      _oficio_id: data.oficio_id,
      _observacao: data.observacao,
    });
    if (error) throw erroOficios(error);
    return { ok: true };
  });

export const cancelarOficio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        oficio_id: z.string().uuid(),
        motivo: z.string().trim().max(1000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("cancelar_oficio", {
      _oficio_id: data.oficio_id,
      _motivo: data.motivo ?? null,
    });
    if (error) throw erroOficios(error);
    return { ok: true };
  });
