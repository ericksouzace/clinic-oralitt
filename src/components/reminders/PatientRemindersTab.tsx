import { useEffect, useMemo, useState } from "react";
import {
  AlarmClock,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Edit3,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  deletePatientReminder,
  savePatientReminder,
  usePatientReminders,
} from "@/lib/db";
import type {
  PatientReminder,
  ReminderPriority,
  ReminderStatus,
} from "@/lib/store";
import {
  Button,
  Card,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui-bits";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Filter =
  | "todos"
  | "hoje"
  | "semana"
  | "mes"
  | "vencidos";

interface Props {
  patientId: string;
}

function localToday() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset)
    .toISOString()
    .split("T")[0];
}

function toLocalDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function formatDate(value: string) {
  return toLocalDate(value).toLocaleDateString("pt-BR");
}

function addDays(value: string, days: number) {
  const date = toLocalDate(value);
  date.setDate(date.getDate() + days);

  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset)
    .toISOString()
    .split("T")[0];
}

function daysDifference(value: string) {
  const today = toLocalDate(localToday());
  const target = toLocalDate(value);

  return Math.round(
    (target.getTime() - today.getTime()) / 86_400_000,
  );
}

function statusLabel(reminder: PatientReminder) {
  if (reminder.status === "concluído") return "Concluído";
  if (reminder.status === "cancelado") return "Cancelado";
  if (reminder.status === "agendado") return "Agendado";

  const difference = daysDifference(reminder.reminderDate);

  if (difference < 0) {
    return `Vencido há ${Math.abs(difference)} ${
      Math.abs(difference) === 1 ? "dia" : "dias"
    }`;
  }

  if (difference === 0) return "Hoje";
  if (difference === 1) return "Amanhã";

  return `Em ${difference} dias`;
}

function statusTone(reminder: PatientReminder) {
  if (reminder.status === "concluído") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (reminder.status === "cancelado") {
    return "border-slate-200 bg-slate-50 text-slate-600";
  }

  if (reminder.status === "agendado") {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }

  const difference = daysDifference(reminder.reminderDate);

  if (difference < 0) {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  if (difference <= 7) {
    return "border-amber-300 bg-amber-50 text-amber-900";
  }

  if (difference <= 14) {
    return "border-yellow-200 bg-yellow-50 text-yellow-900";
  }

  return "border-border bg-white text-foreground";
}

const PRIORITIES: {
  value: ReminderPriority;
  label: string;
}[] = [
  { value: "baixa", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

const FILTERS: { value: Filter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "hoje", label: "Hoje" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" },
  { value: "vencidos", label: "Vencidos" },
];

export function PatientRemindersTab({ patientId }: Props) {
  const [reminders, loading, error, refetch] =
    usePatientReminders(patientId);

  const [filter, setFilter] = useState<Filter>("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] =
    useState<Partial<PatientReminder>>({});
  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const openNew = (
    clinicalRecordId?: string,
    title?: string,
  ) => {
    setDraft({
      id: undefined,
      patientId,
      clinicalRecordId,
      title: title || "",
      description: "",
      reminderDate: addDays(localToday(), 30),
      priority: "normal",
      status: "pendente",
      responsibleName: "",
      postponedCount: 0,
    });

    setModalOpen(true);
  };

  const openEdit = (reminder: PatientReminder) => {
    setDraft({ ...reminder });
    setModalOpen(true);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const parameters = new URLSearchParams(
      window.location.search,
    );

    const clinicalRecordId =
      parameters.get("clinicalRecordId") || undefined;

    const suggestedTitle =
      parameters.get("reminderTitle") || undefined;

    const createReminder =
      parameters.get("newReminder") === "true";

    if (!createReminder) return;

    openNew(clinicalRecordId, suggestedTitle);

    parameters.delete("newReminder");
    parameters.delete("clinicalRecordId");
    parameters.delete("reminderTitle");

    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${parameters.toString()}`,
    );
  }, []);

  const filtered = useMemo(() => {
    const today = localToday();
    const current = toLocalDate(today);

    const startWeek = new Date(current);
    const weekDay = startWeek.getDay();
    const distanceToMonday = weekDay === 0 ? -6 : 1 - weekDay;
    startWeek.setDate(startWeek.getDate() + distanceToMonday);

    const endWeek = new Date(startWeek);
    endWeek.setDate(endWeek.getDate() + 6);

    return [...reminders]
      .filter((reminder) => {
        const date = toLocalDate(reminder.reminderDate);

        if (filter === "hoje") {
          return reminder.reminderDate === today;
        }

        if (filter === "semana") {
          return date >= startWeek && date <= endWeek;
        }

        if (filter === "mes") {
          return (
            date.getMonth() === current.getMonth() &&
            date.getFullYear() === current.getFullYear()
          );
        }

        if (filter === "vencidos") {
          return (
            reminder.status === "pendente" &&
            reminder.reminderDate < today
          );
        }

        return true;
      })
      .sort((a, b) => {
        const statusWeight = (item: PatientReminder) => {
          if (
            item.status === "pendente" &&
            item.reminderDate < today
          ) {
            return 0;
          }

          if (item.status === "pendente") return 1;
          if (item.status === "agendado") return 2;
          if (item.status === "concluído") return 3;

          return 4;
        };

        const weightDifference =
          statusWeight(a) - statusWeight(b);

        if (weightDifference !== 0) {
          return weightDifference;
        }

        return a.reminderDate.localeCompare(b.reminderDate);
      });
  }, [reminders, filter]);

  const handleSave = async () => {
    if (!draft.title?.trim()) {
      toast.error("Informe o título do lembrete.");
      return;
    }

    if (!draft.reminderDate) {
      toast.error("Informe a data do lembrete.");
      return;
    }

    try {
      setSaving(true);

      await savePatientReminder({
        ...draft,
        patientId,
        title: draft.title,
        reminderDate: draft.reminderDate,
        priority:
          (draft.priority as ReminderPriority) || "normal",
        status:
          (draft.status as ReminderStatus) || "pendente",
      });

      toast.success(
        draft.id
          ? "Lembrete atualizado."
          : "Lembrete criado.",
      );

      setModalOpen(false);
      refetch();
    } catch (saveError: any) {
      toast.error(
        saveError?.message ||
          "Não foi possível salvar o lembrete.",
      );
    } finally {
      setSaving(false);
    }
  };

  const completeReminder = async (
    reminder: PatientReminder,
  ) => {
    try {
      await savePatientReminder({
        ...reminder,
        status: "concluído",
        completedAt: new Date().toISOString(),
        completionReason: "Concluído pela ficha do paciente",
      });

      toast.success("Lembrete concluído.");
      refetch();
    } catch (completeError: any) {
      toast.error(
        completeError?.message ||
          "Não foi possível concluir o lembrete.",
      );
    }
  };

  const postponeReminder = async (
    reminder: PatientReminder,
    days: number,
  ) => {
    try {
      await savePatientReminder({
        ...reminder,
        reminderDate: addDays(reminder.reminderDate, days),
        status: "pendente",
        postponedCount:
          Number(reminder.postponedCount || 0) + 1,
      });

      toast.success(`Lembrete adiado por ${days} dias.`);
      refetch();
    } catch (postponeError: any) {
      toast.error(
        postponeError?.message ||
          "Não foi possível adiar o lembrete.",
      );
    }
  };

  const removeReminder = async (
    reminder: PatientReminder,
  ) => {
    if (
      !window.confirm(
        `Excluir o lembrete "${reminder.title}"?`,
      )
    ) {
      return;
    }

    try {
      setDeletingId(reminder.id);
      await deletePatientReminder(reminder.id);
      toast.success("Lembrete excluído.");
      refetch();
    } catch (deleteError: any) {
      toast.error(
        deleteError?.message ||
          "Não foi possível excluir o lembrete.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Carregando lembretes...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <AlarmClock className="h-5 w-5 text-[#C9A227]" />
            <h2 className="font-display text-lg font-bold text-foreground">
              Lembretes do paciente
            </h2>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Organize retornos, avaliações e acompanhamentos
            clínicos.
          </p>
        </div>

        <Button
          type="button"
          className="bg-[#C9A227] font-semibold text-white hover:bg-[#b59122]"
          onClick={() => openNew()}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo lembrete
        </Button>
      </div>

      <Card className="border border-border bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
                filter === item.value
                  ? "border-[#C9A227] bg-[#fff8df] text-[#8A6A16]"
                  : "border-border bg-white text-muted-foreground hover:bg-secondary"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="border-2 border-dashed border-border bg-secondary/20 py-14 text-center">
          <CalendarClock className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <h3 className="mt-3 font-semibold text-foreground">
            Nenhum lembrete encontrado
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie um lembrete para acompanhar o retorno deste
            paciente.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((reminder) => (
            <Card
              key={reminder.id}
              className={`border p-4 ${statusTone(reminder)}`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">
                      {reminder.title}
                    </h3>

                    <span className="rounded-full border border-current/20 bg-white/60 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide">
                      {statusLabel(reminder)}
                    </span>

                    <span className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-bold uppercase">
                      {reminder.priority}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-medium opacity-80">
                    <span className="flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {formatDate(reminder.reminderDate)}
                    </span>

                    {reminder.responsibleName && (
                      <span>
                        Responsável: {reminder.responsibleName}
                      </span>
                    )}
                  </div>

                  {reminder.clinicalRecordDescription && (
                    <p className="mt-2 text-xs font-semibold opacity-80">
                      Origem:{" "}
                      {reminder.clinicalRecordDescription}
                    </p>
                  )}

                  {reminder.description && (
                    <p className="mt-2 text-sm leading-relaxed opacity-85">
                      {reminder.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {reminder.status !== "concluído" &&
                    reminder.status !== "cancelado" && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void postponeReminder(reminder, 7)
                          }
                          title="Adiar por 7 dias"
                        >
                          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                          +7 dias
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void completeReminder(reminder)
                          }
                        >
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                          Concluir
                        </Button>
                      </>
                    )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(reminder)}
                    title="Editar lembrete"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    disabled={deletingId === reminder.id}
                    onClick={() =>
                      void removeReminder(reminder)
                    }
                    title="Excluir lembrete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {draft.id
                ? "Editar lembrete"
                : "Novo lembrete"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div>
              <Label>Título *</Label>
              <Input
                value={draft.title || ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Ex.: Avaliar cicatrização"
                autoFocus
              />
            </div>

            <div>
              <Label>Data prevista *</Label>
              <Input
                type="date"
                value={draft.reminderDate || ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    reminderDate: event.target.value,
                  }))
                }
              />

              <div className="mt-2 flex flex-wrap gap-2">
                {[7, 15, 30, 90, 180].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        reminderDate: addDays(
                          localToday(),
                          days,
                        ),
                      }))
                    }
                    className="rounded-md border border-border bg-white px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition hover:border-[#C9A227] hover:text-[#8A6A16]"
                  >
                    {days < 90
                      ? `${days} dias`
                      : `${Math.round(days / 30)} meses`}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prioridade</Label>
                <Select
                  value={draft.priority || "normal"}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      priority: event.target
                        .value as ReminderPriority,
                    }))
                  }
                >
                  {PRIORITIES.map((priority) => (
                    <option
                      key={priority.value}
                      value={priority.value}
                    >
                      {priority.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label>Status</Label>
                <Select
                  value={draft.status || "pendente"}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      status: event.target
                        .value as ReminderStatus,
                    }))
                  }
                >
                  <option value="pendente">Pendente</option>
                  <option value="agendado">Agendado</option>
                  <option value="concluído">Concluído</option>
                  <option value="cancelado">Cancelado</option>
                </Select>
              </div>
            </div>

            <div>
              <Label>Responsável</Label>
              <Input
                value={draft.responsibleName || ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    responsibleName: event.target.value,
                  }))
                }
                placeholder="Ex.: Recepção ou Dra. Ana"
              />
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                rows={4}
                value={draft.description || ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Detalhes do retorno ou acompanhamento..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              className="bg-[#C9A227] font-semibold text-white hover:bg-[#b59122]"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              <Clock3 className="mr-2 h-4 w-4" />
              {saving ? "Salvando..." : "Salvar lembrete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
