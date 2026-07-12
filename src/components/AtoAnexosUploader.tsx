import { useRef, useState } from "react";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface AtoAnexo {
  nome: string;
  path: string;
}

interface Props {
  denunciaId: string;
  value: AtoAnexo[];
  onChange: (next: AtoAnexo[]) => void;
  disabled?: boolean;
}

const MAX_DIM = 1600;
const QUALITY = 0.85;
const ACCEPT = ["image/jpeg", "image/png"];

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao processar imagem."))),
      mime,
      QUALITY,
    ),
  );
  return blob;
}

/**
 * Uploader de imagens-prova para Despacho / Decisão.
 * Envia direto ao bucket privado "atos-anexos" sob {denunciaId}/{uuid}.{ext}.
 * O nome exibido é dado pelo usuário (default "Anexo N").
 */
export function AtoAnexosUploader({ denunciaId, value, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  async function handleFiles(files: FileList | File[]) {
    setErro(null);
    const arr = Array.from(files).filter((f) => ACCEPT.includes(f.type));
    if (arr.length === 0) {
      setErro("Apenas imagens .jpeg ou .png.");
      return;
    }
    setUploading((c) => c + arr.length);
    try {
      for (const file of arr) {
        try {
          const blob = await compressImage(file);
          const ext = blob.type === "image/png" ? "png" : "jpg";
          const uid =
            (globalThis.crypto?.randomUUID?.() as string | undefined) ??
            `${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const path = `${denunciaId}/${uid}.${ext}`;
          const { error } = await supabase.storage
            .from("atos-anexos")
            .upload(path, blob, { contentType: blob.type, upsert: false });
          if (error) throw error;
          const nome = `PROVA ${String(value.length + 1).padStart(2, "0")}`;
          value = [...value, { nome, path }];
          onChange(value);
        } catch (e) {
          setErro(e instanceof Error ? e.message : "Falha no envio.");
        } finally {
          setUploading((c) => c - 1);
        }
      }
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(i: number) {
    // Best-effort: apaga do storage. Ignora erros (o link já foi removido do ato).
    const item = value[i];
    if (item) void supabase.storage.from("atos-anexos").remove([item.path]);
    const next = value.filter((_, idx) => idx !== i);
    onChange(next);
  }

  function rename(i: number, nome: string) {
    onChange(value.map((a, idx) => (idx === i ? { ...a, nome } : a)));
  }

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
          if (disabled) return;
          if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-4 py-4 text-xs transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-border bg-surface-2/40"
        } ${disabled ? "opacity-50" : ""}`}
      >
        <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden />
        <div className="text-muted-foreground">
          Arraste imagens-prova (.jpeg, .png) aqui ou{" "}
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid"
          >
            selecione do computador
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          multiple
          hidden
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        {uploading > 0 && (
          <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Enviando {uploading}…
          </div>
        )}
        {erro && <div className="text-[11px] text-destructive">{erro}</div>}
      </div>

      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((a, i) => (
            <li
              key={a.path}
              className="flex items-center gap-2 rounded-md border border-border/60 bg-surface-2/40 px-2 py-1.5 text-xs"
            >
              <Upload className="h-3.5 w-3.5 text-primary" aria-hidden />
              <input
                value={a.nome}
                onChange={(e) => rename(i, e.target.value.slice(0, 120))}
                className="flex-1 rounded-sm border border-border bg-transparent px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remover anexo"
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
