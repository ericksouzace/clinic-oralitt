import { createFileRoute, Link } from "@tanstack/react-router";
import AppLayout from "@/components/AppLayout";
import { Card, StatCard, Button, Badge } from "@/components/ui-bits";
import {
  useSupplies, useFixedCosts, useProcedures, useSettings, useHistory,
} from "@/lib/db";
import { BRL, fixedPerMinute, totalFixed } from "@/lib/calc";
import { ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Painel — Oralit" }] }),
  component: Painel,
});

function Painel() {
  const [supplies] = useSupplies();
  const [fixed] = useFixedCosts();
  const [procedures] = useProcedures();
  const [settings] = useSettings();
  const [history] = useHistory();

  const fpm = fixedPerMinute(fixed, settings);
  const totalMonthly = totalFixed(fixed);
  const last = history[0];
  const avgTicket = history.length ? history.reduce((s, h) => s + h.result.priceCard, 0) / history.length : 0;
  const avgProfit = history.length ? history.reduce((s, h) => s + h.result.estimatedProfit, 0) / history.length : 0;
  const avgMargin = history.length ? history.reduce((s, h) => s + h.result.netMargin, 0) / history.length : 0;

  return (
    <AppLayout>
      {/* Hero */}
      <section className="relative overflow-hidden card-premium p-6 lg:p-8 mb-6">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-gold-gradient opacity-15 blur-2xl" />
        <div className="absolute top-0 right-0 h-px w-2/3 bg-gradient-to-l from-gold to-transparent" />
        <div className="relative">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-gold font-semibold">
            <Sparkles className="h-3.5 w-3.5" /> Oralit · Painel
          </div>
          <h1 className="mt-2 text-2xl lg:text-4xl font-display font-extrabold tracking-tight max-w-2xl">
            Visão financeira da sua <span className="text-gold-gradient">rotina clínica</span>.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">
            Controle profissional de custos odontológicos para decisões mais seguras, rápidas e lucrativas.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/precificar">
              <Button variant="gold">Precificar agora <ArrowRight className="h-4 w-4" /></Button>
            </Link>
            <Link to="/insumos"><Button variant="outline">Cadastrar insumos</Button></Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
        <StatCard accent label="Custo do minuto clínico" value={BRL(fpm)} hint={`Hora: ${BRL(fpm * 60)}`} />
        <StatCard label="Custo fixo mensal" value={BRL(totalMonthly)} hint={`${fixed.length} itens`} />
        <StatCard label="Insumos cadastrados" value={String(supplies.length)} />
        <StatCard label="Procedimentos" value={String(procedures.length)} />
        <StatCard label="Último preço (cartão)" value={last ? BRL(last.result.priceCard) : "—"} hint={last?.procedureName} />
        <StatCard label="Ticket médio" value={avgTicket ? BRL(avgTicket) : "—"} />
        <StatCard label="Lucro médio estimado" value={avgProfit ? BRL(avgProfit) : "—"} />
        <StatCard label="Margem média" value={avgMargin ? `${avgMargin.toFixed(1)}%` : "—"} hint={`${history.length} cálculos`} />
      </section>

      {/* Flow */}
      <section className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-bold text-lg">Fluxo recomendado</h2>
              <p className="text-xs text-muted-foreground">Configure uma vez. Precifique todos os dias.</p>
            </div>
            <Badge tone="gold">6 passos</Badge>
          </div>
          <ol className="grid sm:grid-cols-2 gap-3">
            {[
              ["Cadastre seus insumos", "/insumos"],
              ["Informe seus custos fixos", "/custos-fixos"],
              ["Configure impostos, taxas e margem", "/configuracoes"],
              ["Monte seus procedimentos", "/procedimentos"],
              ["Calcule o preço recomendado", "/precificar"],
              ["Acompanhe o histórico", "/historico"],
            ].map(([t, to], i) => (
              <Link key={t} to={to as string}
                className="group flex items-start gap-3 p-3 rounded-xl border border-border bg-card hover:border-gold transition">
                <span className="h-7 w-7 shrink-0 grid place-items-center rounded-full bg-gold-gradient text-white text-xs font-bold">{i + 1}</span>
                <span className="text-sm font-medium pt-0.5">{t}</span>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-gold transition" />
              </Link>
            ))}
          </ol>
        </Card>

        <Card>
          <h2 className="font-display font-bold text-lg">Status clínico</h2>
          <p className="text-xs text-muted-foreground mb-4">Parâmetros financeiros vigentes.</p>
          <dl className="space-y-2.5 text-sm">
            {[
              ["Margem alvo", `${settings.marginPct}%`],
              ["Reserva técnica", `${settings.reservePct}%`],
              ["Impostos", `${settings.taxPct}%`],
              ["Taxa de cartão", `${settings.cardFeePct}%`],
              ["Dias/mês", String(settings.daysPerMonth)],
              ["Horas clínicas/dia", String(settings.hoursPerDay)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-dashed border-border pb-2 last:border-0">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          <Link to="/configuracoes" className="mt-4 block">
            <Button variant="outline" className="w-full">Ajustar configurações</Button>
          </Link>
        </Card>
      </section>
    </AppLayout>
  );
}
