import React, { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Label, Select } from "@/components/ui-bits";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TOOTH_REGIONS } from "@/lib/store";
import {
  CANAL_COMPLEMENT_OPTIONS,
  FIXED_ODONTOGRAM_STATUS,
  RESERVED_ODONTOGRAM_STATUS,
  type CanalComplement,
  getFixedStatusColor,
  getStatusDisplayName,
  isRootOnlyStatus,
  isStandaloneMarkerStatus,
  normalizeOdontogramStatus,
} from "./odontogramStatusConfig";
import { useOdontogramCustomTypes } from "./useOdontogramCustomTypes";

interface Props {
  brushStatus: string;
  setBrushStatus: (status: string) => void;
  brushRegion: string;
  setBrushRegion: (region: string) => void;
  canalComplement: CanalComplement;
  setCanalComplement: (complement: CanalComplement) => void;
}

type DeleteTarget = {
  id: string;
  name: string;
};

export function OdontogramToolbar({
  brushStatus,
  setBrushStatus,
  brushRegion,
  setBrushRegion,
  canalComplement,
  setCanalComplement,
}: Props) {
  const { types: customTypes, addType, deleteType, loading } =
    useOdontogramCustomTypes();

  const [customName, setCustomName] = useState("");
  const [customColor, setCustomColor] = useState("#7B61FF");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const reservedStatusNames = new Set(
    RESERVED_ODONTOGRAM_STATUS.map((status) =>
      normalizeOdontogramStatus(status),
    ),
  );

  const visibleCustomTypes = customTypes.filter(
    (type) => !reservedStatusNames.has(normalizeOdontogramStatus(type.name)),
  );

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

  const selectStatus = (status: string) => {
    setBrushStatus(status);
    if (!isRootOnlyStatus(status)) {
      setCanalComplement("none");
    }
  };

  const handleAddCustom = async () => {
    const name = customName.trim();
    if (!name || isSaving) return;

    if (reservedStatusNames.has(normalizeOdontogramStatus(name))) {
      toast.error(
        `“${getStatusDisplayName(name)}” é uma situação reservada do odontograma.`,
      );
      return;
    }

    const alreadyExists = customTypes.some(
      (type) =>
        normalizeOdontogramStatus(type.name) ===
        normalizeOdontogramStatus(name),
    );

    if (alreadyExists) {
      toast.error(`A situação “${name}” já existe.`);
      return;
    }

    try {
      setIsSaving(true);
      const newType = await addType(name, customColor);
      setBrushStatus(newType.name);
      setCanalComplement("none");
      setCustomName("");
      setCustomColor("#7B61FF");
      toast.success(`Situação "${newType.name}" adicionada.`);
    } catch (error: any) {
      toast.error(
        error?.message || "Não foi possível salvar a situação clínica.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCustom = async () => {
    if (!deleteTarget) return;

    try {
      setDeletingId(deleteTarget.id);
      await deleteType(deleteTarget.id);

      if (
        normalizeOdontogramStatus(brushStatus) ===
        normalizeOdontogramStatus(deleteTarget.name)
      ) {
        setBrushStatus(FIXED_ODONTOGRAM_STATUS[0]);
        setCanalComplement("none");
      }

      toast.success(`Situação "${deleteTarget.name}" excluída.`);
      setDeleteTarget(null);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível excluir a situação.");
    } finally {
      setDeletingId(null);
    }
  };

  const canalSelected = isRootOnlyStatus(brushStatus);
  const markerOnlySelected = isStandaloneMarkerStatus(brushStatus);

  return (
    <>
      <aside className="w-full rounded-2xl border border-[#e6e1d8] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="mb-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            Selecionar Situação Clínica
          </h3>

          <div className="flex flex-col gap-1.5">
            {FIXED_ODONTOGRAM_STATUS.map((status) => {
              const selected =
                normalizeOdontogramStatus(brushStatus) ===
                normalizeOdontogramStatus(status);
              const color = getStatusColor(status);

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => selectStatus(status)}
                  className={`relative flex min-h-9 w-full items-center gap-2.5 overflow-hidden rounded-lg border px-3 py-2 text-left text-[13px] transition-all ${
                    selected
                      ? "border-[#c89b2b] bg-[#fff4cc] font-bold text-slate-950 shadow-[0_2px_8px_rgba(200,155,43,0.22)] ring-1 ring-inset ring-[#d4af37]/70"
                      : "border-transparent text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {selected && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#c89b2b]"
                    />
                  )}
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span>{getStatusDisplayName(status)}</span>
                </button>
              );
            })}

            {visibleCustomTypes.map((type) => {
              const selected =
                normalizeOdontogramStatus(brushStatus) ===
                normalizeOdontogramStatus(type.name);

              return (
                <div
                  key={type.id}
                  className={`group relative flex min-h-9 items-center overflow-hidden rounded-lg border transition-all ${
                    selected
                      ? "border-[#c89b2b] bg-[#fff4cc] shadow-[0_2px_8px_rgba(200,155,43,0.22)] ring-1 ring-inset ring-[#d4af37]/70"
                      : "border-transparent hover:bg-slate-50"
                  }`}
                >
                  {selected && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#c89b2b]"
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => selectStatus(type.name)}
                    className={`flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left text-[13px] ${
                      selected ? "font-bold text-slate-950" : "text-slate-700"
                    }`}
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: type.color }}
                    />
                    <span className="truncate">{type.name}</span>
                  </button>

                  <button
                    type="button"
                    aria-label={`Excluir ${type.name}`}
                    title={`Excluir ${type.name}`}
                    onClick={() =>
                      setDeleteTarget({ id: type.id, name: type.name })
                    }
                    className="mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 opacity-70 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {canalSelected && (
            <div className="mt-4 rounded-xl border border-[#e5d7a9] bg-[#fffbef] p-3.5">
              <div className="mb-1 text-[12px] font-bold text-slate-900">
                Complemento do canal
              </div>
              <p className="mb-3 text-[11px] leading-relaxed text-slate-600">
                Opcional. O canal pode ficar sozinho ou receber PFV ou Núcleo
                Metálico.
              </p>

              <div className="flex flex-col gap-2">
                {CANAL_COMPLEMENT_OPTIONS.map((option) => {
                  const selected = canalComplement === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setCanalComplement(option.value)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12px] transition ${
                        selected
                          ? "border-[#c89b2b] bg-white font-semibold text-slate-950 shadow-sm"
                          : "border-[#e8e3da] bg-white/70 text-slate-600 hover:border-[#d8c58a]"
                      }`}
                    >
                      <span
                        className={`grid h-4 w-4 place-items-center rounded-full border ${
                          selected
                            ? "border-[#c89b2b]"
                            : "border-slate-300"
                        }`}
                      >
                        {selected && (
                          <span className="h-2 w-2 rounded-full bg-[#c89b2b]" />
                        )}
                      </span>
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setCustomName("");
              window.setTimeout(() => {
                document.getElementById("odontogram-custom-name")?.focus();
              }, 0);
            }}
            className="mt-3 flex h-9 w-full items-center justify-center rounded-xl border border-dashed border-slate-300 text-[12px] font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
          >
            + Adicionar situação
          </button>
        </div>

        <div className="mb-5">
          {canalSelected ? (
            <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-3 text-[12px] leading-relaxed text-violet-800">
              <strong>Canal:</strong> ao clicar no dente, a marcação será aplicada
              automaticamente apenas na raiz.
            </div>
          ) : markerOnlySelected ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[12px] leading-relaxed text-slate-700">
              <strong>{getStatusDisplayName(brushStatus)}:</strong> não pinta o
              dente. Será exibida apenas a letra correspondente acima dele.
            </div>
          ) : (
            <>
              <Label>Região do Dente</Label>
              <Select
                value={brushRegion}
                onChange={(event) => setBrushRegion(event.target.value)}
                className="h-11 rounded-xl bg-white"
              >
                {TOOTH_REGIONS.map((region) => (
                  <option key={region} value={region} className="capitalize">
                    {region === "inteiro" ? "Inteiro" : region}
                  </option>
                ))}
              </Select>
            </>
          )}
        </div>

        <div className="rounded-xl border border-[#e8e3da] bg-[#fcfbf8] p-3.5">
          <div className="mb-3">
            <Label>Nome da Situação</Label>
            <Input
              id="odontogram-custom-name"
              value={customName}
              onChange={(event) => setCustomName(event.target.value)}
              placeholder="Ex.: Faceta, Rachadura..."
              disabled={isSaving}
              className="h-10 bg-white"
            />
          </div>

          <div className="mb-3">
            <Label>Cor</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={customColor}
                onChange={(event) => setCustomColor(event.target.value)}
                disabled={isSaving}
                className="h-10 w-12 cursor-pointer rounded-lg border border-input bg-white p-1"
              />
              <Input
                value={customColor.toUpperCase()}
                onChange={(event) => setCustomColor(event.target.value)}
                disabled={isSaving}
                className="h-10 bg-white font-mono uppercase"
              />
            </div>
          </div>

          <Button
            type="button"
            variant="gold"
            onClick={handleAddCustom}
            disabled={!customName.trim() || isSaving || loading}
            className="h-11 w-full rounded-xl"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar situação"
            )}
          </Button>
        </div>
      </aside>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deletingId) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-[430px] rounded-2xl border-[#e6e1d8] p-0">
          <div className="px-6 pb-2 pt-6">
            <DialogHeader>
              <DialogTitle>Excluir situação clínica?</DialogTitle>
              <DialogDescription className="pt-2 leading-relaxed">
                A situação personalizada <strong>“{deleteTarget?.name}”</strong>{" "}
                será removida da lista. As marcações já registradas nos pacientes
                serão preservadas.
              </DialogDescription>
            </DialogHeader>
          </div>

          <DialogFooter className="gap-2 border-t border-[#e6e1d8] bg-[#fcfbf8] px-6 py-4 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={Boolean(deletingId)}
              className="flex-1"
            >
              Cancelar
            </Button>

            <Button
              type="button"
              variant="danger"
              onClick={() => void handleDeleteCustom()}
              disabled={Boolean(deletingId)}
              className="flex-1"
            >
              {deletingId ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Excluir situação
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
