/* eslint-disable @typescript-eslint/no-explicit-any -- tabela e espaço novos: o cliente tipado pode ainda não conhecê-los */
/**
 * Petições do denunciante — rotinas só do servidor (chave de serviço).
 * Importadas dinamicamente pelos handlers de peticoes.functions.ts e
 * denuncias.functions.ts; nunca vão para o navegador.
 */
import {
  BUCKET_PETICOES,
  PETICOES_DIAS,
  PETICOES_MAX_ARQUIVOS,
  PETICOES_MAX_BYTES,
  erroPeticoes,
  naoInstalado,
  type PeticaoEnviada,
} from "@/lib/peticoes.functions";

export async function admin(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export function nomePdf(nome: string): string {
  const limpo = nome
    // eslint-disable-next-line no-control-regex -- remove caracteres de controle do nome do arquivo
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const base = limpo || "documento";
  return /\.pdf$/i.test(base) ? base.slice(0, 200) : `${base.slice(0, 195)}.pdf`;
}

/**
 * Junta à denúncia os PDFs enviados no formulário: confere se é PDF de
 * verdade e o tamanho, move para a pasta da denúncia e grava o registro.
 * Uso interno do servidor (chamado ao registrar a denúncia).
 * Devolve quantos arquivos não puderam ser juntados.
 */
export async function vincularPeticoesDenuncia(
  denunciaId: string,
  lista: PeticaoEnviada[],
): Promise<number> {
  if (!lista.length) return 0;
  const sb = await admin();
  let falhas = 0;
  for (const p of lista.slice(0, PETICOES_MAX_ARQUIVOS)) {
    try {
      const { data: blob, error } = await sb.storage.from(BUCKET_PETICOES).download(p.path);
      if (error || !blob) throw error ?? new Error("Arquivo não encontrado.");
      const cabecalho = new TextDecoder("latin1").decode(
        new Uint8Array(await blob.slice(0, 1024).arrayBuffer()),
      );
      if (blob.size > PETICOES_MAX_BYTES || !cabecalho.includes("%PDF-")) {
        await sb.storage.from(BUCKET_PETICOES).remove([p.path]);
        throw new Error("Arquivo recusado (não é PDF ou passa de 10 MB).");
      }
      const destino = `${denunciaId}/${p.path.slice("entrada/".length)}`;
      const mv = await sb.storage.from(BUCKET_PETICOES).move(p.path, destino);
      if (mv.error) throw mv.error;
      const ins = await sb.from("denuncia_peticoes").insert({
        denuncia_id: denunciaId,
        nome: nomePdf(p.nome),
        path: destino,
        tamanho: blob.size,
        paginas: p.paginas ?? null,
      });
      if (ins.error) {
        await sb.storage.from(BUCKET_PETICOES).remove([destino]);
        throw ins.error;
      }
    } catch (e) {
      falhas += 1;
      console.error("[peticoes] falha ao juntar PDF à denúncia", e);
    }
  }
  return falhas;
}

/** Id da denúncia pelo protocolo (o canal anônimo só devolve o protocolo). */
export async function idDenunciaPorProtocolo(protocolo: string): Promise<string | null> {
  const sb = await admin();
  const { data } = await sb
    .from("denuncias")
    .select("id")
    .eq("numero_protocolo", protocolo)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function arquivosNaPasta(
  sb: any,
  pasta: string,
): Promise<Array<{ path: string; criado: string | null }>> {
  const out: Array<{ path: string; criado: string | null }> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.storage
      .from(BUCKET_PETICOES)
      .list(pasta, { limit: 1000, offset });
    if (error || !data?.length) break;
    for (const e of data) {
      const full = pasta ? `${pasta}/${e.name}` : e.name;
      if (e.id === null || e.metadata === null) out.push(...(await arquivosNaPasta(sb, full)));
      else out.push({ path: full, criado: e.created_at ?? null });
    }
    if (data.length < 1000) break;
  }
  return out;
}

async function removerArquivos(sb: any, paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await sb.storage.from(BUCKET_PETICOES).remove(paths.slice(i, i + 100));
    if (error) throw error;
  }
}

/**
 * Expurga os PDFs vencidos (ou todos) e os envios abandonados (PDF enviado
 * e denúncia não registrada) com mais de 24 h. O registro fica no processo.
 */
export async function expurgar(
  todas: boolean,
  porNome: string | null,
): Promise<{ removidos: number; abandonados: number }> {
  const sb = await admin();
  let q = sb.from("denuncia_peticoes").select("id, path").is("removido_em", null);
  if (!todas) q = q.lte("expira_em", new Date().toISOString());
  const { data: vencidas, error } = await q.limit(1000);
  if (error) throw erroPeticoes(error);
  const lista = (vencidas ?? []) as Array<{ id: string; path: string }>;
  if (lista.length) {
    await removerArquivos(
      sb,
      lista.map((v) => v.path),
    );
    const up = await sb
      .from("denuncia_peticoes")
      .update({
        removido_em: new Date().toISOString(),
        removido_por_nome: porNome ?? `Expurgo automático (${PETICOES_DIAS} dias)`,
      })
      .in(
        "id",
        lista.map((v) => v.id),
      );
    if (up.error) throw erroPeticoes(up.error);
  }

  const limite = Date.now() - 24 * 60 * 60 * 1000;
  const entrada = (await arquivosNaPasta(sb, "entrada")).filter(
    (a) => todas || (a.criado ? new Date(a.criado).getTime() < limite : false),
  );
  if (entrada.length)
    await removerArquivos(
      sb,
      entrada.map((a) => a.path),
    );

  // "Limpar todos": apaga também o que sobrou de processos já excluídos.
  if (todas) {
    const resto = (await arquivosNaPasta(sb, "")).map((a) => a.path);
    if (resto.length) await removerArquivos(sb, resto);
  }
  return { removidos: lista.length, abandonados: entrada.length };
}

/** Uso interno: apaga todos os arquivos (ex.: quando a Manutenção limpa os processos). */
export async function apagarTodosOsPdfsDeDenunciantes(): Promise<void> {
  try {
    await expurgar(true, "Limpeza dos processos (Manutenção)");
  } catch (e) {
    if (!naoInstalado(e as { message?: string })) throw e;
  }
}

/** Uso interno: apaga os PDFs de um processo excluído (o registro some junto, em cascata). */
export async function apagarPdfsDaDenuncia(denunciaId: string): Promise<void> {
  const sb = await admin();
  const arquivos = (await arquivosNaPasta(sb, denunciaId)).map((a) => a.path);
  if (arquivos.length) await removerArquivos(sb, arquivos);
}
