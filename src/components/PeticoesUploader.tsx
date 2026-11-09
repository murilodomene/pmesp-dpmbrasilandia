import { useRef, useState } from "react";
import { FileText, Loader2, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  PETICOES_DIAS,
  PETICOES_MAX_ARQUIVOS,
  PETICOES_MAX_BYTES,
  prepararEnvioPeticao,
} from "@/lib/peticoes.functions";

export interface PeticaoLocal {
  path: string;
  nome: string;
  paginas: number | null;
  tamanho: number;
}

interface Props {
  value: PeticaoLocal[];
  onChange: (next: PeticaoLocal[]) => void;
  /** Avisa o formulário enquanto há envio em andamento. */
  onEnviando?: (n: number) => void;
  disabled?: boolean;
}

export function tamanhoLegivel(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Conta as páginas no navegador; null se o PDF não puder ser lido. */
async function contarPaginas(bytes: ArrayBuffer): Promise<number | null> {
  try {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    return doc.getPageCount();
  } catch {
    return null;
  }
}

/**
 * Envio de petições em PDF pelo denunciante (até 5 arquivos de 10 MB).
 * Cada arquivo vai direto ao espaço privado com um token de uso único;
 * a denúncia só junta os arquivos ao ser registrada.
 */
export function PeticoesUploader({ value, onChange, onEnviando, disabled }: Props) {
  const preparar = useServerFn(prepararEnvioPeticao);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [enviando, setEnviando] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  async function handleFiles(files: FileList | File[]) {
    setErro(null);
    const todos = Array.from(files);
    const pdfs = todos.filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    const erros: string[] = [];
    if (pdfs.length < todos.length) erros.push("Somente arquivos em PDF são aceitos.");
    const vagas = PETICOES_MAX_ARQUIVOS - value.length - enviando.length;
    if (pdfs.length > vagas)
      erros.push(`No máximo ${PETICOES_MAX_ARQUIVOS} arquivos por denúncia.`);
    const fila = pdfs.slice(0, Math.max(0, vagas));
    let acc = [...value];
    for (const file of fila) {
      if (file.size > PETICOES_MAX_BYTES) {
        erros.push(`"${file.name}" passa de 10 MB.`);
        continue;
      }
      setEnviando((e) => [...e, file.name]);
      onEnviando?.(1);
      try {
        const bytes = await file.arrayBuffer();
        const cabecalho = new TextDecoder("latin1").decode(new Uint8Array(bytes.slice(0, 1024)));
        if (!cabecalho.includes("%PDF-")) throw new Error(`"${file.name}" não é um PDF válido.`);
        const paginas = await contarPaginas(bytes);
        const r = await preparar({ data: { nome: file.name, tamanho: file.size } });
        const { error } = await supabase.storage
          .from(r.bucket)
          .uploadToSignedUrl(r.path, r.token, file, { contentType: "application/pdf" });
        if (error) throw new Error(error.message);
        acc = [...acc, { path: r.path, nome: file.name, paginas, tamanho: file.size }];
        onChange(acc);
      } catch (e) {
        erros.push(e instanceof Error ? e.message : `Falha ao enviar "${file.name}".`);
      } finally {
        setEnviando((e) => {
          const i = e.indexOf(file.name);
          return i >= 0 ? [...e.slice(0, i), ...e.slice(i + 1)] : e;
        });
        onEnviando?.(-1);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
    if (erros.length) setErro(erros.join(" "));
  }

  const cheio = value.length + enviando.length >= PETICOES_MAX_ARQUIVOS;

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled || cheio) return;
          if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-4 py-4 text-center text-xs transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-border bg-surface-2/40"
        } ${disabled || cheio ? "opacity-50" : ""}`}
      >
        <FileText className="h-5 w-5 text-muted-foreground" aria-hidden />
        <div className="text-muted-foreground">
          Arraste arquivos PDF aqui ou{" "}
          <button
            type="button"
            disabled={disabled || cheio}
            onClick={() => inputRef.current?.click()}
            className="text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid"
          >
            selecione do computador
          </button>
        </div>
        <div className="text-[11px] text-muted-foreground">
          Até {PETICOES_MAX_ARQUIVOS} arquivos · 10 MB cada · somente .pdf
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {value.map((p, i) => (
        <div
          key={p.path}
          className="flex items-center gap-2 rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm"
        >
          <span className="rounded bg-red-900/70 px-1.5 py-0.5 text-[10px] font-bold text-red-100">
            PDF
          </span>
          <span className="min-w-0 flex-1 truncate" title={p.nome}>
            {p.nome}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {p.paginas ? `${p.paginas} pág${p.paginas > 1 ? "s" : ""} · ` : ""}
            {tamanhoLegivel(p.tamanho)}
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(value.filter((_, k) => k !== i))}
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            aria-label={`Remover ${p.nome}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {enviando.map((nome, i) => (
        <div
          key={`${nome}-${i}`}
          className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm text-muted-foreground"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="min-w-0 flex-1 truncate">Enviando {nome}…</span>
        </div>
      ))}
      {erro && <p className="text-xs text-destructive">{erro}</p>}
      <p className="text-[11.5px] text-muted-foreground">
        Os arquivos ficam disponíveis à Corregedoria por {PETICOES_DIAS} dias. Guarde uma cópia com
        você.
      </p>
    </div>
  );
}
