import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Package,
  LogOut,
  Users,
  Calendar,
  MessageCircle,
  BrainCircuit,
  HardDrive,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider";

const NAV = [
  { to: "/pacientes", label: "Pacientes", icon: Users },
  { to: "/agenda", label: "Agenda", icon: Calendar },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { to: "/insumos", label: "Estoque", icon: Package },
  { to: "/central-ia", label: "PDFs e Arquivos", icon: BrainCircuit },
  { to: "/armazenamento", label: "Armazenamento", icon: HardDrive },
] as const;

function ToothMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M7 3.5c1.6 0 2.4.8 5 .8s3.4-.8 5-.8c2.5 0 4 2 4 4.5 0 3.2-1.4 4.7-2.2 8.2-.6 2.6-1.1 6.3-2.8 6.3-1.6 0-1.8-3.6-3-5.4-.5-.7-1.4-.7-2 0-1.2 1.8-1.4 5.4-3 5.4-1.7 0-2.2-3.7-2.8-6.3C4.4 12.7 3 11.2 3 8c0-2.5 1.5-4.5 4-4.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9 7.5c1-.6 2-.8 3-.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Brand({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-10 w-10" : size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-lg" : "text-xl";

  return (
    <Link to="/" className="flex items-center gap-2.5 group">
      <span
        className={`${dim} grid place-items-center rounded-xl bg-gold-gradient text-white shadow-md shadow-amber-200/50`}
      >
        <ToothMark className="h-1/2 w-1/2" />
      </span>
      <span className="leading-none">
        <span className={`block font-display font-extrabold tracking-tight ${text}`}>Oralit</span>
        {size !== "sm" && (
          <span className="mt-1 block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Gestão Clínica
          </span>
        )}
      </span>
    </Link>
  );
}

export default function AppLayout({ children }: { children?: ReactNode }) {
  const { session, loading, signOut, profile } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const isActive = (to: string) =>
    pathname === to || pathname.startsWith(`${to}/`);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    const redirect = encodeURIComponent(pathname);
    window.location.href = `/login?redirect=${redirect}`;
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-card/80 backdrop-blur lg:flex">
        <div className="border-b border-border px-5 py-6">
          <Brand size="md" />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => {
            const active = isActive(item.to);
            const Icon = item.icon;

            return (
              <Link
                key={item.to}
                to={item.to}
                className={[
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
                  active
                    ? "bg-secondary font-semibold text-foreground ring-gold-soft"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                ].join(" ")}
              >
                <Icon className={`h-4 w-4 ${active ? "text-gold" : ""}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <button
            onClick={signOut}
            className="mt-3 flex w-full cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium text-rose-500 transition-all hover:bg-rose-50 hover:text-rose-600"
          >
            <LogOut className="h-4 w-4" />
            <span>Sair da conta</span>
          </button>
        </nav>

        <div className="border-t border-border p-4 text-[11px] text-muted-foreground">
          <div className="mb-2">
            <div className="truncate font-semibold text-foreground">
              {profile?.full_name || "Dentista"}
            </div>
          </div>
          <span className="font-semibold text-gold-gradient">Oralit</span> · v1.0
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Brand size="sm" />
          <button
            onClick={signOut}
            className="cursor-pointer rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="pb-24 lg:pl-64 lg:pb-10">
        <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-10">
          {children ?? <Outlet />}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:hidden">
        <div className="grid grid-cols-6 gap-0.5 px-1 py-2">
          {NAV.map((item) => {
            const active = isActive(item.to);
            const Icon = item.icon;

            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg py-1.5"
              >
                <span
                  className={`grid h-7 w-7 place-items-center rounded-full transition-all ${
                    active ? "bg-gold/10 text-gold" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-[17px] w-[17px]" />
                </span>
                <span
                  className={`max-w-full truncate px-0.5 text-[9px] ${
                    active ? "font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {item.label === "PDFs e Arquivos" ? "Arquivos" : item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
