import React, { useState, useMemo, useEffect } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import AppLayout from "@/components/AppLayout";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  useAppointments,
  saveAppointment,
  deleteAppointment,
  usePatients,
  useProcedures,
  useSupplies,
  saveClinicalRecord,
  savePayment,
} from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { Appointment, AppointmentStatus, AppointmentType, uid, ClinicalRecord, ClinicalRecordSupply } from "@/lib/store";
import { toast } from "sonner";
import {
  Calendar, Plus, Search, Clock, Activity,
  CheckCircle, XCircle, AlertTriangle, Filter, Trash2, DollarSign, Package, Stethoscope
} from "lucide-react";
import { Input, Label, Select, Textarea } from "@/components/ui-bits";
import { AgendaCalendar } from "@/components/agenda/AgendaCalendar";
import { DayAppointmentsList } from "@/components/agenda/DayAppointmentsList";
import { sendWhatsAppMessage, getWhatsAppTemplates, renderWhatsAppTemplate } from "@/lib/whatsapp";

// ─── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/agenda")({
  component: AgendaPage,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cleanPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 0) return "";
  if (cleaned.length <= 11) return "55" + cleaned;
  return cleaned;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AgendaPage() {
  const router = useRouter();

  // ── Data ──────────────────────────────────────────────────────────────────
  const [appointments, loading, tablesMissing] = useAppointments();
  const [patients] = usePatients();
  const [procedures] = useProcedures();
  const [supplies] = useSupplies();

  // ── Calendar state ────────────────────────────────────────────────────────
  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  // viewMonth is always the first day of the displayed month
  const [viewMonth, setViewMonth] = useState(() => {
    const [y, m] = todayStr.split("-");
    return `${y}-${m}-01`;
  });

  // ── Filter state ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");

  // ── Modal state ───────────────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Appointment>>({});
  const [saving, setSaving] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [patientPlans, setPatientPlans] = useState<any[]>([]);

  // ── Completion Flow Modal States ──────────────────────────────────────────
  const [completionAppt, setCompletionAppt] = useState<Appointment | null>(null);
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [completionStep, setCompletionStep] = useState(1);
  const [compDate, setCompDate] = useState("");
  const [compDescription, setCompDescription] = useState("");
  const [compTeeth, setCompTeeth] = useState("");
  const [compSignature, setCompSignature] = useState("");
  const [compProcId, setCompProcId] = useState("");
  const [compSupplies, setCompSupplies] = useState<any[]>([]);
  const [compChargedAmount, setCompChargedAmount] = useState<number>(0);
  const [compPaymentStatus, setCompPaymentStatus] = useState<"pago" | "pendente">("pago");
  const [compPaymentMethod, setCompPaymentMethod] = useState("Pix");
  const [compDueDate, setCompDueDate] = useState("");
  const [selSupplyId, setSelSupplyId] = useState("");
  const [selSupplyQty, setSelSupplyQty] = useState(1);

  // Sync completion flow states when completionAppt changes
  useEffect(() => {
    if (completionAppt) {
      setCompletionStep(1);
      setCompDate(completionAppt.appointmentDate || new Date().toISOString().split("T")[0]);
      setCompDescription(completionAppt.notes || `Consulta concluída: ${completionAppt.title}`);
      setCompTeeth("");
      setCompSignature("");
      setCompProcId(completionAppt.procedureId || "");
      setCompSupplies([]);
      setCompPaymentStatus("pago");
      setCompPaymentMethod("Pix");
      setCompDueDate(new Date().toISOString().split("T")[0]);
      
      const proc = procedures.find(p => p.id === completionAppt.procedureId);
      setCompChargedAmount(proc && proc.suggestedPrice !== undefined ? proc.suggestedPrice : 0);
    }
  }, [completionAppt, procedures]);

  async function handleProcChange(procId: string) {
    setCompProcId(procId);
    const proc = procedures.find(p => p.id === procId);
    setCompChargedAmount(proc && proc.suggestedPrice !== undefined ? proc.suggestedPrice : 0);

    if (!procId) {
      setCompSupplies([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("procedure_supplies")
        .select("*, supplies(*)")
        .eq("procedure_id", procId);

      if (error) throw error;

      if (data) {
        const items = data.map((ps: any) => {
          const s = ps.supplies;
          const unitCost = s && s.package_cost && s.yield_quantity ? (s.package_cost / s.yield_quantity) : 0;
          return {
            id: `temp-${uid()}`,
            supplyId: ps.supply_id,
            supplyName: s?.name || "Insumo",
            quantityUsed: ps.quantity || 1,
            unitCost: unitCost,
            totalCost: unitCost * (ps.quantity || 1),
            stock: s?.stock_quantity ?? 0,
          };
        });
        setCompSupplies(items);
      }
    } catch (err) {
      console.error("Error loading procedure supplies:", err);
      toast.error("Erro ao carregar insumos do procedimento.");
    }
  }

  function handleAddSupply() {
    if (!selSupplyId) return;
    const supply = supplies.find(s => s.id === selSupplyId);
    if (!supply) return;

    const existing = compSupplies.find(s => s.supplyId === selSupplyId);
    if (existing) {
      updateSupplyQty(existing.id, existing.quantityUsed + selSupplyQty);
      setSelSupplyId("");
      setSelSupplyQty(1);
      return;
    }

    const unitCost = supply.packCost / (supply.packYield || 1);
    const newSupplyItem = {
      id: `temp-${uid()}`,
      supplyId: supply.id,
      supplyName: supply.name,
      quantityUsed: selSupplyQty,
      unitCost: unitCost,
      totalCost: unitCost * selSupplyQty,
      stock: supply.stock || 0,
    };

    setCompSupplies(prev => [...prev, newSupplyItem]);
    setSelSupplyId("");
    setSelSupplyQty(1);
  }

  function handleRemoveSupply(id: string) {
    setCompSupplies(prev => prev.filter(item => item.id !== id));
  }

  function updateSupplyQty(id: string, qty: number) {
    setCompSupplies(prev =>
      prev.map(item => {
        if (item.id === id) {
          const newQty = Math.max(0.01, qty);
          return {
            ...item,
            quantityUsed: newQty,
            totalCost: item.unitCost * newQty,
          };
        }
        return item;
      })
    );
  }

  async function handleFinalizeCompletion() {
    if (!completionAppt) return;
    if (!completionAppt.patientId) {
      toast.error("Não foi possível concluir o atendimento. Verifique evolução, procedimento, insumos e financeiro.");
      return;
    }
    try {
      setSaving(true);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        throw new Error("Usuário não autenticado");
      }
      const userId = userData.user.id;

      // 1. Calculate cost values
      const procDetail = procedures.find(p => p.id === compProcId);
      const totalSuppliesCost = compSupplies.reduce((sum, item) => sum + item.totalCost, 0);
      const labCost = procDetail?.labCost || 0;
      const otherDirect = procDetail?.otherDirect || 0;
      const realCost = totalSuppliesCost + labCost + otherDirect;
      const estimatedProfit = compChargedAmount - realCost;

      // 2. Prepare and save Clinical Record + Supplies usage (stock deduction handled automatically inside saveClinicalRecord)
      const recordToSave: ClinicalRecord = {
        id: `temp-${uid()}`,
        userId: userId,
        patientId: completionAppt.patientId,
        procedureId: compProcId || undefined,
        recordDate: compDate,
        teeth: compTeeth ? compTeeth.split(",").map(t => t.trim()).filter(Boolean) : [],
        description: compDescription,
        notes: completionAppt.notes || "",
        chargedAmount: compChargedAmount,
        realCost: realCost,
        estimatedProfit: estimatedProfit,
        signature: compSignature || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const suppliesToSave: ClinicalRecordSupply[] = compSupplies.map(cs => ({
        id: cs.id,
        userId: userId,
        clinicalRecordId: "", // populated by saveClinicalRecord
        patientId: completionAppt.patientId,
        supplyId: cs.supplyId,
        quantityUsed: cs.quantityUsed,
        unitCost: cs.unitCost,
        totalCost: cs.totalCost,
        createdAt: new Date().toISOString(),
      }));

      await saveClinicalRecord(recordToSave, suppliesToSave);

      // 3. Save Billing Transaction
      if (compPaymentStatus === "pago") {
        // Direct Payment
        await savePayment({
          patientId: completionAppt.patientId,
          amount: compChargedAmount,
          paymentMethod: compPaymentMethod,
          paymentDate: compDate,
          cardFee: 0,
          netAmount: compChargedAmount,
          notes: `Recebimento de consulta concluída: ${completionAppt.title}`
        }, [
          {
            paymentMethod: compPaymentMethod,
            amount: compChargedAmount
          }
        ]);
      } else {
        // Pending: insert approved Budget and pending PaymentInstallment
        const dbBudget = {
          user_id: userId,
          patient_id: completionAppt.patientId,
          treatment_plan_id: completionAppt.treatmentPlanId || null,
          title: `Orçamento Integrado - ${completionAppt.title}`,
          total_amount: compChargedAmount,
          discount: 0,
          final_amount: compChargedAmount,
          status: "aprovado",
          valid_until: compDueDate || null,
          notes: `Gerado automaticamente na conclusão do atendimento`
        };

        const { data: budgetData, error: budgetErr } = await supabase
          .from("budgets")
          .insert(dbBudget)
          .select()
          .single();

        if (budgetErr) throw budgetErr;
        const newBudgetId = budgetData.id;

        // Insert budget item
        const dbBudgetItem = {
          user_id: userId,
          budget_id: newBudgetId,
          procedure_id: compProcId || null,
          description: procDetail?.name || `Procedimento concluído`,
          quantity: 1,
          unit_price: compChargedAmount,
          total_price: compChargedAmount
        };

        const { error: itemErr } = await supabase
          .from("budget_items")
          .insert(dbBudgetItem);

        if (itemErr) throw itemErr;

        // Insert payment installment
        const dbInstallment = {
          user_id: userId,
          patient_id: completionAppt.patientId,
          budget_id: newBudgetId,
          installment_number: 1,
          amount: compChargedAmount,
          paid_amount: 0,
          remaining_amount: compChargedAmount,
          due_date: compDueDate || compDate,
          status: "pendente",
          notes: `Parcela única gerada na conclusão do atendimento`
        };

        const { error: installmentErr } = await supabase
          .from("payment_installments")
          .insert(dbInstallment);

        if (installmentErr) throw installmentErr;
      }

      // 4. Update Appointment status to "concluído"
      await saveAppointment({
        ...completionAppt,
        status: "concluído",
        updatedAt: new Date().toISOString()
      });

      toast.success("Atendimento concluído e integrado com sucesso!");
      setIsCompletionModalOpen(false);
      setCompletionAppt(null);
      window.location.reload();
    } catch (err: any) {
      console.error("Error finalizing completion:", err);
      toast.error("Erro ao finalizar atendimento: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Navigate month ────────────────────────────────────────────────────────
  function goPrevMonth() {
    const [y, m] = viewMonth.split("-").map(Number);
    const d = new Date(y, m - 1 - 1, 1);
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  }
  function goNextMonth() {
    const [y, m] = viewMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + 1, 1);
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  }

  // When user selects a day: update selectedDate, sync viewMonth if needed
  function handleSelectDate(dateStr: string) {
    setSelectedDate(dateStr);
    const [y, m] = dateStr.split("-");
    setViewMonth(`${y}-${m}-01`);
  }

  // ── Patient plans loader ──────────────────────────────────────────────────
  async function loadPlansForPatient(patientId: string) {
    if (!patientId) { setPatientPlans([]); return; }
    try {
      const { data } = await supabase
        .from("treatment_plans")
        .select("id, title, status")
        .eq("patient_id", patientId);
      setPatientPlans(data || []);
    } catch (err) {
      console.error("Error loading patient plans:", err);
      setPatientPlans([]);
    }
  }

  async function handlePatientChange(patientId: string) {
    setSelectedPatientId(patientId);
    setDraft(prev => ({ ...prev, patientId, treatmentPlanId: undefined }));
    await loadPlansForPatient(patientId);
  }

  // ── Open modal helpers ────────────────────────────────────────────────────
  function openNewAppointment(preselectedPatientId?: string) {
    setDraft({
      appointmentDate: selectedDate,
      startTime: "09:00",
      endTime: "10:00",
      status: "agendado",
      type: "consulta",
      whatsappReminder: true,
    });
    setSelectedPatientId(preselectedPatientId || "");
    if (preselectedPatientId) {
      loadPlansForPatient(preselectedPatientId);
    } else {
      setPatientPlans([]);
    }
    setIsModalOpen(true);
  }

  async function openEditAppointment(app: Appointment) {
    setDraft(app);
    setSelectedPatientId(app.patientId);
    await loadPlansForPatient(app.patientId);
    setIsModalOpen(true);
  }

  // ── URL query params listener (from patient profile "Novo agendamento") ──
  React.useEffect(() => {
    if (typeof window === "undefined" || patients.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const newAppt = params.get("newAppt");
    const patientId = params.get("patientId");
    if (newAppt === "true") {
      params.delete("newAppt");
      params.delete("patientId");
      const newSearch = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (newSearch ? "?" + newSearch : ""));
      openNewAppointment(patientId || undefined);
    }
  }, [patients]);

  // ── Conflict check ────────────────────────────────────────────────────────
  function checkTimeConflict(app: Partial<Appointment>): boolean {
    if (!app.appointmentDate || !app.startTime || !app.endTime) return false;
    const startNum = app.startTime.replace(":", "");
    const endNum = app.endTime.replace(":", "");
    return appointments.some(a => {
      if (a.id === app.id) return false;
      if (a.appointmentDate !== app.appointmentDate) return false;
      if (a.status === "cancelado") return false;
      const aStart = a.startTime.replace(":", "");
      const aEnd = a.endTime.replace(":", "");
      return startNum < aEnd && endNum > aStart;
    });
  }

  // ── Save appointment ──────────────────────────────────────────────────────
  async function handleSave() {
    if (!selectedPatientId) { toast.error("Selecione um paciente."); return; }
    if (!draft.appointmentDate || !draft.startTime || !draft.endTime) {
      toast.error("Data, horário inicial e horário final são obrigatórios."); return;
    }
    if (draft.startTime >= draft.endTime) {
      toast.error("O horário final deve ser após o horário inicial."); return;
    }

    const patientDef = patients.find(p => p.id === selectedPatientId);
    const titleVal = draft.title || `Atendimento - ${patientDef?.fullName || ""}`;

    const appointmentToSave: Appointment = {
      id: draft.id || `temp-${uid()}`,
      userId: draft.userId || "",
      patientId: selectedPatientId,
      procedureId: draft.procedureId,
      treatmentPlanId: draft.treatmentPlanId,
      title: titleVal,
      appointmentDate: draft.appointmentDate,
      startTime: draft.startTime,
      endTime: draft.endTime,
      status: (draft.status as AppointmentStatus) || "agendado",
      type: (draft.type as AppointmentType) || "consulta",
      notes: draft.notes,
      whatsappReminder: draft.whatsappReminder ?? false,
      createdAt: draft.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (checkTimeConflict(appointmentToSave)) {
      const ok = window.confirm("⚠️ Já existe outro atendimento neste horário. Deseja continuar mesmo assim?");
      if (!ok) return;
    }

    try {
      setSaving(true);
      await saveAppointment(appointmentToSave);
      toast.success(draft.id ? "Agendamento atualizado!" : "Agendamento criado!");
      // Navigate selectedDate to the saved date so calendar highlights it
      setSelectedDate(appointmentToSave.appointmentDate);
      const [y, m] = appointmentToSave.appointmentDate.split("-");
      setViewMonth(`${y}-${m}-01`);
      setIsModalOpen(false);
      window.location.reload();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Status change ─────────────────────────────────────────────────────────
  async function handleStatusChange(id: string, newStatus: AppointmentStatus) {
    const original = appointments.find(a => a.id === id);
    if (!original) return;
    try {
      if (newStatus === "concluído") {
        setCompletionAppt(original);
        setIsCompletionModalOpen(true);
        return;
      }
      await saveAppointment({ ...original, status: newStatus, updatedAt: new Date().toISOString() });
      toast.success(`Status alterado para "${newStatus}"!`);
      window.location.reload();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  }

  // ── WhatsApp ──────────────────────────────────────────────────────────────
  async function handleWhatsApp(app: Appointment) {
    const patientDef = patients.find(p => p.id === app.patientId);
    const rawPhone = app.patientPhone || patientDef?.phone || patientDef?.whatsapp || "";
    if (!rawPhone) { 
      toast.error("Paciente sem telefone cadastrado."); 
      return; 
    }

    const [y, mo, d] = app.appointmentDate.split("-");
    const dateFormatted = `${d}/${mo}/${y}`;

    const params = new URLSearchParams({
      patientId: app.patientId,
      templateId: "tpl-confirmacao",
      date: dateFormatted,
      time: app.startTime,
      profissional_nome: app.dentistName || "Dentista",
      procedimento_nome: app.title || "Consulta"
    });

    window.location.href = `/whatsapp?${params.toString()}`;
  }

  // ── Filtered appointments (respects global filters, ignores date) ─────────
  const filteredAll = useMemo(() => {
    return appointments.filter(app => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!app.patientName?.toLowerCase().includes(q) && !app.title?.toLowerCase().includes(q)) return false;
      }
      if (filterStatus && app.status !== filterStatus) return false;
      if (filterType && app.type !== filterType) return false;
      return true;
    });
  }, [appointments, searchQuery, filterStatus, filterType]);

  // Appointments for the selected day
  const dayAppointments = useMemo(
    () => filteredAll.filter(a => a.appointmentDate === selectedDate),
    [filteredAll, selectedDate]
  );

  // ── Stats (based on ALL appointments, not filtered, today only) ───────────
  const stats = useMemo(() => {
    const todayAppts = appointments.filter(a => a.appointmentDate === todayStr);
    const totalHoje = todayAppts.filter(a => a.status !== "cancelado").length;
    const confirmados = todayAppts.filter(a => a.status === "confirmado").length;
    const pendentes = todayAppts.filter(a => a.status === "agendado").length;
    const cancelados = todayAppts.filter(a => a.status === "cancelado").length;
    const proximo = appointments
      .filter(a => a.status !== "cancelado" && a.status !== "concluído")
      .filter(a => new Date(`${a.appointmentDate}T${a.startTime}`) >= new Date())
      .sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate) || a.startTime.localeCompare(b.startTime))[0] ?? null;
    return { totalHoje, confirmados, pendentes, cancelados, proximo };
  }, [appointments, todayStr]);

  // ─────────────────────────────────────────────────────────────────────────
  // Fallback: table missing
  // ─────────────────────────────────────────────────────────────────────────
  if (tablesMissing) {
    return (
      <AppLayout>
        <div className="py-12 max-w-4xl mx-auto space-y-6">
          <div className="bg-white border-2 border-dashed border-amber-300 rounded-2xl p-10 text-center flex flex-col items-center">
            <AlertTriangle className="h-16 w-16 text-amber-500 mb-4 animate-bounce" />
            <h2 className="text-2xl font-display font-extrabold text-foreground mb-3">Estrutura de Agenda Necessária</h2>
            <p className="text-muted-foreground text-sm max-w-lg mb-6">
              A tabela de agendamentos no Supabase não está criada ou precisa de colunas adicionais.
              Copie e execute o script abaixo no Supabase SQL Editor.
            </p>
            <div className="text-left w-full bg-slate-900 text-slate-100 rounded-xl p-5 overflow-x-auto text-xs font-mono select-all max-h-[350px] border shadow-inner">
              <p className="text-slate-400 mb-2">-- Execute no Supabase SQL Editor:</p>
              <pre className="whitespace-pre">{`CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  procedure_id uuid REFERENCES public.procedures(id) ON DELETE SET NULL,
  treatment_plan_id uuid REFERENCES public.treatment_plans(id) ON DELETE SET NULL,
  title text NOT NULL,
  appointment_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  status text NOT NULL DEFAULT 'agendado',
  type text NOT NULL DEFAULT 'consulta',
  notes text,
  whatsapp_reminder boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own appointments"
  ON public.appointments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Se a tabela já existir, adicione apenas os campos ausentes:
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS treatment_plan_id uuid REFERENCES public.treatment_plans(id) ON DELETE SET NULL;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS type text DEFAULT 'consulta';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS whatsapp_reminder boolean DEFAULT false;
UPDATE public.appointments SET title = 'Consulta' WHERE title IS NULL;
ALTER TABLE public.appointments ALTER COLUMN title SET NOT NULL;`}</pre>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold text-white bg-[#C9A227] hover:bg-[#b59122] transition-colors shadow-sm"
            >
              Já executei o SQL — recarregar
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="space-y-5 animate-in fade-in duration-200">

        {/* ── Page Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-display font-extrabold text-foreground flex items-center gap-2">
              <Calendar className="h-6 w-6 text-[#C9A227]" />
              Agenda Clínica
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie consultas, retornos e procedimentos da Clínica Oralit
            </p>
          </div>
          <button
            type="button"
            onClick={() => openNewAppointment()}
            className="agenda-btn-primary inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg text-sm font-bold shadow-sm"
          >
            <Plus className="w-4 h-4" /> Novo agendamento
          </button>
        </div>

        {/* ── Stats row ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            {
              label: "Atendimentos hoje",
              value: stats.totalHoje,
              icon: <Clock className="w-4 h-4" />,
              accent: "text-[#C9A227]",
            },
            {
              label: "Confirmados",
              value: stats.confirmados,
              icon: <CheckCircle className="w-4 h-4" />,
              accent: "text-emerald-600",
            },
            {
              label: "Pendentes",
              value: stats.pendentes,
              icon: <Activity className="w-4 h-4" />,
              accent: "text-blue-500",
            },
            {
              label: "Cancelados",
              value: stats.cancelados,
              icon: <XCircle className="w-4 h-4" />,
              accent: "text-red-500",
            },
          ].map(stat => (
            <div key={stat.label} className="bg-white border border-border/60 rounded-xl p-4 shadow-sm">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-1">{stat.label}</span>
              <div className={`text-2xl font-extrabold flex items-center gap-1.5 ${stat.accent}`}>
                {stat.icon}
                {loading ? "—" : stat.value}
              </div>
            </div>
          ))}
          {/* Próximo atendimento */}
          <div className="bg-white border border-border/60 rounded-xl p-4 shadow-sm col-span-2 sm:col-span-1">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-1">Próximo</span>
            {stats.proximo ? (
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-sm text-gray-800 truncate">{stats.proximo.patientName}</span>
                <span className="text-[11px] text-[#C9A227] font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {stats.proximo.appointmentDate.split("-").reverse().join("/")} às {stats.proximo.startTime}
                </span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground italic">Sem consultas</span>
            )}
          </div>
        </div>

        {/* ── Filters bar ───────────────────────────────────────────────────── */}
        <div className="bg-white border border-border/60 rounded-xl p-4 shadow-sm">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Filter className="w-3.5 h-3.5" /> Filtros:
            </div>
            {/* Search */}
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar paciente..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-card pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227] transition"
              />
            </div>
            {/* Status */}
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="h-8 rounded-lg border border-input bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227] transition min-w-[130px]"
            >
              <option value="">Todos os status</option>
              <option value="agendado">Agendado</option>
              <option value="confirmado">Confirmado</option>
              <option value="em atendimento">Em atendimento</option>
              <option value="concluído">Concluído</option>
              <option value="faltou">Faltou</option>
              <option value="cancelado">Cancelado</option>
              <option value="remarcado">Remarcado</option>
            </select>
            {/* Type */}
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="h-8 rounded-lg border border-input bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227] transition min-w-[120px]"
            >
              <option value="">Todos os tipos</option>
              <option value="consulta">Consulta</option>
              <option value="avaliação">Avaliação</option>
              <option value="retorno">Retorno</option>
              <option value="procedimento">Procedimento</option>
              <option value="emergência">Emergência</option>
              <option value="manutenção">Manutenção</option>
              <option value="orçamento">Orçamento</option>
              <option value="outro">Outro</option>
            </select>
            {/* Clear */}
            {(searchQuery || filterStatus || filterType) && (
              <button
                type="button"
                onClick={() => { setSearchQuery(""); setFilterStatus(""); setFilterType(""); }}
                className="h-8 px-3 rounded-lg text-xs font-semibold text-muted-foreground border border-dashed border-border hover:border-red-300 hover:text-red-500 transition-colors"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* ── Main 2-column layout ──────────────────────────────────────────── */}
        {loading ? (
          <div className="py-20 text-center text-muted-foreground animate-pulse text-sm">
            Carregando agenda...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5 items-start">

            {/* ── Left: Calendar ─────────────────────────────────────────── */}
            <div className="w-full">
              <AgendaCalendar
                viewMonth={viewMonth}
                selectedDate={selectedDate}
                appointments={filteredAll}
                onSelectDate={handleSelectDate}
                onPrevMonth={goPrevMonth}
                onNextMonth={goNextMonth}
              />
            </div>

            {/* ── Right: Day appointments ────────────────────────────────── */}
            <div className="bg-white border border-border/60 rounded-2xl shadow-sm p-5">
              <DayAppointmentsList
                selectedDate={selectedDate}
                appointments={dayAppointments}
                onOpenNew={() => openNewAppointment()}
                onEdit={openEditAppointment}
                onStatusChange={handleStatusChange}
                onWhatsApp={handleWhatsApp}
                onViewPatient={(patientId) =>
                  router.navigate({ to: `/pacientes/${patientId}` })
                }
                onCreateEvolution={(app) =>
                  router.navigate({
                    to: `/pacientes/${app.patientId}`,
                    search: {
                      tab: "ficha-clinica",
                      newEvolution: "true",
                      date: app.appointmentDate,
                      procId: app.procedureId || undefined,
                      procedureId: app.procedureId || undefined,
                      notes: app.notes || `Consulta concluída: ${app.title}`,
                    } as any,
                  })
                }
              />
            </div>

          </div>
        )}

      </div>

      {/* ── Modal: New / Edit Appointment ──────────────────────────────────── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-display font-extrabold">
              {draft.id ? "Editar Agendamento" : "Novo Agendamento"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">

            {/* Patient */}
            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                Paciente <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedPatientId}
                onChange={e => handlePatientChange(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-3 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227] transition"
              >
                <option value="">Selecione um paciente...</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}{p.whatsapp || p.phone ? ` · ${p.whatsapp || p.phone}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Date + Times */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                  Data <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={draft.appointmentDate || ""}
                  onChange={e => setDraft({ ...draft, appointmentDate: e.target.value })}
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-3 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227] transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                  Início <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={draft.startTime || ""}
                  onChange={e => setDraft({ ...draft, startTime: e.target.value })}
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-3 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227] transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                  Fim <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={draft.endTime || ""}
                  onChange={e => setDraft({ ...draft, endTime: e.target.value })}
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-3 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227] transition"
                />
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                Título <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Consulta Semestral, Limpeza..."
                value={draft.title || ""}
                onChange={e => setDraft({ ...draft, title: e.target.value })}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-3 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227] transition"
              />
            </div>

            {/* Type + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1.5">Tipo</label>
                <select
                  value={draft.type || "consulta"}
                  onChange={e => setDraft({ ...draft, type: e.target.value as AppointmentType })}
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-3 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227] transition"
                >
                  <option value="consulta">Consulta</option>
                  <option value="avaliação">Avaliação</option>
                  <option value="retorno">Retorno</option>
                  <option value="procedimento">Procedimento</option>
                  <option value="emergência">Emergência</option>
                  <option value="manutenção">Manutenção</option>
                  <option value="orçamento">Orçamento</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1.5">Status</label>
                <select
                  value={draft.status || "agendado"}
                  onChange={e => setDraft({ ...draft, status: e.target.value as AppointmentStatus })}
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-3 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227] transition"
                >
                  <option value="agendado">Agendado</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="em atendimento">Em atendimento</option>
                  <option value="concluído">Concluído</option>
                  <option value="faltou">Faltou</option>
                  <option value="cancelado">Cancelado</option>
                  <option value="remarcado">Remarcado</option>
                </select>
              </div>
            </div>

            {/* Procedure */}
            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                Procedimento <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <select
                value={draft.procedureId || ""}
                onChange={e => setDraft({ ...draft, procedureId: e.target.value || undefined })}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-3 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227] transition"
              >
                <option value="">Selecione...</option>
                {procedures.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Treatment plan (only if patient selected and plans exist) */}
            {selectedPatientId && patientPlans.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                  Plano de Tratamento <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <select
                  value={draft.treatmentPlanId || ""}
                  onChange={e => setDraft({ ...draft, treatmentPlanId: e.target.value || undefined })}
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-3 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227] transition"
                >
                  <option value="">Selecione...</option>
                  {patientPlans.map(plan => (
                    <option key={plan.id} value={plan.id}>{plan.title} ({plan.status})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                Observações <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <textarea
                value={draft.notes || ""}
                onChange={e => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Instruções pré-consulta, detalhes do dente ou tratamento..."
                rows={3}
                className="min-h-[80px] w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227] transition resize-none"
              />
            </div>

            {/* WhatsApp reminder checkbox */}
            <div className="flex items-center gap-2.5 pt-1">
              <input
                type="checkbox"
                id="whatsappReminder"
                checked={draft.whatsappReminder ?? false}
                onChange={e => setDraft({ ...draft, whatsappReminder: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 accent-[#C9A227]"
              />
              <label htmlFor="whatsappReminder" className="text-xs font-medium text-foreground/80 cursor-pointer select-none">
                Registrar lembrete de WhatsApp para este atendimento
              </label>
            </div>

          </div>

          <DialogFooter className="gap-3 mt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={saving}
              className="agenda-btn-secondary h-10 px-5 rounded-lg text-sm font-bold border-2 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !selectedPatientId || !draft.appointmentDate || !draft.startTime || !draft.endTime}
              title={(!selectedPatientId || !draft.appointmentDate || !draft.startTime || !draft.endTime) ? "Preencha paciente, data, início e fim." : ""}
              className="agenda-btn-primary h-10 px-6 rounded-lg text-sm font-bold transition-colors shadow-sm"
            >
              {saving ? "Salvando..." : "Salvar agendamento"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Completion Flow (5 Steps) ────────────────────────────────── */}
      <Dialog open={isCompletionModalOpen} onOpenChange={setIsCompletionModalOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto bg-white">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-lg font-display font-extrabold flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-[#C9A227]" />
              Concluir Atendimento e Faturar
            </DialogTitle>
          </DialogHeader>

          {/* Steps Indicator */}
          <div className="flex justify-between items-center my-4 border-b pb-4">
            {[1, 2, 3, 4, 5].map((stepNum) => (
              <div key={stepNum} className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  completionStep === stepNum 
                    ? "bg-[#C9A227] text-white animate-pulse" 
                    : completionStep > stepNum 
                      ? "bg-emerald-600 text-white" 
                      : "bg-gray-100 text-gray-400"
                }`}>
                  {stepNum}
                </div>
                <span className={`text-[11px] font-semibold hidden sm:inline ${
                  completionStep === stepNum ? "text-foreground font-bold" : "text-muted-foreground"
                }`}>
                  {stepNum === 1 && "Evolução"}
                  {stepNum === 2 && "Procedimento"}
                  {stepNum === 3 && "Insumos"}
                  {stepNum === 4 && "Financeiro"}
                  {stepNum === 5 && "Resumo"}
                </span>
              </div>
            ))}
          </div>

          <div className="py-2 space-y-4">
            {/* STEP 1: EVOLUÇÃO CLÍNICA */}
            {completionStep === 1 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                    <Stethoscope className="w-4 h-4 text-[#C9A227]" />
                    Registro de Evolução Clínica
                  </h3>
                  <p className="text-xs text-muted-foreground">Descreva detalhadamente o atendimento realizado.</p>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Descrição do Atendimento *</Label>
                  <Textarea
                    placeholder="Procedimento executado, queixas relatadas, diagnóstico, técnica empregada..."
                    value={compDescription}
                    onChange={e => setCompDescription(e.target.value)}
                    rows={4}
                    className="w-full text-sm rounded-lg border border-gray-300 p-2.5 focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227] outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold">Dentes / Região (opcional)</Label>
                    <Input
                      placeholder="Ex: 18, 21, quadrante superior..."
                      value={compTeeth}
                      onChange={e => setCompTeeth(e.target.value)}
                      className="h-10 text-sm w-full rounded-lg border border-gray-300 px-3 outline-none"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Data do Atendimento *</Label>
                    <Input
                      type="date"
                      value={compDate}
                      onChange={e => setCompDate(e.target.value)}
                      className="h-10 text-sm w-full rounded-lg border border-gray-300 px-3 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Profissional Responsável (Assinatura) *</Label>
                  <Input
                    placeholder="Nome do dentista responsável..."
                    value={compSignature}
                    onChange={e => setCompSignature(e.target.value)}
                    className="h-10 text-sm w-full rounded-lg border border-gray-300 px-3 outline-none"
                  />
                </div>
              </div>
            )}

            {/* STEP 2: PROCEDIMENTO REALIZADO */}
            {completionStep === 2 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-[#C9A227]" />
                    Procedimento Realizado
                  </h3>
                  <p className="text-xs text-muted-foreground">Selecione o procedimento executado para vincular custos e insumos padrão.</p>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Procedimento Clínico</Label>
                  <select
                    value={compProcId}
                    onChange={e => handleProcChange(e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-3 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227] transition"
                  >
                    <option value="">Selecione um procedimento...</option>
                    {procedures.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                {compProcId && (
                  <div className="p-3 bg-gray-50 border rounded-lg text-xs space-y-1">
                    <p className="font-semibold text-gray-700">Valores cadastrados para o procedimento:</p>
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                      <span>Preço Sugerido: R$ {procedures.find(p => p.id === compProcId)?.suggestedPrice?.toFixed(2) || "0.00"}</span>
                      <span>Custo Lab/Direto: R$ {((procedures.find(p => p.id === compProcId)?.labCost || 0) + (procedures.find(p => p.id === compProcId)?.otherDirect || 0)).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: INSUMOS UTILIZADOS */}
            {completionStep === 3 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-[#C9A227]" />
                    Insumos Utilizados (Baixa de Estoque)
                  </h3>
                  <p className="text-xs text-muted-foreground">Confirme ou altere os insumos consumidos. O estoque será deduzido automaticamente.</p>
                </div>

                {/* Add Custom Supply usage */}
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Adicionar Insumo Extra</span>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-[10px]">Insumo</Label>
                      <select
                        value={selSupplyId}
                        onChange={e => setSelSupplyId(e.target.value)}
                        className="h-9 w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-2 text-xs outline-none"
                      >
                        <option value="">Selecione...</option>
                        {supplies.map(s => (
                          <option key={s.id} value={s.id}>{s.name} (Disp: {s.stock ?? 0} {s.unit || "un"})</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-20">
                      <Label className="text-[10px]">Qtd</Label>
                      <Input
                        type="number"
                        min="1"
                        value={selSupplyQty}
                        onChange={e => setSelSupplyQty(parseInt(e.target.value) || 1)}
                        className="h-9 text-xs text-center"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddSupply}
                      disabled={!selSupplyId}
                      className="h-9 px-3 rounded-lg text-xs font-semibold text-white bg-[#C9A227] hover:bg-[#b59122] disabled:opacity-50 transition"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>

                {/* Used supplies list */}
                {compSupplies.length === 0 ? (
                  <div className="text-center py-6 border border-dashed rounded-xl bg-gray-50/50 text-xs text-muted-foreground">
                    Nenhum insumo selecionado para este atendimento.
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden bg-white max-h-[220px] overflow-y-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b text-gray-500 font-semibold">
                          <th className="p-2.5">Insumo</th>
                          <th className="p-2.5 text-center w-24">Quantidade</th>
                          <th className="p-2.5 text-right w-24">Custo Total</th>
                          <th className="p-2.5 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {compSupplies.map(cs => (
                          <tr key={cs.id} className="hover:bg-gray-50/50">
                            <td className="p-2.5 font-medium text-gray-700">
                              {cs.supplyName}
                              {cs.quantityUsed > cs.stock && (
                                <span className="text-[10px] text-amber-600 block">⚠️ Insuficiente (Estoque: {cs.stock})</span>
                              )}
                            </td>
                            <td className="p-2.5">
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={cs.quantityUsed}
                                onChange={e => updateSupplyQty(cs.id, parseFloat(e.target.value) || 0)}
                                className="h-7 w-16 text-center rounded border border-gray-300 text-xs"
                              />
                            </td>
                            <td className="p-2.5 text-right text-rose-600 font-medium">
                              R$ {cs.totalCost?.toFixed(2)}
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveSupply(cs.id)}
                                className="text-rose-500 hover:text-rose-700 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: FINANCEIRO */}
            {completionStep === 4 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-[#C9A227]" />
                    Lançamento Financeiro (Faturamento)
                  </h3>
                  <p className="text-xs text-muted-foreground">Configure as informações de cobrança deste atendimento.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold">Valor Cobrado (R$) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={compChargedAmount || ""}
                      onChange={e => setCompChargedAmount(parseFloat(e.target.value) || 0)}
                      className="h-10 text-sm w-full rounded-lg border border-gray-300 px-3 outline-none"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Status de Pagamento *</Label>
                    <select
                      value={compPaymentStatus}
                      onChange={e => setCompPaymentStatus(e.target.value as "pago" | "pendente")}
                      className="h-10 w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-3 text-sm outline-none"
                    >
                      <option value="pago">Pago (À vista / Já recebido)</option>
                      <option value="pendente">Pendente (A Faturar / Contas a Receber)</option>
                    </select>
                  </div>
                </div>

                {compPaymentStatus === "pago" ? (
                  <div>
                    <Label className="text-xs font-semibold">Forma de Pagamento *</Label>
                    <select
                      value={compPaymentMethod}
                      onChange={e => setCompPaymentMethod(e.target.value)}
                      className="h-10 w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-3 text-sm outline-none"
                    >
                      <option value="Pix">Pix</option>
                      <option value="Cartão de Crédito">Cartão de Crédito</option>
                      <option value="Cartão de Débito">Cartão de Débito</option>
                      <option value="Dinheiro">Dinheiro</option>
                      <option value="Boleto">Boleto</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <Label className="text-xs font-semibold">Data de Vencimento da Parcela *</Label>
                    <Input
                      type="date"
                      value={compDueDate}
                      onChange={e => setCompDueDate(e.target.value)}
                      className="h-10 text-sm w-full rounded-lg border border-gray-300 px-3 outline-none"
                    />
                  </div>
                )}
              </div>
            )}

            {/* STEP 5: RESUMO FINAL */}
            {completionStep === 5 && (() => {
              const procDetail = procedures.find(p => p.id === compProcId);
              const totalSuppliesCost = compSupplies.reduce((sum, item) => sum + item.totalCost, 0);
              const labCost = procDetail?.labCost || 0;
              const otherDirect = procDetail?.otherDirect || 0;
              const realCost = totalSuppliesCost + labCost + otherDirect;
              const estimatedProfit = compChargedAmount - realCost;
              const marginPct = compChargedAmount > 0 ? (estimatedProfit / compChargedAmount) * 100 : 0;
              
              const lowStockSupplies = compSupplies.filter(item => item.quantityUsed > item.stock);

              return (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      Resumo e Margens do Atendimento
                    </h3>
                    <p className="text-xs text-muted-foreground">Revise o resumo financeiro, custos calculados e alertas antes de finalizar.</p>
                  </div>

                  {/* Summary grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white border rounded-xl p-3 shadow-sm text-center">
                      <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Valor Cobrado</span>
                      <span className="text-sm font-extrabold text-[#C9A227] block mt-1">R$ {compChargedAmount.toFixed(2)}</span>
                    </div>
                    <div className="bg-white border rounded-xl p-3 shadow-sm text-center">
                      <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Custos Insumos</span>
                      <span className="text-sm font-extrabold text-rose-600 block mt-1">R$ {totalSuppliesCost.toFixed(2)}</span>
                    </div>
                    <div className="bg-white border rounded-xl p-3 shadow-sm text-center">
                      <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Lab / Direto</span>
                      <span className="text-sm font-extrabold text-rose-600 block mt-1">R$ {(labCost + otherDirect).toFixed(2)}</span>
                    </div>
                    <div className="bg-white border rounded-xl p-3 shadow-sm text-center">
                      <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Margem Marginal</span>
                      <span className={`text-sm font-extrabold block mt-1 ${marginPct >= 30 ? 'text-emerald-600' : marginPct > 0 ? 'text-[#C9A227]' : 'text-rose-600'}`}>
                        {marginPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Estimated Profit info box */}
                  <div className={`p-4 rounded-xl border flex justify-between items-center ${estimatedProfit >= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                    <span className="text-xs font-semibold">Lucro Estimado para a Clínica:</span>
                    <span className="text-base font-bold">R$ {estimatedProfit.toFixed(2)}</span>
                  </div>

                  {/* Stock warnings */}
                  {lowStockSupplies.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider block">⚠️ Alertas de Estoque</span>
                      <div className="space-y-1.5">
                        {lowStockSupplies.map(item => (
                          <div key={item.id} className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg">
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>
                              Quantidade utilizada de <strong>{item.supplyName}</strong> ({item.quantityUsed}) excede estoque disponível ({item.stock}). O estoque ficará negativo.
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Billing status detail info */}
                  <div className="p-3 bg-gray-50 border rounded-lg text-xs space-y-1.5">
                    <p className="font-semibold text-gray-700">Lançamento de Faturamento:</p>
                    <div className="text-muted-foreground leading-relaxed">
                      {compPaymentStatus === "pago" ? (
                        <p>Será gerado um recebimento direto no valor de <strong>R$ {compChargedAmount.toFixed(2)}</strong> via <strong>{compPaymentMethod}</strong> na data de hoje.</p>
                      ) : (
                        <p>Será criado um orçamento aprovado e uma conta a receber no valor de <strong>R$ {compChargedAmount.toFixed(2)}</strong> com vencimento para <strong>{compDueDate.split("-").reverse().join("/")}</strong>.</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          <DialogFooter className="border-t pt-3 flex justify-between gap-3 mt-4">
            <button
              type="button"
              onClick={() => { setIsCompletionModalOpen(false); setCompletionAppt(null); }}
              disabled={saving}
              className="agenda-btn-secondary h-10 px-5 rounded-lg text-sm font-bold border-2 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCompletionStep(prev => prev - 1)}
                disabled={saving || completionStep === 1}
                className="agenda-btn-secondary h-10 px-5 rounded-lg text-sm font-bold border-2 transition-colors disabled:opacity-50"
              >
                Voltar
              </button>
              {completionStep < 5 ? (
                <button
                  type="button"
                  onClick={() => setCompletionStep(prev => prev + 1)}
                  disabled={
                    (completionStep === 1 && (!compDescription || !compSignature))
                  }
                  className="agenda-btn-primary h-10 px-6 rounded-lg text-sm font-bold transition-colors shadow-sm disabled:opacity-50"
                >
                  Avançar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinalizeCompletion}
                  disabled={saving}
                  className="agenda-btn-primary bg-emerald-600 hover:bg-emerald-700 h-10 px-6 rounded-lg text-sm font-bold text-white transition-colors shadow-sm disabled:opacity-50"
                >
                  {saving ? "Finalizando..." : "Finalizar e Faturar"}
                </button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
}
