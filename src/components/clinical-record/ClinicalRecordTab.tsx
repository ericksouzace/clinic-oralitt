import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit3, Activity, Stethoscope, Calendar, DollarSign, Package } from "lucide-react";
import { Card, Button, Badge, Input, Label, Select, Textarea } from "@/components/ui-bits";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  useClinicalRecords, 
  saveClinicalRecord, 
  deleteClinicalRecord,
  useProcedures,
  useSupplies,
  useOdontogramEntries,
  usePatients
} from "@/lib/db";
import { ClinicalRecord, ClinicalRecordSupply, uid } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sendWhatsAppMessage, getWhatsAppTemplates, renderWhatsAppTemplate } from "@/lib/whatsapp";

interface Props {
  patientId: string;
}

export function ClinicalRecordTab({ patientId }: Props) {
  const [records, error, loading, tablesMissing, refetch] = useClinicalRecords(patientId);
  const [procedures] = useProcedures();
  const [supplies] = useSupplies();
  const [odontogramEntries] = useOdontogramEntries(patientId);
  const [patients] = usePatients();
  const [subTab, setSubTab] = useState<'evolutions' | 'odontogram'>('evolutions');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<ClinicalRecord>>({});
  const [draftSupplies, setDraftSupplies] = useState<Partial<ClinicalRecordSupply>[]>([]);

  // Supply add state
  const [selectedSupplyId, setSelectedSupplyId] = useState("");
  const [selectedSupplyQty, setSelectedSupplyQty] = useState(1);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const isNewEvolution = params.get("newEvolution") === "true";
      if (isNewEvolution) {
        const dateParam = params.get("date") || new Date().toISOString().split("T")[0];
        const notesParam = params.get("notes") || "";
        const procIdParam = params.get("procId") || params.get("procedureId") || "";

        // Set draft
        const selectedProc = procedures.find(p => p.id === procIdParam);
        setDraft({
          recordDate: dateParam,
          description: notesParam,
          procedureId: procIdParam || undefined,
          chargedAmount: selectedProc && selectedProc.suggestedPrice !== undefined ? selectedProc.suggestedPrice : 0,
          teeth: []
        });

        // Load default supplies if procedure is provided
        if (procIdParam) {
          supabase.auth.getUser().then(({ data: userData }) => {
            if (userData.user) {
              supabase
                .from("procedure_supplies")
                .select("supply_id, quantity")
                .eq("procedure_id", procIdParam)
                .eq("user_id", userData.user.id)
                .then(({ data }) => {
                  if (data && data.length > 0) {
                    const newSupplies: Partial<ClinicalRecordSupply>[] = data.map(ps => {
                      const supplyDef = supplies.find(s => s.id === ps.supply_id);
                      const qty = ps.quantity || 1;
                      let unitCost = 0;
                      if (supplyDef && supplyDef.packYield && supplyDef.packCost) {
                        unitCost = supplyDef.packCost / supplyDef.packYield;
                      }
                      return {
                        id: `temp-${uid()}`,
                        supplyId: ps.supply_id,
                        quantityUsed: qty,
                        unitCost: unitCost,
                        totalCost: unitCost * qty,
                        supplyName: supplyDef?.name || "Insumo desconhecido"
                      };
                    });
                    setDraftSupplies(newSupplies);
                    toast.success(`${newSupplies.length} insumo(s) padrão adicionado(s).`);
                  } else {
                    setDraftSupplies([]);
                  }
                });
            }
          });
        } else {
          setDraftSupplies([]);
        }

        setIsModalOpen(true);

        // Clear the query parameters from URL so they don't trigger again on reload
        const newParams = new URLSearchParams(window.location.search);
        newParams.delete("newEvolution");
        newParams.delete("date");
        newParams.delete("notes");
        newParams.delete("procId");
        newParams.delete("procedureId");
        const newSearch = newParams.toString();
        const newUrl = window.location.pathname + (newSearch ? "?" + newSearch : "");
        window.history.replaceState(null, "", newUrl);
      }
    }
  }, [procedures, supplies, typeof window !== "undefined" ? window.location.search : ""]);

  if (loading) {
    return (
      <div className="py-10 text-center text-muted-foreground text-sm font-medium animate-pulse">
        Carregando ficha clínica...
      </div>
    );
  }

  if (tablesMissing) {
    return (
      <div className="py-24 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600 mb-4">
          <Activity className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-display font-semibold mb-2">Estrutura Incompleta</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Estrutura da ficha clínica precisa ser criada no Supabase.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-10 text-center text-rose-600">
        <p>Ocorreu um erro ao carregar as evoluções clínicas.</p>
        <p className="text-sm opacity-80 mt-2">{error}</p>
      </div>
    );
  }

  const openNewRecordModal = () => {
    setDraft({
      recordDate: new Date().toISOString().split("T")[0],
      chargedAmount: 0,
      teeth: []
    });
    setDraftSupplies([]);
    setSelectedSupplyId("");
    setSelectedSupplyQty(1);
    setIsModalOpen(true);
  };

  const openEditRecordModal = (record: ClinicalRecord) => {
    setDraft(record);
    const loadedSupplies = (record.supplies || []).map(s => {
      const supplyDef = supplies.find(x => x.id === s.supplyId);
      let uCost = s.unitCost || 0;
      if (uCost === 0 && supplyDef && supplyDef.packYield && supplyDef.packCost) {
        uCost = supplyDef.packCost / supplyDef.packYield;
      }
      return {
        ...s,
        unitCost: uCost,
        totalCost: uCost * s.quantityUsed,
        supplyName: supplyDef?.name || s.supplyName
      };
    });
    setDraftSupplies(loadedSupplies);
    setSelectedSupplyId("");
    setSelectedSupplyQty(1);
    setIsModalOpen(true);
  };

  const handleProcedureSelect = async (procId: string) => {
    const proc = procedures.find(p => p.id === procId);
    setDraft(prev => ({
      ...prev,
      procedureId: procId,
      chargedAmount: proc && proc.suggestedPrice !== undefined ? proc.suggestedPrice : prev.chargedAmount
    }));

    if (procId) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;
        
        const { data } = await supabase
          .from("procedure_supplies")
          .select("supply_id, quantity")
          .eq("procedure_id", procId)
          .eq("user_id", userData.user.id);
        
        if (data && data.length > 0) {
          const newSupplies: Partial<ClinicalRecordSupply>[] = data.map(ps => {
            const supplyDef = supplies.find(s => s.id === ps.supply_id);
            const qty = ps.quantity || 1;
            let unitCost = 0;
            if (supplyDef && supplyDef.packYield && supplyDef.packCost) {
              unitCost = supplyDef.packCost / supplyDef.packYield;
            }
            return {
              id: `temp-${uid()}`,
              supplyId: ps.supply_id,
              quantityUsed: qty,
              unitCost: unitCost,
              totalCost: unitCost * qty,
              supplyName: supplyDef?.name || "Insumo desconhecido"
            };
          });
          
          setDraftSupplies(newSupplies);
          toast.success(`${newSupplies.length} insumo(s) padrão adicionado(s).`);
        } else {
          setDraftSupplies([]);
        }
      } catch (err) {
        console.error("Failed to load procedure supplies", err);
      }
    }
  };

  const handleAddSupply = () => {
    if (!selectedSupplyId) return;
    const supplyDef = supplies.find(s => s.id === selectedSupplyId);
    if (!supplyDef) return;

    let unitCost = 0;
    if (supplyDef.packYield && supplyDef.packCost) {
      unitCost = supplyDef.packCost / supplyDef.packYield;
    }

    const newItem: Partial<ClinicalRecordSupply> = {
      id: `temp-${uid()}`,
      supplyId: selectedSupplyId,
      quantityUsed: selectedSupplyQty,
      unitCost: unitCost,
      totalCost: unitCost * selectedSupplyQty,
      supplyName: supplyDef.name
    };

    setDraftSupplies(prev => [...prev, newItem]);
    setSelectedSupplyId("");
    setSelectedSupplyQty(1);
  };

  const handleRemoveSupply = (tempId: string) => {
    setDraftSupplies(prev => prev.filter(s => s.id !== tempId));
  };

  const updateSupplyQty = (tempId: string, newQty: number) => {
    setDraftSupplies(prev => prev.map(s => {
      if (s.id === tempId) {
        const qty = newQty > 0 ? newQty : 1;
        return {
          ...s,
          quantityUsed: qty,
          totalCost: (s.unitCost || 0) * qty
        };
      }
      return s;
    }));
  };

  const handleSave = async () => {
    try {
      if (!draft.recordDate) {
        toast.error("Data do atendimento é obrigatória.");
        return;
      }

      // Check stock warning
      for (const ds of draftSupplies) {
        if (!ds.supplyId) continue;
        const supplyDef = supplies.find(s => s.id === ds.supplyId);
        if (supplyDef) {
          const requested = ds.quantityUsed || 1;
          const currentStock = supplyDef.stock || 0;
          if (requested > currentStock) {
            const confirmSave = window.confirm(`O insumo "${supplyDef.name}" possui apenas ${currentStock} unidades em estoque. Deseja registrar a evolução mesmo assim?`);
            if (!confirmSave) {
              return;
            }
          }
        }
      }

      const proc = procedures.find(p => p.id === draft.procedureId);
      const labCost = proc?.labCost || 0;
      const otherDirect = proc?.otherDirect || 0;
      const realCost = draftSupplies.reduce((acc, curr) => acc + (curr.totalCost || 0), 0) + labCost + otherDirect;
      const charged = draft.chargedAmount || 0;
      const profit = charged - realCost;

      const newRecord: ClinicalRecord = {
        id: draft.id || `temp-${uid()}`,
        userId: draft.userId || "",
        patientId: patientId,
        procedureId: draft.procedureId,
        recordDate: draft.recordDate,
        teeth: draft.teeth || [],
        description: draft.description,
        notes: draft.notes,
        chargedAmount: charged,
        realCost: realCost,
        estimatedProfit: profit,
        signature: draft.signature,
        createdAt: draft.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const finalSupplies = draftSupplies.map(s => ({
        id: s.id || `temp-${uid()}`,
        userId: newRecord.userId,
        clinicalRecordId: newRecord.id,
        patientId: patientId,
        supplyId: s.supplyId,
        quantityUsed: s.quantityUsed || 1,
        unitCost: s.unitCost || 0,
        totalCost: s.totalCost || 0,
        createdAt: s.createdAt || new Date().toISOString()
      } as ClinicalRecordSupply));

      await saveClinicalRecord(newRecord, finalSupplies);
      toast.success("Evolução clínica salva com sucesso!");
      setIsModalOpen(false);

      const patientDef = patients.find(p => p.id === patientId);
      const phone = patientDef?.phone || patientDef?.whatsapp || "";
      if (phone) {
        const goWhatsApp = window.confirm("Deseja enviar orientações pós-atendimento via WhatsApp para o paciente?");
        if (goWhatsApp) {
          const params = new URLSearchParams({
            patientId: patientId,
            templateId: "tpl-pos-atendimento"
          });
          window.location.href = `/whatsapp?${params.toString()}`;
          return;
        }
      }
      window.location.reload();
    } catch (err: any) {
      toast.error("Erro ao salvar evolução: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteClinicalRecord(id);
      toast.success("Evolução excluída.");
      refetch();
    } catch (err: any) {
      toast.error("Não foi possível excluir agora.");
    }
  };

  const proc = procedures.find(p => p.id === draft.procedureId);
  const labCost = proc?.labCost || 0;
  const otherDirect = proc?.otherDirect || 0;
  const calculatedRealCost = draftSupplies.reduce((acc, curr) => acc + (curr.totalCost || 0), 0) + labCost + otherDirect;
  const calculatedProfit = (draft.chargedAmount || 0) - calculatedRealCost;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-gold" />
            Ficha Clínica / Evolução
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Registre os atendimentos e acompanhe custos de insumos na timeline.
          </p>
        </div>
        <Button className="bg-[#C9A227] hover:bg-[#b59122] text-white font-semibold" onClick={openNewRecordModal}>
          <Plus className="h-4 w-4 mr-2" /> Nova Evolução
        </Button>
      </div>

      {/* Seleção de Sub-Aba */}
      <div className="flex border-b border-border mb-4">
        <button
          type="button"
          onClick={() => setSubTab('evolutions')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            subTab === 'evolutions'
              ? 'border-[#C9A227] text-[#C9A227]'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Evoluções Clínicas
        </button>
        <button
          type="button"
          onClick={() => setSubTab('odontogram')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            subTab === 'odontogram'
              ? 'border-[#C9A227] text-[#C9A227]'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Histórico Odontológico
        </button>
      </div>

      {subTab === 'odontogram' ? (
        odontogramEntries.length === 0 ? (
          <Card className="p-6 bg-secondary/10 border-dashed">
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gold opacity-50 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Nenhum evento do odontograma</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                As marcações feitas no odontograma do paciente aparecerão listadas aqui para rastreabilidade.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {odontogramEntries.map((entry) => (
              <Card key={entry.id} className="p-4 hover:border-gold/50 transition-colors">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: entry.color || "black" }} />
                      <span className="font-semibold capitalize text-sm">{entry.status}</span>
                      <Badge tone="neutral" className="font-medium text-xs">
                        Dente {entry.toothNumber} ({entry.toothRegion})
                      </Badge>
                    </div>
                    {entry.notes && (
                      <p className="text-sm text-muted-foreground mt-1 bg-secondary/20 p-2 rounded border border-border/50">
                        {entry.notes}
                      </p>
                    )}
                    <div className="text-[10px] text-muted-foreground mt-2">
                      Criado em: {new Date(entry.createdAt).toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-white border border-[#C9A227] text-[#C9A227] hover:bg-[#faf9f5] font-semibold text-xs py-1 h-8"
                      onClick={() => {
                        // Pre-fill evolution modal
                        setDraft({
                          recordDate: new Date().toISOString().split("T")[0],
                          teeth: [entry.toothNumber],
                          description: `Evolução clínica a partir da marcação no Odontograma:\n- Dente: ${entry.toothNumber}\n- Região: ${entry.toothRegion}\n- Diagnóstico/Status: ${entry.status}${entry.notes ? `\n- Observação: ${entry.notes}` : ''}`,
                          chargedAmount: 0
                        });
                        setDraftSupplies([]);
                        setSelectedSupplyId("");
                        setSelectedSupplyQty(1);
                        setSubTab('evolutions');
                        setIsModalOpen(true);
                      }}
                    >
                      Criar evolução a partir desta marcação
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        records.length === 0 ? (
          <Card className="p-6 bg-secondary/10 border-dashed">
            <div className="text-center py-12">
              <Stethoscope className="h-12 w-12 text-gold opacity-50 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Nenhuma evolução registrada</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                O histórico clínico do paciente aparecerá aqui em formato de linha do tempo.
              </p>
              <Button variant="outline" className="bg-white border border-[#C9A227] text-[#C9A227] hover:bg-[#faf9f5] font-semibold" onClick={openNewRecordModal}>Registrar atendimento</Button>
            </div>
          </Card>
        ) : (
          <div className="relative border-l border-border ml-4 md:ml-6 pl-6 space-y-8 mt-8">
            {records.map((record) => (
              <div key={record.id} className="relative">
                {/* Timeline marker */}
                <div className="absolute -left-[33px] top-1 h-4 w-4 rounded-full bg-white border-2 border-gold flex items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-gold"></div>
                </div>
                
                <Card className="p-5 hover:border-gold/50 transition-colors">
                  <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Badge tone="neutral" className="flex items-center gap-1 font-medium">
                          <Calendar className="w-3 h-3" />
                          {new Date(record.recordDate).toLocaleDateString()}
                        </Badge>
                        {record.procedureName && (
                          <Badge tone="gold" className="capitalize">{record.procedureName}</Badge>
                        )}
                        {record.procedureId && (
                          <Badge tone="neutral" className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold py-0.5 px-2">
                            Agenda Vinculada
                          </Badge>
                        )}
                        {record.chargedAmount > 0 && (
                          <Badge tone="neutral" className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold py-0.5 px-2">
                            Financeiro Integrado
                          </Badge>
                        )}
                      </div>
                      
                      {record.teeth && record.teeth.length > 0 && (
                        <p className="text-sm font-medium mb-2">
                          Dentes / Região: <span className="text-muted-foreground">{record.teeth.join(", ")}</span>
                        </p>
                      )}

                      <p className="text-sm whitespace-pre-wrap mb-2">
                        {record.description || <span className="italic text-muted-foreground">Sem descrição</span>}
                      </p>
                      {record.signature && (
                        <p className="text-xs text-muted-foreground mb-4 italic">
                          Profissional: {record.signature}
                        </p>
                      )}

                      {record.supplies && record.supplies.length > 0 && (
                        <div className="bg-secondary/30 rounded p-3 mb-3 text-xs text-muted-foreground">
                          <p className="font-semibold mb-1 flex items-center gap-1"><Package className="w-3 h-3" /> Insumos Usados ({record.supplies.length})</p>
                          <ul className="list-disc list-inside">
                            {record.supplies.map(s => (
                              <li key={s.id}>{s.quantityUsed}x {s.supplyName}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border/50 text-sm">
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground font-semibold uppercase">Valor Cobrado</span>
                          <span className="font-medium">R$ {record.chargedAmount?.toFixed(2) || "0.00"}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground font-semibold uppercase">Custo Real</span>
                          <span className="font-medium text-rose-600">R$ {record.realCost?.toFixed(2) || "0.00"}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground font-semibold uppercase">Lucro</span>
                          <span className={`font-medium ${record.estimatedProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            R$ {record.estimatedProfit?.toFixed(2) || "0.00"}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                      <Button variant="outline" size="sm" className="h-8 text-xs font-semibold" onClick={() => openEditRecordModal(record)}>
                        <Edit3 className="w-3.5 h-3.5 mr-1" /> Editar
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-transparent hover:border-rose-200 font-semibold" onClick={() => handleDelete(record.id)}>
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )
      )}

      {/* Modal Nova Evolução */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar Evolução Clínica" : "Nova Evolução Clínica"}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data do Atendimento *</Label>
                <Input 
                  type="date" 
                  value={draft.recordDate || ""} 
                  onChange={e => setDraft({...draft, recordDate: e.target.value})}
                />
              </div>
              <div>
                <Label>Procedimento Realizado</Label>
                <Select 
                  value={draft.procedureId || ""} 
                  onChange={e => handleProcedureSelect(e.target.value)}
                >
                  <option value="">Selecione um procedimento...</option>
                  {procedures.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <Label>Dentes / Regiões envolvidas</Label>
              <Input 
                value={(draft.teeth || []).join(", ")} 
                onChange={e => {
                  const arr = e.target.value.split(",").map(t => t.trim()).filter(Boolean);
                  setDraft({...draft, teeth: arr});
                }}
                placeholder="Ex: 18, 21, Superior Direito..."
              />
            </div>

            <div>
              <Label>Descrição Clínica</Label>
              <Textarea 
                value={draft.description || ""} 
                onChange={e => setDraft({...draft, description: e.target.value})}
                placeholder="Detalhes sobre o procedimento executado, técnica, material etc..."
                rows={4}
              />
            </div>

            <div className="bg-secondary/20 p-4 rounded-xl border border-border space-y-4">
              <div>
                <h4 className="font-semibold flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4" /> Insumos Utilizados
                </h4>
                <p className="text-xs text-muted-foreground">
                  Adicione insumos para calcular o custo real. Baixa automática de estoque será configurada em etapa futura.
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label className="text-xs">Insumo</Label>
                    <Select value={selectedSupplyId} onChange={e => setSelectedSupplyId(e.target.value)}>
                      <option value="">Selecione...</option>
                      {supplies.map(s => (
                        <option key={s.id} value={s.id}>{s.name} (R$ {(s.packCost && s.packYield ? s.packCost / s.packYield : 0).toFixed(2)}/un)</option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-24">
                    <Label className="text-xs">Qtd</Label>
                    <Input 
                      type="number" 
                      min="1" 
                      value={selectedSupplyQty} 
                      onChange={e => setSelectedSupplyQty(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <Button type="button" className="bg-[#C9A227] hover:bg-[#b59122] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleAddSupply} disabled={!selectedSupplyId}>
                    Adicionar
                  </Button>
                </div>
                {selectedSupplyId && (() => {
                  const s = supplies.find(x => x.id === selectedSupplyId);
                  if (s && (!s.packCost || !s.packYield)) {
                    return (
                      <p className="text-xs text-amber-600 font-medium">
                        ⚠️ Este insumo está sem custo ou rendimento configurado.
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>

              {draftSupplies.length > 0 && (
                <div className="bg-white border rounded-lg divide-y">
                  {draftSupplies.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-2 text-sm">
                      <div className="flex-1 flex flex-col">
                        <span className="font-medium">{s.supplyName}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                          <span>Custo un.: R$ {s.unitCost?.toFixed(2)}</span>
                          {s.unitCost === 0 && (
                            <span className="text-amber-600 font-medium text-[11px]">
                              (⚠️ Este insumo está sem custo ou rendimento configurado)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Input 
                            type="number" 
                            className="w-16 h-7 text-center p-1" 
                            min="1"
                            value={s.quantityUsed}
                            onChange={e => updateSupplyQty(s.id!, parseInt(e.target.value) || 1)}
                          />
                          <span className="text-muted-foreground text-xs">
                            {supplies.find(x => x.id === s.supplyId)?.unit || "un"}
                          </span>
                        </div>
                        <span className="w-20 text-right text-rose-600">R$ {s.totalCost?.toFixed(2)}</span>
                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => handleRemoveSupply(s.id!)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="p-2 flex flex-col gap-1 bg-secondary/30 text-sm font-semibold">
                    <div className="flex justify-between">
                      <span>Custo Total de Insumos</span>
                      <span className="text-rose-600">R$ {draftSupplies.reduce((acc, curr) => acc + (curr.totalCost || 0), 0).toFixed(2)}</span>
                    </div>
                    {labCost > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground font-normal">
                        <span>Custo de Laboratório</span>
                        <span>R$ {labCost.toFixed(2)}</span>
                      </div>
                    )}
                    {otherDirect > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground font-normal">
                        <span>Outros Custos Diretos</span>
                        <span>R$ {otherDirect.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-1 mt-1 text-sm font-bold">
                      <span>Custo Real Total</span>
                      <span className="text-rose-600">R$ {calculatedRealCost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor Cobrado (R$)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={draft.chargedAmount === 0 && !draft.procedureId ? "" : draft.chargedAmount} 
                  onChange={e => setDraft({...draft, chargedAmount: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="flex flex-col justify-end">
                <div className={`text-sm font-semibold p-2 rounded-md border ${calculatedProfit >= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                  Lucro Estimado: R$ {calculatedProfit.toFixed(2)}
                </div>
              </div>
            </div>
            
            <div>
              <Label>Assinatura / Responsável</Label>
              <Input 
                value={draft.signature || ""} 
                onChange={e => setDraft({...draft, signature: e.target.value})}
                placeholder="Nome do profissional"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" className="bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 font-semibold" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="button" className="bg-[#C9A227] hover:bg-[#b59122] text-white font-semibold" onClick={handleSave}>Salvar Evolução</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
