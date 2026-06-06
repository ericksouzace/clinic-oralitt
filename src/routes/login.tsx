import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { Card, Button, Input, Label } from "@/components/ui-bits";
import { Brand } from "@/components/AppLayout";
import { useAuth } from "@/components/AuthProvider";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({
    redirect: z.string().optional(),
  }),
  head: () => ({ meta: [{ title: "Entrar — Oralit" }] }),
  component: LoginPage,
});

// Read env vars directly to detect missing config early
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

function translateAuthError(message: string): string {
  const msg = message.toLowerCase();
  if (msg.includes("invalid login credentials")) return "E-mail ou senha inválidos.";
  if (msg.includes("email not confirmed") || msg.includes("email_not_confirmed")) {
    return "Por favor, confirme seu e-mail antes de fazer login.";
  }
  if (msg.includes("invalid email")) return "E-mail com formato inválido.";
  if (msg.includes("too many requests")) return "Muitas tentativas. Aguarde alguns minutos.";
  return message;
}

function LoginPage() {
  const search = Route.useSearch();
  const { session, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [envError, setEnvError] = useState<string | null>(null);

  // Check env vars on mount
  useEffect(() => {
    if (!SUPA_URL || !SUPA_KEY) {
      const missing = [
        !SUPA_URL ? "VITE_SUPABASE_URL" : null,
        !SUPA_KEY ? "VITE_SUPABASE_PUBLISHABLE_KEY" : null,
      ].filter(Boolean).join(", ");
      setEnvError(`Variáveis de ambiente ausentes: ${missing}. Reinicie o servidor após verificar o .env`);
      console.error("[login] Missing env vars:", missing);
    } else {
      console.log("[login] Supabase URL:", SUPA_URL);
    }
  }, []);

  // If already logged in, redirect
  useEffect(() => {
    if (!authLoading && session) {
      window.location.href = search.redirect || "/";
    }
  }, [session, authLoading, search.redirect]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    if (envError) return toast.error("Configuração do Supabase inválida. Veja o console.");
    if (!email.trim()) return toast.error("Informe seu e-mail.");
    if (!password) return toast.error("Informe sua senha.");

    setLoading(true);
    try {
      // Use createClient directly to bypass Proxy initialization issues
      const client = createClient(SUPA_URL!, SUPA_KEY!);

      console.log("[login] Calling signInWithPassword for:", email.trim());

      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      console.log("[login] signInWithPassword response — user:", data?.user?.id, "error:", error);

      if (error) {
        const msg = translateAuthError(error.message);
        console.error("[login] signIn error:", error);
        toast.error(msg);
        return;
      }

      if (!data?.session) {
        toast.error("Login falhou: sessão não retornada. Tente novamente.");
        return;
      }

      toast.success("Login realizado com sucesso!");
      console.log("[login] Login success for:", data.user?.email);

      setTimeout(() => {
        window.location.href = search.redirect || "/";
      }, 600);

    } catch (err: unknown) {
      console.error("[login] Unexpected exception:", err);
      const msg = err instanceof Error ? err.message : "Erro inesperado.";
      toast.error("Erro: " + msg);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
          <p className="text-sm text-muted-foreground font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex justify-center">
        <Brand size="lg" />
      </div>

      <div className="w-full max-w-md">
        <Card className="p-8 border border-border bg-card/60 backdrop-blur shadow-xl relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gold-gradient" />

          {/* Env error banner */}
          {envError && (
            <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700 font-medium">
              ⚠️ {envError}
            </div>
          )}

          <div className="mb-6 text-center">
            <h2 className="font-display font-extrabold text-2xl tracking-tight">Acessar sistema</h2>
            <p className="text-sm text-muted-foreground mt-1.5">Insira suas credenciais para continuar</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                placeholder="nome@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Senha</Label>
                <Link
                  to="/recuperar-senha"
                  className="text-xs text-gold-deep font-semibold hover:underline"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <Input
                type="password"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <Button
              type="submit"
              variant="gold"
              className="w-full mt-2"
              disabled={loading || !!envError}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Entrando...</span>
                </div>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Não tem uma conta? </span>
            <Link to="/cadastro" className="font-bold text-gold-deep hover:underline">
              Criar conta
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
