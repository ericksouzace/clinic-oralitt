import React, { useState } from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Input, Label, Textarea } from "@/components/ui-bits";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteClinicalRecord, useClinicalRecords } from "@/lib/db";
import type { ClinicalRecord } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  patientId: string;
}

const TOOTH_NUMBERS = [
  "18", "17", "16", "15", "14", "13", "12", "11",
  "21", "22", "23", "24", "25", "26", "27", "28",
  "48", "47", "46", "45", "44", "43", "42", "41",
  "31", "32", "33", "34", "35", "36", "37", "38",
];

const LINK_MARKER_REGEX = /\[\[ORALIT_TP_ITEM:([^\]]+)\]\]/g;

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function getVisibleNotes(notes?: string) {
  return (notes || "").replace(LINK_MARKER_REGEX, "").trim();
}

function getLinkMarkers(notes?: string) {
  const matches = (notes || "").match(/\[\[ORALIT_TP_ITEM:[^\]]+\]\]/g);
  return matches?.join("\n") || "";
}

function getLinkedItemIds(notes?: string) {
  const ids: string[] = [];
  const text = notes || "";
  let match: RegExpExecArray | null;
  LINK_MARKER_REGEX.lastIndex = 0;
  while ((match = LINK_MARKER_REGEX.exec(text)) !== null) {
    ids.push(match[1]);
  }
  LINK_MARKER_REGEX.lastIndex = 0;
  return ids;
}

function formatDate(value: string) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export function ClinicalRecordTab({ patientId }: Props) {
  const [records, error, loading, tablesMissing, refetch] = useClinicalRecords(patientId);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<ClinicalRecord>>({});
  const [selectTeeth, setSelectTeeth] = useState(false);
  const [linkMarkers, setLinkMarkers] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openNewRecordModal = () => {
    setDraft({
      recordDate: getToday(),
      description: "",
      teeth: [],
      chargedAmount: 0,
      notes: "",
      realCost: 0,
      estimatedProfit: 0,
    });
    setSelectTeeth(false);
    setLinkMarkers("");
    setIsModalOpen(true);
  };

  const openEditRecordModal = (record: ClinicalRecord) => {
    setDraft({
      ...record,
      notes: getVisibleNotes(record.notes),
    });
    setSelectTeeth(Boolean(record.teeth && record.teeth.length > 0));
    setLinkMarkers(getLinkMarkers(record.notes));
    setIsModalOpen(true);
  };

  const toggleTooth = (tooth: string) => {
    setDraft((current) => {
      const teeth = current.teeth || [];
      return {
        ...current,
        teeth: teeth.includes(tooth)
          ? teeth.filter((item) => item !== tooth)
          : [...teeth, tooth],
      };
    });
  };

  const handleSave = async () => {
    if (saving) return;

    if (!draft.recordDate) {
      toast.error("Informe a data.");
      return;
    }

    if (!draft.description?.trim()) {
      toast.error("Informe o procedimento.");
      return;
    }

    try {
      setSaving(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const chargedAmount = Math.max(0, Number(draft.chargedAmount || 0));
      const realCost = Number(draft.realCost || 0);
      const visibleNotes = draft.notes?.trim() || "";
      const notes = [linkMarkers, visibleNotes].filter(Boolean).join("\n") || null;
      const teeth = selectTeeth ? draft.teeth || [] : [];

      const payload = {
        user_id: userData.user.id,
        patient_id: patientId,
        procedure_id: draft.procedureId || null,
        record_date: draft.recordDate,
        teeth,
        description: draft.description.trim(),
        notes,
        charged_amount: chargedAmount,
        real_cost: realCost,
        estimated_profit: chargedAmount - realCost,
        signature: draft.signature || null,
        updated_at: new Date().toISOString(),
      };

      if (draft.id && !draft.id.startsWith("temp-")) {
        const { error: updateError } = await supabase
          .from("clinical_records")
          .update(payload)
          .eq("id", draft.id)
          .eq("user_id", userData.user.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("clinical_records")
          .insert(payload);

        if (insertError) throw insertError;
      }

      toast.success(draft.id ? "Registro atualizado." : "Registro adicionado.");
      setIsModalOpen(false);
      refetch();
    } catch (saveError: any) {
      toast.error(saveError?.message || "Não foi possível salvar o registro.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: ClinicalRecord) => {
    try {
      setDeletingId(record.id);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const linkedItemIds = getLinkedItemIds(record.notes);
      for (const itemId of linkedItemIds) {
        const { error: itemError } = await supabase
          .from("treatment_plan_items")
          .update({
            status: "planejado",
            updated_at: new Date().toISOString(),
          })
          .eq("id", itemId)
          .eq("user_id", userData.user.id);

        if (itemError) throw itemError;
      }

      await deleteClinicalRecord(record.id);
      toast.success("Registro removido.");
      refetch();
    } catch (deleteError: any) {
      toast.error(deleteError?.message || "Não foi possível remover o registro.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-10 text-center text-sm font-medium text-muted-foreground">
        Carregando ficha clínica...
      </div>
    );
  }

  if (tablesMissing) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
        Estrutura da ficha clínica indisponível.
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
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button
          type="button"
          className="bg-[#C9A227] font-semibold text-white hover:bg-[#b59122]"
          onClick={openNewRecordModal}
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar registro
        </Button>
      </div>

      <Card className="overflow-hidden border border-border bg-white p-0">
        <div className="grid grid-cols-[140px_minmax(0,1fr)_minmax(120px,190px)_140px_88px] items-center gap-3 border-b border-border bg-secondary/30 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Data</span>
          <span>Procedimento</span>
          <span>Dentes</span>
          <span className="text-right">Valor</span>
          <span className="text-right">Ações</span>
        </div>

        {records.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhum registro na ficha clínica.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {records.map((record) => {
              const observations = getVisibleNotes(record.notes);

              return (
                <div
                  key={record.id}
                  className="grid grid-cols-[140px_minmax(0,1fr)_minmax(120px,190px)_140px_88px] items-center gap-3 px-4 py-3"
                >
                  <span className="text-sm font-medium text-foreground">
                    {formatDate(record.recordDate)}
                  </span>

                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {record.description || record.procedureName || "Procedimento"}
                    </div>
                    {observations && (
                      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {observations}
                      </div>
                    )}
                  </div>

                  <span className="text-sm text-muted-foreground">
                    {record.teeth && record.teeth.length > 0
                      ? record.teeth.join(", ")
                      : "—"}
                  </span>

                  <span className="text-right text-sm font-semibold text-[#8A6A16]">
                    {formatCurrency(Number(record.chargedAmount || 0))}
                  </span>

                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => openEditRecordModal(record)}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      disabled={deletingId === record.id}
                      onClick={() => void handleDelete(record)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar registro" : "Novo registro"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-3">
            <div className="grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)_210px_160px]">
              <div>
                <Label>Data</Label>
                <Input
                  type="date"
                  value={draft.recordDate || ""}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      recordDate: event.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <Label>Procedimento</Label>
                <Input
                  value={draft.description || ""}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      procedureId: undefined,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Digite o procedimento"
                  autoFocus
                />
              </div>

              <div>
                <Label>Dentes</Label>
                <label className="flex h-10 items-center justify-between rounded-lg border border-input bg-white px-3 text-sm">
                  <span>{selectTeeth ? "Selecionar" : "Sem seleção"}</span>
                  <input
                    type="checkbox"
                    checked={selectTeeth}
                    onChange={(event) => {
                      setSelectTeeth(event.target.checked);
                      if (!event.target.checked) {
                        setDraft((current) => ({ ...current, teeth: [] }));
                      }
                    }}
                    className="h-5 w-5 accent-[#C9A227]"
                  />
                </label>
              </div>

              <div>
                <Label>Valor</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    R$
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.chargedAmount ?? 0}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        chargedAmount: Number(event.target.value || 0),
                      }))
                    }
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {selectTeeth && (
              <div className="grid grid-cols-8 gap-2 rounded-xl border border-border bg-secondary/20 p-3">
                {TOOTH_NUMBERS.map((tooth) => {
                  const selected = (draft.teeth || []).includes(tooth);
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

            <div>
              <Label>Observações</Label>
              <Textarea
                rows={4}
                value={draft.notes || ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                placeholder="Observações"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-[#C9A227] font-semibold text-white hover:bg-[#b59122]"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
