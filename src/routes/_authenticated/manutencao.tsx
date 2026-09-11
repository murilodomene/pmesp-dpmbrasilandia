import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  definirProximoProtocolo,
  lerContadorProtocolo,
  limparDados,
} from "@/lib/manutencao.functions";
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
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/manutencao")({
  head: () => ({
    meta: [
      { title: "Manutenção — Corregepol" },
      { name: "description", content: "Zona de manutenção — limpeza de dados de teste." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  beforeLoad: async () => {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) throw redirect({ to: "/auth" });
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .maybeSingle();
    if (((role as { role: string } | null)?.role !== "corregedor_geral") && ((role as { role: string } | null)?.(role !== "subcorregedor_geral" && role !== "corregedor_supervisor"))) {
      throw redirect({ to: "/painel" });
    }
  },
  component: ManutencaoPage,
});

type Tipo = "processos" | "pdos" | "avisos" | "observacoes";

const CARDS: Array<{
  tipo: Tipo;
  titulo: string;
  descricao: string;
  palavra: string;
}> = [
  {
    tipo: "processos",
    titulo: "Limpar processos administrativos",
    descricao:
      "Remove TODAS as denúncias/PADs e o que está atrelado (movimentações, atos, oitivas, certidões, intimações, acessos do MP, provas anexadas). Reinicia a numeração para 001.",
    palavra: "PROCESSOS",
  },
  {
    tipo: "pdos",
    titulo: "Limpar PDOs",
    descricao: "Remove TODOS os PDOs e seus dados. Reinicia a numeração para PDO 1-001.",
    palavra: "PDOS",
  },
  {
    tipo: "avisos",
    titulo: "Limpar avisos",
    descricao: "Remove TODOS os avisos publicados. Reinicia a numeração dos avisos.",
    palavra: "AVISOS",
  },
  {
    tipo: "observacoes",
    titulo: "Limpar observações da Corregedoria",
    descricao:
      "Remove TODAS as observações internas da Corregedoria, seus vínculos com PADs e as imagens anexadas no armazenamento privado. Os indicadores de observação nos PADs desaparecem automaticamente.",
    palavra: "OBSERVACOES",
  },
];

function NumeracaoCard() {
  const anoAtual = new Date().getFullYear();
  const lerFn = useServerFn(lerContadorProtocolo);
  const definirFn = useServerFn(definirProximoProtocolo);
  const [valor, setValor] = useState("");

  const atual = useQuery({
    queryKey: ["contador-protocolo", anoAtual],
    queryFn: () => lerFn({ data: { ano: anoAtual } }),
  });

  const salvar = useMutation({
    mutationFn: (proximo: number) => definirFn({ data: { ano: anoAtual, proximo } }),
    onSuccess: (res) => {
      toast.success(`Próximo procedimento será ${res.proximo}.`);
      setValor("");
      atual.refetch();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao ajustar a numeração."),
  });

  const proximoAtual = atual.data?.proximo_numero;

  return (
    <div className="mb-6 rounded-lg border border-border bg-surface p-5">
      <h2 className="font-serif text-lg">Numeração dos procedimentos</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Formato <strong>NNN/{anoAtual}</strong> (três dígitos e o ano corrente). Defina abaixo qual
        será o número do próximo procedimento criado em {anoAtual}.
      </p>
      <p className="mt-2 text-sm">
        Próximo número atual:{" "}
        <span className="tabular font-medium">
          {atual.isPending
            ? "carregando..."
            : proximoAtual
              ? `${String(proximoAtual).padStart(3, "0")}/${anoAtual}`
              : "—"}
        </span>
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs uppercase tracking-wider text-muted-foreground">
            Próximo número (1 a 999)
          </label>
          <Input
            className="mt-1 w-40"
            type="number"
            min={1}
            max={999}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="175"
          />
        </div>
        <Button
          disabled={
            salvar.isPending ||
            !valor ||
            Number(valor) < 1 ||
            Number(valor) > 999 ||
            !Number.isInteger(Number(valor))
          }
          onClick={() => salvar.mutate(Number(valor))}
        >
          {salvar.isPending ? "Salvando..." : "Definir numeração"}
        </Button>
      </div>
    </div>
  );
}

function ManutencaoPage() {
  const [open, setOpen] = useState<Tipo | null>(null);
  const [texto, setTexto] = useState("");
  const limparFn = useServerFn(limparDados);

  const mut = useMutation({
    mutationFn: (v: { tipo: Tipo; confirmacao: string }) => limparFn({ data: v }),
    onSuccess: (res) => {
      toast.success(`Limpeza concluída. ${res.removidos} registro(s) removido(s).`);
      setOpen(null);
      setTexto("");
    },
    onError: (e: any) => toast.error(e.message ?? "Falha na limpeza."),
  });

  const card = CARDS.find((c) => c.tipo === open);

  return (
    <>
      <Outlet />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <h1 className="font-serif text-3xl">Manutenção</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Zona restrita ao Corregedor-Geral. As ações abaixo removem apenas registros de dados

            — nunca alteram a estrutura do banco, usuários, documentos internos ou configurações.
          </p>
        </div>

        <div className="mb-6 flex gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <div className="font-medium text-amber-100">Operação definitiva</div>
            <p className="text-amber-100/80">
              A limpeza é irreversível. Cada botão apaga somente o seu tipo — não existe
              opção que apague tudo de uma vez. Exige confirmação digitada.
            </p>
          </div>
        </div>

        <NumeracaoCard />

        <div className="grid gap-4">
          {CARDS.map((c) => (
            <div key={c.tipo} className="rounded-lg border border-border bg-surface p-5">
              <h2 className="font-serif text-lg">{c.titulo}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{c.descricao}</p>
              <div className="mt-4">
                <Button
                  variant="destructive"
                  onClick={() => {
                    setOpen(c.tipo);
                    setTexto("");
                  }}
                >
                  {c.titulo}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog
        open={open !== null}
        onOpenChange={(v) => {
          if (!v) {
            setOpen(null);
            setTexto("");
          }
        }}
      >
        <DialogContent>
          {card && (
            <>
              <DialogHeader>
                <DialogTitle>{card.titulo}</DialogTitle>
                <DialogDescription>
                  Esta ação é <strong>definitiva</strong> e não pode ser desfeita.
                  <br />
                  {card.descricao}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <label className="text-sm">
                  Para confirmar, digite <strong>{card.palavra}</strong>:
                </label>
                <Input
                  autoFocus
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={card.palavra}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(null)} disabled={mut.isPending}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  disabled={texto.trim().toUpperCase() !== card.palavra || mut.isPending}
                  onClick={() =>
                    mut.mutate({ tipo: card.tipo, confirmacao: texto.trim().toUpperCase() })
                  }
                >
                  {mut.isPending ? "Executando..." : "Confirmar limpeza"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
