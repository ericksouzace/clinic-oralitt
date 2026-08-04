import React from "react";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Edit3,
  Eye,
  MessageCircle,
  Plus,
  Stethoscope,
  User,
} from "lucide-react";
import type { Appointment, AppointmentStatus } from "@/lib/store";

interface DayAppointmentsListProps {
  selectedDate: string;
  appointments: Appointment[];
  onOpenNew: () => void;
  onEdit: (appointment: Appointment) => void;
  onStatusChange: (
    id: string,
    status: AppointmentStatus,
  ) => void | Promise<void>;
  onWhatsApp: (appointment: Appointment) => void;
  onViewPatient: (patientId: string) => void;
}

const PT_MONTHS_SHORT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function formatDateReadable(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const weekDays = [
    "domingo",
    "segunda-feira",
    "terça-feira",
    "quarta-feira",
    "quinta-feira",
    "sexta-feira",
    "sábado",
  ];

  const date = new Date(year, month - 1, day);

  return `${String(day).padStart(2, "0")} de ${
    PT_MONTHS_SHORT[month - 1]
  } de ${year} · ${weekDays[date.getDay()]}`;
}

function AppointmentCard({
  app,
  onEdit,
  onStatusChange,
  onWhatsApp,
  onViewPatient,
}: {
  app: Appointment;
  onEdit: (appointment: Appointment) => void;
  onStatusChange: (
    id: string,
    status: AppointmentStatus,
  ) => void | Promise<void>;
  onWhatsApp: (appointment: Appointment) => void;
  onViewPatient: (patientId: string) => void;
}) {
  const confirmed = app.status === "confirmado";

  return (
    <div className="space-y-3 rounded-xl border border-border bg-white p-4 transition-all hover:border-[#C9A227]/40 hover:shadow-sm">
      <div>
        <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-extrabold text-[#8A6A16]">
          <Clock className="h-3.5 w-3.5" />
          {app.startTime}
          {app.endTime && ` – ${app.endTime}`}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-bold text-gray-900">
            {app.patientName}
          </span>
        </div>

        <div className="flex items-start gap-2 pl-0.5 text-xs text-slate-600">
          <Stethoscope className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8A6A16]" />
          <span className="font-semibold">
            {app.title || "Procedimento não informado"}
          </span>
        </div>
      </div>

      {app.notes && (
        <p className="rounded-lg border border-border/50 bg-gray-50 px-3 py-2 text-[11px] italic leading-relaxed text-muted-foreground">
          {app.notes}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-3">
        <button
          type="button"
          onClick={() => onViewPatient(app.patientId)}
          className="agenda-btn-secondary inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors"
        >
          <Eye className="h-3.5 w-3.5" />
          Ficha
        </button>

        <button
          type="button"
          onClick={() => onWhatsApp(app)}
          className="agenda-btn-secondary inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp
        </button>

        <button
          type="button"
          onClick={() => onEdit(app)}
          className="agenda-btn-secondary inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors"
        >
          <Edit3 className="h-3.5 w-3.5" />
          Editar
        </button>

        <button
          type="button"
          disabled={confirmed}
          onClick={() => void onStatusChange(app.id, "confirmado")}
          className={[
            "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors",
            confirmed
              ? "cursor-default border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "agenda-btn-primary",
          ].join(" ")}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          {confirmed ? "Confirmado" : "Confirmar"}
        </button>
      </div>
    </div>
  );
}

export function DayAppointmentsList({
  selectedDate,
  appointments,
  onOpenNew,
  onEdit,
  onStatusChange,
  onWhatsApp,
  onViewPatient,
}: DayAppointmentsListProps) {
  const readableDate = formatDateReadable(selectedDate);

  const sorted = [...appointments].sort((a, b) =>
    a.startTime.localeCompare(b.startTime),
  );

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-foreground">
            <Clock className="h-4 w-4 text-[#C9A227]" />
            Agendamentos do dia
          </h2>
          <p className="mt-0.5 text-xs capitalize text-muted-foreground">
            {readableDate}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNew}
          className="agenda-btn-primary inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-bold shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          Agendar
        </button>
      </div>

      <div className="max-h-[calc(100vh-280px)] flex-1 space-y-3 overflow-y-auto pr-0.5">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-gray-50/50 py-16 text-center">
            <AlertCircle className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-semibold text-gray-700">
              Nenhum atendimento agendado
            </p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Não há agendamentos para este dia.
            </p>

            <button
              type="button"
              onClick={onOpenNew}
              className="agenda-btn-primary mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              Agendar para esta data
            </button>
          </div>
        ) : (
          sorted.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              app={appointment}
              onEdit={onEdit}
              onStatusChange={onStatusChange}
              onWhatsApp={onWhatsApp}
              onViewPatient={onViewPatient}
            />
          ))
        )}
      </div>
    </div>
  );
}
