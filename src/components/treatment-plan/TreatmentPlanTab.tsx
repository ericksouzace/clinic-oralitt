import React, { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Plus, Trash2, Edit3, Activity, FileText, Calendar, DollarSign, ChevronLeft } from "lucide-react";
import { Card, Button, Badge, Input, Label, Select, Textarea } from "@/components/ui-bits";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  useTreatmentPlans, 
  saveTreatmentPlan, 
  deleteTreatmentPlan, 
  saveTreatmentPlanItem, 
  deleteTreatmentPlanItem,
  useProcedures,
  saveBudget
} from "@/lib/db";
import { TreatmentPlan, TreatmentPlanItem, Budget, BudgetItem, uid } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  patientId: string;
}

export function TreatmentPlanTab({ patientId }: Props) {
  const router = useRouter();
  const [plans, error, loading, tablesMissing] = useTreatmentPlans(patientId);
  const [procedures] = useProcedures();
  
  const [selectedPlanId, setSelectedPlanIdState] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("planId");
    }
    return null;
  });

  const handleSelectPlanId = (id: string | null) => {
    setSelectedPlanIdState(id);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (id) {
        params.set("planId", id);
      } else {
        params.delete("planId");
      }
      window.history.replaceState(null, "", "?" + params.toString());
      router.invalidate();
    }
  };

  const [emptyPlanActionType, setEmptyPlanActionType] = useState<'valores' | 'precificar' | 'orcamento' | null>(null);

  // Modais
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planDraft, setPlanDraft] = useState<Partial<TreatmentPlan>>({});

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemDraft, setItemDraft] = useState<Partial<TreatmentPlanItem>>({});

  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [pricingItemsDraft, setPricingItemsDraft] = useState<TreatmentPlanItem[]>([]);

  // Precificar plano modal
  const [isPrecificarOpen, setIsPrecificarOpen] = useState(false);
  const [precificarDiscount, setPrecificarDiscount] = useState(0);
  const [precificarValidity, setPrecificarValidity] = useState("");
  const [precificarNotes, setPrecificarNotes] = useState("");
  const [precificarItemsDraft, setPrecificarItemsDraft] = useState<TreatmentPlanItem[]>([]);

  if (loading) {
    return (
      <div className="py-10 text-center text-muted-foreground text-sm font-medium animate-pulse">
        Carregando planos de tratamento...
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
          Estrutura do plano de tratamento precisa ser criada no Supabase.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-10 text-center text-rose-600">
        <p>Ocorreu um erro ao carregar os planos de tratamento.</p>
        <p className="text-sm opacity-80 mt-2">{error}</p>
      </div>
    );
  }

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  const handleSavePlan = async () => {
    try {
      if (!planDraft.title) {
        toast.error("O título é obrigatório");
        return;
      }
      
      const newPlan: TreatmentPlan = {
        id: planDraft.id || `temp-${uid()}`,
        userId: planDraft.userId || "",
        patientId: patientId,
        title: planDraft.title,
        diagnosis: planDraft.diagnosis,
        notes: planDraft.notes,
        status: planDraft.status || "planejado",
        startDate: planDraft.startDate,
        expectedEndDate: planDraft.expectedEndDate,
        createdAt: planDraft.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveTreatmentPlan(newPlan);
      toast.success("Plano de tratamento salvo com sucesso!");
      setIsPlanModalOpen(false);
      // Aqui idealmente re-fetch os planos, o supabase fará real-time ou basta forçar recarregamento?
      // O react router não recarrega sozinho, podemos avisar pra dar F5 se precisar, ou reload na página
      window.location.reload(); 
    } catch (err: any) {
      toast.error("Erro ao salvar plano: " + err.message);
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (confirm("Tem certeza que deseja apagar este plano inteiro? Todos os itens dele serão removidos.")) {
      try {
        await deleteTreatmentPlan(id);
        toast.success("Plano apagado com sucesso.");
        if (selectedPlanId === id) handleSelectPlanId(null);
        window.location.reload();
      } catch (err: any) {
        toast.error("Erro ao apagar: " + err.message);
      }
    }
  };

  const handleSaveItem = async () => {
    try {
      if (!itemDraft.description && !itemDraft.procedureId) {
        toast.error("Informe uma descrição ou selecione um procedimento.");
        return;
      }

      if (!selectedPlanId) return;

      const newItem: TreatmentPlanItem = {
        id: itemDraft.id || `temp-${uid()}`,
        userId: itemDraft.userId || "",
        treatmentPlanId: selectedPlanId,
        procedureId: itemDraft.procedureId,
        toothNumber: itemDraft.toothNumber,
        toothRegion: itemDraft.toothRegion,
        description: itemDraft.description,
        priority: itemDraft.priority || "média",
        estimatedPrice: itemDraft.estimatedPrice || 0,
        status: itemDraft.status || "planejado",
        createdAt: itemDraft.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveTreatmentPlanItem(newItem);
      toast.success("Item salvo com sucesso!");
      setIsItemModalOpen(false);
      window.location.reload();
    } catch (err: any) {
      toast.error("Erro ao salvar item: " + err.message);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm("Apagar este procedimento do plano?")) {
      try {
        await deleteTreatmentPlanItem(id);
        toast.success("Item apagado.");
        window.location.reload();
      } catch (err: any) {
        toast.error("Erro ao apagar: " + err.message);
      }
    }
  };

  const openNewPlanModal = () => {
    setPlanDraft({
      status: "planejado"
    });
    setIsPlanModalOpen(true);
  };

  const openEditPlanModal = (plan: TreatmentPlan) => {
    setPlanDraft(plan);
    setIsPlanModalOpen(true);
  };

  const openNewItemModal = () => {
    setItemDraft({
      status: "planejado",
      priority: "média"
    });
    setIsItemModalOpen(true);
  };

  const openEditItemModal = (item: TreatmentPlanItem) => {
    setItemDraft(item);
    setIsItemModalOpen(true);
  };

  const openPricingModal = (plan: TreatmentPlan) => {
    if (!plan.items || plan.items.length === 0) {
      setEmptyPlanActionType('valores');
      return;
    }
    setPricingItemsDraft(plan.items.map(i => ({ ...i })));
    setIsPricingModalOpen(true);
  };

  const handleSavePricing = async () => {
    try {
      if (!selectedPlan) return;
      for (const item of pricingItemsDraft) {
        await saveTreatmentPlanItem(item);
      }
      toast.success("Valores do plano atualizados!");
      setIsPricingModalOpen(false);
      window.location.reload();
    } catch (err: any) {
      toast.error("Erro ao salvar valores: " + err.message);
    }
  };

  const handleProcedureSelect = (procId: string) => {
    const proc = procedures.find(p => p.id === procId);
    setItemDraft(prev => ({
      ...prev,
      procedureId: procId,
      description: proc ? proc.name : prev.description,
      estimatedPrice: proc && proc.suggestedPrice !== undefined ? proc.suggestedPrice : prev.estimatedPrice
    }));
  };

  const handleGenerateBudget = async (plan: TreatmentPlan, items: TreatmentPlanItem[] = plan.items || [], discount = 0, notes = "") => {
    try {
      if (items.length === 0) {
        setEmptyPlanActionType('orcamento');
        return;
      }

      const totalAmount = items.reduce((acc, curr) => acc + (curr.estimatedPrice || 0), 0);
      const finalAmount = totalAmount - discount;

      const budget: Budget = {
        id: `temp-${uid()}`,
        userId: plan.userId,
        patientId: patientId,
        treatmentPlanId: plan.id,
        title: `Orçamento: ${plan.title}`,
        totalAmount,
        discount,
        finalAmount,
        status: "rascunho",
        notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const bItems: BudgetItem[] = items.map(item => ({
        id: `temp-${uid()}`,
        userId: plan.userId,
        budgetId: budget.id,
        procedureId: item.procedureId,
        toothNumber: item.toothNumber,
        toothRegion: item.toothRegion,
        description: item.description || item.procedureName || "Item do Plano",
        quantity: 1,
        unitPrice: item.estimatedPrice || 0,
        totalPrice: item.estimatedPrice || 0,
        createdAt: new Date().toISOString()
      }));

      await saveBudget(budget, bItems);
      toast.success("Orçamento gerado com sucesso! Vá para a aba Financeiro.");
    } catch (err: any) {
      toast.error("Erro ao gerar orçamento: " + err.message);
    }
  };

  const openPrecificarModal = (plan: TreatmentPlan) => {
    if (!plan.items || plan.items.length === 0) {
      setEmptyPlanActionType('precificar');
      return;
    }
    setPrecificarDiscount(0);
    setPrecificarValidity("");
    setPrecificarNotes("");
    setPrecificarItemsDraft(plan.items.map(i => ({ ...i })));
    setIsPrecificarOpen(true);
  };

  if (selectedPlan) {
    const totalEstimado = selectedPlan.items?.reduce((acc, curr) => acc + (curr.estimatedPrice || 0), 0) || 0;

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" className="mb-2 -ml-3 text-muted-foreground" onClick={() => handleSelectPlanId(null)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Voltar aos planos
            </Button>
            <h2 className="font-display font-bold text-xl flex items-center gap-2">
              <FileText className="h-5 w-5 text-gold" />
              {selectedPlan.title}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <Badge tone={
                selectedPlan.status === 'concluído' ? 'ok' : 
                selectedPlan.status === 'planejado' ? 'neutral' : 
                selectedPlan.status === 'cancelado' ? 'warn' : 'gold'
              } className="capitalize">
                {selectedPlan.status}
              </Badge>
              {selectedPlan.diagnosis && (
                <span className="text-sm text-muted-foreground ml-2">Diagnóstico: {selectedPlan.diagnosis}</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-semibold" onClick={() => openEditPlanModal(selectedPlan)}>
              <Edit3 className="h-4 w-4 mr-2" /> Editar plano
            </Button>
            <Button variant="outline" className="bg-white border border-red-500 text-red-500 hover:bg-red-50 hover:text-red-600 font-semibold" onClick={() => handleDeletePlan(selectedPlan.id)}>
              <Trash2 className="h-4 w-4 mr-2" /> Excluir plano
            </Button>
            <Button variant="outline" className="bg-white border border-[#C9A227] text-[#C9A227] hover:bg-[#faf9f5] hover:text-[#b59122] font-semibold" onClick={() => openPricingModal(selectedPlan)}>
              <Edit3 className="h-4 w-4 mr-2" /> Definir valores
            </Button>
            <Button variant="outline" className="bg-white border border-[#C9A227] text-[#C9A227] hover:bg-[#faf9f5] hover:text-[#b59122] font-semibold" onClick={() => openPrecificarModal(selectedPlan)}>
              <DollarSign className="w-4 h-4 mr-2" /> Precificar plano
            </Button>
            <Button variant="outline" className="bg-white border border-[#C9A227] text-[#C9A227] hover:bg-[#faf9f5] hover:text-[#b59122] font-semibold" onClick={() => handleGenerateBudget(selectedPlan)}>
              <DollarSign className="w-4 h-4 mr-2" /> Gerar orçamento
            </Button>
            <Button className="bg-[#C9A227] hover:bg-[#b59122] text-white font-semibold" onClick={openNewItemModal}>
              <Plus className="w-4 h-4 mr-2" /> Adicionar item
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-5 flex flex-col justify-center bg-secondary/10 border-border">
            <span className="text-xs text-muted-foreground font-semibold uppercase mb-1">Previsão</span>
            <div className="font-medium">
              {selectedPlan.startDate ? new Date(selectedPlan.startDate).toLocaleDateString() : "--"} a {selectedPlan.expectedEndDate ? new Date(selectedPlan.expectedEndDate).toLocaleDateString() : "--"}
            </div>
          </Card>
          <Card className="p-5 flex flex-col justify-center bg-secondary/10 border-border">
            <span className="text-xs text-muted-foreground font-semibold uppercase mb-1">Total Estimado</span>
            <div className="font-medium text-lg text-emerald-600 font-bold flex items-center">
              <DollarSign className="w-4 h-4 mr-1" />
              {totalEstimado.toFixed(2)}
            </div>
          </Card>
          <Card className="p-5 flex flex-col justify-center bg-secondary/10 border-border">
            <span className="text-xs text-muted-foreground font-semibold uppercase mb-1">Itens Planejados</span>
            <div className="font-medium text-lg">
              {selectedPlan.items?.length || 0} procedimentos
            </div>
          </Card>
        </div>

        <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/10">
            <h3 className="font-bold text-sm text-gray-800">Itens do plano</h3>
            <Button 
              type="button" 
              className="bg-[#C9A227] hover:bg-[#b59122] text-white font-semibold h-8 px-3 text-xs"
              onClick={openNewItemModal}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar item ao plano
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Procedimento</th>
                  <th className="px-4 py-3">Dente / Região</th>
                  <th className="px-4 py-3">Prioridade</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Valor Estimado</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(!selectedPlan.items || selectedPlan.items.length === 0) ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground font-medium">
                      Nenhum item adicionado a este plano ainda.
                    </td>
                  </tr>
                ) : (
                  selectedPlan.items.map(item => (
                    <tr key={item.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        {item.description || item.procedureName || "Sem descrição"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.toothNumber ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-secondary rounded-md text-xs font-bold">
                            {item.toothNumber} <span className="font-normal opacity-70">{item.toothRegion ? `- ${item.toothRegion}` : ''}</span>
                          </span>
                        ) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={
                          item.priority === 'urgente' ? 'warn' :
                          item.priority === 'alta' ? 'gold' :
                          item.priority === 'média' ? 'neutral' : 'ok'
                        } className="capitalize">{item.priority}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={
                          item.status === 'concluído' ? 'ok' :
                          item.status === 'cancelado' ? 'warn' :
                          item.status === 'planejado' ? 'neutral' : 'gold'
                        } className="capitalize">{item.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        R$ {item.estimatedPrice ? item.estimatedPrice.toFixed(2) : "0.00"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" className="text-gray-700 hover:text-gray-900 hover:bg-gray-100" onClick={() => openEditItemModal(item)}>
                            <Edit3 className="w-4 h-4 mr-2" /> Editar item
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteItem(item.id)}>
                            <Trash2 className="w-4 h-4 mr-2" /> Excluir item
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Item de Tratamento */}
        <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{itemDraft.id ? "Editar item" : "Adicionar item ao plano"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Procedimento base</Label>
                <Select 
                  value={itemDraft.procedureId || ""} 
                  onChange={e => handleProcedureSelect(e.target.value)}
                >
                  <option value="">Selecione um procedimento cadastrado...</option>
                  {procedures.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </div>

              <div>
                <Label>Descrição / Observação</Label>
                <Input 
                  value={itemDraft.description || ""} 
                  onChange={e => setItemDraft({...itemDraft, description: e.target.value})}
                  placeholder="Nome do procedimento ou detalhe..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Dente (opcional)</Label>
                  <Input 
                    placeholder="Ex: 18, 21, 44" 
                    value={itemDraft.toothNumber || ""} 
                    onChange={e => setItemDraft({...itemDraft, toothNumber: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Região (opcional)</Label>
                  <Select 
                    value={itemDraft.toothRegion || ""} 
                    onChange={e => setItemDraft({...itemDraft, toothRegion: e.target.value})}
                  >
                    <option value="">Inteiro</option>
                    <option value="superior esquerdo">Sup. Esquerdo</option>
                    <option value="superior direito">Sup. Direito</option>
                    <option value="inferior esquerdo">Inf. Esquerdo</option>
                    <option value="inferior direito">Inf. Direito</option>
                    <option value="centro">Centro</option>
                    <option value="raiz/base">Raiz/Base</option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Prioridade</Label>
                  <Select 
                    value={itemDraft.priority || "média"} 
                    onChange={e => setItemDraft({...itemDraft, priority: e.target.value as any})}
                  >
                    <option value="baixa">Baixa</option>
                    <option value="média">Média</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select 
                    value={itemDraft.status || "planejado"} 
                    onChange={e => setItemDraft({...itemDraft, status: e.target.value as any})}
                  >
                    <option value="planejado">Planejado</option>
                    <option value="aprovado">Aprovado</option>
                    <option value="em execução">Em execução</option>
                    <option value="concluído">Concluído</option>
                    <option value="cancelado">Cancelado</option>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Valor Estimado (R$)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  value={itemDraft.estimatedPrice || ""} 
                  onChange={e => setItemDraft({...itemDraft, estimatedPrice: parseFloat(e.target.value) || 0})}
                />
              </div>

            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 border border-gray-200 font-semibold" onClick={() => setIsItemModalOpen(false)}>Cancelar</Button>
              <Button type="button" className="bg-[#C9A227] hover:bg-[#b59122] text-white font-semibold" onClick={handleSaveItem}>Salvar item</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Precificação em Lote */}
        <Dialog open={isPricingModalOpen} onOpenChange={setIsPricingModalOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Definir Valores do Plano</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50 border-b">
                    <tr>
                      <th className="p-2 text-left">Procedimento</th>
                      <th className="p-2 text-left">Descrição</th>
                      <th className="p-2 text-left w-20">Dente</th>
                      <th className="p-2 text-left w-36">Região</th>
                      <th className="p-2 text-right w-24">P. Sugerido</th>
                      <th className="p-2 text-right w-28">P. Estimado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricingItemsDraft.map((it, idx) => {
                      const proc = procedures.find(p => p.id === it.procedureId);
                      return (
                        <tr key={it.id} className="border-b last:border-0 hover:bg-gray-50/50">
                          <td className="p-1">
                            <Select
                              value={it.procedureId || ""}
                              onChange={e => {
                                const pId = e.target.value;
                                const p = procedures.find(x => x.id === pId);
                                const newDraft = [...pricingItemsDraft];
                                newDraft[idx] = {
                                  ...newDraft[idx],
                                  procedureId: pId,
                                  description: p ? p.name : newDraft[idx].description,
                                  estimatedPrice: p && p.suggestedPrice !== undefined ? p.suggestedPrice : newDraft[idx].estimatedPrice
                                };
                                setPricingItemsDraft(newDraft);
                              }}
                              className="h-8 text-xs"
                            >
                              <option value="">Nenhum (Manual)</option>
                              {procedures.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </Select>
                          </td>
                          <td className="p-1">
                            <Input
                              value={it.description || ""}
                              onChange={e => {
                                const newDraft = [...pricingItemsDraft];
                                newDraft[idx] = { ...newDraft[idx], description: e.target.value };
                                setPricingItemsDraft(newDraft);
                              }}
                              className="h-8 text-xs"
                              placeholder="Procedimento..."
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              value={it.toothNumber || ""}
                              onChange={e => {
                                const newDraft = [...pricingItemsDraft];
                                newDraft[idx] = { ...newDraft[idx], toothNumber: e.target.value };
                                setPricingItemsDraft(newDraft);
                              }}
                              className="h-8 text-xs"
                              placeholder="Dente"
                            />
                          </td>
                          <td className="p-1">
                            <Select
                              value={it.toothRegion || ""}
                              onChange={e => {
                                const newDraft = [...pricingItemsDraft];
                                newDraft[idx] = { ...newDraft[idx], toothRegion: e.target.value };
                                setPricingItemsDraft(newDraft);
                              }}
                              className="h-8 text-xs"
                            >
                              <option value="">Inteiro</option>
                              <option value="superior esquerdo">Sup. Esquerdo</option>
                              <option value="superior direito">Sup. Direito</option>
                              <option value="inferior esquerdo">Inf. Esquerdo</option>
                              <option value="inferior direito">Inf. Direito</option>
                              <option value="centro">Centro</option>
                              <option value="raiz/base">Raiz/Base</option>
                            </Select>
                          </td>
                          <td className="p-1 text-right text-xs text-gray-500 tabular-nums">
                            {proc?.suggestedPrice ? `R$ ${proc.suggestedPrice.toFixed(2)}` : "—"}
                          </td>
                          <td className="p-1">
                            <Input
                              type="number"
                              step="0.01"
                              className="h-8 text-xs text-right font-medium"
                              value={it.estimatedPrice || 0}
                              onChange={e => {
                                const newDraft = [...pricingItemsDraft];
                                newDraft[idx] = { ...newDraft[idx], estimatedPrice: parseFloat(e.target.value) || 0 };
                                setPricingItemsDraft(newDraft);
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end pt-4 border-t">
                <div className="text-right font-semibold text-lg text-emerald-600">
                  Total Estimado: {formatCurrency(pricingItemsDraft.reduce((acc, curr) => acc + (curr.estimatedPrice || 0), 0))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" className="bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 border border-gray-200 font-semibold" onClick={() => setIsPricingModalOpen(false)}>Cancelar</Button>
              <Button type="button" className="bg-[#C9A227] hover:bg-[#b59122] text-white font-semibold" onClick={handleSavePricing}>Salvar valores</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Precificar Plano */}
        <Dialog open={isPrecificarOpen} onOpenChange={setIsPrecificarOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Precificar Plano: {selectedPlan.title}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">Revise os itens e preços do plano, aplique desconto e gere o orçamento.</p>
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 border-b">
                  <tr>
                    <th className="p-2 text-left">Procedimento</th>
                    <th className="p-2 text-left">Dente/Região</th>
                    <th className="p-2 text-right w-36">Valor Estimado (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {precificarItemsDraft.map((it, idx) => (
                    <tr key={it.id} className="border-b last:border-0 hover:bg-gray-50/50">
                      <td className="p-2">{it.description || it.procedureName || "Sem descrição"}</td>
                      <td className="p-2">{it.toothNumber ? `${it.toothNumber} ${it.toothRegion ? `(${it.toothRegion})` : ""}` : "—"}</td>
                      <td className="p-2 text-right">
                        <Input
                          type="number"
                          step="0.01"
                          className="w-28 ml-auto text-right font-medium h-8 text-xs"
                          value={it.estimatedPrice || 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const newDraft = [...precificarItemsDraft];
                            newDraft[idx] = { ...newDraft[idx], estimatedPrice: val };
                            setPrecificarItemsDraft(newDraft);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label>Desconto geral (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={precificarDiscount || ""} onChange={e => setPrecificarDiscount(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Validade do orçamento</Label>
                  <Input type="date" value={precificarValidity} onChange={e => setPrecificarValidity(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={precificarNotes} onChange={e => setPrecificarNotes(e.target.value)} rows={2} placeholder="Observações sobre o orçamento..." />
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <div>
                  <p className="text-sm text-muted-foreground">Subtotal: {formatCurrency(precificarItemsDraft.reduce((acc, curr) => acc + (curr.estimatedPrice || 0), 0))}</p>
                  {precificarDiscount > 0 && <p className="text-sm text-red-500">Desconto: -{formatCurrency(precificarDiscount)}</p>}
                  <p className="text-lg font-bold text-amber-700">Total: {formatCurrency(precificarItemsDraft.reduce((acc, curr) => acc + (curr.estimatedPrice || 0), 0) - precificarDiscount)}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" className="bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 border border-gray-200 font-semibold" onClick={() => setIsPrecificarOpen(false)}>Cancelar</Button>
                  <Button type="button" className="bg-white border border-[#C9A227] text-[#C9A227] hover:bg-[#faf9f5] hover:text-[#b59122] font-semibold" onClick={async () => {
                    try {
                      for (const item of precificarItemsDraft) {
                        await saveTreatmentPlanItem(item);
                      }
                      toast.success("Preços do plano atualizados com sucesso!");
                      window.location.reload();
                    } catch (e: any) {
                      toast.error("Erro ao salvar preços: " + e.message);
                    }
                  }}>Salvar precificação</Button>
                  <Button type="button" className="bg-[#C9A227] hover:bg-[#b59122] text-white font-semibold" onClick={async () => {
                    const notesWithValidity = precificarValidity
                      ? `${precificarNotes}\nValidade: ${new Date(precificarValidity).toLocaleDateString()}`
                      : precificarNotes;
                    await handleGenerateBudget(selectedPlan, precificarItemsDraft, precificarDiscount, notesWithValidity);
                    setIsPrecificarOpen(false);
                  }}>Gerar orçamento</Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-gold" />
            Planos de Tratamento
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Organize procedimentos por etapas, dentes e prioridades.
          </p>
        </div>
        <Button type="button" className="bg-[#C9A227] hover:bg-[#b59122] text-white font-semibold animate-all" onClick={openNewPlanModal}>
          <Plus className="h-4 w-4 mr-2" /> Novo Plano
        </Button>
      </div>

      {plans.length === 0 ? (
        <Card className="p-6 bg-secondary/10 border-dashed">
          <div className="text-center py-12">
            <Activity className="h-12 w-12 text-gold opacity-50 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Nenhum plano cadastrado</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              Comece criando o primeiro plano de tratamento para este paciente.
            </p>
            <Button type="button" variant="outline" className="bg-white border border-[#C9A227] text-[#C9A227] hover:bg-[#faf9f5] hover:text-[#b59122] font-semibold" onClick={openNewPlanModal}>Criar primeiro plano</Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {plans.map(plan => {
            const totalEstimado = plan.items?.reduce((acc, curr) => acc + (curr.estimatedPrice || 0), 0) || 0;
            return (
              <Card key={plan.id} className="p-5 hover:border-gold/50 transition-colors cursor-pointer" onClick={() => handleSelectPlanId(plan.id)}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-lg">{plan.title}</h3>
                        <Badge tone={
                          plan.status === 'concluído' ? 'ok' : 
                          plan.status === 'planejado' ? 'neutral' : 
                          plan.status === 'cancelado' ? 'warn' : 'gold'
                        } className="capitalize">
                          {plan.status}
                        </Badge>
                      </div>
                      {plan.diagnosis && (
                        <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                          Diagnóstico: {plan.diagnosis}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground mt-3">
                        <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Início: {plan.startDate ? new Date(plan.startDate).toLocaleDateString() : "--"}</span>
                        <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Fim: {plan.expectedEndDate ? new Date(plan.expectedEndDate).toLocaleDateString() : "--"}</span>
                        <span className="flex items-center gap-1.5 font-medium"><Activity className="h-3.5 w-3.5" /> {plan.items?.length || 0} itens</span>
                      </div>
                    </div>
                    <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-border ml-auto">
                      <div className="text-sm font-semibold text-emerald-600 flex items-center">
                        <DollarSign className="w-4 h-4 mr-1" />
                        {totalEstimado.toFixed(2)}
                      </div>
                      <div className="flex gap-2 ml-auto sm:ml-0">
                        <Button variant="outline" size="sm" className="bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900" onClick={(e) => { e.stopPropagation(); openEditPlanModal(plan); }}>
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="outline" size="sm" className="bg-white border border-red-500 text-red-500 hover:bg-red-50 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleDeletePlan(plan.id); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 pt-4 border-t border-border w-full" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-sm text-gray-800">Itens do plano</h4>
                      <Button 
                        type="button" 
                        className="bg-[#C9A227] hover:bg-[#b59122] text-white font-semibold h-7 px-2.5 text-xs"
                        onClick={() => {
                          handleSelectPlanId(plan.id);
                          openNewItemModal();
                        }}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Adicionar item ao plano
                      </Button>
                    </div>
                    
                    {(!plan.items || plan.items.length === 0) ? (
                      <p className="text-xs text-muted-foreground italic py-1">
                        Nenhum item adicionado a este plano ainda.
                      </p>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                        {plan.items.map(item => (
                          <div key={item.id} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-100 last:border-0">
                            <span className="font-medium text-gray-700">
                              {item.description || item.procedureName || "Sem descrição"}
                              {item.toothNumber && <span className="ml-1.5 text-gray-400">({item.toothNumber})</span>}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-emerald-600">
                                R$ {item.estimatedPrice ? item.estimatedPrice.toFixed(2) : "0.00"}
                              </span>
                              <div className="flex gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-[#C9A227]"
                                  onClick={() => {
                                    handleSelectPlanId(plan.id);
                                    openEditItemModal(item);
                                  }}
                                >
                                  <Edit3 className="w-3 h-3" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 w-6 p-0 text-rose-500 hover:text-rose-600"
                                  onClick={() => {
                                    handleSelectPlanId(plan.id);
                                    handleDeleteItem(item.id);
                                  }}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal de Plano */}
      <Dialog open={isPlanModalOpen} onOpenChange={setIsPlanModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{planDraft.id ? "Editar Plano de Tratamento" : "Novo Plano de Tratamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Título do Plano *</Label>
              <Input 
                value={planDraft.title || ""} 
                onChange={e => setPlanDraft({...planDraft, title: e.target.value})}
                placeholder="Ex: Tratamento Ortodôntico, Restaurações Gerais..."
              />
            </div>
            <div>
              <Label>Diagnóstico</Label>
              <Input 
                value={planDraft.diagnosis || ""} 
                onChange={e => setPlanDraft({...planDraft, diagnosis: e.target.value})}
                placeholder="Ex: Cáries múltiplas, Classe II..."
              />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea 
                value={planDraft.notes || ""} 
                onChange={e => setPlanDraft({...planDraft, notes: e.target.value})}
                placeholder="Anotações adicionais sobre o plano..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select 
                  value={planDraft.status || "planejado"} 
                  onChange={e => setPlanDraft({...planDraft, status: e.target.value as any})}
                >
                  <option value="planejado">Planejado</option>
                  <option value="em andamento">Em andamento</option>
                  <option value="pausado">Pausado</option>
                  <option value="concluído">Concluído</option>
                  <option value="cancelado">Cancelado</option>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Início</Label>
                <Input 
                  type="date" 
                  value={planDraft.startDate || ""} 
                  onChange={e => setPlanDraft({...planDraft, startDate: e.target.value})}
                />
              </div>
              <div>
                <Label>Previsão de Término</Label>
                <Input 
                  type="date" 
                  value={planDraft.expectedEndDate || ""} 
                  onChange={e => setPlanDraft({...planDraft, expectedEndDate: e.target.value})}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" className="bg-[#C9A227] hover:bg-[#b59122] text-white font-semibold" onClick={handleSavePlan}>Salvar Plano</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {emptyPlanActionType && (
        <Dialog open onOpenChange={(open) => !open && setEmptyPlanActionType(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Plano sem itens</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4 text-center">
              <p className="text-sm text-gray-700 font-semibold">
                {emptyPlanActionType === 'valores' && "Adicione itens ao plano antes de definir valores."}
                {emptyPlanActionType === 'precificar' && "Este plano ainda não possui itens. Adicione itens antes de precificar."}
                {emptyPlanActionType === 'orcamento' && "Este plano não possui itens. Adicione itens antes de gerar orçamento."}
              </p>
              <Button 
                type="button" 
                className="bg-[#C9A227] hover:bg-[#b59122] text-white font-semibold mx-auto"
                onClick={() => {
                  setEmptyPlanActionType(null);
                  openNewItemModal();
                }}
              >
                <Plus className="w-4 h-4 mr-2" /> Adicionar item ao plano
              </Button>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 border border-gray-200 font-semibold"
                onClick={() => setEmptyPlanActionType(null)}
              >
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function ClipboardList(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
}
