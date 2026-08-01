import { useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ChevronRight,
  HeartPulse,
  ShieldCheck,
} from "lucide-react";
import { useAnamneses } from "@/lib/db";
import type { Anamnesis } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PatientComorbiditiesProps {
  patientId: string;
  mode?: "button" | "panel";
}

interface ComorbidityItem {
  label: string;
  value?: string;
}

function normalizeText(value?: string | null) {
  return String(value || "").trim();
}

function isRelevantText(value?: string | null) {
  const normalized = normalizeText(value).toLocaleLowerCase("pt-BR");

  if (!normalized) return false;

  return ![
    "não",
    "nao",
    "nenhum",
    "nenhuma",
    "não possui",
    "nao possui",
    "não informado",
    "nao informado",
    "normal",
    "sem alterações",
    "sem alteracoes",
  ].includes(normalized);
}

function extractComorbidities(anamnesis?: Anamnesis): ComorbidityItem[] {
  if (!anamnesis) return [];

  const items: ComorbidityItem[] = [];

  if (anamnesis.diabetes === true) {
    items.push({ label: "Diabetes" });
  }

  if (anamnesis.heartProblem === true) {
    items.push({ label: "Problema cardíaco" });
  }

  if (anamnesis.bleedingProblem === true) {
    items.push({ label: "Problema de sangramento" });
  }

  if (anamnesis.healingProblem === true) {
    items.push({ label: "Problema de cicatrização" });
  }

  if (anamnesis.anesthesiaReaction === true) {
    items.push({ label: "Reação à anestesia" });
  }

  if (anamnesis.previousSurgery === true) {
    items.push({ label: "Cirurgia recente ou anterior relevante" });
  }

  if (anamnesis.pregnancy === true) {
    items.push({ label: "Gestação" });
  }

  if (isRelevantText(anamnesis.bloodPressure)) {
    items.push({
      label: "Pressão arterial",
      value: normalizeText(anamnesis.bloodPressure),
    });
  }

  if (isRelevantText(anamnesis.allergies)) {
    items.push({
      label: "Alergias",
      value: normalizeText(anamnesis.allergies),
    });
  }

  if (isRelevantText(anamnesis.medications)) {
    items.push({
      label: "Medicamentos em uso",
      value: normalizeText(anamnesis.medications),
    });
  }

  if (isRelevantText(anamnesis.healthProblems)) {
    items.push({
      label: "Outros problemas de saúde",
      value: normalizeText(anamnesis.healthProblems),
    });
  }

  return items;
}

function ComorbiditiesList({
  items,
}: {
  items: ComorbidityItem[];
}) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          className="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A227]" />

            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground">
                {item.label}
              </div>

              {item.value && (
                <div className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                  {item.value}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PatientComorbidities({
  patientId,
  mode = "button",
}: PatientComorbiditiesProps) {
  const [anamneses, , loading] = useAnamneses(patientId);
  const [open, setOpen] = useState(false);

  const latestAnamnesis = useMemo(
    () =>
      [...anamneses].sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime(),
      )[0],
    [anamneses],
  );

  const items = useMemo(
    () => extractComorbidities(latestAnamnesis),
    [latestAnamnesis],
  );

  if (mode === "panel") {
    if (loading) {
      return (
        <div className="rounded-xl border border-border bg-white p-8 text-center text-sm text-muted-foreground">
          Carregando comorbidades...
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-8 text-center">
          <ShieldCheck className="mx-auto h-9 w-9 text-emerald-600" />

          <h3 className="mt-3 text-sm font-bold text-emerald-900">
            Nenhuma comorbidade informada
          </h3>

          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-emerald-700">
            A anamnese mais recente deste paciente não possui comorbidades,
            alergias, medicamentos ou condições clínicas relevantes registradas.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-white p-5">
          <div className="flex items-start gap-3">
            <HeartPulse className="mt-0.5 h-5 w-5 text-[#C9A227]" />

            <div>
              <h3 className="font-display text-base font-bold text-foreground">
                Comorbidades informadas
              </h3>

              <p className="mt-1 text-xs text-muted-foreground">
                Resumo automático da anamnese mais recente do paciente.
              </p>
            </div>
          </div>
        </div>

        <ComorbiditiesList items={items} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
        Verificando comorbidades...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">
        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />

        <span className="text-xs font-semibold text-emerald-700">
          Nenhuma comorbidade informada
        </span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-left transition hover:border-[#C9A227] hover:bg-amber-50"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Activity className="h-4 w-4 shrink-0 text-[#C9A227]" />

          <div className="min-w-0">
            <div className="text-xs font-bold text-[#8A6A16]">
              Comorbidades
            </div>

            <div className="truncate text-[11px] text-amber-800/80">
              {items.length} {items.length === 1 ? "identificada" : "identificadas"}
            </div>
          </div>
        </div>

        <ChevronRight className="h-4 w-4 shrink-0 text-[#8A6A16]" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-[#C9A227]" />
              Comorbidades do paciente
            </DialogTitle>
          </DialogHeader>

          <div className="py-3">
            <ComorbiditiesList items={items} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
