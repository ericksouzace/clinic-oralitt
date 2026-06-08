import React, { useState } from "react";
import { OdontogramErrorBoundary } from "./OdontogramErrorBoundary";
import { useOdontogramEntries } from "@/lib/db";
import { OdontogramMap } from "./OdontogramMap";
import { OdontogramToolbar } from "./OdontogramToolbar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label, Textarea, Button } from "@/components/ui-bits";
import { Trash2 } from "lucide-react";
import { STATUS_COLORS } from "@/lib/store";
import { useOdontogramCustomTypes } from "./useOdontogramCustomTypes";
import { toast } from "sonner";

interface Props {
  patientId: string;
}

function OdontogramContent({ patientId }: Props) {
  const [entries, setEntries, loading, error] = useOdontogramEntries(patientId);
  const { types: customTypes } = useOdontogramCustomTypes();

  const [brushStatus, setBrushStatus] = useState("cárie");
  const [brushRegion, setBrushRegion] = useState("dente inteiro");

  const [selectedRegion, setSelectedRegion] = useState<{ tooth: string, region: string } | null>(null);
  const [modalNotes, setModalNotes] = useState("");
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [existingEntryId, setExistingEntryId] = useState<string | null>(null);

  if (loading) {
    return <div className="p-8 text-center animate-pulse text-muted-foreground">Carregando odontograma...</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-center bg-rose-50 rounded-lg text-rose-600">
        <h3 className="font-bold">Erro ao carregar o odontograma</h3>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    if (STATUS_COLORS[status]) return STATUS_COLORS[status];
    const custom = (customTypes || []).find(t => t.name === status);
    return custom ? custom.color : "#000";
  };

  const handleRegionClick = (toothNumber: string, region: string) => {
    // A regra diz: "Quando o status for extração... aplicar em dente inteiro"
    // Isso quer dizer que se o brushStatus for extração/ausente etc, forçamos o clique a ser no dente inteiro
    let targetRegion = region;
    
    // Regra: dente inteiro
    if (brushRegion === "dente inteiro" || 
        brushStatus === "extração indicada" || 
        brushStatus === "extração realizada" || 
        brushStatus === "ausente") {
      targetRegion = "dente inteiro";
    }

    const existing = (entries || []).find(o => o.toothNumber === toothNumber && o.toothRegion === targetRegion);
    setExistingEntryId(existing?.id || null);
    setSelectedRegion({ tooth: toothNumber, region: targetRegion });
    setModalNotes(existing?.notes || "");
    setIsNotesModalOpen(true);
  };

  const handleSaveEntry = async () => {
    if (!selectedRegion) return;
    
    const colorToSave = getStatusColor(brushStatus);

    const newEntry = {
      patientId: patientId,
      toothNumber: selectedRegion.tooth,
      toothRegion: selectedRegion.region,
      status: brushStatus,
      color: colorToSave,
      notes: modalNotes
    };

    if (existingEntryId) {
      await setEntries(prev => (prev || []).map(o => o.id === existingEntryId ? { ...o, ...newEntry } : o));
    } else {
      await setEntries(prev => [...(prev || []), { ...newEntry, id: "temp-" + Date.now(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as any]);
    }
    
    setIsNotesModalOpen(false);
  };

  const handleDeleteEntry = async () => {
    if (!existingEntryId) return;
    try {
      await setEntries(prev => (prev || []).filter(o => o.id !== existingEntryId));
      setIsNotesModalOpen(false);
      toast.success("Marcação removida.");
    } catch (err) {
      toast.error("Não foi possível excluir agora.");
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full">
      <div className="flex flex-col lg:flex-row gap-6 w-full items-start">
        <div className="w-full lg:w-80 shrink-0">
          <OdontogramToolbar 
            brushStatus={brushStatus}
            setBrushStatus={setBrushStatus}
            brushRegion={brushRegion}
            setBrushRegion={setBrushRegion}
          />
        </div>
        
        <div className="flex-1 w-full flex flex-col gap-4">
          <div className="flex justify-center">
            <OdontogramMap 
              entries={entries || []}
              onRegionClick={handleRegionClick}
            />
          </div>
          
          {/* Legenda Discreta */}
          <div className="p-4 bg-white border border-border rounded-lg shadow-sm flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground justify-center">
            <span className="font-bold mr-1 text-foreground">Legenda:</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"/> Cárie</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]"/> Restauração</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#94a3b8]"/> Amálgama</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#a855f7]"/> Canal</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#fbbf24]"/> Coroa</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#a16207]"/> Implante</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#f97316]"/> Dor</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#cbd5e1]"/> Ausente</span>
            <span className="flex items-center gap-1.5 font-bold text-[#991b1b]">/ <span className="font-normal text-muted-foreground">Extração indicada</span></span>
            <span className="flex items-center gap-1.5 font-bold text-black">X <span className="font-normal text-muted-foreground">Extração realizada</span></span>
          </div>
        </div>
      </div>
      
      {/* Histórico do Odontograma */}
      <div>
        <h3 className="text-lg font-bold font-display mb-4">Histórico de Marcações</h3>
        {(!entries || entries.length === 0) ? (
          <div className="p-8 text-center text-muted-foreground bg-secondary/50 rounded-lg border border-border">
            Nenhuma marcação no odontograma ainda.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {entries.map(entry => (
              <div key={entry.id} className="flex items-center justify-between p-3 sm:p-4 bg-white border border-border rounded-lg shadow-sm">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 bg-secondary">
                    {entry.toothNumber}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: entry.color || "black" }} />
                      <span className="font-semibold capitalize text-sm">{entry.status}</span>
                      <span className="text-xs text-muted-foreground truncate hidden sm:inline-block">({entry.toothRegion})</span>
                    </div>
                    {entry.notes && (
                      <p className="text-xs text-muted-foreground truncate mt-1">{entry.notes}</p>
                    )}
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {new Date(entry.createdAt).toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setExistingEntryId(entry.id);
                      setSelectedRegion({ tooth: entry.toothNumber, region: entry.toothRegion });
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
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    onClick={async () => {
                      try {
                        await setEntries(prev => (prev || []).filter(o => o.id !== entry.id));
                        toast.success("Marcação removida.");
                      } catch (err) {
                        toast.error("Não foi possível excluir agora.");
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isNotesModalOpen} onOpenChange={setIsNotesModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{existingEntryId ? "Observações do dente selecionado" : "Nova Marcação"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Dente</Label>
                <div className="font-bold text-lg">{selectedRegion?.tooth}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Região</Label>
                <div className="font-medium capitalize">{selectedRegion?.region}</div>
              </div>
            </div>
            
            <div className="bg-secondary/20 p-3 rounded-lg border border-border">
              <Label className="text-xs text-muted-foreground">Status / Problema</Label>
              <div className="font-medium text-foreground capitalize flex items-center gap-2 mt-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getStatusColor(brushStatus) }} />
                {brushStatus}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observação (Opcional)</Label>
              <Textarea 
                placeholder="Detalhes adicionais sobre este problema..." 
                value={modalNotes}
                onChange={(e) => setModalNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between items-center w-full">
            {existingEntryId ? (
              <Button variant="outline" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200" onClick={handleDeleteEntry}>
                <Trash2 className="w-4 h-4 mr-2" /> Excluir
              </Button>
            ) : <div />}
            <Button variant="gold" onClick={handleSaveEntry}>
              Salvar marcação
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
