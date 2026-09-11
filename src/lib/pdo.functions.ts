import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DESFECHOS = ["regular", "sanada", "gera_procedimento"] as const;
const ESTADOS = ["conforme", "nao_conforme", "nao_aplicavel"] as const;

const membroSchema = z.object({
  cargo: z.string().trim().max(80).default(""),
  nome: z.string().trim().max(200),
  matricula: z.string().trim().max(80).default(""),
});
const abordadoSchema = z.object({
  nome: z.string().trim().max(200),
  matricula: z.string().trim().max(80).default(""),
  cargo: z.string().trim().max(80).default(""),
});
const itemSchema = z.object({
  chave: z.string().trim().min(1).max(60),
  estado: z.enum(ESTADOS),
  observacao: z.string().trim().max(1000).default(""),
});

const createSchema = z.object({
  abordagem_em: z.string().min(1),
  local: z.string().trim().min(1).max(300),
  vtr_prefixo: z.string().trim().max(50).default(""),
  vtr_placa: z.string().trim().max(20).default(""),
  vtr_unidade: z.string().trim().max(80).default(""),
  equipe: z.array(membroSchema).min(1).max(20),
  abordados: z.array(abordadoSchema).max(4),
  itens: z.array(itemSchema).max(20),
  desfecho: z.enum(DESFECHOS),
  relato: z.string().trim().max(4000).default(""),
});

async function requireStaff(context: { supabase: any; userId: string }) {
  const [{ data: prof }, { data: role }] = await Promise.all([
    context.supabase.from("profiles").select("nome, status").eq("id", context.userId).maybeSingle(),
    context.supabase.from("user_roles").select("role").eq("user_id", context.userId).maybeSingle(),
  ]);
  if (!prof || prof.status !== "ativo" || !role) throw new Error("Usuário sem cargo ativo.");
  const cargo = (role as { role: string }).role;
  if (cargo === "cidadao" || cargo === "mp") throw new Error("Sem acesso ao módulo PDO.");
  return { nome: (prof as { nome: string }).nome, cargo };
}

export const createPdo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const me = await requireStaff(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: numRow, error: eNum } = await supabaseAdmin.rpc("gerar_numero_pdo" as never);
    if (eNum) throw new Error(eNum.message);
    const numero = numRow as unknown as string;

    const { data: inserted, error } = await (context.supabase as any)
      .from("pdos")
      .insert({
        numero,
        abordagem_em: data.abordagem_em,
        local: data.local,
        vtr_prefixo: data.vtr_prefixo || null,
        vtr_placa: data.vtr_placa || null,
        vtr_unidade: data.vtr_unidade || null,
        equipe: data.equipe,
        abordados: data.abordados,
        itens: data.itens,
        desfecho: data.desfecho,
        relato: data.relato || null,
        lavrado_por: context.userId,
        lavrado_por_nome: me.nome,
        lavrado_por_cargo: me.cargo,
      })
      .select("id, numero")
      .single();
    if (error) throw new Error(error.message);
    return inserted as { id: string; numero: string };
  });

export const listPdos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("pdos")
      .select(
        "id, numero, abordagem_em, local, vtr_prefixo, vtr_placa, vtr_unidade, desfecho, procedimento_numero, abordados, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

export const getPdo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase as any)
      .from("pdos")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return row as any;
  });

const denunciadoSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  matricula: z.string().trim().max(80).default(""),
  cargo: z.string().trim().max(80).default(""),
});

// Gera procedimento (denúncia) a partir de um PDO com desfecho "gera_procedimento".
export const gerarProcedimentoDoPdo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        pdo_id: z.string().uuid(),
        unidade: z.string().trim().max(80).optional().nullable(),
        relato: z.string().trim().min(1).max(8000),
        denunciados: z.array(denunciadoSchema).min(1).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const me = await requireStaff(context as any);
    if (!["corregedor_geral", "ssp", "corregedor", "subcorregedor_geral"].includes(me.cargo)) {
      throw new Error("Sem permissão para gerar procedimento.");
    }
    const sb = context.supabase as any;

    const { data: pdo, error: e1 } = await sb.from("pdos").select("*").eq("id", data.pdo_id).single();
    if (e1) throw new Error(e1.message);
    if (pdo.desfecho !== "gera_procedimento")
      throw new Error("Só o desfecho 'Irregularidade que origina procedimento' pode gerar denúncia.");
    if (pdo.procedimento_id) throw new Error("Este PDO já originou um procedimento.");

    const { data: den, error: e2 } = await sb
      .from("denuncias")
      .insert({
        denunciante_nome: pdo.lavrado_por_nome,
        denunciante_anonimo: false,
        ocorrencia_tipo: "Diligência Corregedoria (PDO)",
        ocorrencia_local: pdo.local,
        relato: data.relato,
        unidade: data.unidade ?? pdo.vtr_unidade ?? null,
        info_adicional: `Originado do ${pdo.numero}.`,
      })
      .select("id, numero_protocolo")
      .single();
    if (e2) throw new Error(e2.message);

    const rows = data.denunciados.map((p) => ({
      denuncia_id: den.id,
      nome: p.nome,
      rg_funcional: p.matricula || null,
      unidade: pdo.vtr_unidade || null,
    }));
    const { error: e4 } = await sb.from("denuncia_policiais").insert(rows);
    if (e4) throw new Error(e4.message);

    const { error: e3 } = await sb
      .from("pdos")
      .update({ procedimento_id: den.id, procedimento_numero: den.numero_protocolo })
      .eq("id", data.pdo_id);
    if (e3) throw new Error(e3.message);

    return { protocolo: den.numero_protocolo as string, denuncia_id: den.id as string };
  });

export const excluirPdo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const me = await requireStaff(context as any);
    if (me.cargo !== "corregedor_geral" && me.cargo !== "subcorregedor_geral") {
      throw new Error("Apenas o Corregedor-Geral pode excluir PDOs.");
    }
    const { error } = await (context.supabase as any).from("pdos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
