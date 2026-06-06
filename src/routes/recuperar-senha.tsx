import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, Button, Input, Label } from "@/components/ui-bits";
import { Brand } from "@/components/AppLayout";
import { useAuth } from "@/components/AuthProvider";

export const Route = createFileRoute("/recuperar-senha")({
  head: () => ({ meta: [{ title: "Recuperar Senha — Oralit" }] }),
  component: RecoverPasswordPage,
});

function RecoverPasswordPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [isResetFlow, setIsResetFlow] = useState(false);

  // Detect recovery flow from URL hash or query params
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash || "";
      const query = window.location.search || "";
      if (
        hash.includes("type=recovery") || 
        hash.includes("access_token") ||
        query.includes("type=recovery")
      ) {
        setIsResetFlow(true);
      }
    }
  }, []);

  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return toast.error("Informe seu e-mail.");

    setLoading(true);
    try {
      const redirectTo = typeof window !== "undefined"
        ? `${window.location.origin}/recuperar-senha`
        : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (error) {
        toast.error(error.message || "Erro ao solicitar recuperação.");
      } else {
        toast.success("E-mail de recuperação enviado com sucesso!");
        setEmailSent(true);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro inesperado ao solicitar recuperação.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!password || !confirmPassword) {
      return toast.error("Preencha todos os campos.");
    }
    if (password.length < 6) {
      return toast.error("A senha precisa ter no mínimo 6 caracteres.");
    }
    if (password !== confirmPassword) {
      return toast.error("As senhas não coincidem.");
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        toast.error(error.message || "Erro ao atualizar a senha.");
      } else {
        toast.success("Senha atualizada com sucesso! Redirecionando...");
        // Redirect to dashboard or login
        setTimeout(() => {
          navigate({ to: "/" });
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro inesperado ao atualizar a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex justify-center">
        <Brand size="lg" />
      </div>

      <div className="w-full max-w-md">
        <Card className="p-8 border border-border bg-card/60 backdrop-blur shadow-xl relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gold-gradient" />
          
          <div className="mb-6 text-center">
            <h2 className="font-display font-extrabold text-2xl tracking-tight">
              {isResetFlow ? "Nova senha" : "Recuperar senha"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              {isResetFlow 
                ? "Defina sua nova senha de acesso abaixo"
                : "Enviaremos um link de recuperação por e-mail"
              }
            </p>
          </div>

          {isResetFlow ? (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <Label>Nova senha</Label>
                <Input
                  type="password"
                  placeholder="Mínimo de 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <Label>Confirmar nova senha</Label>
                <Input
                  type="password"
                  placeholder="Confirme a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <Button
                type="submit"
                variant="gold"
                className="w-full mt-2"
                disabled={loading}
              >
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  "Atualizar senha"
                )}
              </Button>
            </form>
          ) : emailSent ? (
            <div className="text-center space-y-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 grid place-items-center text-lg font-bold">✓</div>
              <p className="text-sm text-muted-foreground">
                Um link para redefinir sua senha foi enviado para o e-mail informado. Verifique sua caixa de entrada e spam.
              </p>
              <Link to="/login" className="block">
                <Button variant="outline" className="w-full">
                  Voltar para login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSendEmail} className="space-y-4">
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

              <Button
                type="submit"
                variant="gold"
                className="w-full mt-2"
                disabled={loading}
              >
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  "Enviar e-mail de recuperação"
                )}
              </Button>

              <div className="text-center mt-4">
                <Link
                  to="/login"
                  className="text-sm font-bold text-gold-deep hover:underline"
                >
                  Voltar para login
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
