import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tamanhoLegivel } from "@/components/PeticoesUploader";
import { limparPeticoes, resumoPeticoes, PETICOES_DIAS } from "@/lib/peticoes.functions";

/** Manutenção: espaço ocupado pelos PDFs dos denunciantes e limpeza. */
export function PeticoesManutencaoCard() {
  const resumoFn = useServerFn(resumoPeticoes);
  const limparFn = useServerFn(limparPeticoes);
  const [confirmarTodos, setConfirmarTodos] = useState(false);
  const [texto, setTexto] = useState("");
  const resumo = useQuery({
    queryKey: ["peticoes-resumo"],
    queryFn: () => resumoFn(),
    retry: false,
  });

  const limpar = useMutation({
    mutationFn: (modo: "vencidas" | "todas") =>
      limparFn({ data: { modo, confirmacao: modo === "todas" ? texto.trim() : undefined } }),
    onSuccess: (r) => {
      const partes = [`${r.removidos} PDF(s) expurgado(s)`];
      if (r.abandonados) partes.push(`${r.abandonados} envio(s) abandonado(s) apagado(s)`);
      toast.success(`${partes.join(" e ")}.`);
      setConfirmarTodos(false);
      setTexto("");
      void resumo.refetch();
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha na limpeza."),
  });

  const r = resumo.data;
  return (
    <div className="mb-6 rounded-lg border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 font-serif text-lg">
        <FileText className="h-4 w-4 text-primary" aria-hidden /> PDFs enviados pelos denunciantes
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Petições e documentos em PDF ficam no sistema por {PETICOES_DIAS} dias a contar do envio. O
        expurgo dos vencidos também roda sozinho quando a Corregedoria é aberta. Depois de apagado o
        arquivo, o registro (nome, data, páginas) continua no processo.
      </p>
      {resumo.isError ? (
        <p className="mt-3 text-sm text-destructive">
          {resumo.error instanceof Error ? resumo.error.message : "Não foi possível ler os PDFs."}
        </p>
      ) : (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-md border border-border p-3">
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Armazenados</dt>
            <dd className="mt-1 font-medium">
              {r ? `${r.armazenados} arquivo(s) · ${tamanhoLegivel(r.bytes)}` : "carregando..."}
            </dd>
          </div>
          <div className="rounded-md border border-border p-3">
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Vencidos (&gt; {PETICOES_DIAS} dias)
            </dt>
            <dd className={`mt-1 font-medium ${r?.vencidos ? "text-destructive" : ""}`}>
              {r ? `${r.vencidos} arquivo(s) · ${tamanhoLegivel(r.bytesVencidos)}` : "—"}
            </dd>
          </div>
          <div className="rounded-md border border-border p-3">
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Envios abandonados (&gt; 24 h)
            </dt>
            <dd className="mt-1 font-medium">{r ? `${r.abandonados} arquivo(s)` : "—"}</dd>
          </div>
        </dl>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="destructive"
          disabled={limpar.isPending || resumo.isError}
          onClick={() => limpar.mutate("vencidas")}
        >
          <Trash2 className="mr-1 h-4 w-4" />
          {limpar.isPending && !confirmarTodos ? "Limpando..." : "Limpar PDFs vencidos"}
        </Button>
        <Button
          variant="outline"
          disabled={limpar.isPending || resumo.isError}
          onClick={() => {
            setTexto("");
            setConfirmarTodos(true);
          }}
        >
          Limpar todos…
        </Button>
      </div>

      <Dialog open={confirmarTodos} onOpenChange={(v) => !v && setConfirmarTodos(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar todos os PDFs dos denunciantes</DialogTitle>
            <DialogDescription>
              Apaga <strong>todos</strong> os PDFs enviados pelos denunciantes, inclusive os que
              ainda estão no prazo de {PETICOES_DIAS} dias. Os registros continuam nos processos.
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm">
              Para confirmar, digite <strong>PETICOES</strong>:
            </label>
            <Input
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="PETICOES"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmarTodos(false)}
              disabled={limpar.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={texto.trim().toUpperCase() !== "PETICOES" || limpar.isPending}
              onClick={() => limpar.mutate("todas")}
            >
              {limpar.isPending ? "Apagando..." : "Apagar todos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
