import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acesso interno — Corregedoria" },
      { name: "description", content: "Login e cadastro para servidores da Corregedoria." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [matricula, setMatricula] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotEmailInvalid, setForgotEmailInvalid] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/corregedoria" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/corregedoria`,
            data: { nome, matricula },
          },
        });
        if (error) throw error;
        setInfo("Cadastro enviado. Aguarde a aprovação de um administrador para acessar o sistema.");
        setMode("login");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao autenticar.";
      setError(traduzirErro(msg));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail);
    if (!valid) {
      setForgotEmailInvalid(true);
      return;
    }
    setForgotEmailInvalid(false);
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao enviar e-mail.";
      setError(traduzirErro(msg));
    } finally {
      setLoading(false);
    }
  }

  function goLogin() {
    setMode("login");
    setError(null);
    setInfo(null);
    setForgotSent(false);
    setForgotEmail("");
    setForgotEmailInvalid(false);
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto grid max-w-md gap-6 px-4 py-16">
        {mode !== "forgot" ? (
          <div className="animate-fade-in">
            <div>
              <div className="eyebrow">Acesso restrito</div>
              <h1 className="mt-2 font-serif text-3xl">
                {mode === "login" ? "Entrar no sistema" : "Cadastro de servidor"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {mode === "login"
                  ? "Use suas credenciais institucionais."
                  : "Todo cadastro interno depende da aprovação de um Corregedor-Geral ou Subcorregedor-Geral."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="surface mt-6 grid gap-4 p-6">
              {mode === "signup" && (
                <>
                  <Field label="Nome completo">
                    <input required value={nome} onChange={(e) => setNome(e.target.value)} className="input" />
                  </Field>
                  <Field label="Matrícula">
                    <input required value={matricula} onChange={(e) => setMatricula(e.target.value)} className="input" />
                  </Field>
                </>
              )}
              <Field label="E-mail">
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
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

              {mode === "login" && (
                <div className="-mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setError(null);
                      setInfo(null);
                    }}
                    className="text-xs text-muted-foreground transition-colors hover:text-primary hover:underline"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
              )}

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
                className="flex items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-transform duration-200 hover:scale-[1.01] disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
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
                {mode === "login" ? "Não tem cadastro? Registrar" : "Já sou cadastrado. Entrar"}
              </button>
            </form>
          </div>
        ) : (
          <div className="animate-fade-in">
            {!forgotSent ? (
              <>
                <div>
                  <div className="eyebrow">Recuperação</div>
                  <h1 className="mt-2 font-serif text-3xl">Recuperar senha</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Digite o e-mail cadastrado. Enviaremos as instruções.
                  </p>
                </div>

                <form onSubmit={handleForgot} className="surface mt-6 grid gap-4 p-6">
                  <Field label="E-mail">
                    <input
                      type="email"
                      required
                      disabled={loading}
                      placeholder="exemplo@email.com"
                      value={forgotEmail}
                      onChange={(e) => {
                        setForgotEmail(e.target.value);
                        if (forgotEmailInvalid) setForgotEmailInvalid(false);
                      }}
                      className="input"
                      style={forgotEmailInvalid ? { borderColor: "var(--destructive)" } : undefined}
                    />
                  </Field>

                  {error && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive-foreground">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-transform duration-200 hover:scale-[1.01] disabled:opacity-60"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loading ? "Enviando..." : "Enviar instruções"}
                  </button>

                  <button
                    type="button"
                    onClick={goLogin}
                    className="mx-auto flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Voltar para login
                  </button>
                </form>
              </>
            ) : (
              <div className="surface grid gap-4 p-8 text-center">
                <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
                <h2 className="font-serif text-2xl">E-mail enviado</h2>
                <p className="text-sm text-muted-foreground">
                  Verifique sua caixa de entrada. Caso não encontre, procure na pasta de spam.
                </p>
                <button
                  onClick={goLogin}
                  className="mt-2 rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-transform duration-200 hover:scale-[1.01]"
                >
                  Ir para login
                </button>
              </div>
            )}
          </div>
        )}

        <Link to="/" className="text-center text-xs text-muted-foreground hover:text-foreground">
          ← Voltar ao início
        </Link>
      </div>

      <style>{`.input{background:var(--input);border:1px solid var(--border);border-radius:6px;padding:.55rem .7rem;font-size:.9rem;color:var(--foreground);width:100%}.input:disabled{opacity:.6}`}</style>
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

function traduzirErro(msg: string): string {
  if (/invalid.*credentials/i.test(msg)) return "E-mail ou senha inválidos.";
  if (/already registered/i.test(msg)) return "Este e-mail já está cadastrado.";
  if (/password/i.test(msg) && /short|6/i.test(msg)) return "Senha muito curta (mínimo 6 caracteres).";
  if (/rate limit/i.test(msg)) return "Muitas tentativas. Aguarde alguns minutos.";
  return msg;
}
