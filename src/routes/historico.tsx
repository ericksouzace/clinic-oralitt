import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { PageHeader, Card, Button, Input, Badge, EmptyState } from "@/components/ui-bits";
import { useHistory } from "@/lib/db";
import { BRL } from "@/lib/calc";
import { Download, Trash2, Calculator, Copy, Search } from "lucide-react";

export const Route = createFileRoute("/historico")({
  head: () => ({ meta: [{ title: "Histórico — Oralit" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const [history, setHistory] = useHistory();
  const [q, setQ] = useState("");

  const filtered = history.filter(h =>
    !q || h.procedureName.toLowerCase().includes(q.toLowerCase())
  );

  function remove(id: string) {
    if (!confirm("Excluir registro?")) return;
    setHistory(history.filter(h => h.id !== id));
  }
  function duplicate(id: string) {
    const h = history.find(x => x.id === id);
    if (!h) return;
    setHistory([{ ...h, id: Math.random().toString(36).slice(2) + Date.now(), createdAt: Date.now() }, ...history]);
    toast.success("Cálculo duplicado.");
  }
  function exportCsv() {
    const header = "Data,Procedimento,Min,Custo real,Preço PIX,Preço cartão,Lucro,Margem%\n";
    const body = history.map(h => [
      new Date(h.createdAt).toLocaleString("pt-BR"),
      h.procedureName, h.minutes,
      h.result.realCost.toFixed(2), h.result.pricePix.toFixed(2),
      h.result.priceCard.toFixed(2), h.result.estimatedProfit.toFixed(2),
      h.result.netMargin.toFixed(2),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "oralit-historico.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppLayout>
      <PageHeader
        title="Histórico"
        subtitle="Consulte cálculos anteriores e acompanhe sua evolução financeira."
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>Imprimir</Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!history.length}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
        }
      />

      {!history.length ? (
        <EmptyState
          title="Sem cálculos salvos"
          description="Quando você precificar um procedimento, ele aparecerá aqui."
          action={<Link to="/precificar"><Button variant="gold"><Calculator className="h-4 w-4" /> Precificar</Button></Link>}
        />
      ) : (
        <Card>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar procedimento…" value={q} onChange={e => setQ(e.target.value)} />
          </div>

          <div className="space-y-2">
            {filtered.map(h => {
              const tone: "ok" | "warn" | "danger" =
                h.result.estimatedProfit <= 0 ? "danger" :
                h.result.netMargin < h.settings.marginPct * 0.6 ? "warn" : "ok";
              return (
                <div key={h.id} className="rounded-xl border border-border p-3 sm:p-4 hover:border-gold transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString("pt-BR")}</div>
                      <div className="font-semibold mt-0.5">{h.procedureName}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Badge>{h.minutes} min</Badge>
                        <Badge tone={tone}>Margem {h.result.netMargin.toFixed(1)}%</Badge>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Cartão</div>
                      <div className="font-display font-bold text-lg text-gold-gradient">{BRL(h.result.priceCard)}</div>
                      <div className="text-xs text-muted-foreground">PIX {BRL(h.result.pricePix)}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link to="/precificar" search={{ h: h.id } as never} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">Reabrir</Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => duplicate(h.id)}><Copy className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(h.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              );
            })}
            {!filtered.length && <div className="py-10 text-center text-sm text-muted-foreground">Nada encontrado.</div>}
          </div>
        </Card>
      )}
    </AppLayout>
  );
}
