import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Appointment } from "@/lib/store";

// ─── Constants ───────────────────────────────────────────────────────────────

const WEEK_DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

const PT_MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgendaCalendarProps {
  /** YYYY-MM-DD string of the currently viewed month (can be any day in that month) */
  viewMonth: string;
  /** YYYY-MM-DD string of the selected day */
  selectedDate: string;
  /** All (filtered) appointments to compute indicators */
  appointments: Appointment[];
  onSelectDate: (dateStr: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

// ─── Helper: build a 42-cell grid for the calendar ───────────────────────────

function buildCalendarGrid(year: number, month: number) {
  // month is 1-based
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();

  // Previous month fill
  const startWeekday = firstOfMonth.getDay(); // 0 = Sunday

  // We always render 6 rows × 7 cols = 42 cells
  const cells: Array<{ dateStr: string; isCurrentMonth: boolean }> = [];

  // Days from previous month
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    cells.push({
      dateStr: `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      isCurrentMonth: false,
    });
  }

  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      dateStr: `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      isCurrentMonth: true,
    });
  }

  // Days from next month to fill remaining cells
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  let d = 1;
  while (cells.length < 42) {
    cells.push({
      dateStr: `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      isCurrentMonth: false,
    });
    d++;
  }

  return cells;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AgendaCalendar({
  viewMonth,
  selectedDate,
  appointments,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: AgendaCalendarProps) {
  const [year, month] = viewMonth.split("-").map(Number);
  const todayStr = new Date().toISOString().split("T")[0];

  const cells = useMemo(() => buildCalendarGrid(year, month), [year, month]);

  // Build a map: dateStr → count of non-cancelled appointments
  const appointmentCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const appt of appointments) {
      if (appt.status === "cancelado") continue;
      map.set(appt.appointmentDate, (map.get(appt.appointmentDate) ?? 0) + 1);
    }
    return map;
  }, [appointments]);

  // Cancelled-only days (for subtle indicator)
  const cancelledOnlyDays = useMemo(() => {
    const cancelledMap = new Map<string, number>();
    for (const appt of appointments) {
      if (appt.status === "cancelado") {
        cancelledMap.set(appt.appointmentDate, (cancelledMap.get(appt.appointmentDate) ?? 0) + 1);
      }
    }
    const result = new Set<string>();
    for (const [dateStr, count] of cancelledMap) {
      if (!appointmentCounts.has(dateStr) && count > 0) {
        result.add(dateStr);
      }
    }
    return result;
  }, [appointments, appointmentCounts]);

  const monthLabel = `${PT_MONTHS[month - 1]} de ${year}`;

  return (
    <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden select-none">
      {/* ── Month Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-gradient-to-r from-amber-50/60 to-white">
        <button
          type="button"
          onClick={onPrevMonth}
          aria-label="Mês anterior"
          className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-amber-50 hover:text-[#C9A227] transition-colors border border-border/50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <h2 className="font-display font-extrabold text-base text-foreground capitalize tracking-tight">
          {monthLabel}
        </h2>

        <button
          type="button"
          onClick={onNextMonth}
          aria-label="Próximo mês"
          className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-amber-50 hover:text-[#C9A227] transition-colors border border-border/50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── Week day labels ──────────────────────────────────────── */}
      <div 
        className="grid border-b border-border/40"
        style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}
      >
        {WEEK_DAYS.map((d, i) => (
          <div
            key={i}
            className="py-2.5 text-center text-[11px] font-bold text-muted-foreground uppercase tracking-widest"
          >
            {d}
          </div>
        ))}
      </div>

      {/* ── Day grid ────────────────────────────────────────────── */}
      <div 
        className="grid gap-px bg-border/20 p-1.5"
        style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}
      >
        {cells.map(({ dateStr, isCurrentMonth }, idx) => {
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const activeCount = appointmentCounts.get(dateStr) ?? 0;
          const dayNum = parseInt(dateStr.split("-")[2], 10);

          let cellClass = "relative flex flex-col items-center justify-center rounded-xl p-1.5 border min-h-[52px] transition-all duration-150 cursor-pointer ";
          let textClass = "";

          if (isSelected) {
            // Dia selecionado tem prioridade absoluta
            cellClass += "bg-[#C9A227] border-[#C9A227] text-white font-bold shadow-sm hover:bg-[#A9821E] hover:text-white";
            textClass = "text-white";
          } else if (activeCount > 0) {
            // Dia com atendimento
            if (isCurrentMonth) {
              cellClass += "bg-[#FFF8E1] border-[#C9A227] text-[#8A6A16] font-semibold hover:bg-[#F7E7A6] hover:border-[#C9A227] hover:text-[#8A6A16]";
              textClass = "text-[#8A6A16]";
            } else {
              // Fora do mês com atendimento (visual mais apagado / borda discreta)
              cellClass += "bg-gray-50/50 border-[#C9A227]/40 text-gray-400 hover:bg-[#FFF8E1] hover:border-[#C9A227] hover:text-[#8A6A16] opacity-60";
              textClass = "text-gray-400";
            }
          } else if (isToday) {
            // Hoje sem atendimento
            cellClass += "bg-amber-50 border-[#C9A227]/40 ring-1 ring-[#C9A227]/30 text-[#C9A227] font-semibold hover:bg-[#FFF8E1] hover:border-[#C9A227] hover:text-[#8A6A16]";
            textClass = "text-[#C9A227]";
          } else if (!isCurrentMonth) {
            // Fora do mês normal
            cellClass += "bg-gray-50/20 border-transparent text-gray-400 hover:bg-[#FFF8E1] hover:border-[#C9A227] hover:text-[#8A6A16] opacity-35";
            textClass = "text-gray-400";
          } else {
            // Dia normal
            cellClass += "bg-white border-transparent text-gray-800 hover:bg-[#FFF8E1] hover:border-[#C9A227] hover:text-[#8A6A16]";
            textClass = "text-gray-800";
          }

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectDate(dateStr)}
              aria-label={`Selecionar dia ${dateStr}`}
              aria-current={isToday ? "date" : undefined}
              title={activeCount > 0 ? `${activeCount} atendimento(s)` : undefined}
              className={cellClass}
            >
              {/* Day number */}
              <span className={`text-[13px] leading-none ${textClass}`}>
                {dayNum}
              </span>

              {/* "Hoje" label for today */}
              {isToday && !isSelected && (
                <span className="absolute top-1 right-1 text-[8px] font-bold text-[#C9A227] leading-none uppercase tracking-wider">
                  hoje
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Legend ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4 px-5 py-3 border-t border-border/40 bg-gray-50/50">
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-md bg-[#FFF8E1] border border-[#C9A227] inline-block animate-pulse" />
          <span className="text-[11px] text-muted-foreground">Com atendimentos</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-md bg-[#C9A227] border border-[#C9A227] inline-block" />
          <span className="text-[11px] text-muted-foreground">Selecionado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-md bg-amber-50 ring-2 ring-[#C9A227]/30 inline-block" />
          <span className="text-[11px] text-muted-foreground">Hoje</span>
        </div>
      </div>
    </div>
  );
}
