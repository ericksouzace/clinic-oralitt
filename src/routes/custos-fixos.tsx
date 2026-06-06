import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { PageHeader, Card, Button, Input, Label, StatCard, EmptyState } from "@/components/ui-bits";
import { uid } from "@/lib/store";
import { useFixedCosts, useSettings } from "@/lib/db";
import { BRL, fixedPerMinute, totalFixed } from "@/lib/calc";
import { seedFixed } from "@/lib/seed";
import { Plus, Trash2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/custos-fixos")({
  head: () => ({ meta: [{ title: "Custos fixos — Oralit" }] }),
  component: CustosFixos,
});

function CustosFixos() {
  const [costs, setCosts] = useFixedCosts();
  const [settings, setSettings] = useSettings();
  const [name, setName] = useState("");
  const [value, setValue] = useState<number>(0);

  const fpm = fixedPerMinute(costs, settings);
  const total = totalFixed(costs);

  function add() {
    if (!name.trim()) return toast.error("Informe o nome do custo.");
    if (value < 0) return toast.error("Valor inválido.");
    setCosts([...costs, { id: uid(), name: name.trim(), value }]);
    setName(""); setValue(0);
    toast.success("Custo adicionado.");
  }
  function update(id: string, patch: Partial<{ name: string; value: number }>) {
    setCosts(costs.map(c => c.id === id ? { ...c, ...patch } : c));
  }
  function remove(id: string) {
    setCosts(costs.filter(c => c.id !== id));
  }

  return (
    <AppLayout>
      <PageHeader
        title="Custos fixos"
        subtitle="Transforme sua estrutura mensal em custo por minuto clínico."
        action={
          <Button variant="outline" size="sm" onClick={() => { setCosts([...costs, ...seedFixed()]); toast.success("Exemplos carregados."); }}>
            <Sparkles className="h-3.5 w-3.5" /> Exemplo
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total mensal" value={BRL(total)} />
        <StatCard label="Por dia" value={BRL(settings.daysPerMonth ? total / settings.daysPerMonth : 0)} />
        <StatCard label="Por hora clínica" value={BRL(fpm * 60)} />
        <StatCard accent label="Por minuto clínico" value={BRL(fpm)} hint={`${settings.daysPerMonth} dias × ${settings.hoursPerDay}h`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <h2 className="font-display font-bold mb-3">Itens cadastrados</h2>
          {!costs.length && (
            <EmptyState title="Nenhum custo fixo" description="Comece adicionando aluguel, equipe, água, energia e outros gastos mensais." />
          )}
          {costs.length > 0 && (
            <div className="space-y-2">
              {costs.map(c => (
                <div key={c.id} className="grid grid-cols-[1fr_140px_auto] gap-2 items-center">
                  <Input value={c.name} onChange={e => update(c.id, { name: e.target.value })} />
                  <Input type="number" step="0.01" value={c.value} onChange={e => update(c.id, { value: +e.target.value })} />
                  <button className="p-2 text-muted-foreground hover:text-rose-500" onClick={() => remove(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 pt-5 border-t border-dashed border-border">
            <Label>Adicionar custo personalizado</Label>
            <div className="grid grid-cols-[1fr_140px_auto] gap-2">
              <Input placeholder="Ex.: Esterilização terceirizada" value={name} onChange={e => setName(e.target.value)} />
              <Input type="number" placeholder="Valor" step="0.01" value={value || ""} onChange={e => setValue(+e.target.value)} />
              <Button variant="gold" onClick={add}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="font-display font-bold mb-3">Tempo útil mensal</h2>
          <div className="space-y-3">
            <div>
              <Label>Dias trabalhados/mês</Label>
              <Input type="number" value={settings.daysPerMonth} onChange={e => setSettings({ ...settings, daysPerMonth: +e.target.value })} />
            </div>
            <div>
              <Label>Horas clínicas/dia</Label>
              <Input type="number" value={settings.hoursPerDay} onChange={e => setSettings({ ...settings, hoursPerDay: +e.target.value })} />
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-gold-gradient/10 border border-gold/30 p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Tempo útil</div>
            <div className="font-display font-bold text-xl">
              {settings.daysPerMonth * settings.hoursPerDay} h
            </div>
            <div className="text-xs text-muted-foreground">
              = {settings.daysPerMonth * settings.hoursPerDay * 60} minutos clínicos/mês
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
