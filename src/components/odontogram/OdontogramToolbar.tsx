import React, { useState } from "react";
import { Button, Select, Label, Input } from "@/components/ui-bits";
import { TOOTH_REGIONS, TOOTH_STATUS, STATUS_COLORS } from "@/lib/store";
import { useOdontogramCustomTypes } from "./useOdontogramCustomTypes";

interface Props {
  brushStatus: string;
  setBrushStatus: (s: string) => void;
  brushRegion: string;
  setBrushRegion: (r: string) => void;
}

export function OdontogramToolbar({
  brushStatus,
  setBrushStatus,
  brushRegion,
  setBrushRegion,
}: Props) {
  const {
    types: customTypes,
    addType,
    loading: loadingCustom,
  } = useOdontogramCustomTypes();

  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customColor, setCustomColor] = useState("#ff00ff");
  const [isSavingCustom, setIsSavingCustom] = useState(false);

  const handleAddCustom = async () => {
    const name = customName.trim();

    if (!name || isSavingCustom) {
      return;
    }

    try {
      setIsSavingCustom(true);

      const newType = await addType(name, customColor);

      if (newType) {
        setBrushStatus(newType.name);
        setIsAddingCustom(false);
        setCustomName("");
        setCustomColor("#ff00ff");
      }
    } catch (error) {
      console.error(
        "Não foi possível salvar a situação personalizada:",
        error
      );

      alert(
        "Não foi possível salvar a situação clínica. Verifique a conexão com o banco de dados e tente novamente."
      );
    } finally {
      setIsSavingCustom(false);
    }
  };

  const handleCancelCustom = () => {
    if (isSavingCustom) {
      return;
    }

    setIsAddingCustom(false);
    setCustomName("");
    setCustomColor("#ff00ff");
  };

  const getStatusColor = (status: string) => {
    if (STATUS_COLORS[status]) {
      return STATUS_COLORS[status];
    }

    const custom = (customTypes || []).find(
      (type) => type.name === status
    );

    return custom ? custom.color : "#000";
  };

  return (
    <div className="flex flex-col gap-6 p-4 bg-white border border-border rounded-lg shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex-1">
          <Label className="mb-2">
            Selecionar Situação Clínica
          </Label>

          <div className="flex flex-wrap gap-2">
            {TOOTH_STATUS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setBrushStatus(status);
                  setIsAddingCustom(false);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  brushStatus === status
                    ? "ring-2 ring-offset-1 border-transparent"
                    : "border-border hover:bg-secondary"
                }`}
                style={{
                  backgroundColor:
                    brushStatus === status
                      ? getStatusColor(status)
                      : "transparent",
                  color:
                    brushStatus === status
                      ? "white"
                      : "inherit",
                  borderColor:
                    brushStatus === status
                      ? getStatusColor(status)
                      : undefined,
                }}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor:
                      getStatusColor(status),
                  }}
                />

                <span className="capitalize">
                  {status}
                </span>
              </button>
            ))}

            {(customTypes || []).map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => {
                  setBrushStatus(type.name);
                  setIsAddingCustom(false);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  brushStatus === type.name
                    ? "ring-2 ring-offset-1 border-transparent"
                    : "border-border hover:bg-secondary"
                }`}
                style={{
                  backgroundColor:
                    brushStatus === type.name
                      ? type.color
                      : "transparent",
                  color:
                    brushStatus === type.name
                      ? "white"
                      : "inherit",
                  borderColor:
                    brushStatus === type.name
                      ? type.color
                      : undefined,
                }}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: type.color,
                  }}
                />

                <span>{type.name}</span>
              </button>
            ))}

            <button
              type="button"
              onClick={() =>
                setIsAddingCustom(
                  (current) => !current
                )
              }
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-border hover:bg-secondary text-muted-foreground"
            >
              + Adicionar situação
            </button>
          </div>
        </div>

        <div className="w-full">
          <Label className="mb-2">
            Região do Dente
          </Label>

          <Select
            value={brushRegion}
            onChange={(event) =>
              setBrushRegion(event.target.value)
            }
          >
            {TOOTH_REGIONS.map((region) => (
              <option
                key={region}
                value={region}
                className="capitalize"
              >
                {region}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isAddingCustom && (
        <div className="flex flex-col sm:flex-row gap-3 items-end bg-secondary/30 p-3 rounded-md border border-border mt-2">
          <div className="flex-1">
            <Label>
              Nome da Situação
            </Label>

            <Input
              value={customName}
              onChange={(event) =>
                setCustomName(event.target.value)
              }
              placeholder="Ex: lesão cervical"
              disabled={isSavingCustom}
            />
          </div>

          <div>
            <Label>
              Cor
            </Label>

            <div className="flex items-center gap-2 h-9">
              <input
                type="color"
                value={customColor}
                onChange={(event) =>
                  setCustomColor(event.target.value)
                }
                disabled={isSavingCustom}
                className="w-8 h-8 p-0 border-0 rounded cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>

          <Button
            variant="gold"
            onClick={handleAddCustom}
            disabled={
              !customName.trim() ||
              loadingCustom ||
              isSavingCustom
            }
          >
            {isSavingCustom
              ? "Salvando..."
              : "Salvar"}
          </Button>

          <Button
            variant="ghost"
            onClick={handleCancelCustom}
            disabled={isSavingCustom}
          >
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}
