import React, { useEffect, useMemo, useState } from "react";
import { Check, Edit3, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Input, Label, Select } from "@/components/ui-bits";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteClinicalRecord,
  deleteTreatmentPlanItem,
  saveTreatmentPlanItem,
  useProcedures,
  useTreatmentPlans,
} from "@/lib/db";
import type { TreatmentPlanItem } from "@/lib/store";
import { uid } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  patientId: string;
}

type InternalTab = "plano" | "orcamento";

const TOOTH_NUMBERS = [
  "18", "17", "16", "15", "14", "13", "12", "11",
  "21", "22", "23", "24", "25", "26", "27", "28",
  "48", "47", "46", "45", "44", "43", "42", "41",
  "31", "32", "33", "34", "35", "36", "37", "38",
];

const LINK_MARKER_PREFIX = "[[ORALIT_TP_ITEM:";

function getLinkMarker(itemId: string) {
  return `${LINK_MARKER_PREFIX}${itemId}]]`;
}

function getItemLabel(
  item: TreatmentPlanItem,
  procedures: { id: string; name: string }[],
) {
  return (
    item.description ||
    item.procedureName ||
    procedures.find((procedure) => procedure.id === item.procedureId)?.name ||
    "Procedimento"
  );
}

function parseTeeth(value?: string) {
  return (value || "")
    .split(",")
    .map((tooth) => tooth.trim())
    .filter(Boolean);
}

export function TreatmentPlanTab({ patientId }: Props) {
  const [plans, error, loading, tablesMissing] = useTreatmentPlans(patientId);
  const [procedures] = useProcedures();

  const [internalTab, setInternalTab] = useState<InternalTab>("plano");
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemDraft, setItemDraft] = useState<Partial<TreatmentPlanItem>>({});
  const [useTeeth, setUseTeeth] = useState(false);
  const [selectedTeeth, setSelectedTeeth] = useState<string[]>([]);
  const [savingItem, setSavingItem] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});

  const allItems = useMemo(
    () =>
      plans
        .flatMap((plan) => plan.items || [])
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
    [plans],
  );

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const item of allItems) {
      next[item.id] = String(item.estimatedPrice || 0);
    }
    setPriceDrafts(next);
  }, [allItems]);

  const totalBudget = allItems.reduce((sum, item) => {
    const draft = Number(priceDrafts[item.id]);
    return sum + (Number.isFinite(draft) ? draft : item.estimatedPrice || 0);
  }, 0);

  const ensurePlanId = async () => {
    if (plans[0]?.id) return plans[0].id;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("Não autenticado");

    const { data, error: insertError } = await supabase
      .from("treatment_plans")
      .insert({
        user_id: userData.user.id,
        patient_id: patientId,
        title: "Plano de Tratamento",
        diagnosis: null,
        notes: null,
        status: "planejado",
        start_date: new Date().toISOString().split("T")[0],
        expected_end_date: null,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;
    return data.id as string;
  };

  const openNewItemModal = () => {
    setItemDraft({
      priority: "média",
      status: "planejado",
      estimatedPrice: 0,
    });
    setUseTeeth(false);
    setSelectedTeeth([]);
    setIsItemModalOpen(true);
  };

  const openEditItemModal = (item: TreatmentPlanItem) => {
    const teeth = parseTeeth(item.toothNumber);
    setItemDraft(item);
    setUseTeeth(teeth.length > 0);
    setSelectedTeeth(teeth);
    setIsItemModalOpen(true);
  };

  const toggleTooth = (tooth: string) => {
    setSelectedTeeth((current) =>
      current.includes(tooth)
        ? current.filter((item) => item !== tooth)
        : [...current, tooth],
    );
  };

  const handleProcedureSelect = (procedureId: string) => {
    const procedure = procedures.find((item) => item.id === procedureId);
    setItemDraft((current) => ({
      ...current,
      procedureId: procedureId || undefined,
      description: procedure?.name || current.description,
    }));
  };

  const handleSaveItem = async () => {
    if (savingItem) return;
    if (!itemDraft.procedureId && !itemDraft.description?.trim()) {
      toast.error("Selecione um procedimento.");
      return;
    }

    try {
      setSavingItem(true);
      const treatmentPlanId = itemDraft.treatmentPlanId || (await ensurePlanId());
      const now = new Date().toISOString();
      const procedure = procedures.find(
        (candidate) => candidate.id === itemDraft.procedureId,
      );

      const item: TreatmentPlanItem = {
        id: itemDraft.id || `temp-${uid()}`,
        userId: itemDraft.userId || "",
        treatmentPlanId,
        procedureId: itemDraft.procedureId,
        toothNumber:
          useTeeth && selectedTeeth.length > 0
            ? selectedTeeth.join(", ")
            : undefined,
        toothRegion: undefined,
        description: itemDraft.description || procedure?.name,
        priority: itemDraft.priority || "média",
        estimatedPrice: itemDraft.estimatedPrice || 0,
        status: itemDraft.status || "planejado",
        createdAt: itemDraft.createdAt || now,
        updatedAt: now,
      };

      await saveTreatmentPlanItem(item);
      if (item.status === "concluído") {
        await syncLinkedClinicalRecordDetails(item);
      }
      toast.success(itemDraft.id ? "Procedimento atualizado." : "Procedimento adicionado.");
      setIsItemModalOpen(false);
      window.location.reload();
    } catch (saveError: any) {
      toast.error(saveError?.message || "Não foi possível salvar o procedimento.");
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (item: TreatmentPlanItem) => {
    try {
      setBusyItemId(item.id);
      if (item.status === "concluído") {
        await removeLinkedClinicalRecord(item.id);
      }
      await deleteTreatmentPlanItem(item.id);
      toast.success("Procedimento removido.");
      window.location.reload();
    } catch (deleteError: any) {
      toast.error(deleteError?.message || "Não foi possível remover o procedimento.");
    } finally {
      setBusyItemId(null);
    }
  };

  const findLinkedClinicalRecords = async (itemId: string) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("Não autenticado");

    const { data, error: queryError } = await supabase
      .from("clinical_records")
      .select("id, real_cost")
      .eq("user_id", userData.user.id)
      .eq("patient_id", patientId)
      .ilike("notes", `%${getLinkMarker(itemId)}%`);

    if (queryError) throw queryError;
    return data || [];
  };

  const removeLinkedClinicalRecord = async (itemId: string) => {
    const linked = await findLinkedClinicalRecords(itemId);
    for (const record of linked) {
      await deleteClinicalRecord(record.id);
    }
  };

  const syncLinkedClinicalRecordDetails = async (item: TreatmentPlanItem) => {
    const linked = await findLinkedClinicalRecords(item.id);
    if (linked.length === 0) return;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("Não autenticado");

    const amount = Number(item.estimatedPrice || 0);
    const teeth = parseTeeth(item.toothNumber);
    const description = getItemLabel(item, procedures);

    for (const record of linked) {
      const realCost = Number(record.real_cost || 0);
      const { error: updateError } = await supabase
        .from("clinical_records")
        .update({
          procedure_id: item.procedureId || null,
          teeth,
          description,
          charged_amount: amount,
          estimated_profit: amount - realCost,
          updated_at: new Date().toISOString(),
        })
        .eq("id", record.id)
        .eq("user_id", userData.user.id);

      if (updateError) throw updateError;
    }
  };

  const syncLinkedClinicalAmount = async (
    item: TreatmentPlanItem,
    amount: number,
  ) => {
    if (item.status !== "concluído") return;

    const linked = await findLinkedClinicalRecords(item.id);
    if (linked.length === 0) return;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("Não autenticado");

    for (const record of linked) {
      const realCost = Number(record.real_cost || 0);
      const { error: updateError } = await supabase
        .from("clinical_records")
        .update({
          charged_amount: amount,
          estimated_profit: amount - realCost,
          updated_at: new Date().toISOString(),
        })
        .eq("id", record.id)
        .eq("user_id", userData.user.id);

      if (updateError) throw updateError;
    }
  };

  const saveItemPrice = async (item: TreatmentPlanItem) => {
    const amount = Math.max(0, Number(priceDrafts[item.id]) || 0);
    await saveTreatmentPlanItem({
      ...item,
      estimatedPrice: amount,
      updatedAt: new Date().toISOString(),
    });
    await syncLinkedClinicalAmount(item, amount);
    return amount;
  };

  const handlePerformedChange = async (
    item: TreatmentPlanItem,
    checked: boolean,
  ) => {
    try {
      setBusyItemId(item.id);
      const amount = await saveItemPrice(item);
      const nextStatus = checked ? "concluído" : "planejado";

      await saveTreatmentPlanItem({
        ...item,
        estimatedPrice: amount,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });

      if (checked) {
        const linked = await findLinkedClinicalRecords(item.id);
        const procedure = procedures.find(
          (candidate) => candidate.id === item.procedureId,
        );
        const label = getItemLabel(item, procedures);
        const teeth = parseTeeth(item.toothNumber);

        if (linked.length === 0) {
          const { data: userData } = await supabase.auth.getUser();
          if (!userData.user) throw new Error("Não autenticado");

          const { error: insertError } = await supabase
            .from("clinical_records")
            .insert({
              user_id: userData.user.id,
              patient_id: patientId,
              procedure_id: item.procedureId || null,
              record_date: new Date().toISOString().split("T")[0],
              teeth,
              description: label,
              notes: getLinkMarker(item.id),
              charged_amount: amount,
              real_cost: 0,
              estimated_profit: amount,
              signature: null,
            });

          if (insertError) throw insertError;
        } else {
          const { data: userData } = await supabase.auth.getUser();
          if (!userData.user) throw new Error("Não autenticado");

          for (const record of linked) {
            const realCost = Number(record.real_cost || 0);
            const { error: updateError } = await supabase
              .from("clinical_records")
              .update({
                procedure_id: item.procedureId || null,
                teeth,
                description: label,
                charged_amount: amount,
                estimated_profit: amount - realCost,
                updated_at: new Date().toISOString(),
              })
              .eq("id", record.id)
              .eq("user_id", userData.user.id);

            if (updateError) throw updateError;
          }
        }

        toast.success(`${procedure?.name || label} registrado na ficha clínica.`);
      } else {
        await removeLinkedClinicalRecord(item.id);
        toast.success("Registro removido da ficha clínica.");
      }

      window.location.reload();
    } catch (syncError: any) {
      toast.error(syncError?.message || "Não foi possível sincronizar o procedimento.");
    } finally {
      setBusyItemId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-10 text-center text-sm font-medium text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (tablesMissing) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
        Estrutura do plano de tratamento indisponível.
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setInternalTab("plano")}
          className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            internalTab === "plano"
              ? "border-[#C9A227] text-[#C9A227]"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Plano de Tratamento
        </button>
        <button
          type="button"
          onClick={() => setInternalTab("orcamento")}
          className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            internalTab === "orcamento"
              ? "border-[#C9A227] text-[#C9A227]"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Orçamento
        </button>
      </div>

      {internalTab === "plano" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              type="button"
              className="bg-[#C9A227] font-semibold text-white hover:bg-[#b59122]"
              onClick={openNewItemModal}
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar procedimento
            </Button>
          </div>

          <Card className="overflow-hidden border border-border bg-white p-0">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(140px,220px)_96px] border-b border-border bg-secondary/30 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Procedimento</span>
              <span>Dentes</span>
              <span className="text-right">Ações</span>
            </div>

            {allItems.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Nenhum procedimento adicionado.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {allItems.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(140px,220px)_96px] items-center gap-3 px-4 py-3"
                  >
                    <span className="truncate text-sm font-medium text-foreground">
                      {getItemLabel(item, procedures)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {item.toothNumber || "—"}
                    </span>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openEditItemModal(item)}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        disabled={busyItemId === item.id}
                        onClick={() => void handleDeleteItem(item)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <Card className="overflow-hidden border border-border bg-white p-0">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(110px,170px)_minmax(130px,180px)_56px] items-center border-b border-border bg-secondary/30 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Procedimento</span>
              <span>Dentes</span>
              <span>Valor</span>
              <span />
            </div>

            {allItems.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Nenhum procedimento adicionado.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {allItems.map((item) => {
                  const checked = item.status === "concluído";
                  const busy = busyItemId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(110px,170px)_minmax(130px,180px)_56px] items-center gap-3 px-4 py-3"
                    >
                      <span className="truncate text-sm font-medium text-foreground">
                        {getItemLabel(item, procedures)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {item.toothNumber || "—"}
                      </span>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          R$
                        </span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={priceDrafts[item.id] ?? "0"}
                          onChange={(event) =>
                            setPriceDrafts((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                          onBlur={() => void saveItemPrice(item)}
                          className="h-9 pl-10"
                        />
                      </div>
                      <div className="flex justify-end">
                        <label className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-[#d8c178] bg-white transition hover:bg-[#fff9e8]">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={busy}
                            onChange={(event) =>
                              void handlePerformedChange(item, event.target.checked)
                            }
                            className="peer sr-only"
                            aria-label={`Marcar ${getItemLabel(item, procedures)} como realizado`}
                          />
                          <span className="grid h-5 w-5 place-items-center rounded border-2 border-[#C9A227] bg-white text-white peer-checked:bg-[#C9A227]">
                            {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                          </span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border bg-[#fcfbf8] px-4 py-4">
              <span className="text-sm font-semibold text-foreground">Total</span>
              <span className="text-lg font-bold text-[#8A6A16]">
                {formatCurrency(totalBudget)}
              </span>
            </div>
          </Card>
        </div>
      )}

      <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {itemDraft.id ? "Editar procedimento" : "Adicionar procedimento"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-3">
            <div>
              <Label>Procedimento</Label>
              <Select
                value={itemDraft.procedureId || ""}
                onChange={(event) => handleProcedureSelect(event.target.value)}
              >
                <option value="">Selecione...</option>
                {procedures.map((procedure) => (
                  <option key={procedure.id} value={procedure.id}>
                    {procedure.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <Label className="mb-0">Selecionar dentes</Label>
              <input
                type="checkbox"
                checked={useTeeth}
                onChange={(event) => {
                  setUseTeeth(event.target.checked);
                  if (!event.target.checked) setSelectedTeeth([]);
                }}
                className="h-5 w-5 accent-[#C9A227]"
              />
            </div>

            {useTeeth && (
              <div className="grid grid-cols-8 gap-2 rounded-xl border border-border bg-secondary/20 p-3">
                {TOOTH_NUMBERS.map((tooth) => {
                  const selected = selectedTeeth.includes(tooth);
                  return (
                    <button
                      key={tooth}
                      type="button"
                      onClick={() => toggleTooth(tooth)}
                      className={`h-9 rounded-lg border text-sm font-semibold transition ${
                        selected
                          ? "border-[#C9A227] bg-[#fff7dc] text-[#8A6A16]"
                          : "border-border bg-white text-foreground hover:border-[#C9A227]/60"
                      }`}
                    >
                      {tooth}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsItemModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-[#C9A227] font-semibold text-white hover:bg-[#b59122]"
              disabled={savingItem}
              onClick={() => void handleSaveItem()}
            >
              {savingItem ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
