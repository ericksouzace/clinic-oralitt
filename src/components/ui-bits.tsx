import type { ReactNode } from "react";

export function PageHeader({
  title, subtitle, action,
}: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card-premium p-5 ${className}`}>{children}</div>;
}

export function StatCard({
  label, value, hint, accent,
}: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`card-premium p-4 lg:p-5 relative overflow-hidden ${accent ? "ring-gold-soft" : ""}`}>
      {accent && <div className="absolute top-0 right-0 h-12 w-12 bg-gold-gradient opacity-10 rounded-bl-full" />}
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className={`mt-2 text-xl lg:text-2xl font-display font-bold ${accent ? "text-gold-gradient" : ""}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

export function EmptyState({
  title, description, action,
}: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="card-premium p-10 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-gold-gradient/10 grid place-items-center text-gold">✦</div>
      <h3 className="mt-4 font-display font-bold text-lg">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger" | "gold";
  size?: "sm" | "md";
};
export function Button({ variant = "primary", size = "md", className = "", ...p }: ButtonProps) {
  const v = {
    primary: "bg-foreground text-background hover:opacity-90",
    gold: "bg-gold-gradient text-white shadow-sm hover:brightness-105",
    ghost: "text-foreground hover:bg-secondary",
    outline: "border border-border bg-card text-foreground hover:bg-secondary",
    danger: "bg-destructive text-destructive-foreground hover:opacity-90",
  }[variant];
  const s = size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm";
  return (
    <button
      {...p}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${v} ${s} ${className}`}
    />
  );
}

export function Input({ className = "", ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...p}
      className={`h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition ${className}`}
    />
  );
}

export function Textarea({ className = "", ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...p}
      className={`min-h-[80px] w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring ${className}`}
    />
  );
}

export function Select({ className = "", children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...p}
      className={`h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring ${className}`}
    >
      {children}
    </select>
  );
}

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
      {children}
      {hint && <span className="ml-1 text-muted-foreground font-normal">· {hint}</span>}
    </label>
  );
}

export function Badge({ children, tone, variant, className = "" }: { children: ReactNode; tone?: "neutral" | "ok" | "warn" | "danger" | "gold"; variant?: string; className?: string }) {
  // compatibilidade com código antigo usando variant="success" etc
  let resolvedTone = tone || "neutral";
  if (variant === "success") resolvedTone = "ok";
  if (variant === "warning") resolvedTone = "warn";
  if (variant === "destructive") resolvedTone = "danger";
  
  const t = {
    neutral: "bg-secondary text-foreground",
    ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    gold: "bg-gold-gradient text-white",
  }[resolvedTone as string] || "bg-secondary text-foreground";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border border-transparent ${t} ${className}`}>
      {children}
    </span>
  );
}
