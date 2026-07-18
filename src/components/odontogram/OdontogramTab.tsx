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
import { OdontogramErrorBoundary } from "./OdontogramErrorBoundary";
import { OdontogramMap } from "./OdontogramMap";
import { OdontogramToolbar } from "./OdontogramToolbar";
import {
  FIXED_ODONTOGRAM_STATUS,
  getFixedStatusColor,
  getStatusDisplayName,
  isRootOnlyStatus,
  normalizeOdontogramStatus,
} from "./odontogramStatusConfig";
import { useOdontogramCustomTypes } from "./useOdontogramCustomTypes";

interface Props {
  patientId: string;
}

function getRegionDisplayName(region?: string) {
  if (!region) return "";
  if (region === "inteiro" || region === "dente inteiro") return "Dente inteiro";
  if (region === "raiz/base") return "Raiz / canal";
  return region;
}

function OdontogramContent({ patientId }: Props) {
  const [entries, setEntries, loading, error] = useOdontogramEntries(patientId);
  const { types: customTypes } = useOdontogramCustomTypes();

  const [brushStatus, setBrushStatus] = useState(FIXED_ODONTOGRAM_STATUS[0]);
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
    const fixedColor = getFixedStatusColor(status);
    if (fixedColor) return fixedColor;

    return (
      customTypes.find(
        (type) =>
          normalizeOdontogramStatus(type.name) ===
          normalizeOdontogramStatus(status),
      )?.color || "#64748b"
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
    const normalizedStatus = normalizeOdontogramStatus(brushStatus);

    let targetRegion: string;

    if (isRootOnlyStatus(brushStatus)) {
      // Canal continua sendo aplicado exclusivamente na raiz.
      targetRegion = "raiz/base";
    } else {
      // Sensibilidade, Pino de Vidro e Núcleo Metálico agora respeitam
      // a região selecionada, assim como as demais situações clínicas.
      const forceWholeTooth =
        brushRegion === "inteiro" ||
        brushRegion === "dente inteiro" ||
        normalizedStatus === "extração indicada" ||
        normalizedStatus === "extração realizada" ||
        normalizedStatus === "ausente";

      targetRegion = forceWholeTooth ? "inteiro" : clickedRegion;
    }

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

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="grid w-full grid-cols-1 items-start gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <OdontogramToolbar
          brushStatus={brushStatus}
          setBrushStatus={setBrushStatus}
          brushRegion={brushRegion}
          setBrushRegion={setBrushRegion}
        />

        <div className="min-w-0">
          <OdontogramMap
            entries={entries || []}
            onRegionClick={handleRegionClick}
          />
        </div>
      </div>

      {/* Histórico de Marcações — restaurado */}
      <div>
        <h3 className="mb-4 text-lg font-bold font-display">
          Histórico de Marcações
        </h3>

        {!entries || entries.length === 0 ? (
          <div className="rounded-lg border border-border bg-secondary/50 p-8 text-center text-muted-foreground">
            Nenhuma marcação no odontograma ainda.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg border border-border bg-white p-3 shadow-sm sm:p-4"
              >
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary font-bold">
                    {entry.toothNumber}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            entry.color || getStatusColor(entry.status),
                        }}
                      />

                      <span className="text-sm font-semibold capitalize">
                        {getStatusDisplayName(entry.status)}
                      </span>

                      <span className="hidden truncate text-xs text-muted-foreground sm:inline-block">
                        ({getRegionDisplayName(entry.toothRegion)})
                      </span>
                    </div>

                    {entry.notes && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {entry.notes}
                      </p>
                    )}

                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleDateString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setExistingEntryId(entry.id);
                      setSelectedRegion({
                        tooth: entry.toothNumber,
                        region: entry.toothRegion,
                      });
                      setBrushStatus(entry.status);
                      setModalNotes(entry.notes || "");
                      setIsNotesModalOpen(true);
                    }}
                  >
                    Editar
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    onClick={async () => {
                      try {
                        await setEntries((previous) =>
                          (previous || []).filter((item) => item.id !== entry.id),
                        );
                        toast.success("Marcação removida.");
                      } catch (deleteError) {
                        console.error(deleteError);
                        toast.error("Não foi possível excluir agora.");
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
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
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {getRegionDisplayName(selectedRegion?.region)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-border p-3">
              <span
                className="h-3.5 w-3.5 rounded-full"
                style={{ backgroundColor: getStatusColor(brushStatus) }}
              />
              <span className="text-sm font-semibold text-slate-900">
                {getStatusDisplayName(brushStatus)}
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
