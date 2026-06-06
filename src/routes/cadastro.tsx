import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";
import { Card, Button, Input, Label } from "@/components/ui-bits";
import { Brand } from "@/components/AppLayout";
import { useAuth } from "@/components/AuthProvider";

export const Route = createFileRoute("/cadastro")({
  head: () => ({ meta: [{ title: "Criar Conta — Oralit" }] }),
  component: RegisterPage,
});

// Read env vars directly here so we can diagnose if they are missing
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

function translateAuthError(message: string): string {
  const msg = message.toLowerCase();
  if (msg.includes("user already registered") || msg.includes("already registered")) {
    return "Este e-mail já está cadastrado.";
  }
  if (msg.includes("password should be at least") || msg.includes("at least 6")) {
    return "A senha precisa ter no mínimo 6 caracteres.";
  }
  if (msg.includes("invalid email")) {
    return "E-mail com formato inválido.";
  }
  if (msg.includes("email rate limit")) {
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  }
  return message;
}

function RegisterPage() {
  const { session, loading: authLoading } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
      console.error("[cadastro] Missing env vars:", missing);
    } else {
      console.log("[cadastro] Supabase URL:", SUPA_URL);
      console.log("[cadastro] Key starts with:", SUPA_KEY.slice(0, 20) + "...");
    }
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && session) {
      window.location.href = "/";
    }
  }, [session, authLoading]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();

    if (envError) {
      return toast.error("Configuração do Supabase inválida. Veja o console.");
    }
    if (!fullName.trim()) return toast.error("Informe seu nome completo.");
    if (!email.trim()) return toast.error("Informe seu e-mail.");
    if (!password) return toast.error("Informe uma senha.");
    if (password.length < 6) return toast.error("A senha precisa ter no mínimo 6 caracteres.");
    if (password !== confirmPassword) return toast.error("As senhas não coincidem.");

    setLoading(true);

    try {
      // Create a fresh client directly to bypass the Proxy and confirm env vars work
      const client = createClient(SUPA_URL!, SUPA_KEY!);

      console.log("[cadastro] Calling supabase.auth.signUp for:", email.trim());

      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            clinic_name: "Clínica Oralit",
          },
        },
      });

      console.log("[cadastro] signUp response — data:", JSON.stringify(data), "error:", error);

      if (error) {
        const msg = translateAuthError(error.message);
        console.error("[cadastro] signUp error:", error);
        toast.error(msg);
        return;
      }

      if (!data?.user) {
        toast.error("Não foi possível criar a conta. Tente novamente.");
        return;
      }

      toast.success("Conta criada com sucesso!");
      console.log("[cadastro] User created:", data.user.id, "| Session:", !!data.session);

      if (data.session) {
        // Auto-login active → go to dashboard
        setTimeout(() => { window.location.href = "/"; }, 800);
      } else {
        // Email confirmation required
        toast.info("Verifique seu e-mail para confirmar o cadastro antes de entrar.");
        setTimeout(() => { window.location.href = "/login"; }, 2500);
      }

    } catch (err: unknown) {
      console.error("[cadastro] Unexpected exception:", err);
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
            <h2 className="font-display font-extrabold text-2xl tracking-tight">Criar uma conta</h2>
            <p className="text-sm text-muted-foreground mt-1.5">Insira seus dados para começar no Oralit</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <Label>Nome completo</Label>
              <Input
                type="text"
                placeholder="Seu nome"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
                required
              />
            </div>

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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Senha</Label>
                <Input
                  type="password"
                  placeholder="Mín. 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
              <div>
                <Label>Confirmar senha</Label>
                <Input
                  type="password"
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
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
                  <span>Criando conta...</span>
                </div>
              ) : (
                "Criar conta"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Já tem uma conta? </span>
            <Link to="/login" className="font-bold text-gold-deep hover:underline">
              Fazer login
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
