import React, { useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";
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
import type { OdontogramEntry } from "@/lib/store";
import { OdontogramErrorBoundary } from "./OdontogramErrorBoundary";
import { OdontogramMap } from "./OdontogramMap";
import { OdontogramToolbar } from "./OdontogramToolbar";
import {
  FIXED_ODONTOGRAM_STATUS,
  type CanalComplement,
  getCanalComplementStatus,
  getCanalComplementValue,
  getFixedStatusColor,
  getStatusDisplayName,
  isCanalComplementStatus,
  isRootOnlyStatus,
  isStandaloneMarkerStatus,
  normalizeOdontogramStatus,
} from "./odontogramStatusConfig";
import { useOdontogramCustomTypes } from "./useOdontogramCustomTypes";

interface Props {
  patientId: string;
}

const GENERAL_OBSERVATION_TOOTH = "__GERAL__";
const GENERAL_OBSERVATION_REGION = "observações gerais";
const GENERAL_OBSERVATION_STATUS = "observações gerais";
const CANAL_COMPLEMENT_REGION = "marcador:canal-complemento";

function markerRegionForStatus(status: string) {
  return `marcador:${normalizeOdontogramStatus(status)}`;
}

function isGeneralObservationEntry(entry: OdontogramEntry) {
  return (
    entry.toothNumber === GENERAL_OBSERVATION_TOOTH ||
    (entry.toothRegion === GENERAL_OBSERVATION_REGION &&
      normalizeOdontogramStatus(entry.status) === GENERAL_OBSERVATION_STATUS)
  );
}

function getRegionDisplayName(region?: string) {
  if (!region) return "";
  if (region.startsWith("marcador:")) return "Marcação do dente";
  if (region === "inteiro" || region === "dente inteiro") {
    return "Dente inteiro";
  }
  if (region === "raiz/base") return "Raiz / canal";
  return region;
}

function sortNewestFirst(entries: OdontogramEntry[]) {
  return [...entries].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function OdontogramContent({ patientId }: Props) {
  const [entries, setEntries, loading, error] = useOdontogramEntries(patientId);
  const { types: customTypes } = useOdontogramCustomTypes();

  const [brushStatus, setBrushStatus] = useState(FIXED_ODONTOGRAM_STATUS[0]);
  const [brushRegion, setBrushRegion] = useState("inteiro");
  const [canalComplement, setCanalComplement] =
    useState<CanalComplement>("none");
  const [selectedRegion, setSelectedRegion] = useState<{
    tooth: string;
    region: string;
  } | null>(null);
  const [modalNotes, setModalNotes] = useState("");
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [existingEntryId, setExistingEntryId] = useState<string | null>(null);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [generalNotes, setGeneralNotes] = useState("");
  const [isSavingGeneralNotes, setIsSavingGeneralNotes] = useState(false);

  const generalObservationEntry = (entries || []).find(
    isGeneralObservationEntry,
  );

  const odontogramEntries = (entries || []).filter(
    (entry) => !isGeneralObservationEntry(entry),
  );

  const historyEntries = odontogramEntries.filter(
    (entry) => !isCanalComplementStatus(entry.status),
  );

  useEffect(() => {
    setGeneralNotes(generalObservationEntry?.notes || "");
  }, [patientId, generalObservationEntry?.id, generalObservationEntry?.notes]);

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

  const getCanalComplementEntryForTooth = (toothNumber: string) =>
    sortNewestFirst(
      odontogramEntries.filter(
        (entry) =>
          entry.toothNumber === toothNumber &&
          isCanalComplementStatus(entry.status),
      ),
    )[0];

  const getHistoryStatusName = (entry: OdontogramEntry) => {
    if (!isRootOnlyStatus(entry.status)) {
      return getStatusDisplayName(entry.status);
    }

    const complementEntry = getCanalComplementEntryForTooth(entry.toothNumber);
    const complement = getCanalComplementValue(complementEntry?.status);

    if (complement === "pfv") return "Canal + PFV";
    if (complement === "nucleo-metalico") return "Canal + Núcleo Metálico";
    return "Canal";
  };

  const removeEntryAndDependencies = (
    previous: OdontogramEntry[],
    entryId: string,
  ) => {
    const entryToDelete = previous.find((entry) => entry.id === entryId);
    if (!entryToDelete) return previous;

    return previous.filter((entry) => {
      if (entry.id === entryId) return false;

      if (
        isRootOnlyStatus(entryToDelete.status) &&
        entry.toothNumber === entryToDelete.toothNumber &&
        isCanalComplementStatus(entry.status)
      ) {
        return false;
      }

      return true;
    });
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

    if (isStandaloneMarkerStatus(brushStatus)) {
      // Sensibilidade e Mobilidade são apenas marcadores visuais acima do dente.
      targetRegion = markerRegionForStatus(brushStatus);
    } else if (isRootOnlyStatus(brushStatus)) {
      // Canal é aplicado exclusivamente na raiz.
      targetRegion = "raiz/base";
    } else {
      const forceWholeTooth =
        brushRegion === "inteiro" ||
        brushRegion === "dente inteiro" ||
        normalizedStatus === "extração indicada" ||
        normalizedStatus === "extração realizada" ||
        normalizedStatus === "ausente";

      targetRegion = forceWholeTooth ? "inteiro" : clickedRegion;
    }

    const existing = sortNewestFirst(
      odontogramEntries.filter(
        (entry) =>
          entry.toothNumber === toothNumber &&
          (entry.toothRegion === targetRegion ||
            (targetRegion === "inteiro" &&
              entry.toothRegion === "dente inteiro")),
      ),
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

      await setEntries((previous) => {
        let next = [...(previous || [])];
        const previousEntry = existingEntryId
          ? next.find((entry) => entry.id === existingEntryId)
          : undefined;

        if (existingEntryId) {
          next = next.map((entry) =>
            entry.id === existingEntryId ? { ...entry, ...newEntry } : entry,
          );
        } else {
          next.push({
            ...newEntry,
            id: `temp-${Date.now()}`,
            userId: "",
            createdAt: now,
          });
        }

        if (isRootOnlyStatus(brushStatus)) {
          // PFV e Núcleo Metálico nunca substituem a pintura do canal.
          // Eles ficam como complemento opcional e apenas como marcador acima.
          next = next.filter(
            (entry) =>
              !(
                entry.toothNumber === selectedRegion.tooth &&
                isCanalComplementStatus(entry.status)
              ),
          );

          const complementStatus = getCanalComplementStatus(canalComplement);

          if (complementStatus) {
            next.push({
              id: `temp-${Date.now() + 1}`,
              userId: "",
              patientId,
              toothNumber: selectedRegion.tooth,
              toothRegion: CANAL_COMPLEMENT_REGION,
              status: complementStatus,
              color: getStatusColor(complementStatus),
              notes: undefined,
              createdAt: now,
              updatedAt: now,
            });
          }
        } else if (
          selectedRegion.region === "raiz/base" &&
          previousEntry &&
          isRootOnlyStatus(previousEntry.status)
        ) {
          // Se um canal for substituído por outra marcação de raiz,
          // o complemento deixa de fazer sentido e é removido junto.
          next = next.filter(
            (entry) =>
              !(
                entry.toothNumber === selectedRegion.tooth &&
                isCanalComplementStatus(entry.status)
              ),
          );
        }

        return next;
      });

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
        removeEntryAndDependencies(previous || [], existingEntryId),
      );
      setIsNotesModalOpen(false);
      setCanalComplement("none");
      toast.success("Marcação removida.");
    } catch (deleteError) {
      console.error(deleteError);
      toast.error("Não foi possível excluir a marcação agora.");
    }
  };

  const handleSaveGeneralNotes = async () => {
    if (isSavingGeneralNotes) return;

    try {
      setIsSavingGeneralNotes(true);
      const now = new Date().toISOString();
      const notes = generalNotes.trim();

      await setEntries((previous) => {
        const current = [...(previous || [])];
        const existing = current.find(isGeneralObservationEntry);

        if (!notes) {
          return existing
            ? current.filter((entry) => entry.id !== existing.id)
            : current;
        }

        if (existing) {
          return current.map((entry) =>
            entry.id === existing.id
              ? {
                  ...entry,
                  notes,
                  updatedAt: now,
                }
              : entry,
          );
        }

        return [
          ...current,
          {
            id: `temp-general-${Date.now()}`,
            userId: "",
            patientId,
            toothNumber: GENERAL_OBSERVATION_TOOTH,
            toothRegion: GENERAL_OBSERVATION_REGION,
            status: GENERAL_OBSERVATION_STATUS,
            color: "#c89b2b",
            notes,
            createdAt: now,
            updatedAt: now,
          },
        ];
      });

      toast.success(
        notes
          ? "Observações gerais salvas."
          : "Observações gerais removidas.",
      );
    } catch (saveError) {
      console.error(saveError);
      toast.error("Não foi possível salvar as observações gerais.");
    } finally {
      setIsSavingGeneralNotes(false);
    }
  };

  const openHistoryEntryForEditing = (entry: OdontogramEntry) => {
    setExistingEntryId(entry.id);
    setSelectedRegion({
      tooth: entry.toothNumber,
      region: entry.toothRegion,
    });
    setBrushStatus(entry.status);
    setModalNotes(entry.notes || "");

    if (isRootOnlyStatus(entry.status)) {
      const complementEntry = getCanalComplementEntryForTooth(entry.toothNumber);
      setCanalComplement(getCanalComplementValue(complementEntry?.status));
    } else {
      setCanalComplement("none");
    }

    setIsNotesModalOpen(true);
  };

  const savedGeneralNotes = generalObservationEntry?.notes || "";
  const generalNotesChanged = generalNotes.trim() !== savedGeneralNotes.trim();

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="grid w-full grid-cols-1 items-start gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <OdontogramToolbar
          brushStatus={brushStatus}
          setBrushStatus={setBrushStatus}
          brushRegion={brushRegion}
          setBrushRegion={setBrushRegion}
          canalComplement={canalComplement}
          setCanalComplement={setCanalComplement}
        />

        <div className="min-w-0 space-y-5">
          <OdontogramMap
            entries={odontogramEntries}
            onRegionClick={handleRegionClick}
          />

          <section className="rounded-2xl border border-[#e6e1d8] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Observações Gerais
                </h3>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  Anotações gerais do odontograma deste paciente, sem vínculo com
                  um dente específico.
                </p>
              </div>
            </div>

            <Textarea
              placeholder="Digite aqui observações gerais sobre o quadro clínico do paciente..."
              value={generalNotes}
              onChange={(event) => setGeneralNotes(event.target.value)}
              rows={5}
              className="min-h-[120px] resize-y"
            />

            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="gold"
                onClick={() => void handleSaveGeneralNotes()}
                disabled={isSavingGeneralNotes || !generalNotesChanged}
              >
                <Save className="h-4 w-4" />
                {isSavingGeneralNotes ? "Salvando..." : "Salvar observações"}
              </Button>
            </div>
          </section>
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-lg font-bold font-display">
          Histórico de Marcações
        </h3>

        {historyEntries.length === 0 ? (
          <div className="rounded-lg border border-border bg-secondary/50 p-8 text-center text-muted-foreground">
            Nenhuma marcação no odontograma ainda.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {historyEntries.map((entry) => (
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
                        {getHistoryStatusName(entry)}
                      </span>

                      <span className="hidden truncate text-xs text-muted-foreground sm:inline-block">
                        ({getRegionDisplayName(entry.toothRegion)})
                      </span>
                    </div>

                    {entry.notes && (
                      <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
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
                    onClick={() => openHistoryEntryForEditing(entry)}
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
                          removeEntryAndDependencies(previous || [], entry.id),
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

            <div className="rounded-xl border border-border p-3">
              <div className="flex items-center gap-2">
                <span
                  className="h-3.5 w-3.5 rounded-full"
                  style={{ backgroundColor: getStatusColor(brushStatus) }}
                />
                <span className="text-sm font-semibold text-slate-900">
                  {getStatusDisplayName(brushStatus)}
                </span>
              </div>

              {isRootOnlyStatus(brushStatus) && (
                <div className="mt-2 text-[12px] text-slate-600">
                  Complemento: {" "}
                  <strong>
                    {canalComplement === "pfv"
                      ? "PFV"
                      : canalComplement === "nucleo-metalico"
                        ? "Núcleo Metálico"
                        : "Nenhum — somente canal"}
                  </strong>
                </div>
              )}

              {isStandaloneMarkerStatus(brushStatus) && (
                <div className="mt-2 text-[12px] text-slate-600">
                  Esta situação não pinta o dente; apenas adiciona o marcador
                  acima dele.
                </div>
              )}
            </div>

            <div>
              <Label>Observação do dente</Label>
              <Textarea
                placeholder="Detalhes adicionais sobre esta marcação específica..."
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
