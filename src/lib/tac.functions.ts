/* eslint-disable @typescript-eslint/no-explicit-any -- tabela e funções novas: o cliente tipado pode ainda não conhecê-las */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * TAC — Termo de Ajustamento de Conduta. Numeração 001/2026 (reinicia a cada
 * ano), reservada só ao celebrar. A cúpula (CG, SubCG, Supervisor) celebra; os
 * demais redigem e encaminham para assinatura. Requisitos, obrigações padrão e
 * cláusulas ficam em tac_config, editável pela cúpula; cada TAC guarda o texto
 * como foi assinado. Toda gravação passa pelas funções SECURITY DEFINER do banco.
 */

export type StatusTac =
  | "aguardando_assinatura"
  | "devolvido"
  | "em_cumprimento"
  | "cumprido"
  | "descumprido"
  | "cancelado";

export interface Tac {
  id: string;
  status: StatusTac;
  numero: string | null;
  ano: number | null;
  sequencia: number | null;
  celebrado_em: string | null;
  compromissario_nome: string;
  compromissario_posto: string | null;
  compromissario_re: string | null;
  compromissario_opm: string | null;
  origem_denuncia_id: string | null;
  origem_texto: string | null;
  data_fato: string | null;
  capitulacao: string | null;
  fato: string;
  requisitos: string[];
  obrigacoes: string[];
  clausula_descumprimento: string | null;
  disposicoes_finais: string | null;
  prazo_meses: number;
  inicio: string | null;
  fim: string | null;
  acompanhamento: string | null;
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
  encerrado_em: string | null;
  encerrado_por_nome: string | null;
  encerramento_obs: string | null;
  cancelado_em: string | null;
  cancelado_por_nome: string | null;
  motivo_cancelamento: string | null;
  criado_em: string;
  atualizado_em: string;
  denuncias: { numero_procedimento: string | null; numero_protocolo: string } | null;
}

export interface TacConfig {
  requisitos: string[];
  obrigacoes: string[];
  clausula_descumprimento: string;
  disposicoes_finais: string;
  atualizado_por_nome: string | null;
  atualizado_em: string;
}

function erroTac(error: { message?: string; code?: string } | null): Error {
  const msg = error?.message ?? "Falha ao processar o TAC.";
  if (
    error?.code === "42P01" ||
    error?.code === "PGRST202" ||
    error?.code === "PGRST205" ||
    (/tac/i.test(msg) && /does not exist|could not find|schema cache/i.test(msg))
  ) {
    return new Error(
      "O TAC ainda não foi instalado no banco deste site (falta rodar o script SQL).",
    );
  }
  return new Error(msg);
}

const texto = (max: number) => z.string().trim().max(max).optional().nullable();
export const dadosTacSchema = z.object({
  compromissario_nome: z.string().trim().min(3, "Informe o compromissário.").max(150),
  compromissario_posto: texto(60),
  compromissario_re: texto(30),
  compromissario_opm: texto(120),
  origem_denuncia_id: z.string().uuid().optional().nullable(),
  origem_texto: texto(150),
  data_fato: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data do fato inválida.")
    .optional()
    .nullable()
    .or(z.literal("")),
  capitulacao: texto(300),
  fato: z.string().trim().min(10, "Descreva o fato.").max(20000),
  requisitos: z.array(z.string().trim().min(2).max(500)).min(1, "Informe os requisitos.").max(30),
  obrigacoes: z
    .array(z.string().trim().min(2).max(800))
    .min(1, "Informe ao menos uma obrigação.")
    .max(30),
  prazo_meses: z.number().int().min(1).max(24),
  acompanhamento: texto(500),
});
export type DadosTac = z.infer<typeof dadosTacSchema>;
const encaminhamento = z.object({
  destinatarios: z.array(z.string().uuid()).max(10).default([]),
  recado: z.string().trim().max(500).optional().nullable(),
});

const SELECT = "*, denuncias:origem_denuncia_id(numero_procedimento, numero_protocolo)";

export const listTacs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const [{ data, error }, cfg, prox] = await Promise.all([
      sb.from("tacs").select(SELECT).order("criado_em", { ascending: false }).limit(1000),
      sb.from("tac_config").select("*").eq("id", 1).maybeSingle(),
      sb.rpc("tac_proximo_numero"),
    ]);
    if (error) throw erroTac(error);
    return {
      userId: context.userId,
      tacs: (data ?? []) as Tac[],
      config: (cfg?.data ?? null) as TacConfig | null,
      proximoNumero: (prox?.data as string | null) ?? null,
    };
  });

export const getTac = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().uuid().optional(), numero: z.string().trim().max(20).optional() })
      .refine((v) => v.id || v.numero, "Informe o TAC.")
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = (context.supabase as any).from("tacs").select(SELECT);
    q = data.id ? q.eq("id", data.id) : q.eq("numero", data.numero);
    const { data: row, error } = await q.maybeSingle();
    if (error) throw erroTac(error);
    if (!row) throw new Error("TAC não encontrado.");
    return row as Tac;
  });

/** TACs aguardando a assinatura do usuário (0 se o banco ainda não tem TAC). */
export const contarTacsParaAssinar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error } = await (context.supabase as any)
      .from("tacs")
      .select("id", { count: "exact", head: true })
      .eq("status", "aguardando_assinatura")
      .contains("destinatarios", [context.userId]);
    if (error) return 0;
    return count ?? 0;
  });

export const salvarTacConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        requisitos: z
          .array(z.string().trim().min(2).max(500))
          .min(1, "Informe ao menos um requisito.")
          .max(30),
        obrigacoes: z.array(z.string().trim().min(2).max(800)).max(30),
        clausula_descumprimento: z.string().trim().min(10).max(3000),
        disposicoes_finais: z.string().trim().min(10).max(3000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("salvar_tac_config", {
      _requisitos: data.requisitos,
      _obrigacoes: data.obrigacoes,
      _descumprimento: data.clausula_descumprimento,
      _finais: data.disposicoes_finais,
    });
    if (error) throw erroTac(error);
    return { ok: true };
  });

const limpar = (d: DadosTac) => ({ ...d, data_fato: d.data_fato || null });

/** Sem destinatários: a cúpula celebra na hora. Com destinatários: vai para assinatura. */
export const criarTac = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ dados: dadosTacSchema }).merge(encaminhamento).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: r, error } = await (context.supabase as any).rpc("criar_tac", {
      _dados: limpar(data.dados),
      _destinatarios: data.destinatarios,
      _recado: data.recado ?? null,
    });
    if (error) throw erroTac(error);
    return r as { id: string; numero: string | null };
  });

export const assinarTac = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ tac_id: z.string().uuid(), dados: dadosTacSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: numero, error } = await (context.supabase as any).rpc("assinar_tac", {
      _tac_id: data.tac_id,
      _dados: limpar(data.dados),
    });
    if (error) throw erroTac(error);
    return { numero: numero as string };
  });

export const reenviarTac = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ tac_id: z.string().uuid(), dados: dadosTacSchema }).merge(encaminhamento).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("reenviar_tac", {
      _tac_id: data.tac_id,
      _dados: limpar(data.dados),
      _destinatarios: data.destinatarios,
      _recado: data.recado ?? null,
    });
    if (error) throw erroTac(error);
    return { ok: true };
  });

export const devolverTac = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tac_id: z.string().uuid(),
        observacao: z.string().trim().min(3, "Escreva a observação para o redator.").max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("devolver_tac", {
      _tac_id: data.tac_id,
      _observacao: data.observacao,
    });
    if (error) throw erroTac(error);
    return { ok: true };
  });

export const encerrarTac = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tac_id: z.string().uuid(),
        cumprido: z.boolean(),
        obs: z.string().trim().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("encerrar_tac", {
      _tac_id: data.tac_id,
      _cumprido: data.cumprido,
      _obs: data.obs ?? null,
    });
    if (error) throw erroTac(error);
    return { ok: true };
  });

export const cancelarTac = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tac_id: z.string().uuid(),
        motivo: z.string().trim().max(1000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("cancelar_tac", {
      _tac_id: data.tac_id,
      _motivo: data.motivo ?? null,
    });
    if (error) throw erroTac(error);
    return { ok: true };
  });
