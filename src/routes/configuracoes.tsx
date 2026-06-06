import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { PageHeader, Card, Button, Input, Label, Select } from "@/components/ui-bits";
import { useSettings } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/store";
import { Save } from "lucide-react";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Oralit" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [s, set] = useSettings();
  const [draft, setDraft] = useState(s);

  // Sincroniza o draft quando as configurações carregam do banco
  useEffect(() => {
    setDraft(s);
  }, [s]);

  const totalTaxes = draft.taxPct + draft.cardFeePct;
  const invalid = totalTaxes >= 100;

  async function handleSave() {
    if (invalid) return toast.error("A taxa total não pode ser >= 100%.");
    try {
      await set(draft);
      toast.success("Configurações salvas com sucesso!");
    } catch (e) {
      // O erro já é mostrado no toast pelo lib/db.ts, mas garantimos o catch aqui
    }
  }

  return (
    <AppLayout>
      <PageHeader
        title="Configurações financeiras"
        subtitle="Defina margem, impostos, taxas e tempo útil mensal."
        action={
          <Button variant="gold" onClick={handleSave} disabled={invalid}>
            <Save className="h-4 w-4 mr-2" /> Salvar alterações
          </Button>
        }
      />

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h2 className="font-display font-bold mb-3">Margem e impostos</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label hint="%">Margem de lucro</Label>
              <Input type="number" step="0.1" value={draft.marginPct} onChange={e => setDraft({ ...draft, marginPct: +e.target.value })} />
            </div>
            <div>
              <Label hint="%">Reserva técnica</Label>
              <Input type="number" step="0.1" value={draft.reservePct} onChange={e => setDraft({ ...draft, reservePct: +e.target.value })} />
            </div>
            <div>
              <Label hint="%">Impostos</Label>
              <Input type="number" step="0.1" value={draft.taxPct} onChange={e => setDraft({ ...draft, taxPct: +e.target.value })} />
            </div>
            <div>
              <Label hint="%">Taxa de cartão</Label>
              <Input type="number" step="0.1" value={draft.cardFeePct} onChange={e => setDraft({ ...draft, cardFeePct: +e.target.value })} />
            </div>
          </div>
          {invalid && (
            <div className="mt-3 rounded-lg bg-rose-50 text-rose-700 px-3 py-2 text-xs font-semibold">
              A taxa total (impostos + cartão = {totalTaxes.toFixed(1)}%) não pode chegar a 100%.
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-display font-bold mb-3">Tempo clínico mensal</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Dias trabalhados/mês</Label>
              <Input type="number" value={draft.daysPerMonth} onChange={e => setDraft({ ...draft, daysPerMonth: +e.target.value })} />
            </div>
            <div>
              <Label>Horas clínicas/dia</Label>
              <Input type="number" value={draft.hoursPerDay} onChange={e => setDraft({ ...draft, hoursPerDay: +e.target.value })} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Esse tempo é a base para distribuir o custo fixo por minuto clínico.
          </p>
        </Card>

        <Card>
          <h2 className="font-display font-bold mb-3">Arredondamento</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Modo</Label>
              <Select value={[0, 5, 10, 50, 100].includes(draft.rounding) ? String(draft.rounding) : "custom"} onChange={e => {
                const v = e.target.value;
                if (v === "custom") setDraft({ ...draft, rounding: 1 });
                else setDraft({ ...draft, rounding: +v });
              }}>
                <option value="0">Sem arredondamento</option>
                <option value="5">R$ 5</option>
                <option value="10">R$ 10</option>
                <option value="50">R$ 50</option>
                <option value="100">R$ 100</option>
                <option value="custom">Personalizado</option>
              </Select>
            </div>
            <div>
              <Label>Múltiplo de R$</Label>
              <Input type="number" step="0.01" value={draft.rounding} onChange={e => setDraft({ ...draft, rounding: +e.target.value })} />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="font-display font-bold mb-3">Dados Padrão</h2>
          <p className="text-xs text-muted-foreground mb-3">Se você modificou as configurações e não gostou, pode restaurar os valores padrão recomendados.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { setDraft(DEFAULT_SETTINGS); toast.info("Valores padrão aplicados. Clique em Salvar para gravar."); }}>
              Carregar valores padrão
            </Button>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
