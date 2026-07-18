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
  FIXED_ODONTOGRAM_STATUS,
  getFixedStatusColor,
  getStatusDisplayName,
  normalizeOdontogramStatus,
} from "./odontogramStatusConfig";
import { useOdontogramCustomTypes } from "./useOdontogramCustomTypes";

interface Props {
  brushStatus: string;
  setBrushStatus: (status: string) => void;
  brushRegion: string;
  setBrushRegion: (region: string) => void;
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
}: Props) {
  const { types: customTypes, addType, deleteType, loading } =
    useOdontogramCustomTypes();

  const [customName, setCustomName] = useState("");
  const [customColor, setCustomColor] = useState("#7B61FF");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const fixedStatusNames = new Set(
    FIXED_ODONTOGRAM_STATUS.map((status) => normalizeOdontogramStatus(status)),
  );

  const visibleCustomTypes = customTypes.filter(
    (type) => !fixedStatusNames.has(normalizeOdontogramStatus(type.name)),
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

  const handleAddCustom = async () => {
    const name = customName.trim();
    if (!name || isSaving) return;

    if (fixedStatusNames.has(normalizeOdontogramStatus(name))) {
      toast.error(`“${getStatusDisplayName(name)}” já é uma situação fixa do odontograma.`);
      return;
    }

    const alreadyExists = customTypes.some(
      (type) =>
        normalizeOdontogramStatus(type.name) === normalizeOdontogramStatus(name),
    );

    if (alreadyExists) {
      toast.error(`A situação “${name}” já existe.`);
      return;
    }

    try {
      setIsSaving(true);
      const newType = await addType(name, customColor);
      setBrushStatus(newType.name);
      setCustomName("");
      setCustomColor("#7B61FF");
      toast.success(`Situação "${newType.name}" adicionada.`);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível salvar a situação clínica.");
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
      }

      toast.success(`Situação "${deleteTarget.name}" excluída.`);
      setDeleteTarget(null);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível excluir a situação.");
    } finally {
      setDeletingId(null);
    }
  };

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
                  onClick={() => setBrushStatus(status)}
                  className={`relative flex h-8 w-full items-center gap-2.5 overflow-hidden rounded-lg px-2 pl-3 text-left text-[13px] transition-all ${
                    selected
                      ? "bg-[#fff8e7] font-semibold text-slate-950 ring-1 ring-inset ring-[#d4af37]/45 shadow-[0_1px_2px_rgba(212,175,55,0.10)]"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {selected && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#d4af37]"
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
                  className={`group relative flex h-8 items-center overflow-hidden rounded-lg transition-all ${
                    selected
                      ? "bg-[#fff8e7] ring-1 ring-inset ring-[#d4af37]/45 shadow-[0_1px_2px_rgba(212,175,55,0.10)]"
                      : "hover:bg-slate-50"
                  }`}
                >
                  {selected && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#d4af37]"
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => setBrushStatus(type.name)}
                    className={`flex min-w-0 flex-1 items-center gap-2.5 px-2 pl-3 text-left text-[13px] ${
                      selected ? "font-semibold text-slate-950" : "text-slate-700"
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
                A situação personalizada <strong>“{deleteTarget?.name}”</strong> será
                removida da lista. As marcações já registradas nos pacientes serão
                preservadas.
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
