import React, { useState, useMemo } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import AppLayout from "@/components/AppLayout";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  useAppointments,
  saveAppointment,
  deleteAppointment,
  usePatients,
  useProcedures,
} from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { Appointment, AppointmentStatus, AppointmentType, uid } from "@/lib/store";
import { toast } from "sonner";
import {
  Calendar, Plus, Search, Clock, Activity,
  CheckCircle, XCircle, AlertTriangle, Filter
} from "lucide-react";
import { AgendaCalendar } from "@/components/agenda/AgendaCalendar";
import { DayAppointmentsList } from "@/components/agenda/DayAppointmentsList";

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
      await saveAppointment({ ...original, status: newStatus, updatedAt: new Date().toISOString() });
      toast.success(`Status alterado para "${newStatus}"!`);

      if (newStatus === "concluído") {
        const goEvolution = window.confirm(
          "Deseja registrar uma evolução clínica para esta consulta?"
        );
        if (goEvolution) {
          router.navigate({
            to: `/pacientes/${original.patientId}`,
            search: {
              tab: "ficha-clinica",
              newEvolution: "true",
              date: original.appointmentDate,
              notes: original.notes || `Consulta concluída: ${original.title}`,
            } as any,
          });
          return;
        }
      }
      window.location.reload();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  }

  // ── WhatsApp ──────────────────────────────────────────────────────────────
  function handleWhatsApp(app: Appointment) {
    const phone = app.patientPhone ? cleanPhoneNumber(app.patientPhone) : "";
    if (!phone) { toast.error("Paciente sem WhatsApp/telefone cadastrado."); return; }
    const [y, mo, d] = app.appointmentDate.split("-");
    const dateFormatted = `${d}/${mo}/${y}`;
    const msg = `Olá, ${app.patientName}. Passando para confirmar seu atendimento na Clínica Oralit no dia ${dateFormatted} às ${app.startTime}.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
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

    </AppLayout>
  );
}
