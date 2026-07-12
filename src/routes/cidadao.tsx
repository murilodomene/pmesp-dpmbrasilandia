import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";

export const Route = createFileRoute("/cidadao")({
  head: () => ({
    meta: [
      { title: "Área do Cidadão — Corregedoria" },
      {
        name: "description",
        content:
          "Cadastre-se para acompanhar suas denúncias. Cadastro imediato, sem aprovação.",
      },
    ],
  }),
  component: CidadaoPage,
});

type Mode = "login" | "signup" | "forgot";

function CidadaoPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/minhas-denuncias" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setInfo("E-mail enviado. Verifique sua caixa de entrada (e spam).");
        setMode("login");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/minhas-denuncias" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/minhas-denuncias`,
            data: { tipo: "cidadao", nome },
          },
        });
        if (error) throw error;
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setInfo("Cadastro concluído. Faça login para acessar sua área.");
          setMode("login");
        } else {
          navigate({ to: "/minhas-denuncias" });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro.";
      setError(traduzir(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto grid max-w-md gap-6 px-4 py-16">
        <div>
          <div className="eyebrow">Área do Cidadão</div>
          <h1 className="mt-2 font-serif text-3xl">
            {mode === "login" ? "Entrar" : "Cadastre-se"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Acompanhe suas denúncias. Cadastro imediato, sem aprovação.
          </p>
        </div>
        <form onSubmit={submit} className="surface grid gap-4 p-6">
          {mode === "signup" && (
            <Field label="Nome">
              <input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="input"
              />
            </Field>
          )}
          <Field label="E-mail">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Senha">
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
          </Field>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive-foreground">
              {error}
            </div>
          )}
          {info && (
            <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-xs">{info}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Cadastrar"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
              setInfo(null);
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "login" ? "Não tem conta? Cadastrar" : "Já tenho conta. Entrar"}
          </button>
        </form>
        <Link to="/" className="text-center text-xs text-muted-foreground hover:text-foreground">
          ← Voltar ao início
        </Link>
      </div>
      <style>{`.input{background:var(--input);border:1px solid var(--border);border-radius:6px;padding:.55rem .7rem;font-size:.9rem;color:var(--foreground);width:100%}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function traduzir(msg: string): string {
  if (/invalid.*credentials/i.test(msg)) return "E-mail ou senha inválidos.";
  if (/already registered/i.test(msg)) return "Este e-mail já está cadastrado.";
  if (/password/i.test(msg) && /short|6/i.test(msg)) return "Senha muito curta (mínimo 6 caracteres).";
  return msg;
}
