import React from "react";
import {
  Eye, MessageCircle, Edit3, CheckCircle, XCircle,
  Clock, User, Stethoscope, Plus, AlertCircle
} from "lucide-react";
import type { Appointment, AppointmentStatus } from "@/lib/store";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayAppointmentsListProps {
  selectedDate: string;
  appointments: Appointment[]; // already filtered to this day + global filters
  onOpenNew: () => void;
  onEdit: (app: Appointment) => void;
  onStatusChange: (id: string, status: AppointmentStatus) => void;
  onWhatsApp: (app: Appointment) => void;
  onViewPatient: (patientId: string) => void;
  onCreateEvolution?: (app: Appointment) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PT_MONTHS_SHORT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function formatDateReadable(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const weekDays = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const date = new Date(y, m - 1, d);
  const weekDay = weekDays[date.getDay()];
  return `${String(d).padStart(2, "0")} de ${PT_MONTHS_SHORT[m - 1]} de ${y} · ${weekDay}`;
}

function statusConfig(status: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    agendado:        { label: "Agendado",        className: "bg-slate-100 text-slate-700 border-slate-200" },
    confirmado:      { label: "Confirmado",      className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    "em atendimento":{ label: "Em atendimento",  className: "bg-amber-100 text-amber-700 border-amber-200" },
    "concluído":     { label: "Concluído",       className: "bg-teal-100 text-teal-800 border-teal-200" },
    faltou:          { label: "Faltou",          className: "bg-orange-100 text-orange-700 border-orange-200" },
    cancelado:       { label: "Cancelado",       className: "bg-red-100 text-red-700 border-red-200" },
    remarcado:       { label: "Remarcado",       className: "bg-violet-100 text-violet-700 border-violet-200" },
  };
  return map[status] ?? { label: status, className: "bg-gray-100 text-gray-700 border-gray-200" };
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    consulta:     "Consulta",
    avaliação:    "Avaliação",
    retorno:      "Retorno",
    procedimento: "Procedimento",
    emergência:   "Emergência",
    manutenção:   "Manutenção",
    orçamento:    "Orçamento",
    outro:        "Outro",
  };
  return map[type] ?? type;
}

// ─── Sub-component: single appointment card ───────────────────────────────────

function AppointmentCard({
  app,
  onEdit,
  onStatusChange,
  onWhatsApp,
  onViewPatient,
  onCreateEvolution,
}: {
  app: Appointment;
  onEdit: (app: Appointment) => void;
  onStatusChange: (id: string, status: AppointmentStatus) => void;
  onWhatsApp: (app: Appointment) => void;
  onViewPatient: (patientId: string) => void;
  onCreateEvolution?: (app: Appointment) => void;
}) {
  const status = statusConfig(app.status);
  const isConcluded = app.status === "concluído";
  const isCancelled = app.status === "cancelado";
  const isActive = !isConcluded && !isCancelled;

  return (
    <div
      className={[
        "bg-white border rounded-xl p-4 space-y-3 transition-all",
        isCancelled
          ? "border-red-100 opacity-70"
          : "border-border hover:border-[#C9A227]/40 hover:shadow-sm",
      ].join(" ")}
    >
      {/* ── Row 1: time + status + type ── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-[#C9A227] text-xs font-extrabold px-2.5 py-1 rounded-lg">
          <Clock className="w-3.5 h-3.5" />
          {app.startTime}
          {app.endTime && ` – ${app.endTime}`}
        </span>

        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${status.className}`}
        >
          {status.label}
        </span>

        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
          {typeLabel(app.type)}
        </span>
      </div>

      {/* ── Row 2: patient name ── */}
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="font-bold text-sm text-gray-900 truncate">{app.patientName}</span>
      </div>

      {/* ── Row 3: procedure + notes ── */}
      {(app.procedureName || app.notes) && (
        <div className="space-y-1 pl-0.5">
          {app.procedureName && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Stethoscope className="w-3.5 h-3.5 shrink-0" />
              <span>{app.procedureName}</span>
            </div>
          )}
          {app.notes && (
            <p className="text-[11px] text-muted-foreground italic bg-gray-50 border border-border/50 rounded-lg px-3 py-1.5 leading-relaxed">
              {app.notes}
            </p>
          )}
        </div>
      )}

      {/* ── Row 4: action buttons ── */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 mt-1">
        {/* Always visible */}
        <button
          type="button"
          onClick={() => onViewPatient(app.patientId)}
          className="agenda-btn-secondary inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold transition-colors"
        >
          <Eye className="w-3.5 h-3.5" /> Ficha
        </button>

        <button
          type="button"
          onClick={() => onWhatsApp(app)}
          className="agenda-btn-secondary inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
        </button>

        {!isCancelled && (
          <button
            type="button"
            onClick={() => onEdit(app)}
            className="agenda-btn-secondary inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" /> Editar
          </button>
        )}

        {/* Status quick actions */}
        {isActive && (
          <>
            {app.status !== "confirmado" && (
              <button
                type="button"
                onClick={() => onStatusChange(app.id, "confirmado")}
                className="agenda-btn-secondary inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Confirmar
              </button>
            )}

            {app.status !== "em atendimento" && (
              <button
                type="button"
                onClick={() => onStatusChange(app.id, "em atendimento")}
                className="agenda-btn-primary inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold transition-colors"
              >
                Atender
              </button>
            )}

            <button
              type="button"
              onClick={() => onStatusChange(app.id, "concluído")}
              className="agenda-btn-primary inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold transition-colors shadow-sm"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Concluir
            </button>

            <button
              type="button"
              onClick={() => onStatusChange(app.id, "cancelado")}
              className="agenda-btn-danger inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" /> Cancelar
            </button>
          </>
        )}

        {/* If concluded: show create evolution button */}
        {isConcluded && (
          <button
            type="button"
            onClick={() => onCreateEvolution ? onCreateEvolution(app) : onViewPatient(app.patientId)}
            className="agenda-btn-secondary inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Criar evolução clínica
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DayAppointmentsList({
  selectedDate,
  appointments,
  onOpenNew,
  onEdit,
  onStatusChange,
  onWhatsApp,
  onViewPatient,
  onCreateEvolution,
}: DayAppointmentsListProps) {
  const readableDate = formatDateReadable(selectedDate);

  // Sort by start time
  const sorted = [...appointments].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display font-extrabold text-base text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#C9A227]" />
            Agendamentos do dia
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">{readableDate}</p>
        </div>
        <button
          type="button"
          onClick={onOpenNew}
          className="agenda-btn-primary shrink-0 inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg text-sm font-bold transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Agendar
        </button>
      </div>

      {/* ── List ───────────────────────────────────────────────── */}
      <div className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-280px)] pr-0.5">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border rounded-2xl bg-gray-50/50">
            <AlertCircle className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="font-semibold text-sm text-gray-700">Nenhum atendimento agendado</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Não há consultas para este dia. Clique abaixo para agendar.
            </p>
            <button
              type="button"
              onClick={onOpenNew}
              className="agenda-btn-primary mt-4 inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg text-sm font-bold transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Agendar para esta data
            </button>
          </div>
        ) : (
          sorted.map((app) => (
            <AppointmentCard
              key={app.id}
              app={app}
              onEdit={onEdit}
              onStatusChange={onStatusChange}
              onWhatsApp={onWhatsApp}
              onViewPatient={onViewPatient}
              onCreateEvolution={onCreateEvolution}
            />
          ))
        )}
      </div>
    </div>
  );
}
