import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button, Card } from "@/components/ui-bits";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserOrThrow } from "@/lib/db";
import { uid } from "@/lib/store";

export function ImportLocalStorage() {
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasKeys = Object.keys(localStorage).some(k => k.startsWith("oralit:"));
    setHasData(hasKeys);
  }, []);

  const handleImport = async () => {
    if (!confirm("Isso vai importar todos os dados locais antigos (insumos, custos fixos, procedimentos, histórico) para sua conta na nuvem (Supabase). Deseja continuar?")) return;

    try {
      setLoading(true);
      const user = await getCurrentUserOrThrow();

      // Read local storage
      const readLocal = (key: string) => {
        try {
          const item = localStorage.getItem(`oralit:${key}`);
          return item ? JSON.parse(item) : [];
        } catch {
          return [];
        }
      };

      const supplies = readLocal("supplies");
      const fixedCosts = readLocal("fixedCosts");
      const procedures = readLocal("procedures");
      const history = readLocal("history");
      const customSupplyCats = readLocal("supplyCats");
      const customProcCats = readLocal("procCats");

      let count = 0;

      if (supplies.length > 0) {
        const payload = supplies.map((s: any) => ({
          id: s.id || uid(),
          user_id: user.id,
          name: s.name,
          category: s.category,
          brand: s.brand || null,
          package_cost: s.packCost || 0,
          yield_quantity: s.packYield || 1,
          unit: s.unit || null,
          stock_quantity: s.stock || null,
          minimum_stock: s.minStock || null,
          notes: s.note || null,
        }));
        const { error } = await supabase.from("supplies").insert(payload);
        if (error) throw error;
        count += payload.length;
      }

      if (fixedCosts.length > 0) {
        const payload = fixedCosts.map((c: any) => ({
          id: c.id || uid(),
          user_id: user.id,
          name: c.name,
          amount: c.value || 0,
        }));
        const { error } = await supabase.from("fixed_costs").insert(payload);
        if (error) throw error;
        count += payload.length;
      }

      if (procedures.length > 0) {
        const payload = procedures.map((p: any) => ({
          id: p.id || uid(),
          user_id: user.id,
          name: p.name,
          category: p.category,
          default_time_minutes: p.defaultMinutes || 30,
          lab_cost: p.labCost || 0,
          other_direct_costs: p.otherDirect || 0,
          notes: p.note || null,
        }));
        const { error } = await supabase.from("procedures").insert(payload);
        if (error) throw error;
        count += payload.length;
      }

      if (history.length > 0) {
        const payload = history.map((h: any) => ({
          id: h.id || uid(),
          user_id: user.id,
          procedure_id: h.procedureId || null,
          procedure_name: h.procedureName || "Sem nome",
          total_supply_cost: h.result?.suppliesCost || 0,
          fixed_cost: h.result?.fixedProportional || 0,
          lab_cost: h.labCost || 0,
          other_costs: h.otherDirect || 0,
          real_cost: h.result?.realCost || 0,
          suggested_price_pix: h.result?.pricePix || 0,
          suggested_price_card: h.result?.priceCard || 0,
          estimated_profit: h.result?.estimatedProfit || 0,
          net_margin: h.result?.netMargin || 0,
          created_at: h.createdAt ? new Date(h.createdAt).toISOString() : undefined,
        }));
        const { error } = await supabase.from("pricing_history").insert(payload);
        if (error) throw error;
        count += payload.length;
      }

      if (customSupplyCats.length > 0) {
        const payload = customSupplyCats.map((c: any) => ({
          user_id: user.id,
          type: "supply_category",
          name: typeof c === 'string' ? c : c.name
        }));
        await supabase.from("custom_categories").insert(payload);
      }

      if (customProcCats.length > 0) {
        const payload = customProcCats.map((c: any) => ({
          user_id: user.id,
          type: "procedure_category",
          name: typeof c === 'string' ? c : c.name
        }));
        await supabase.from("custom_categories").insert(payload);
      }

      toast.success(`${count} registros importados com sucesso! Recarregue a página para ver.`);
      setHasData(false); // hide the button to prevent duplicate imports
    } catch (e: any) {
      console.error("[Import] error:", e);
      toast.error("Erro na importação: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!hasData) return null;

  return (
    <Card className="border-gold bg-gold/5 mt-4">
      <h3 className="font-display font-bold text-gold-deep mb-2">Migração de Dados</h3>
      <p className="text-sm mb-4 text-foreground/80">
        Encontramos dados antigos salvos apenas no seu navegador. Deseja enviá-los para a nuvem para acessá-los de qualquer dispositivo?
      </p>
      <Button variant="gold" onClick={handleImport} disabled={loading}>
        {loading ? "Importando..." : "Importar dados locais para a nuvem"}
      </Button>
    </Card>
  );
}
