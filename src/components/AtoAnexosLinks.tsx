import { useState } from "react";
import { Paperclip, ExternalLink, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getAnexoSignedUrl } from "@/lib/denuncias.functions";

export interface AtoAnexoRef {
  nome: string;
  path: string;
}

/**
 * Lista de rótulos clicáveis dos anexos (imagens-prova) juntados a um ato.
 * Clique abre a imagem em uma nova aba por URL assinada temporária.
 * Nunca renderiza a imagem inline.
 */
export function AtoAnexosLinks({ anexos }: { anexos: AtoAnexoRef[] }) {
  const getUrl = useServerFn(getAnexoSignedUrl);
  const [loading, setLoading] = useState<string | null>(null);

  if (!anexos || anexos.length === 0) return null;

  async function abrir(path: string) {
    setLoading(path);
    // Abre a aba já para não ser bloqueada pelo popup blocker; depois seta a URL.
    const win = window.open("about:blank", "_blank", "noopener,noreferrer");
    try {
      const { url } = await getUrl({ data: { path } });
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch (e) {
      win?.close();
      alert(e instanceof Error ? e.message : "Não foi possível abrir o anexo.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Paperclip className="h-3 w-3" aria-hidden /> Provas juntadas:
      </span>
      {anexos.map((a) => (
        <button
          key={a.path}
          type="button"
          onClick={() => abrir(a.path)}
          disabled={loading === a.path}
          className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-60"
        >
          {loading === a.path ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ExternalLink className="h-3 w-3" />
          )}
          {a.nome}
        </button>
      ))}
    </div>
  );
}
