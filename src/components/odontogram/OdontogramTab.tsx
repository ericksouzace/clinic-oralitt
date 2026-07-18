import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Label, Textarea } from "@/components/ui-bits";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOdontogramEntries } from "@/lib/db";
import { STATUS_COLORS, TOOTH_STATUS } from "@/lib/store";
import { OdontogramErrorBoundary } from "./OdontogramErrorBoundary";
import { OdontogramMap } from "./OdontogramMap";
import { OdontogramToolbar } from "./OdontogramToolbar";
import { useOdontogramCustomTypes } from "./useOdontogramCustomTypes";

interface Props {
  patientId: string;
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function OdontogramContent({ patientId }: Props) {
  const [entries, setEntries, loading, error] = useOdontogramEntries(patientId);
  const { types: customTypes } = useOdontogramCustomTypes();

  const [brushStatus, setBrushStatus] = useState(TOOTH_STATUS[0]);
  const [brushRegion, setBrushRegion] = useState("inteiro");
  const [selectedRegion, setSelectedRegion] = useState<{
    tooth: string;
    region: string;
  } | null>(null);
  const [modalNotes, setModalNotes] = useState("");
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [existingEntryId, setExistingEntryId] = useState<string | null>(null);
  const [isSavingEntry, setIsSavingEntry] = useState(false);

  const getStatusColor = (status: string) => {
    const normalized = normalize(status);

    const builtIn = Object.entries(STATUS_COLORS).find(
      ([key]) => normalize(key) === normalized,
    );

    if (builtIn) return builtIn[1];

    return (
      customTypes.find((type) => normalize(type.name) === normalized)?.color ||
      "#64748b"
    );
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-white p-10 text-center text-muted-foreground">
        Carregando odontograma...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-700">
        <h3 className="font-bold">Erro ao carregar o odontograma</h3>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    );
  }

  const handleRegionClick = (toothNumber: string, clickedRegion: string) => {
    const normalizedStatus = normalize(brushStatus);

    const forceWholeTooth =
      brushRegion === "inteiro" ||
      normalizedStatus === "extração indicada" ||
      normalizedStatus === "extração realizada" ||
      normalizedStatus === "ausente";

    const targetRegion = forceWholeTooth ? "inteiro" : clickedRegion;

    const existing = (entries || [])
      .filter(
        (entry) =>
          entry.toothNumber === toothNumber &&
          (entry.toothRegion === targetRegion ||
            (targetRegion === "inteiro" && entry.toothRegion === "dente inteiro")),
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0];

    setExistingEntryId(existing?.id || null);
    setSelectedRegion({ tooth: toothNumber, region: targetRegion });
    setModalNotes(existing?.notes || "");
    setIsNotesModalOpen(true);
  };

  const handleSaveEntry = async () => {
    if (!selectedRegion || isSavingEntry) return;

    try {
      setIsSavingEntry(true);

      const now = new Date().toISOString();
      const newEntry = {
        patientId,
        toothNumber: selectedRegion.tooth,
        toothRegion: selectedRegion.region,
        status: brushStatus,
        color: getStatusColor(brushStatus),
        notes: modalNotes,
        updatedAt: now,
      };

      if (existingEntryId) {
        await setEntries((previous) =>
          (previous || []).map((entry) =>
            entry.id === existingEntryId ? { ...entry, ...newEntry } : entry,
          ),
        );
      } else {
        await setEntries((previous) => [
          ...(previous || []),
          {
            ...newEntry,
            id: `temp-${Date.now()}`,
            userId: "",
            createdAt: now,
          },
        ]);
      }

      setIsNotesModalOpen(false);
      toast.success("Marcação salva no odontograma.");
    } catch (saveError) {
      console.error(saveError);
      toast.error("Não foi possível salvar a marcação.");
    } finally {
      setIsSavingEntry(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!existingEntryId) return;

    try {
      await setEntries((previous) =>
        (previous || []).filter((entry) => entry.id !== existingEntryId),
      );
      setIsNotesModalOpen(false);
      toast.success("Marcação removida.");
    } catch (deleteError) {
      console.error(deleteError);
      toast.error("Não foi possível excluir a marcação agora.");
    }
  };

  const legendItems = [
    ...TOOTH_STATUS.map((status) => ({
      name: status,
      color: getStatusColor(status),
      custom: false,
    })),
    ...customTypes.map((type) => ({
      name: type.name,
      color: type.color,
      custom: true,
    })),
  ];

  return (
    <div className="w-full">
      <div className="grid w-full grid-cols-1 items-start gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <OdontogramToolbar
          brushStatus={brushStatus}
          setBrushStatus={setBrushStatus}
          brushRegion={brushRegion}
          setBrushRegion={setBrushRegion}
        />

        <div className="min-w-0 space-y-4">
          <OdontogramMap
            entries={entries || []}
            onRegionClick={handleRegionClick}
          />

          <div className="flex min-h-[72px] flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-[#e6e1d8] bg-white px-5 py-4 text-[12px] text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <span className="mr-1 font-semibold text-slate-900">Legenda:</span>

            {legendItems.map((item) => {
              const normalizedStatus = normalize(item.name);

              if (normalizedStatus === "extração indicada") {
                return (
                  <span key={item.name} className="flex items-center gap-1.5">
                    <span className="font-bold text-[#991b1b]">/</span>
                    <span className="capitalize">{item.name}</span>
                  </span>
                );
              }

              if (normalizedStatus === "extração realizada") {
                return (
                  <span key={item.name} className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900">X</span>
                    <span className="capitalize">{item.name}</span>
                  </span>
                );
              }

              return (
                <span key={`${item.custom ? "custom" : "base"}-${item.name}`} className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="capitalize">{item.name}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={isNotesModalOpen} onOpenChange={setIsNotesModalOpen}>
        <DialogContent className="max-w-md rounded-2xl border-[#e6e1d8]">
          <DialogHeader>
            <DialogTitle>
              {existingEntryId ? "Editar marcação" : "Nova marcação"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Dente
                </div>
                <div className="mt-1 text-lg font-bold text-slate-900">
                  {selectedRegion?.tooth}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Região
                </div>
                <div className="mt-1 text-sm font-semibold capitalize text-slate-900">
                  {selectedRegion?.region}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-border p-3">
              <span
                className="h-3.5 w-3.5 rounded-full"
                style={{ backgroundColor: getStatusColor(brushStatus) }}
              />
              <span className="text-sm font-semibold capitalize text-slate-900">
                {brushStatus}
              </span>
            </div>

            <div>
              <Label>Observação</Label>
              <Textarea
                placeholder="Detalhes adicionais sobre esta marcação..."
                value={modalNotes}
                onChange={(event) => setModalNotes(event.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:space-x-0">
            {existingEntryId && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleDeleteEntry()}
                className="mr-auto text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="h-4 w-4" />
                Excluir marcação
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsNotesModalOpen(false)}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              variant="gold"
              onClick={() => void handleSaveEntry()}
              disabled={isSavingEntry}
            >
              {isSavingEntry ? "Salvando..." : "Salvar marcação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function OdontogramTab({ patientId }: Props) {
  return (
    <OdontogramErrorBoundary>
      <OdontogramContent patientId={patientId} />
    </OdontogramErrorBoundary>
  );
}
