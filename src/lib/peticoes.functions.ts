/* eslint-disable @typescript-eslint/no-explicit-any -- tabela e espaço novos: o cliente tipado pode ainda não conhecê-los */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isInternalRole } from "@/lib/access-roles";

/**
 * Petições em PDF enviadas pelo denunciante (petições de advogado,
 * procurações, laudos…). Ficam no espaço privado "denuncia-pdfs" por 30 dias;
 * depois o arquivo é expurgado e só o registro (nome, data, páginas) fica no
 * processo. Os arquivos são gravados, abertos e apagados só pelo servidor
 * (chave de serviço); quem vê o registro é quem já vê o processo.
 */

export const BUCKET_PETICOES = "denuncia-pdfs";
export const PETICOES_MAX_ARQUIVOS = 5;
export const PETICOES_MAX_BYTES = 10 * 1024 * 1024;
export const PETICOES_DIAS = 30;

export interface Peticao {
  id: string;
  denuncia_id: string;
  nome: string;
  path: string;
  tamanho: number;
  paginas: number | null;
  enviado_em: string;
  expira_em: string;
  removido_em: string | null;
  removido_por_nome: string | null;
}

/** PDF já enviado ao espaço temporário, aguardando o envio da denúncia. */
export const peticaoEnviadaSchema = z.object({
  path: z.string().regex(/^entrada\/[0-9a-f-]{36}\.pdf$/i, "Arquivo enviado inválido."),
  nome: z.string().trim().min(1).max(200),
  paginas: z.number().int().min(0).max(5000).optional().nullable(),
});
export type PeticaoEnviada = z.infer<typeof peticaoEnviadaSchema>;

export function naoInstalado(error: { message?: string; code?: string } | null): boolean {
  const msg = error?.message ?? "";
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    error?.code === "PGRST202" ||
    /bucket not found/i.test(msg) ||
    (/denuncia_peticoes|peticoes_pode_limpar/i.test(msg) &&
      /does not exist|could not find|schema cache/i.test(msg))
  );
}

export function erroPeticoes(error: { message?: string; code?: string } | null): Error {
  if (naoInstalado(error)) {
    return new Error(
      "O envio de PDFs ainda não foi instalado no banco deste site (falta rodar o script SQL).",
    );
  }
  return new Error(error?.message ?? "Falha ao processar o PDF.");
}

/* ------------ envio (canal público, com ou sem login) ------------ */

/**
 * Reserva um endereço temporário e devolve um token de envio de uso único:
 * o navegador manda o PDF direto ao espaço privado, sem passar pelo site.
 */
export const prepararEnvioPeticao = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        nome: z.string().trim().min(1).max(200),
        tamanho: z
          .number()
          .int()
          .min(1, "Arquivo vazio.")
          .max(PETICOES_MAX_BYTES, "Cada PDF pode ter no máximo 10 MB."),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (!/\.pdf$/i.test(data.nome)) throw new Error("Envie apenas arquivos em PDF.");
    const sb = await (await import("@/lib/peticoes.server")).admin();
    const path = `entrada/${crypto.randomUUID()}.pdf`;
    const { data: r, error } = await sb.storage.from(BUCKET_PETICOES).createSignedUploadUrl(path);
    if (error || !r) throw erroPeticoes(error);
    return { path, token: r.token as string, bucket: BUCKET_PETICOES };
  });

/* ------------ consulta (equipe) ------------ */

export const listPeticoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ denuncia_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("denuncia_peticoes")
      .select("*")
      .eq("denuncia_id", data.denuncia_id)
      .order("enviado_em", { ascending: true });
    if (error) {
      if (naoInstalado(error)) return [] as Peticao[];
      throw erroPeticoes(error);
    }
    return (rows ?? []) as Peticao[];
  });

/** Endereço temporário (1 h) para abrir ou baixar a petição. */
export const abrirPeticao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), baixar: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // A leitura com o usuário confere se ele pode ver o processo.
    const { data: p, error } = await (context.supabase as any)
      .from("denuncia_peticoes")
      .select("id, nome, path, removido_em")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw erroPeticoes(error);
    if (!p) throw new Error("Petição não encontrada.");
    if (p.removido_em) throw new Error("Este PDF já foi expurgado do sistema (prazo de 30 dias).");
    const sb = await (await import("@/lib/peticoes.server")).admin();
    const { data: signed, error: e2 } = await sb.storage
      .from(BUCKET_PETICOES)
      .createSignedUrl(p.path, 60 * 60, data.baixar ? { download: p.nome } : undefined);
    if (e2 || !signed) throw new Error(e2?.message ?? "Não foi possível abrir o PDF.");
    return { url: signed.signedUrl as string, nome: p.nome as string };
  });

/* ------------ expurgo ------------ */

async function cargoDoUsuario(context: { supabase: any; userId: string }): Promise<string | null> {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .maybeSingle();
  return (data?.role as string | undefined) ?? null;
}

async function exigirCupula(context: { supabase: any }): Promise<void> {
  const { data, error } = await context.supabase.rpc("peticoes_pode_limpar");
  if (error) throw erroPeticoes(error);
  if (!data) {
    throw new Error(
      "Só o Corregedor-Geral, o Subcorregedor-Geral e o Corregedor Supervisor podem limpar os PDFs.",
    );
  }
}

/**
 * Faxina automática: roda quando a equipe abre a Corregedoria e só apaga o
 * que já venceu. Silenciosa (nunca derruba a tela).
 */
export const faxinaPeticoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      if (!isInternalRole(await cargoDoUsuario(context as any))) return { removidos: 0 };
      const { expurgar } = await import("@/lib/peticoes.server");
      const r = await expurgar(false, null);
      return { removidos: r.removidos };
    } catch (e) {
      if (!naoInstalado(e as { message?: string })) console.error("[peticoes] faxina", e);
      return { removidos: 0 };
    }
  });

export const resumoPeticoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirCupula(context as any);
    const srv = await import("@/lib/peticoes.server");
    const sb = await srv.admin();
    const { data, error } = await sb
      .from("denuncia_peticoes")
      .select("tamanho, expira_em")
      .is("removido_em", null)
      .limit(10000);
    if (error) throw erroPeticoes(error);
    const agora = Date.now();
    const lista = (data ?? []) as Array<{ tamanho: number; expira_em: string }>;
    const vencidas = lista.filter((p) => new Date(p.expira_em).getTime() <= agora);
    const limite = agora - 24 * 60 * 60 * 1000;
    const entrada = await srv.arquivosNaPasta(sb, "entrada");
    return {
      armazenados: lista.length,
      bytes: lista.reduce((s, p) => s + (p.tamanho ?? 0), 0),
      vencidos: vencidas.length,
      bytesVencidos: vencidas.reduce((s, p) => s + (p.tamanho ?? 0), 0),
      abandonados: entrada.filter((a) => (a.criado ? new Date(a.criado).getTime() < limite : false))
        .length,
    };
  });

export const limparPeticoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        modo: z.enum(["vencidas", "todas"]),
        confirmacao: z.string().trim().max(40).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await exigirCupula(context as any);
    if (data.modo === "todas" && (data.confirmacao ?? "").toUpperCase() !== "PETICOES") {
      throw new Error("Digite exatamente PETICOES para confirmar.");
    }
    const { data: perfil } = await (context.supabase as any)
      .from("profiles")
      .select("nome")
      .eq("id", context.userId)
      .maybeSingle();
    const { expurgar } = await import("@/lib/peticoes.server");
    return expurgar(data.modo === "todas", (perfil?.nome as string | undefined) ?? "Cúpula");
  });
