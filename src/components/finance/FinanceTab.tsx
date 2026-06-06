import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select } from "@/components/ui-bits";
import { Plus, X, AlertCircle, DollarSign, Calendar, RefreshCcw, Eye, Trash2, Edit3, Receipt, CreditCard, FileText, Check } from "lucide-react";
import { formatCurrency, formatDateBR } from "@/lib/utils";
import { toast } from "sonner";
import {
  useBudgets,
  useInstallments,
  usePayments,
  saveBudget,
  deleteBudget,
  updateBudgetStatus,
  saveInstallments,
  savePayment,
  useProcedures,
  deletePayment,
  updateInstallmentStatus,
  useTreatmentPlans
} from "@/lib/db";
import { Budget, BudgetItem, PaymentInstallment, Payment, PaymentSplit, Procedure, uid } from "@/lib/store";

type SubTab = "resumo" | "orcamentos" | "parcelas" | "pagamentos" | "acoes";

export function FinanceTab({ patientId }: { patientId: string }) {
  const [budgets, bError, bLoading, bMissing] = useBudgets(patientId);
  const [installments, iLoading] = useInstallments(patientId);
  const [payments, pLoading] = usePayments(patientId);
  const [procedures] = useProcedures();
  const [plans, plansError, plansLoading] = useTreatmentPlans(patientId);

  const [subTab, setSubTab] = useState<SubTab>("resumo");

  // Novo Orçamento options modals
  const [isBudgetOptionModalOpen, setIsBudgetOptionModalOpen] = useState(false);
  const [isPlanSelectionModalOpen, setIsPlanSelectionModalOpen] = useState(false);

  // Modals
  const [budgetModal, setBudgetModal] = useState<Budget | null>(null);
  const [generateInstModal, setGenerateInstModal] = useState<Budget | null>(null);
  const [generateInstSelectMode, setGenerateInstSelectMode] = useState(false);
  const [paymentModal, setPaymentModal] = useState<PaymentInstallment | null>(null);
  const [standalonePayModal, setStandalonePayModal] = useState(false);
  const [viewItemsModal, setViewItemsModal] = useState<Budget | null>(null);
  const [editInstModal, setEditInstModal] = useState<PaymentInstallment | null>(null);
  const [renegotiateModal, setRenegotiateModal] = useState<PaymentInstallment | null>(null);
  const [payDetailsModal, setPayDetailsModal] = useState<Payment | null>(null);

  // Stats
  const stats = useMemo(() => {
    const totalOrcado = budgets.reduce((acc, b) => acc + (b.totalAmount || 0), 0);
    const totalAprovado = budgets.filter(b => b.status === "aprovado").reduce((acc, b) => acc + (b.finalAmount || 0), 0);
    const totalPago = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
    const saldoAberto = installments.filter(i => i.status !== "cancelado" && i.status !== "pago").reduce((acc, i) => acc + (i.remainingAmount || 0), 0);
    const parcelasPendentes = installments.filter(i => i.status === "pendente").length;
    const parcelasParciais = installments.filter(i => i.status === "parcialmente pago").length;
    const parcelasVencidas = installments.filter(i => i.status !== "pago" && i.status !== "cancelado" && new Date(i.dueDate || "") < new Date()).length;
    const qtdOrcamentos = budgets.length;
    const qtdPagamentos = payments.length;
    return { totalOrcado, totalAprovado, totalPago, saldoAberto, parcelasPendentes, parcelasParciais, parcelasVencidas, qtdOrcamentos, qtdPagamentos };
  }, [budgets, payments, installments]);

  const approvedBudgets = budgets.filter(b => b.status === "aprovado");

  const openNewBudget = () => {
    setBudgetModal({ id: "temp-" + Date.now(), userId: "", patientId, totalAmount: 0, discount: 0, finalAmount: 0, status: "rascunho", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), items: [] });
  };

  const handleSelectPlanForBudget = (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    if (!plan.items || plan.items.length === 0) {
      toast.error("Este plano ainda não possui itens para gerar orçamento.");
      return;
    }
    
    const budgetId = "temp-" + Date.now();
    const bItems: BudgetItem[] = (plan.items || []).map(item => ({
      id: "temp-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      userId: plan.userId,
      budgetId: budgetId,
      procedureId: item.procedureId,
      toothNumber: item.toothNumber,
      toothRegion: item.toothRegion,
      description: item.description || item.procedureName || "Item do Plano",
      quantity: 1,
      unitPrice: item.estimatedPrice || 0,
      totalPrice: item.estimatedPrice || 0,
      createdAt: new Date().toISOString()
    }));

    const totalAmount = bItems.reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);

    setBudgetModal({
      id: budgetId,
      userId: plan.userId,
      patientId: patientId,
      treatmentPlanId: plan.id,
      title: `Orçamento: ${plan.title}`,
      totalAmount,
      discount: 0,
      finalAmount: totalAmount,
      status: "rascunho",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: bItems
    });
    
    setIsPlanSelectionModalOpen(false);
  };

  const openGenerateInstallments = (budget?: Budget) => {
    if (budget) {
      setGenerateInstSelectMode(false);
      setGenerateInstModal(budget);
    } else {
      if (approvedBudgets.length === 0) {
        toast.error("Nenhum orçamento aprovado disponível para parcelamento.");
        return;
      }
      setGenerateInstSelectMode(true);
      setGenerateInstModal(approvedBudgets[0]);
    }
  };

  if (bMissing) {
    return (
      <div className="p-8 text-center text-gray-500 flex flex-col items-center">
        <AlertCircle className="w-10 h-10 mb-4 text-orange-400" />
        <h3 className="text-lg font-medium text-gray-800">Estrutura financeira precisa ser criada no Supabase.</h3>
        <p className="mt-2 text-sm">Rode o script SQL fornecido no terminal para habilitar o módulo financeiro.</p>
      </div>
    );
  }

  if (bLoading || iLoading || pLoading) {
    return <div className="p-8 text-center text-gray-500 animate-pulse">Carregando financeiro...</div>;
  }

  const SUB_TABS: { key: SubTab; label: string }[] = [
    { key: "resumo", label: "Resumo" },
    { key: "orcamentos", label: "Orçamentos" },
    { key: "parcelas", label: "Parcelas" },
    { key: "pagamentos", label: "Pagamentos realizados" },
    { key: "acoes", label: "Ações financeiras" },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tab navigation */}
      <div className="flex overflow-x-auto no-scrollbar border-b border-border">
        {SUB_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              subTab === t.key
                ? "border-[#C9A227] text-[#C9A227]"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ==================== RESUMO ==================== */}
      {subTab === "resumo" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total Orçado" value={stats.totalOrcado} />
            <StatCard title="Total Aprovado" value={stats.totalAprovado} className="bg-green-50 text-green-900 border-green-200" />
            <StatCard title="Total Pago" value={stats.totalPago} className="bg-green-50 text-green-900 border-green-200" />
            <StatCard title="Saldo em Aberto" value={stats.saldoAberto} className="bg-orange-50 text-orange-900 border-orange-200" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <InfoCard title="Parcelas Pendentes" value={stats.parcelasPendentes} />
            <InfoCard title="Parcialmente Pagas" value={stats.parcelasParciais} className="text-orange-600" />
            <InfoCard title="Parcelas Vencidas" value={stats.parcelasVencidas} className={stats.parcelasVencidas > 0 ? "text-red-600" : ""} />
            <InfoCard title="Orçamentos" value={stats.qtdOrcamentos} />
            <InfoCard title="Pagamentos" value={stats.qtdPagamentos} />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setIsBudgetOptionModalOpen(true)} className="!bg-[#C9A227] hover:!bg-[#b59122] !text-white !border-[#C9A227] font-semibold">
              <Plus className="w-4 h-4 mr-2" /> Novo orçamento
            </Button>
            <Button variant="outline" onClick={() => setStandalonePayModal(true)} className="!bg-white !border-[#C9A227] !text-[#8A6A16] hover:!bg-[#faf9f5] hover:!text-[#b59122] font-semibold">
              <DollarSign className="w-4 h-4 mr-2" /> Registrar pagamento
            </Button>
            <Button variant="outline" onClick={() => openGenerateInstallments()} className="!bg-white !border-[#C9A227] !text-[#8A6A16] hover:!bg-[#faf9f5] hover:!text-[#b59122] font-semibold">
              <Calendar className="w-4 h-4 mr-2" /> Gerar parcelas
            </Button>
            <Button variant="outline" className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 hover:!text-gray-900 !border-gray-200 font-semibold" onClick={() => window.location.reload()}>
              <RefreshCcw className="w-4 h-4 mr-2" /> Atualizar resumo
            </Button>
          </div>
        </div>
      )}

      {/* ==================== ORÇAMENTOS ==================== */}
      {subTab === "orcamentos" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Orçamentos</h3>
            <div className="flex gap-2">
              <Button onClick={() => setIsBudgetOptionModalOpen(true)} className="!bg-[#C9A227] hover:!bg-[#b59122] !text-white !border-[#C9A227] font-semibold">
                <Plus className="w-4 h-4 mr-2" /> Novo orçamento
              </Button>
              <Button variant="outline" className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 hover:!text-gray-900 !border-gray-200 font-semibold" onClick={() => window.location.reload()}>
                <RefreshCcw className="w-4 h-4 mr-2" /> Atualizar
              </Button>
            </div>
          </div>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-3 font-medium text-gray-600">Título</th>
                  <th className="p-3 font-medium text-gray-600">Total</th>
                  <th className="p-3 font-medium text-gray-600">Desconto</th>
                  <th className="p-3 font-medium text-gray-600">Final</th>
                  <th className="p-3 font-medium text-gray-600">Status</th>
                  <th className="p-3 font-medium text-gray-600 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {budgets.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-gray-500">Nenhum orçamento encontrado.</td></tr>
                )}
                {budgets.map(b => (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-3 font-medium">{b.title || "Orçamento"}</td>
                    <td className="p-3">{formatCurrency(b.totalAmount)}</td>
                    <td className="p-3">{formatCurrency(b.discount)}</td>
                    <td className="p-3 font-semibold">{formatCurrency(b.finalAmount)}</td>
                    <td className="p-3"><StatusBadge status={b.status} /></td>
                    <td className="p-3 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button variant="outline" className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 hover:!text-gray-900 !border-gray-200 h-8 px-2 text-xs font-semibold" onClick={() => setViewItemsModal(b)}>
                          <Eye className="w-3.5 h-3.5 mr-1" /> Itens
                        </Button>
                        <Button variant="outline" className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 hover:!text-gray-900 !border-gray-200 h-8 px-2 text-xs font-semibold" onClick={() => setBudgetModal(b)}>
                          <Edit3 className="w-3.5 h-3.5 mr-1" /> Editar
                        </Button>
                        {b.status === "rascunho" && (
                          <Button variant="outline" className="!bg-white !border border-emerald-500 !text-emerald-600 hover:!bg-emerald-50 hover:!text-emerald-700 h-8 px-2 text-xs font-semibold" onClick={async () => {
                            try { await updateBudgetStatus(b.id, "aprovado"); toast.success("Orçamento aprovado!"); window.location.reload(); }
                            catch (e: any) { console.error(e); toast.error("Erro ao aprovar: " + e.message); }
                          }}>
                            <Check className="w-3.5 h-3.5 mr-1" /> Aprovar
                          </Button>
                        )}
                        {b.status === "rascunho" && (
                          <Button variant="outline" className="!bg-white !border border-red-500 !text-red-500 hover:!bg-red-50 hover:!text-red-600 h-8 px-2 text-xs font-semibold" onClick={async () => {
                            try { await updateBudgetStatus(b.id, "recusado"); toast.success("Orçamento recusado."); window.location.reload(); }
                            catch (e: any) { console.error(e); toast.error("Erro: " + e.message); }
                          }}>
                            Recusar
                          </Button>
                        )}
                        {b.status !== "cancelado" && (
                          <Button variant="outline" className="!bg-white !border border-orange-500 !text-orange-500 hover:!bg-orange-50 hover:!text-orange-600 h-8 px-2 text-xs font-semibold" onClick={async () => {
                            try { await updateBudgetStatus(b.id, "cancelado"); toast.success("Orçamento cancelado."); window.location.reload(); }
                            catch (e: any) { console.error(e); toast.error("Erro: " + e.message); }
                          }}>
                            Cancelar
                          </Button>
                        )}
                        <Button variant="outline" className="!bg-white !border border-[#C9A227] !text-[#8A6A16] hover:!bg-[#faf9f5] hover:!text-[#b59122] h-8 px-2 text-xs font-semibold" onClick={() => {
                          if (b.status === "aprovado") {
                            openGenerateInstallments(b);
                          } else {
                            toast.error("Aprove o orçamento antes de parcelar.");
                          }
                        }}>
                          <Calendar className="w-3.5 h-3.5 mr-1" /> Parcelar
                        </Button>
                        <Button variant="outline" className="!bg-white !border border-red-500 !text-red-500 hover:!bg-red-50 hover:!text-red-600 h-8 px-2 text-xs font-semibold" onClick={async () => {
                          if (confirm("Excluir este orçamento e todos os seus itens?")) {
                            try { await deleteBudget(b.id); toast.success("Orçamento excluído."); window.location.reload(); }
                            catch (e: any) { console.error(e); toast.error("Erro: " + e.message); }
                          }
                        }}>
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== PARCELAS ==================== */}
      {subTab === "parcelas" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Parcelas</h3>
            <div className="flex gap-2">
              <Button variant="outline" className="!bg-white !border border-[#C9A227] !text-[#8A6A16] hover:!bg-[#faf9f5] hover:!text-[#b59122] font-semibold" onClick={() => openGenerateInstallments()}>
                <Calendar className="w-4 h-4 mr-2" /> Gerar parcelas
              </Button>
              <Button variant="outline" className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 hover:!text-gray-900 !border-gray-200 font-semibold" onClick={() => window.location.reload()}>
                <RefreshCcw className="w-4 h-4 mr-2" /> Atualizar
              </Button>
            </div>
          </div>
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-3 font-medium text-gray-600">Nº</th>
                    <th className="p-3 font-medium text-gray-600">Orçamento</th>
                    <th className="p-3 font-medium text-gray-600">Valor</th>
                    <th className="p-3 font-medium text-gray-600">Pago</th>
                    <th className="p-3 font-medium text-gray-600">Restante</th>
                    <th className="p-3 font-medium text-gray-600">Vencimento</th>
                    <th className="p-3 font-medium text-gray-600">Status</th>
                    <th className="p-3 font-medium text-gray-600 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {installments.length === 0 && (
                    <tr><td colSpan={8} className="p-6 text-center text-gray-500">Nenhuma parcela gerada.</td></tr>
                  )}
                  {installments.map(inst => {
                    const isOverdue = inst.status !== "pago" && inst.status !== "cancelado" && new Date(inst.dueDate || "") < new Date();
                    const budgetTitle = budgets.find(b => b.id === inst.budgetId)?.title || "—";
                    const canAct = inst.status !== "pago" && inst.status !== "cancelado";
                    return (
                      <tr key={inst.id} className={`border-b last:border-0 hover:bg-gray-50 ${isOverdue ? "bg-red-50/50" : ""}`}>
                        <td className="p-3 font-medium">{inst.installmentNumber}</td>
                        <td className="p-3 text-xs text-gray-600">{budgetTitle}</td>
                        <td className="p-3">{formatCurrency(inst.amount)}</td>
                        <td className="p-3 text-green-600">{formatCurrency(inst.paidAmount)}</td>
                        <td className="p-3 font-medium">{formatCurrency(inst.remainingAmount)}</td>
                        <td className={`p-3 ${isOverdue ? "text-red-600 font-semibold" : ""}`}>
                          {inst.dueDate ? formatDateBR(inst.dueDate) : "-"}
                        </td>
                        <td className="p-3"><StatusBadge status={isOverdue ? "atrasado" : inst.status} /></td>
                        <td className="p-3 text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {canAct && (
                              <Button size="sm" className="!bg-[#C9A227] hover:!bg-[#b59122] !text-white !border-[#C9A227] font-semibold h-8 px-2 text-xs" onClick={() => setPaymentModal(inst)}>
                                Pagar
                              </Button>
                            )}
                            {canAct && (
                              <Button variant="outline" className="!bg-white !border border-emerald-500 !text-emerald-600 hover:!bg-emerald-50 hover:!text-emerald-700 h-8 px-2 text-xs font-semibold" onClick={async () => {
                                try {
                                  await updateInstallmentStatus(inst.id, { status: "pago", paidAmount: inst.amount, remainingAmount: 0 });
                                  toast.success("Parcela marcada como paga!");
                                  window.location.reload();
                                } catch (e: any) { console.error(e); toast.error("Erro: " + e.message); }
                              }}>
                                Marcar Paga
                              </Button>
                            )}
                            <Button variant="outline" className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 hover:!text-gray-900 !border-gray-200 h-8 px-2 text-xs font-semibold" onClick={() => setEditInstModal(inst)}>
                              Editar
                            </Button>
                            {canAct && (
                              <Button variant="outline" className="!bg-white !border border-[#C9A227] !text-[#8A6A16] hover:!bg-[#faf9f5] hover:!text-[#b59122] h-8 px-2 text-xs font-semibold" onClick={() => setRenegotiateModal(inst)}>
                                Renegociar
                              </Button>
                            )}
                            {canAct && (
                              <Button variant="outline" className="!bg-white !border border-red-500 !text-red-500 hover:!bg-red-50 hover:!text-red-600 h-8 px-2 text-xs font-semibold" onClick={async () => {
                                if (confirm("Cancelar esta parcela?")) {
                                  try {
                                    await updateInstallmentStatus(inst.id, { status: "cancelado" });
                                    toast.success("Parcela cancelada.");
                                    window.location.reload();
                                  } catch (e: any) { console.error(e); toast.error("Erro: " + e.message); }
                                }
                              }}>
                                Cancelar
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PAGAMENTOS ==================== */}
      {subTab === "pagamentos" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Pagamentos Realizados</h3>
            <div className="flex gap-2">
              <Button onClick={() => setStandalonePayModal(true)} className="!bg-[#C9A227] hover:!bg-[#b59122] !text-white !border-[#C9A227] font-semibold">
                <Plus className="w-4 h-4 mr-2" /> Novo pagamento
              </Button>
              <Button variant="outline" className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 hover:!text-gray-900 !border-gray-200 font-semibold" onClick={() => window.location.reload()}>
                <RefreshCcw className="w-4 h-4 mr-2" /> Atualizar
              </Button>
            </div>
          </div>
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-3 font-medium text-gray-600">Data</th>
                    <th className="p-3 font-medium text-gray-600">Método</th>
                    <th className="p-3 font-medium text-gray-600">Valor Bruto</th>
                    <th className="p-3 font-medium text-gray-600">Taxa</th>
                    <th className="p-3 font-medium text-gray-600">Valor Líquido</th>
                    <th className="p-3 font-medium text-gray-600">Obs</th>
                    <th className="p-3 font-medium text-gray-600 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-gray-500">Nenhum pagamento registrado.</td></tr>
                  )}
                  {payments.map(p => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="p-3">{p.paymentDate ? formatDateBR(p.paymentDate) : "-"}</td>
                      <td className="p-3 uppercase text-xs font-semibold">{p.paymentMethod || "—"}</td>
                      <td className="p-3 font-medium">{formatCurrency(p.amount)}</td>
                      <td className="p-3 text-red-500">{formatCurrency(p.cardFee)}</td>
                      <td className="p-3 text-green-600 font-medium">{formatCurrency(p.netAmount)}</td>
                      <td className="p-3 text-xs text-gray-500 max-w-[150px] truncate">{p.notes || "-"}</td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="outline" className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 hover:!text-gray-900 !border-gray-200 h-8 px-2 text-xs font-semibold" onClick={() => setPayDetailsModal(p)}>
                            <Eye className="w-3.5 h-3.5 mr-1" /> Ver detalhes
                          </Button>
                          <Button variant="outline" className="!bg-white !border border-red-500 !text-red-500 hover:!bg-red-50 hover:!text-red-600 h-8 px-2 text-xs font-semibold" onClick={async () => {
                            if (confirm("Excluir este pagamento? A parcela vinculada será recalculada.")) {
                              try { await deletePayment(p); toast.success("Pagamento excluído."); window.location.reload(); }
                              catch (e: any) { console.error(e); toast.error("Erro: " + e.message); }
                            }
                          }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== AÇÕES FINANCEIRAS ==================== */}
      {subTab === "acoes" && (
        <div className="animate-in fade-in duration-200">
          <h3 className="text-lg font-semibold mb-4">Ações Financeiras</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <ActionCard
              icon={<Plus className="w-6 h-6 text-[#C9A227]" />}
              title="Novo orçamento manual"
              description="Crie um orçamento manual com itens, quantidades e valores."
              buttonLabel="Criar manual"
              onClick={openNewBudget}
            />
            <ActionCard
              icon={<Plus className="w-6 h-6 text-[#C9A227]" />}
              title="Novo orçamento de Plano de Tratamento"
              description="Use um plano de tratamento existente do paciente para gerar o orçamento."
              buttonLabel="Criar a partir de Plano"
              onClick={() => setIsPlanSelectionModalOpen(true)}
            />
            <ActionCard
              icon={<Calendar className="w-6 h-6 text-[#C9A227]" />}
              title="Gerar parcelas"
              description={approvedBudgets.length > 0
                ? `${approvedBudgets.length} orçamento(s) aprovado(s) disponível(is) para parcelamento.`
                : "Nenhum orçamento aprovado disponível para parcelamento."}
              buttonLabel="Gerar parcelas"
              onClick={() => openGenerateInstallments()}
              disabled={approvedBudgets.length === 0}
            />
            <ActionCard
              icon={<DollarSign className="w-6 h-6 text-[#C9A227]" />}
              title="Registrar pagamento avulso"
              description="Registre um pagamento avulso ou de parcela existente."
              buttonLabel="Registrar pagamento"
              onClick={() => setStandalonePayModal(true)}
            />
            <ActionCard
              icon={<RefreshCcw className="w-6 h-6 text-[#C9A227]" />}
              title="Atualizar resumo"
              description="Recarregue todos os dados financeiros do paciente."
              buttonLabel="Atualizar"
              onClick={() => window.location.reload()}
            />
          </div>
        </div>
      )}

      {/* ==================== MODALS ==================== */}

      {/* Budget Modal */}
      {budgetModal && (
        <BudgetModal
          budget={budgetModal}
          procedures={procedures}
          onClose={() => setBudgetModal(null)}
          onSave={async (b, items) => {
            try {
              await saveBudget(b, items);
              toast.success("Orçamento salvo com sucesso!");
              setBudgetModal(null);
              window.location.reload();
            } catch (e: any) {
              console.error("saveBudget error:", e);
              toast.error("Erro ao salvar orçamento: " + e.message);
            }
          }}
        />
      )}

      {/* Generate Installments Modal */}
      {generateInstModal && (
        <GenerateInstallmentsModal
          budget={generateInstModal}
          approvedBudgets={approvedBudgets}
          selectMode={generateInstSelectMode}
          onBudgetChange={(b) => setGenerateInstModal(b)}
          onClose={() => setGenerateInstModal(null)}
          onSave={async (insts) => {
            try {
              await saveInstallments(insts);
              toast.success("Parcelas geradas com sucesso!");
              setGenerateInstModal(null);
              window.location.reload();
            } catch (e: any) {
              console.error("saveInstallments error:", e);
              toast.error("Erro ao gerar parcelas: " + e.message);
            }
          }}
        />
      )}

      {/* Payment Modal (from installment) */}
      {paymentModal && (
        <PaymentModal
          installment={paymentModal}
          onClose={() => setPaymentModal(null)}
          onSave={async (payment, splits, instUpdate) => {
            try {
              await savePayment(payment, splits, instUpdate);
              toast.success("Pagamento registrado com sucesso!");
              setPaymentModal(null);
              window.location.reload();
            } catch (e: any) {
              console.error("savePayment error:", e);
              toast.error("Erro ao registrar pagamento: " + e.message);
            }
          }}
        />
      )}

      {/* Standalone Payment Modal */}
      {standalonePayModal && (
        <StandalonePaymentModal
          budgets={budgets}
          installments={installments}
          onClose={() => setStandalonePayModal(false)}
          onSave={async (payment, splits, instUpdate) => {
            try {
              await savePayment(payment, splits, instUpdate);
              toast.success("Pagamento registrado com sucesso!");
              setStandalonePayModal(false);
              window.location.reload();
            } catch (e: any) {
              console.error("savePayment error:", e);
              toast.error("Erro ao registrar pagamento: " + e.message);
            }
          }}
          patientId={patientId}
        />
      )}

      {/* View Items Modal */}
      {viewItemsModal && (
        <ViewItemsModal budget={viewItemsModal} onClose={() => setViewItemsModal(null)} />
      )}

      {/* Edit Installment Modal */}
      {editInstModal && (
        <EditInstallmentModal
          installment={editInstModal}
          onClose={() => setEditInstModal(null)}
          onSave={async (id, updates) => {
            try {
              await updateInstallmentStatus(id, updates);
              toast.success("Parcela atualizada!");
              setEditInstModal(null);
              window.location.reload();
            } catch (e: any) {
              console.error("updateInstallment error:", e);
              toast.error("Erro ao atualizar parcela: " + e.message);
            }
          }}
        />
      )}

      {/* Renegotiate Modal */}
      {renegotiateModal && (
        <RenegotiateModal
          installment={renegotiateModal}
          onClose={() => setRenegotiateModal(null)}
          onSave={async (id, updates) => {
            try {
              await updateInstallmentStatus(id, { ...updates, status: "renegociado" });
              toast.success("Parcela renegociada com sucesso!");
              setRenegotiateModal(null);
              window.location.reload();
            } catch (e: any) {
              console.error("renegotiate error:", e);
              toast.error("Erro ao renegociar parcela: " + e.message);
            }
          }}
        />
      )}

      {/* Payment Details Modal */}
      {payDetailsModal && (
        <PaymentDetailsModal payment={payDetailsModal} onClose={() => setPayDetailsModal(null)} />
      )}

      {/* Option Modal for New Budget */}
      {isBudgetOptionModalOpen && (
        <Dialog open onOpenChange={(open) => !open && setIsBudgetOptionModalOpen(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Novo Orçamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 text-center">
              <p className="text-sm text-gray-500">Escolha como deseja iniciar este orçamento:</p>
              <div className="flex flex-col gap-3">
                <Button 
                  className="!bg-[#C9A227] hover:!bg-[#b59122] !text-white !border-[#C9A227] font-semibold py-3" 
                  onClick={() => {
                    openNewBudget();
                    setIsBudgetOptionModalOpen(false);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" /> Criar orçamento manual
                </Button>
                <Button 
                  variant="outline" 
                  className="!bg-white !border border-[#C9A227] !text-[#8A6A16] hover:!bg-[#faf9f5] hover:!text-[#b59122] py-3"
                  onClick={() => {
                    setIsPlanSelectionModalOpen(true);
                    setIsBudgetOptionModalOpen(false);
                  }}
                >
                  <FileText className="w-4 h-4 mr-2" /> Criar a partir de Plano de Tratamento
                </Button>
              </div>
            </div>
            <div className="flex justify-end mt-2">
              <Button 
                variant="outline" 
                className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 hover:!text-gray-900 !border-gray-200 font-semibold"
                onClick={() => setIsBudgetOptionModalOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Plan Selection Modal */}
      {isPlanSelectionModalOpen && (
        <Dialog open onOpenChange={(open) => !open && setIsPlanSelectionModalOpen(false)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Selecionar Plano de Tratamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {plansLoading ? (
                <div className="text-center py-6 text-gray-500 animate-pulse">Carregando planos de tratamento...</div>
              ) : plans.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  Nenhum plano de tratamento cadastrado para este paciente.
                </div>
              ) : (
                <div className="divide-y divide-border border rounded-xl overflow-hidden bg-white max-h-[40vh] overflow-y-auto">
                  {plans.map(plan => {
                    const totalPlan = plan.items?.reduce((acc, curr) => acc + (curr.estimatedPrice || 0), 0) || 0;
                    const hasItems = plan.items && plan.items.length > 0;
                    return (
                      <div key={plan.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50 transition-colors">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-800">{plan.title}</h4>
                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-medium capitalize">
                              {plan.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">
                              {plan.items?.length || 0} procedimento(s)
                            </span>
                            <span className="text-xs font-semibold text-emerald-600">
                              {formatCurrency(totalPlan)}
                            </span>
                          </div>
                        </div>
                        {hasItems ? (
                          <Button 
                            className="!bg-[#C9A227] hover:!bg-[#b59122] !text-white !border-[#C9A227] font-semibold h-8 px-3 text-xs"
                            onClick={() => handleSelectPlanForBudget(plan.id)}
                          >
                            Selecionar plano
                          </Button>
                        ) : (
                          <div className="flex flex-col items-end gap-1.5">
                            <span className="text-[11px] text-red-500 font-semibold max-w-[220px] text-right">
                              ⚠️ Este plano não possui itens. Adicione itens antes de gerar orçamento.
                            </span>
                            <Button 
                              variant="outline" 
                              className="!bg-white !border border-[#C9A227] !text-[#8A6A16] hover:!bg-[#faf9f5] hover:!text-[#b59122] h-7 px-2.5 text-[10px] font-bold"
                              onClick={() => {
                                setIsPlanSelectionModalOpen(false);
                                if (typeof window !== "undefined") {
                                  const params = new URLSearchParams(window.location.search);
                                  params.set("tab", "plano-tratamento");
                                  params.set("planId", plan.id);
                                  window.history.replaceState(null, "", "?" + params.toString());
                                  window.location.reload();
                                }
                              }}
                            >
                              Adicionar itens
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 hover:!text-gray-900 !border-gray-200 font-semibold"
                onClick={() => setIsPlanSelectionModalOpen(false)}
              >
                Voltar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function StatCard({ title, value, className = "" }: { title: string; value: number; className?: string }) {
  return (
    <div className={`bg-white border rounded-xl p-4 flex flex-col justify-center ${className}`}>
      <p className="text-xs text-gray-500 font-semibold uppercase mb-1">{title}</p>
      <p className="text-xl font-bold">{formatCurrency(value)}</p>
    </div>
  );
}

function InfoCard({ title, value, className = "" }: { title: string; value: number; className?: string }) {
  return (
    <div className="bg-white border rounded-xl p-4 flex flex-col justify-center">
      <p className="text-xs text-gray-500 font-semibold uppercase mb-1">{title}</p>
      <p className={`text-xl font-bold ${className}`}>{value}</p>
    </div>
  );
}

function ActionCard({ icon, title, description, buttonLabel, onClick, disabled }: {
  icon: React.ReactNode; title: string; description: string; buttonLabel: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <div className="bg-white border rounded-xl p-6 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {icon}
        <h4 className="font-semibold">{title}</h4>
      </div>
      <p className="text-sm text-gray-500">{description}</p>
      <Button
        variant="outline"
        className={`mt-auto self-start !bg-white !border border-[#C9A227] !text-[#8A6A16] hover:!bg-[#faf9f5] hover:!text-[#b59122] font-semibold ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        onClick={onClick}
        disabled={disabled}
      >
        {buttonLabel}
      </Button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  let color = "bg-gray-100 text-gray-800";
  if (status === "aprovado" || status === "pago") color = "bg-green-100 text-green-800";
  if (status === "pendente" || status === "rascunho" || status === "enviado") color = "bg-blue-100 text-blue-800";
  if (status === "atrasado" || status === "recusado" || status === "vencido" || status === "cancelado") color = "bg-red-100 text-red-800";
  if (status === "parcialmente pago") color = "bg-orange-100 text-orange-800";
  if (status === "renegociado") color = "bg-purple-100 text-purple-800";
  return <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${color}`}>{status}</span>;
}

// =============================================================================
// Modals
// =============================================================================

function BudgetModal({ budget, procedures, onClose, onSave }: {
  budget: Budget; procedures: Procedure[]; onClose: () => void; onSave: (b: Budget, items: BudgetItem[]) => Promise<void>;
}) {
  const [title, setTitle] = useState(budget.title || "");
  const [discount, setDiscount] = useState(budget.discount || 0);
  const [validUntil, setValidUntil] = useState(budget.validUntil || "");
  const [notes, setNotes] = useState(budget.notes || "");
  const [items, setItems] = useState<BudgetItem[]>(budget.items || []);
  const [saving, setSaving] = useState(false);

  const totalAmount = items.reduce((acc, i) => acc + (i.totalPrice || 0), 0);
  const finalAmount = totalAmount - discount;

  const addItem = () => {
    setItems([...items, {
      id: "temp-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      userId: budget.userId,
      budgetId: budget.id,
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      createdAt: new Date().toISOString()
    }]);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{budget.id.startsWith("temp-") ? "Novo Orçamento" : "Editar Orçamento"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-gray-500">Título / Plano</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Tratamento Completo" />
          </div>
          <div>
            <label className="text-sm text-gray-500">Desconto Geral (R$)</label>
            <Input type="number" value={discount} onChange={e => setDiscount(+e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-gray-500">Validade do Orçamento</label>
            <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-sm text-gray-500">Observações</label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Validade, condições..." />
        </div>
        <div className="mt-4 border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-2 font-medium text-left">Procedimento / Descrição</th>
                <th className="p-2 font-medium w-16">Qtd</th>
                <th className="p-2 font-medium w-32">V. Unitário</th>
                <th className="p-2 font-medium w-32">V. Total</th>
                <th className="p-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={it.id} className="border-b last:border-0">
                  <td className="p-2">
                    <div className="flex flex-col gap-1">
                      <Select
                        value={it.procedureId || "custom"}
                        onChange={e => {
                          const v = e.target.value;
                          if (v === "custom") {
                            const newItems = [...items];
                            newItems[idx] = { ...newItems[idx], procedureId: undefined };
                            setItems(newItems);
                            return;
                          }
                          const proc = procedures.find(p => p.id === v);
                          if (proc) {
                            const newItems = [...items];
                            newItems[idx] = { ...newItems[idx], procedureId: proc.id, description: proc.name, unitPrice: proc.suggestedPricePix || 0, totalPrice: newItems[idx].quantity * (proc.suggestedPricePix || 0) };
                            setItems(newItems);
                          }
                        }}
                        className="h-8 py-0 !text-gray-900"
                      >
                        <option value="custom">Outro (Manual)</option>
                        {procedures.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </Select>
                      <Input className="h-8" placeholder="Descrição (dente, região...)" value={it.description || ""} onChange={e => {
                        const newItems = [...items]; newItems[idx] = { ...newItems[idx], description: e.target.value }; setItems(newItems);
                      }} />
                    </div>
                  </td>
                  <td className="p-2">
                    <Input type="number" className="h-8" value={it.quantity} onChange={e => {
                      const newItems = [...items]; const q = +e.target.value;
                      newItems[idx] = { ...newItems[idx], quantity: q, totalPrice: q * newItems[idx].unitPrice }; setItems(newItems);
                    }} />
                  </td>
                  <td className="p-2">
                    <Input 
                      type="number" 
                      className={`h-8 ${(!it.unitPrice || it.unitPrice === 0) ? "border-red-500 focus-visible:ring-red-500" : ""}`} 
                      value={it.unitPrice} 
                      onChange={e => {
                        const newItems = [...items]; const u = +e.target.value;
                        newItems[idx] = { ...newItems[idx], unitPrice: u, totalPrice: newItems[idx].quantity * u }; setItems(newItems);
                      }} 
                    />
                    {(!it.unitPrice || it.unitPrice === 0) && (
                      <span className="text-[10px] text-red-500 font-bold block mt-1">⚠️ Precisa de preço</span>
                    )}
                  </td>
                  <td className="p-2 bg-gray-50 font-medium">{formatCurrency(it.totalPrice)}</td>
                  <td className="p-2 text-center">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 !text-red-500 hover:!text-red-600 hover:!bg-red-50" onClick={() => setItems(items.filter(x => x.id !== it.id))}><X className="w-4 h-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-2 bg-gray-50 border-t">
            <Button type="button" variant="outline" size="sm" className="!bg-white !border border-[#C9A227] !text-[#8A6A16] hover:!bg-[#faf9f5] hover:!text-[#b59122] font-semibold" onClick={addItem}><Plus className="w-4 h-4 mr-1" /> Adicionar Item</Button>
          </div>
        </div>
        <div className="flex justify-end gap-4 text-right pt-4 border-t">
          <div>
            <p className="text-sm text-gray-500">Subtotal: {formatCurrency(totalAmount)}</p>
            <p className="text-sm text-red-500">Desconto: -{formatCurrency(discount)}</p>
            <p className="text-lg font-bold text-amber-700">Total: {formatCurrency(finalAmount)}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="outline" className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 hover:!text-gray-900 !border-gray-200 font-semibold" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={async () => {
            setSaving(true);
            await onSave({ ...budget, title, discount, totalAmount, finalAmount, notes, validUntil }, items);
            setSaving(false);
          }} disabled={saving} className="!bg-[#C9A227] hover:!bg-[#b59122] !text-white !border-[#C9A227] font-semibold">{saving ? "Salvando..." : "Salvar Orçamento"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GenerateInstallmentsModal({ budget, approvedBudgets, selectMode, onBudgetChange, onClose, onSave }: {
  budget: Budget; approvedBudgets: Budget[]; selectMode: boolean;
  onBudgetChange: (b: Budget) => void; onClose: () => void; onSave: (insts: Partial<PaymentInstallment>[]) => Promise<void>;
}) {
  const [qty, setQty] = useState(1);
  const [firstDate, setFirstDate] = useState(new Date().toISOString().split("T")[0]);
  const [interval, setIntervalDays] = useState(30);
  const [notes, setNotes] = useState("");

  const handleGenerate = () => {
    const insts: Partial<PaymentInstallment>[] = [];
    const amountPerInst = budget.finalAmount / qty;
    let currentDate = new Date(firstDate);
    for (let i = 1; i <= qty; i++) {
      insts.push({
        patientId: budget.patientId,
        budgetId: budget.id,
        installmentNumber: i,
        amount: amountPerInst,
        paidAmount: 0,
        remainingAmount: amountPerInst,
        dueDate: currentDate.toISOString().split("T")[0],
        status: "pendente",
        notes
      });
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + interval);
    }
    onSave(insts);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Gerar Parcelas</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          {selectMode && approvedBudgets.length > 1 && (
            <div>
              <label className="text-sm font-medium">Orçamento</label>
              <Select
                value={budget.id}
                onChange={e => {
                  const found = approvedBudgets.find(b => b.id === e.target.value);
                  if (found) onBudgetChange(found);
                }}
                className="!text-gray-900"
              >
                {approvedBudgets.map(b => <option key={b.id} value={b.id}>{b.title || "Orçamento"} — {formatCurrency(b.finalAmount)}</option>)}
              </Select>
            </div>
          )}
          <p className="text-sm text-gray-600">Orçamento: <strong>{budget.title || "Orçamento"}</strong> — Valor: <strong>{formatCurrency(budget.finalAmount)}</strong></p>
          <div>
            <label className="text-sm">Quantidade de Parcelas</label>
            <Input type="number" min={1} value={qty} onChange={e => setQty(+e.target.value)} />
          </div>
          <div>
            <label className="text-sm">Vencimento da 1ª Parcela</label>
            <Input type="date" value={firstDate} onChange={e => setFirstDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">Intervalo (dias)</label>
            <Input type="number" min={1} value={interval} onChange={e => setIntervalDays(+e.target.value)} />
          </div>
          <div>
            <label className="text-sm">Observações</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" />
          </div>
          {qty > 0 && (
            <p className="text-sm text-gray-500">Valor por parcela: <strong>{formatCurrency(budget.finalAmount / qty)}</strong></p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 hover:!text-gray-900 !border-gray-200 font-semibold" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={handleGenerate} className="!bg-[#C9A227] hover:!bg-[#b59122] !text-white !border-[#C9A227] font-semibold">Gerar Parcelas</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PaymentModal({ installment, onClose, onSave }: {
  installment: PaymentInstallment; onClose: () => void;
  onSave: (p: Partial<Payment>, splits: Partial<PaymentSplit>[], inst: Partial<PaymentInstallment>) => Promise<void>;
}) {
  const [payAmount, setPayAmount] = useState(installment.remainingAmount);
  const [payMethod, setPayMethod] = useState("Pix");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (payAmount <= 0 || payAmount > (installment.remainingAmount + 0.01)) {
      toast.error("Valor inválido. Máximo: " + formatCurrency(installment.remainingAmount));
      return;
    }
    setSaving(true);
    const newPaidAmount = (installment.paidAmount || 0) + payAmount;
    const newRemainingAmount = installment.amount - newPaidAmount;
    const newStatus = newRemainingAmount <= 0.01 ? "pago" : "parcialmente pago";

    const instUpdate: Partial<PaymentInstallment> = { id: installment.id, paidAmount: newPaidAmount, remainingAmount: newRemainingAmount, status: newStatus };
    const payment: Partial<Payment> = {
      patientId: installment.patientId, budgetId: installment.budgetId, installmentId: installment.id,
      amount: payAmount, paymentMethod: payMethod, paymentDate: payDate, cardFee: 0, netAmount: payAmount, notes
    };
    const finalSplits: Partial<PaymentSplit>[] = [{ paymentMethod: payMethod, amount: payAmount }];
    await onSave(payment, finalSplits, instUpdate);
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-amber-50 p-3 rounded-lg text-amber-900 text-sm border border-amber-200">
            Parcela {installment.installmentNumber} • Saldo Devedor: <strong>{formatCurrency(installment.remainingAmount)}</strong>
          </div>
          <div>
            <label className="text-sm font-medium">Valor a Pagar (R$)</label>
            <Input type="number" step="0.01" max={installment.remainingAmount} value={payAmount} onChange={e => setPayAmount(+e.target.value)} />
            <p className="text-xs text-gray-500 mt-1">Pode ser menor para pagamento parcial.</p>
          </div>
          <div>
            <label className="text-sm font-medium">Data do Pagamento</label>
            <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Forma de Pagamento</label>
            <Select
              value={payMethod}
              onChange={e => setPayMethod(e.target.value)}
              className="!text-gray-900"
            >
              <option value="Dinheiro">Dinheiro</option>
              <option value="Pix">Pix</option>
              <option value="Cartão de Crédito">Cartão de Crédito</option>
              <option value="Cartão de Débito">Cartão de Débito</option>
              <option value="Transferência">Transferência</option>
              <option value="Boleto">Boleto manual</option>
              <option value="Outro">Outro</option>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Observações</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 hover:!text-gray-900 !border-gray-200 font-semibold" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={handleSave} disabled={saving} className="!bg-[#C9A227] hover:!bg-[#b59122] !text-white !border-[#C9A227] font-semibold">{saving ? "Salvando..." : "Confirmar Pagamento"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StandalonePaymentModal({ budgets, installments, onClose, onSave, patientId }: {
  budgets: Budget[]; installments: PaymentInstallment[]; onClose: () => void;
  onSave: (p: Partial<Payment>, splits: Partial<PaymentSplit>[], inst?: Partial<PaymentInstallment>) => Promise<void>;
  patientId: string;
}) {
  const [selectedBudgetId, setSelectedBudgetId] = useState("");
  const [selectedInstId, setSelectedInstId] = useState("");
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("Pix");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredInstallments = selectedBudgetId
    ? installments.filter(i => i.budgetId === selectedBudgetId && i.status !== "pago" && i.status !== "cancelado")
    : installments.filter(i => i.status !== "pago" && i.status !== "cancelado");

  const selectedInst = installments.find(i => i.id === selectedInstId);

  const handleSave = async () => {
    if (payAmount <= 0) { toast.error("Informe um valor válido."); return; }
    setSaving(true);

    const payment: Partial<Payment> = {
      patientId,
      budgetId: selectedBudgetId || undefined,
      installmentId: selectedInstId || undefined,
      amount: payAmount,
      paymentMethod: payMethod,
      paymentDate: payDate,
      cardFee: 0,
      netAmount: payAmount,
      notes
    };

    const splits: Partial<PaymentSplit>[] = [{ paymentMethod: payMethod, amount: payAmount }];

    let instUpdate: Partial<PaymentInstallment> | undefined;
    if (selectedInst) {
      const newPaid = (selectedInst.paidAmount || 0) + payAmount;
      const newRem = selectedInst.amount - newPaid;
      instUpdate = {
        id: selectedInst.id,
        paidAmount: newPaid,
        remainingAmount: newRem,
        status: newRem <= 0.01 ? "pago" : "parcialmente pago"
      };
    }

    await onSave(payment, splits, instUpdate);
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium">Orçamento (opcional)</label>
            <Select
              value={selectedBudgetId || "none"}
              onChange={e => {
                const v = e.target.value;
                setSelectedBudgetId(v === "none" ? "" : v);
                setSelectedInstId("");
              }}
              className="!text-gray-900"
            >
              <option value="none">Nenhum (pagamento avulso)</option>
              {budgets.map(b => <option key={b.id} value={b.id}>{b.title || "Orçamento"} — {formatCurrency(b.finalAmount)}</option>)}
            </Select>
          </div>
          {filteredInstallments.length > 0 && (
            <div>
              <label className="text-sm font-medium">Parcela (opcional)</label>
              <Select
                value={selectedInstId || "none"}
                onChange={e => {
                  const v = e.target.value;
                  setSelectedInstId(v === "none" ? "" : v);
                  if (v !== "none") {
                    const inst = installments.find(i => i.id === v);
                    if (inst) setPayAmount(inst.remainingAmount);
                  }
                }}
                className="!text-gray-900"
              >
                <option value="none">Nenhuma</option>
                {filteredInstallments.map(i => (
                  <option key={i.id} value={i.id}>
                    Parcela {i.installmentNumber} — Saldo: {formatCurrency(i.remainingAmount)}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div>
            <label className="text-sm font-medium">Valor a Pagar (R$)</label>
            <Input type="number" step="0.01" value={payAmount || ""} onChange={e => setPayAmount(+e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Data do Pagamento</label>
            <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Forma de Pagamento</label>
            <Select
              value={payMethod}
              onChange={e => setPayMethod(e.target.value)}
              className="!text-gray-900"
            >
              <option value="Dinheiro">Dinheiro</option>
              <option value="Pix">Pix</option>
              <option value="Cartão de Crédito">Cartão de Crédito</option>
              <option value="Cartão de Débito">Cartão de Débito</option>
              <option value="Transferência">Transferência</option>
              <option value="Boleto">Boleto manual</option>
              <option value="Outro">Outro</option>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Observações</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 hover:!text-gray-900 !border-gray-200 font-semibold" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={handleSave} disabled={saving} className="!bg-[#C9A227] hover:!bg-[#b59122] !text-white !border-[#C9A227] font-semibold">{saving ? "Salvando..." : "Confirmar Pagamento"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ViewItemsModal({ budget, onClose }: { budget: Budget; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Itens do Orçamento: {budget.title}</DialogTitle></DialogHeader>
        <div className="mt-4 border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-2 font-medium text-left">Descrição</th>
                <th className="p-2 font-medium text-center">Qtd</th>
                <th className="p-2 font-medium text-right">V. Unitário</th>
                <th className="p-2 font-medium text-right">V. Total</th>
              </tr>
            </thead>
            <tbody>
              {budget.items?.map(it => (
                <tr key={it.id} className="border-b last:border-0">
                  <td className="p-2">{it.description || "—"}</td>
                  <td className="p-2 text-center">{it.quantity}</td>
                  <td className="p-2 text-right">{formatCurrency(it.unitPrice)}</td>
                  <td className="p-2 text-right font-medium">{formatCurrency(it.totalPrice)}</td>
                </tr>
              ))}
              {(!budget.items || budget.items.length === 0) && (
                <tr><td colSpan={4} className="p-4 text-center text-gray-500">Nenhum item.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between items-center pt-4 border-t mt-4">
          <div>
            <p className="text-sm text-gray-500">Total: <strong className="text-amber-700">{formatCurrency(budget.totalAmount)}</strong></p>
            {budget.discount > 0 && <p className="text-sm text-red-500">Desconto: -{formatCurrency(budget.discount)}</p>}
            <p className="text-lg font-bold text-amber-700">Final: {formatCurrency(budget.finalAmount)}</p>
          </div>
          <Button type="button" variant="outline" className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 hover:!text-gray-900 !border-gray-200 font-semibold" onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditInstallmentModal({ installment, onClose, onSave }: {
  installment: PaymentInstallment; onClose: () => void; onSave: (id: string, updates: Partial<PaymentInstallment>) => Promise<void>;
}) {
  const [amount, setAmount] = useState(installment.amount);
  const [dueDate, setDueDate] = useState(installment.dueDate || "");
  const [notes, setNotes] = useState(installment.notes || "");
  const [status, setStatus] = useState(installment.status || "pendente");
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar Parcela {installment.installmentNumber}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium">Data de Vencimento</label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Valor Total da Parcela</label>
            <Input type="number" step="0.01" value={amount} onChange={e => setAmount(+e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Observações</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" />
          </div>
          <div>
            <label className="text-sm font-medium">Status</label>
            <Select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="!text-gray-900"
            >
              <option value="pendente">Pendente</option>
              <option value="parcialmente pago">Parcialmente Pago</option>
              <option value="pago">Pago</option>
              <option value="renegociado">Renegociado</option>
              <option value="cancelado">Cancelado</option>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 hover:!text-gray-900 !border-gray-200 font-semibold" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={async () => {
            setSaving(true);
            await onSave(installment.id, { amount, dueDate, remainingAmount: amount - (installment.paidAmount || 0), notes, status });
            setSaving(false);
          }} disabled={saving} className="!bg-[#C9A227] hover:!bg-[#b59122] text-white font-semibold">Salvar Alterações</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RenegotiateModal({ installment, onClose, onSave }: {
  installment: PaymentInstallment; onClose: () => void; onSave: (id: string, updates: Partial<PaymentInstallment>) => Promise<void>;
}) {
  const [amount, setAmount] = useState(installment.amount);
  const [dueDate, setDueDate] = useState(installment.dueDate || "");
  const [notes, setNotes] = useState(installment.notes || "");
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Renegociar Parcela {installment.installmentNumber}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-purple-50 p-3 rounded-lg text-purple-900 text-sm border border-purple-200">
            A parcela será marcada como <strong>renegociada</strong> após salvar.
          </div>
          <div>
            <label className="text-sm font-medium">Nova Data de Vencimento</label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Novo Valor</label>
            <Input type="number" step="0.01" value={amount} onChange={e => setAmount(+e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Observações da Renegociação</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Motivo ou condições..." />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 hover:!text-gray-900 !border-gray-200 font-semibold" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={async () => {
            setSaving(true);
            await onSave(installment.id, { amount, dueDate, remainingAmount: amount - (installment.paidAmount || 0), notes });
            setSaving(false);
          }} disabled={saving} className="!bg-[#C9A227] hover:!bg-[#b59122] !text-white !border-[#C9A227] font-semibold">Renegociar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDetailsModal({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Detalhes do Pagamento</DialogTitle></DialogHeader>
        <div className="space-y-3 py-4">
          <DetailRow label="Data" value={payment.paymentDate ? formatDateBR(payment.paymentDate) : "-"} />
          <DetailRow label="Valor" value={formatCurrency(payment.amount)} />
          <DetailRow label="Forma" value={payment.paymentMethod || "—"} />
          <DetailRow label="Taxa" value={formatCurrency(payment.cardFee)} />
          <DetailRow label="Valor Líquido" value={formatCurrency(payment.netAmount)} />
          <DetailRow label="Observações" value={payment.notes || "Nenhuma"} />
          {(payment.splits || []).length > 0 && (
            <div className="mt-4 p-4 border rounded-lg bg-gray-50">
              <p className="font-semibold mb-2 text-sm">Divisões:</p>
              <ul className="space-y-1">
                {payment.splits?.map(s => (
                  <li key={s.id} className="text-sm flex justify-between border-b pb-1 last:border-0">
                    <span>{s.paymentMethod}</span>
                    <span className="font-medium">{formatCurrency(s.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="outline" className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 hover:!text-gray-900 !border-gray-200 font-semibold" onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-gray-100 pb-2">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
