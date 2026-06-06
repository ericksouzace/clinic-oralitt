import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { PageHeader, Card, StatCard, Select, Label, EmptyState } from "@/components/ui-bits";
import { useHistory, useSupplies, useFixedCosts, useSettings } from "@/lib/db";
import { BRL, fixedPerMinute, totalFixed } from "@/lib/calc";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line,
} from "recharts";

export const Route = createFileRoute("/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Oralit" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const [history] = useHistory();
  const [supplies] = useSupplies();
  const [fixed] = useFixedCosts();
  const [settings] = useSettings();
  const [period, setPeriod] = useState<"all" | "30" | "90">("all");

  const filtered = useMemo(() => {
    if (period === "all") return history;
    const days = +period;
    const cutoff = Date.now() - days * 86400000;
    return history.filter(h => h.createdAt >= cutoff);
  }, [history, period]);

  const ticket = filtered.length ? filtered.reduce((s, h) => s + h.result.priceCard, 0) / filtered.length : 0;
  const profit = filtered.length ? filtered.reduce((s, h) => s + h.result.estimatedProfit, 0) / filtered.length : 0;
  const totalProfit = filtered.reduce((s, h) => s + h.result.estimatedProfit, 0);
  const avgRealCost = filtered.length ? filtered.reduce((s, h) => s + h.result.realCost, 0) / filtered.length : 0;

  const highestPrice = [...filtered].sort((a, b) => b.result.priceCard - a.result.priceCard)[0];
  const lowestMargin = [...filtered].sort((a, b) => a.result.netMargin - b.result.netMargin)[0];

  const supplyUsage = new Map<string, number>();
  filtered.forEach(h => h.supplies.forEach(u => {
    supplyUsage.set(u.supplyId, (supplyUsage.get(u.supplyId) || 0) + u.qty);
  }));
  const topSupplyId = [...supplyUsage.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const topSupply = supplies.find(s => s.id === topSupplyId);

  const catCount = new Map<string, number>();
  filtered.forEach(h => {
    const cat = h.procedureName.split(" ")[0];
    catCount.set(cat, (catCount.get(cat) || 0) + 1);
  });

  const barData = filtered.slice(0, 10).map(h => ({
    name: h.procedureName.slice(0, 14),
    Cartão: Math.round(h.result.priceCard),
    Lucro: Math.round(h.result.estimatedProfit),
  })).reverse();

  const lineData = filtered.slice(0, 20).map((h, i) => ({
    name: `#${filtered.length - i}`,
    Ticket: Math.round(h.result.priceCard),
    Margem: +h.result.netMargin.toFixed(1),
  })).reverse();

  return (
    <AppLayout>
      <PageHeader
        title="Relatórios"
        subtitle="Analise custos, margem e desempenho dos procedimentos."
        action={
          <div className="w-40">
            <Label>Período</Label>
            <Select value={period} onChange={e => setPeriod(e.target.value as "all" | "30" | "90")}>
              <option value="all">Tudo</option>
              <option value="30">Últimos 30d</option>
              <option value="90">Últimos 90d</option>
            </Select>
          </div>
        }
      />

      {!history.length ? (
        <EmptyState title="Sem dados ainda" description="Realize cálculos no módulo de precificação para ver relatórios aqui." />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatCard accent label="Ticket médio" value={BRL(ticket)} hint={`${filtered.length} cálculos`} />
            <StatCard label="Lucro médio" value={BRL(profit)} />
            <StatCard label="Lucro total estimado" value={BRL(totalProfit)} />
            <StatCard label="Custo médio real" value={BRL(avgRealCost)} />
            <StatCard label="Custo fixo mensal" value={BRL(totalFixed(fixed))} />
            <StatCard label="Custo por hora clínica" value={BRL(fixedPerMinute(fixed, settings) * 60)} />
            <StatCard label="Maior preço" value={highestPrice ? BRL(highestPrice.result.priceCard) : "—"} hint={highestPrice?.procedureName} />
            <StatCard label="Menor margem" value={lowestMargin ? `${lowestMargin.result.netMargin.toFixed(1)}%` : "—"} hint={lowestMargin?.procedureName} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4 mb-4">
            <Card>
              <h2 className="font-display font-bold mb-3">Preço × Lucro por procedimento</h2>
              <div className="h-72">
                <ResponsiveContainer>
                  <BarChart data={barData}>
                    <CartesianGrid stroke="oklch(0.92 0.008 85)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#64748B" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#64748B" />
                    <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 12 }} />
                    <Bar dataKey="Cartão" fill="#C9A24D" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Lucro" fill="#1F2937" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <h2 className="font-display font-bold mb-3">Evolução do ticket e margem</h2>
              <div className="h-72">
                <ResponsiveContainer>
                  <LineChart data={lineData}>
                    <CartesianGrid stroke="oklch(0.92 0.008 85)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#64748B" />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#64748B" />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#64748B" />
                    <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 12 }} />
                    <Line yAxisId="left" dataKey="Ticket" stroke="#C9A24D" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line yAxisId="right" dataKey="Margem" stroke="#1F2937" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card>
            <h2 className="font-display font-bold mb-3">Insumo mais utilizado</h2>
            {topSupply ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{topSupply.name}</div>
                  <div className="text-xs text-muted-foreground">{topSupply.category}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase text-muted-foreground">Usos contabilizados</div>
                  <div className="font-display font-bold text-xl text-gold-gradient">{supplyUsage.get(topSupplyId!) || 0}</div>
                </div>
              </div>
            ) : <p className="text-sm text-muted-foreground">Sem dados de insumos.</p>}
          </Card>
        </>
      )}
    </AppLayout>
  );
}
