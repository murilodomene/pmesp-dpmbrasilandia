import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Header } from "@/components/Header";
import { getSessionInfo } from "@/lib/usuarios.functions";

export const Route = createFileRoute("/_authenticated/pendente")({
  component: PendentePage,
});

function PendentePage() {
  const fn = useServerFn(getSessionInfo);
  const { data } = useQuery({ queryKey: ["session-info"], queryFn: () => fn() });

  const status = data?.profile?.status;
  const cargo = data?.cargo;

  if (status === "ativo" && cargo) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <div className="eyebrow">Tudo pronto</div>
          <h1 className="mt-2 font-serif text-3xl">Você já está ativo.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Seu cargo é {cargoLabel(cargo)}. Acesse a Corregedoria.
          </p>
          <Link
            to="/corregedoria"
            className="mt-6 inline-flex rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
          >
            Ir para Corregedoria
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <div className="eyebrow">Cadastro em análise</div>
        <h1 className="mt-2 font-serif text-3xl">Aguardando aprovação</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Seu cadastro foi recebido. Um Delegado precisa aprová-lo e atribuir seu cargo antes que
          você tenha acesso às denúncias e procedimentos.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Se você é o primeiro usuário deste sistema, sua conta já foi ativada automaticamente como
          Delegado Corregedor — recarregue a página.
        </p>
      </div>
    </div>
  );
}

function cargoLabel(c: string): string {
  return c === "delegado_geral"
    ? "Delegado Geral"
    : c === "delegado_corregedor"
      ? "Delegado Corregedor"
      : "Corregedor";
}
