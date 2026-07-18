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

export function OdontogramToolbar({ brushStatus, setBrushStatus, brushRegion, setBrushRegion }: Props) {
  const { types: customTypes, addType, loading: loadingCustom } = useOdontogramCustomTypes();
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customColor, setCustomColor] = useState("#ff00ff");

  const handleAddCustom = async () => {
  const name = customName.trim();

  if (!name) return;

  try {
    const newType = await addType(name, customColor);

    if (newType) {
      setBrushStatus(newType.name);
      setIsAddingCustom(false);
      setCustomName("");
      setCustomColor("#ff00ff");
    }
  } catch (error) {
    console.error("Não foi possível salvar a situação:", error);

    alert(
      "Não foi possível salvar a situação clínica. Verifique se a tabela odontogram_status_types existe no Supabase e se o usuário possui permissão para inserir dados."
    );
  }
};

  const getStatusColor = (status: string) => {
    if (STATUS_COLORS[status]) return STATUS_COLORS[status];
    const custom = (customTypes || []).find(t => t.name === status);
    return custom ? custom.color : "#000";
  };

  return (
    <div className="flex flex-col gap-6 p-4 bg-white border border-border rounded-lg shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex-1">
          <Label className="mb-2">Selecionar Situação Clínica</Label>
          <div className="flex flex-wrap gap-2">
            {TOOTH_STATUS.map(s => (
              <button
                key={s}
                onClick={() => { setBrushStatus(s); setIsAddingCustom(false); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  brushStatus === s 
                    ? "ring-2 ring-offset-1 border-transparent" 
                    : "border-border hover:bg-secondary"
                }`}
                style={{ 
                  backgroundColor: brushStatus === s ? getStatusColor(s) : "transparent",
                  color: brushStatus === s ? "white" : "inherit",
                  borderColor: brushStatus === s ? getStatusColor(s) : undefined,
                  ringColor: getStatusColor(s)
                }}
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getStatusColor(s) }} />
                <span className="capitalize">{s}</span>
              </button>
            ))}

            {(customTypes || []).map(t => (
              <button
                key={t.id}
                onClick={() => { setBrushStatus(t.name); setIsAddingCustom(false); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  brushStatus === t.name 
                    ? "ring-2 ring-offset-1 border-transparent" 
                    : "border-border hover:bg-secondary"
                }`}
                style={{ 
                  backgroundColor: brushStatus === t.name ? t.color : "transparent",
                  color: brushStatus === t.name ? "white" : "inherit",
                  borderColor: brushStatus === t.name ? t.color : undefined,
                  ringColor: t.color
                }}
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                <span>{t.name}</span>
              </button>
            ))}

            <button
              onClick={() => setIsAddingCustom(!isAddingCustom)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-border hover:bg-secondary text-muted-foreground"
            >
              + Adicionar situação
            </button>
          </div>
        </div>

        <div className="w-full">
          <Label className="mb-2">Região do Dente</Label>
          <Select value={brushRegion} onChange={(e) => setBrushRegion(e.target.value)}>
            {TOOTH_REGIONS.map(r => (
              <option key={r} value={r} className="capitalize">{r}</option>
            ))}
          </Select>
        </div>
      </div>

      {isAddingCustom && (
        <div className="flex flex-col sm:flex-row gap-3 items-end bg-secondary/30 p-3 rounded-md border border-border mt-2">
          <div className="flex-1">
            <Label>Nome da Situação</Label>
            <Input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Ex: lesão cervical" />
          </div>
          <div>
            <Label>Cor</Label>
            <div className="flex items-center gap-2 h-9">
              <input 
                type="color" 
                value={customColor} 
                onChange={e => setCustomColor(e.target.value)} 
                className="w-8 h-8 p-0 border-0 rounded cursor-pointer"
              />
            </div>
          </div>
          <Button variant="gold" onClick={handleAddCustom} disabled={!customName.trim() || loadingCustom}>
            Salvar
          </Button>
          <Button variant="ghost" onClick={() => setIsAddingCustom(false)}>Cancelar</Button>
        </div>
      )}


    </div>
  );
}
