import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Package, Wallet, Stethoscope, Calculator,
  History, Settings, BarChart3, Sparkles, LogOut, Users, Calendar, MessageCircle, BrainCircuit
} from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider";

const NAV = [
  { to: "/", label: "Painel", icon: LayoutDashboard, exact: true },
  { to: "/agenda", label: "Agenda", icon: Calendar },
  { to: "/pacientes", label: "Pacientes", icon: Users },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { to: "/insumos", label: "Insumos", icon: Package },
  { to: "/custos-fixos", label: "Custos fixos", icon: Wallet },
  { to: "/procedimentos", label: "Procedimentos", icon: Stethoscope },
  { to: "/precificar", label: "Precificar", icon: Calculator, highlight: true },
  { to: "/historico", label: "Histórico", icon: History },
  { to: "/central-ia", label: "PDFs e Arquivos", icon: BrainCircuit }, { to: "/armazenamento", label: "Armazenamento", icon: HardDrive },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

function ToothMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M7 3.5c1.6 0 2.4.8 5 .8s3.4-.8 5-.8c2.5 0 4 2 4 4.5 0 3.2-1.4 4.7-2.2 8.2-.6 2.6-1.1 6.3-2.8 6.3-1.6 0-1.8-3.6-3-5.4-.5-.7-1.4-.7-2 0-1.2 1.8-1.4 5.4-3 5.4-1.7 0-2.2-3.7-2.8-6.3C4.4 12.7 3 11.2 3 8c0-2.5 1.5-4.5 4-4.5Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
      />
      <path d="M9 7.5c1-.6 2-.8 3-.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function Brand({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-10 w-10" : size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-lg" : "text-xl";
  return (
    <Link to="/" className="flex items-center gap-2.5 group">
      <span className={`${dim} grid place-items-center rounded-xl bg-gold-gradient text-white shadow-md shadow-amber-200/50`}>
        <ToothMark className="h-1/2 w-1/2" />
      </span>
      <span className="leading-none">
        <span className={`block font-display font-extrabold tracking-tight ${text}`}>Oralit</span>
        {size !== "sm" && (
          <span className="block text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-1">
            Precificação Clínica
          </span>
        )}
      </span>
    </Link>
  );
}

export default function AppLayout({ children }: { children?: ReactNode }) {
  const { session, loading, signOut, profile } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  // Show spinner while checking session
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
          <p className="text-sm text-muted-foreground font-medium">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  // Not authenticated — redirect to login
  if (!session) {
    const redirect = encodeURIComponent(pathname);
    window.location.href = `/login?redirect=${redirect}`;
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-border bg-card/80 backdrop-blur">
        <div className="px-5 py-6 border-b border-border">
          <Brand size="md" />
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {NAV.map((n) => {
            const active = isActive(n.to, "exact" in n ? n.exact : false);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={[
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                  active
                    ? "bg-secondary text-foreground font-semibold ring-gold-soft"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                ].join(" ")}
              >
                <n.icon className={`h-4 w-4 ${active ? "text-gold" : ""}`} />
                <span>{n.label}</span>
                {"highlight" in n && n.highlight && !active && (
                  <Sparkles className="ml-auto h-3.5 w-3.5 text-gold" />
                )}
              </Link>
            );
          })}

          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-rose-500 hover:bg-rose-50 hover:text-rose-600 mt-2 border border-transparent cursor-pointer font-medium"
          >
            <LogOut className="h-4 w-4" />
            <span>Sair da conta</span>
          </button>
        </nav>
        <div className="p-4 text-[11px] text-muted-foreground border-t border-border">
          <div className="mb-2">
            <div className="font-semibold text-foreground truncate">{profile?.full_name || "Dentista"}</div>
          </div>
          <span className="text-gold-gradient font-semibold">Oralit</span> · v1.0
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <Brand size="sm" />
          <div className="flex items-center gap-2.5">
            <Link
              to="/precificar"
              className="inline-flex items-center gap-1.5 rounded-full bg-gold-gradient text-white px-3.5 py-1.5 text-xs font-semibold shadow-sm"
            >
              <Calculator className="h-3.5 w-3.5" /> Precificar
            </Link>
            <button
              onClick={signOut}
              className="p-1.5 text-rose-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="lg:pl-64 pb-24 lg:pb-10">
        <div className="mx-auto max-w-6xl px-4 lg:px-8 py-6 lg:py-10">
          {children ?? <Outlet />}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur">
        <div className="grid grid-cols-5 gap-1 px-2 py-2">
          {[NAV[0], NAV[2], NAV[1], NAV[3], NAV[7]].map((n) => {
            const active = isActive(n.to, "exact" in n ? n.exact : false);
            const Icon = n.icon;
            const highlight = "highlight" in n && n.highlight;
            return (
              <Link key={n.to} to={n.to} className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg">
                <span className={[
                  "grid place-items-center rounded-full transition-all",
                  highlight ? "h-10 w-10 bg-gold-gradient text-white shadow -mt-4" : "h-7 w-7",
                  active && !highlight ? "text-gold" : !highlight ? "text-muted-foreground" : "",
                ].join(" ")}>
                  <Icon className={highlight ? "h-5 w-5" : "h-[18px] w-[18px]"} />
                </span>
                <span className={`text-[10px] ${active ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                  {n.label.split(" ")[0]}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
