import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import {
  PageHeader, Card, Button, Input, Select, Label, Badge, EmptyState,
} from "@/components/ui-bits";
import {
  uid, type SupplyUsage, type CustomCost,
} from "@/lib/store";
import { useSupplies, useFixedCosts, useProcedures, useSettings, useHistory, useProcedureSupplies } from "@/lib/db";
import { BRL, calculate, fixedPerMinute, priceStatus, unitCost } from "@/lib/calc";
import { Plus, Trash2, Save, Printer, Sparkles, AlertCircle, CheckCircle2, XCircle, Pencil } from "lucide-react";
import { z } from "zod";
import { useEffect } from "react";

export const Route = createFileRoute("/precificar")({
  validateSearch: z.object({ p: z.string().optional(), h: z.string().optional() }),
  head: () => ({ meta: [{ title: "Precificar — Oralit" }] }),
  component: Pricing,
});

function Pricing() {
  const search = Route.useSearch();
  const [supplies] = useSupplies();
  const [fixed] = useFixedCosts();
  const [procedures] = useProcedures();
  const [settings] = useSettings();
  const [history, setHistory] = useHistory();

  const fromHistory = search.h ? history.find(h => h.id === search.h) : undefined;
  const initialProc = fromHistory?.procedureId || search.p || procedures[0]?.id || "";

  const [procId, setProcId] = useState<string>(initialProc);
  const proc = procedures.find(p => p.id === procId);
  const [minutes, setMinutes] = useState<number>(fromHistory?.minutes ?? proc?.defaultMinutes ?? 30);
  const [labCost, setLabCost] = useState<number>(fromHistory?.labCost ?? proc?.labCost ?? 0);
  const [otherDirect, setOtherDirect] = useState<number>(fromHistory?.otherDirect ?? proc?.otherDirect ?? 0);
  const [usages, setUsages] = useState<SupplyUsage[]>(fromHistory?.supplies ?? []);
  const [customCosts, setCustomCosts] = useState<CustomCost[]>(fromHistory?.customCosts ?? []);

  const [procSupplies, , procSuppliesLoading] = useProcedureSupplies(procId);
  const [loadedSuppliesFor, setLoadedSuppliesFor] = useState<string>(fromHistory ? initialProc : "");

  const [manualPricePix, setManualPricePix] = useState<number | undefined>(fromHistory?.result?.pricePix);
  const [manualPriceCard, setManualPriceCard] = useState<number | undefined>(fromHistory?.result?.priceCard);
  const [isEditingPix, setIsEditingPix] = useState(false);
  const [isEditingCard, setIsEditingCard] = useState(false);

  useEffect(() => {
    if (procId && !procSuppliesLoading && procId !== loadedSuppliesFor) {
      if (procSupplies.length > 0) {
        setUsages(procSupplies.map(ps => ({ supplyId: ps.supplyId, qty: ps.qty })));
      } else {
        if (!search.h || procId !== initialProc) setUsages([]);
      }
      setLoadedSuppliesFor(procId);
    }
  }, [procId, procSupplies, procSuppliesLoading, loadedSuppliesFor, search.h, initialProc]);

  function onProcChange(id: string) {
    setProcId(id);
    const p = procedures.find(x => x.id === id);
    if (p) {
      setMinutes(p.defaultMinutes);
      setLabCost(p.labCost || 0);
      setOtherDirect(p.otherDirect || 0);
    }
  }

  const suppliesIndex = useMemo(() => Object.fromEntries(supplies.map(s => [s.id, s])), [supplies]);
  const fpm = useMemo(() => fixedPerMinute(fixed, settings), [fixed, settings]);

  const result = useMemo(() => calculate({
    minutes, labCost, otherDirect, supplies: usages, customCosts, suppliesIndex, fixedPerMin: fpm, settings, manualPricePix, manualPriceCard
  }), [minutes, labCost, otherDirect, usages, customCosts, suppliesIndex, fpm, settings, manualPricePix, manualPriceCard]);

  const status = priceStatus(result.netMargin, result.estimatedProfit, settings.marginPct);

  function addUsage() {
    const available = supplies.find(s => !usages.some(u => u.supplyId === s.id));
    if (!available) return toast.error("Todos os insumos já foram adicionados.");
    setUsages([...usages, { supplyId: available.id, qty: 1 }]);
  }
  function updateUsage(i: number, patch: Partial<SupplyUsage>) {
    setUsages(usages.map((u, idx) => idx === i ? { ...u, ...patch } : u));
  }
  function removeUsage(i: number) {
    setUsages(usages.filter((_, idx) => idx !== i));
  }
  function addCustom() {
    setCustomCosts([...customCosts, { name: "", value: 0 }]);
  }
  function updateCustom(i: number, patch: Partial<CustomCost>) {
    setCustomCosts(customCosts.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  }
  function removeCustom(i: number) {
    setCustomCosts(customCosts.filter((_, idx) => idx !== i));
  }

  function saveToHistory() {
    if (!proc) return toast.error("Selecione um procedimento.");
    if (settings.taxPct + settings.cardFeePct >= 100) return toast.error("Taxa total não pode chegar a 100%.");
    setHistory([
      {
        id: uid(),
        createdAt: Date.now(),
        procedureId: proc.id,
        procedureName: proc.name,
        minutes, labCost, otherDirect,
        supplies: usages,
        customCosts,
        result: {
          suppliesCost: result.suppliesCost,
          fixedProportional: result.fixedProportional,
          realCost: result.realCost,
          targetPrice: result.targetPrice,
          pricePix: result.pricePix,
          priceCard: result.priceCard,
          estimatedProfit: result.estimatedProfit,
          netMargin: result.netMargin,
        },
        settings,
      },
      ...history,
    ]);
    toast.success("Cálculo salvo no histórico.");
  }

  if (!procedures.length) {
    return (
      <AppLayout>
        <PageHeader title="Precificar" />
        <EmptyState
          title="Sem procedimentos para precificar"
          description="Cadastre ao menos um procedimento para começar a calcular preços."
          action={<Link to="/procedimentos"><Button variant="gold">Cadastrar procedimento</Button></Link>}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Precificar"
        subtitle="Calcule o preço real considerando material, tempo, estrutura, taxas e margem."
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /> Imprimir</Button>
            <Button variant="gold" size="sm" onClick={saveToHistory}><Save className="h-3.5 w-3.5" /> Salvar</Button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <h2 className="font-display font-bold mb-3">Procedimento</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Label>Selecione</Label>
                <Select value={procId} onChange={e => onProcChange(e.target.value)}>
                  {procedures.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </div>
              <div>
                <Label>Tempo (min)</Label>
                <Input type="number" value={minutes} onChange={e => setMinutes(+e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 mt-3">
              <div>
                <Label hint="R$">Valor do procedimento</Label>
                <Input type="number" step="0.01" value={otherDirect} onChange={e => setOtherDirect(+e.target.value)} />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold">Insumos utilizados</h2>
              <Button variant="outline" size="sm" onClick={addUsage} disabled={!supplies.length}>
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </Button>
            </div>
            {!supplies.length && (
              <p className="text-sm text-muted-foreground">Cadastre insumos para vinculá-los ao procedimento. <Link to="/insumos" className="text-gold-deep font-semibold">Ir para insumos</Link></p>
            )}
            {!!supplies.length && !usages.length && (
              <p className="text-sm text-muted-foreground">Nenhum insumo adicionado ainda.</p>
            )}
            <div className="space-y-2">
              {usages.map((u, i) => {
                const s = suppliesIndex[u.supplyId];
                const subtotal = s ? unitCost(s) * (u.qty || 0) : 0;
                return (
                  <div key={i} className="grid grid-cols-[1fr_80px_100px_auto] gap-2 items-center">
                    <Select value={u.supplyId} onChange={e => updateUsage(i, { supplyId: e.target.value })}>
                      {supplies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </Select>
                    <Input type="number" step="0.01" value={u.qty} onChange={e => updateUsage(i, { qty: +e.target.value })} />
                    <div className="text-right font-semibold text-sm tabular-nums">{BRL(subtotal)}</div>
                    <button className="p-2 text-muted-foreground hover:text-rose-500" onClick={() => removeUsage(i)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold">Custos diretos personalizados</h2>
              <Button variant="outline" size="sm" onClick={addCustom}><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
            </div>
            {!customCosts.length && <p className="text-sm text-muted-foreground">Adicione itens pontuais (guia cirúrgico, escaneamento etc.)</p>}
            <div className="space-y-2">
              {customCosts.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_140px_auto] gap-2">
                  <Input placeholder="Nome do custo" value={c.name} onChange={e => updateCustom(i, { name: e.target.value })} />
                  <Input type="number" step="0.01" placeholder="Valor" value={c.value || ""} onChange={e => updateCustom(i, { value: +e.target.value })} />
                  <button className="p-2 text-muted-foreground hover:text-rose-500" onClick={() => removeCustom(i)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Result */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card-premium p-5 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gold-gradient" />
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-gold font-semibold">
              <Sparkles className="h-3 w-3" /> Resultado
            </div>

            <div className={[
              "mt-3 rounded-xl px-3 py-2 text-sm font-semibold flex items-center gap-2",
              status.tone === "ok" ? "bg-emerald-50 text-emerald-700" :
              status.tone === "warn" ? "bg-amber-50 text-amber-700" :
              "bg-rose-50 text-rose-700",
            ].join(" ")}>
              {status.tone === "ok" ? <CheckCircle2 className="h-4 w-4" /> :
               status.tone === "warn" ? <AlertCircle className="h-4 w-4" /> :
               <XCircle className="h-4 w-4" />}
              {status.label}
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-gold-gradient p-4 text-white">
                <div className="text-[11px] uppercase tracking-wider opacity-90">Preço final · Cartão</div>
                <div className="mt-1 flex items-center gap-2">
                  {isEditingCard ? (
                    <Input 
                      type="number" 
                      step="0.01" 
                      className="w-32 font-bold text-foreground bg-background" 
                      value={manualPriceCard ?? result.priceCard} 
                      onChange={e => setManualPriceCard(+e.target.value)}
                      onBlur={() => setIsEditingCard(false)}
                      autoFocus
                    />
                  ) : (
                    <div className="text-3xl font-display font-extrabold flex items-center gap-2">
                      {BRL(result.priceCard)}
                      <button className="opacity-70 hover:opacity-100 transition-opacity" onClick={() => setIsEditingCard(true)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="text-xs opacity-90 mt-1">Margem líquida {result.netMargin.toFixed(1)}%</div>
              </div>
              <div className="rounded-xl bg-secondary p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Preço final · PIX</div>
                <div className="mt-1 flex items-center gap-2">
                  {isEditingPix ? (
                    <Input 
                      type="number" 
                      step="0.01" 
                      className="w-32 font-bold text-foreground bg-background" 
                      value={manualPricePix ?? result.pricePix} 
                      onChange={e => setManualPricePix(+e.target.value)}
                      onBlur={() => setIsEditingPix(false)}
                      autoFocus
                    />
                  ) : (
                    <div className="text-2xl font-display font-bold flex items-center gap-2">
                      {BRL(result.pricePix)}
                      <button className="text-muted-foreground hover:text-foreground transition-colors" onClick={() => setIsEditingPix(true)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <dl className="mt-5 space-y-2 text-sm">
              {[
                ["Custo real", BRL(result.realCost)],
                ["• Insumos", BRL(result.suppliesCost)],
                ["• Custo fixo proporcional", BRL(result.fixedProportional)],
                ["• Valor do procedimento", BRL(otherDirect)],
                ["• Personalizados", BRL(result.customTotal)],
                ["Impostos (no cartão)", BRL(result.taxesCard)],
                ["Taxa de cartão", BRL(result.feesCard)],
                ["Lucro estimado", BRL(result.estimatedProfit)],
              ].map(([k, v], i) => (
                <div key={i} className={`flex justify-between ${k.toString().startsWith("•") ? "text-xs text-muted-foreground pl-2" : ""}`}>
                  <dt>{k}</dt><dd className="tabular-nums font-semibold">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 pt-4 border-t border-dashed border-border flex flex-wrap gap-1.5">
              <Badge>Margem alvo {settings.marginPct}%</Badge>
              <Badge>Reserva {settings.reservePct}%</Badge>
              <Badge>Imp. {settings.taxPct}%</Badge>
              <Badge>Cartão {settings.cardFeePct}%</Badge>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
