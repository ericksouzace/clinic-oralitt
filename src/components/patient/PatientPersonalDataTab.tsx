import { useEffect, useState } from "react";
import { Check, Edit3, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui-bits";
import { PATIENT_GENDERS, PATIENT_MARITAL_STATUSES, type Patient } from "@/lib/store";

interface PatientPersonalDataTabProps {
  patient: Patient;
  onSave: (patient: Patient) => Promise<void>;
}

function formatCpf(value: string) {
  let digits = value.replace(/\D/g, "").slice(0, 11);
  digits = digits.replace(/(\d{3})(\d)/, "$1.$2");
  digits = digits.replace(/(\d{3})(\d)/, "$1.$2");
  return digits.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length > 10) return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (digits.length > 6) return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  if (digits.length > 2) return digits.replace(/(\d{2})(\d{0,5})/, "($1) $2");
  return digits;
}

export function PatientPersonalDataTab({ patient, onSave }: PatientPersonalDataTabProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Patient>({ ...patient });

  useEffect(() => {
    if (!editing) setDraft({ ...patient });
  }, [patient, editing]);

  const update = <K extends keyof Patient>(key: K, value: Patient[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const cancel = () => {
    setDraft({ ...patient });
    setEditing(false);
  };

  const save = async () => {
    if (!draft.fullName.trim()) {
      toast.error("O nome completo é obrigatório.");
      return;
    }

    try {
      setSaving(true);
      await onSave({ ...draft, fullName: draft.fullName.trim() });
      toast.success("Dados pessoais atualizados.");
      setEditing(false);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível salvar os dados pessoais.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="overflow-hidden border border-border bg-white p-0">
      <div className="flex flex-col gap-3 border-b border-border bg-secondary/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">Informações cadastrais</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Consulte e altere os dados diretamente nesta ficha.
          </p>
        </div>

        {!editing ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Edit3 className="mr-2 h-3.5 w-3.5" /> Editar dados
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={cancel} disabled={saving}>
              <RotateCcw className="mr-2 h-3.5 w-3.5" /> Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-[#C9A227] font-semibold text-white hover:bg-[#b59122]"
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? (
                <Check className="mr-2 h-3.5 w-3.5 animate-pulse" />
              ) : (
                <Save className="mr-2 h-3.5 w-3.5" />
              )}
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-7 p-5 sm:p-6">
        <section>
          <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[#8A6A16]">
            Identificação
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-2">
              <Label>Nome completo</Label>
              <Input
                value={draft.fullName}
                onChange={(event) => update("fullName", event.target.value)}
                disabled={!editing}
              />
            </div>
            <div>
              <Label>Nº do prontuário</Label>
              <Input
                value={draft.recordNumber || ""}
                onChange={(event) => update("recordNumber", event.target.value)}
                disabled={!editing}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Label>Referência</Label>
              <Input
                value={draft.referenceNote || ""}
                onChange={(event) => update("referenceNote", event.target.value)}
                placeholder="Ex.: indicação da Maria, irmão do João..."
                disabled={!editing}
              />
            </div>
            <div>
              <Label>Data de nascimento</Label>
              <Input
                type="date"
                value={draft.birthDate || ""}
                onChange={(event) => update("birthDate", event.target.value)}
                disabled={!editing}
              />
            </div>
            <div>
              <Label>Sexo</Label>
              <Select
                value={draft.gender || ""}
                onChange={(event) => update("gender", event.target.value)}
                disabled={!editing}
              >
                <option value="">Não informado</option>
                {PATIENT_GENDERS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Estado civil</Label>
              <Select
                value={draft.maritalStatus || ""}
                onChange={(event) => update("maritalStatus", event.target.value)}
                disabled={!editing}
              >
                <option value="">Não informado</option>
                {PATIENT_MARITAL_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Label>Profissão</Label>
              <Input
                value={draft.profession || ""}
                onChange={(event) => update("profession", event.target.value)}
                disabled={!editing}
              />
            </div>
          </div>
        </section>

        <section className="border-t border-border pt-6">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[#8A6A16]">
            Documentos
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label>CPF</Label>
              <Input
                value={draft.cpf || ""}
                onChange={(event) => update("cpf", formatCpf(event.target.value))}
                disabled={!editing}
              />
            </div>
            <div>
              <Label>RG</Label>
              <Input
                value={draft.rg || ""}
                onChange={(event) => update("rg", event.target.value)}
                disabled={!editing}
              />
            </div>
            <div>
              <Label>Órgão expedidor</Label>
              <Input
                value={draft.issuingAgency || ""}
                onChange={(event) => update("issuingAgency", event.target.value.toUpperCase())}
                disabled={!editing}
              />
            </div>
          </div>
        </section>

        <section className="border-t border-border pt-6">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[#8A6A16]">
            Contato
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Telefone</Label>
              <Input
                value={draft.phone || ""}
                onChange={(event) => update("phone", formatPhone(event.target.value))}
                disabled={!editing}
              />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input
                value={draft.whatsapp || ""}
                onChange={(event) => update("whatsapp", formatPhone(event.target.value))}
                disabled={!editing}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Endereço completo</Label>
              <Input
                value={draft.address || ""}
                onChange={(event) => update("address", event.target.value)}
                disabled={!editing}
              />
            </div>
          </div>
        </section>

        <section className="border-t border-border pt-6">
          <Label>Observações</Label>
          <Textarea
            rows={4}
            value={draft.administrativeNotes || ""}
            onChange={(event) => update("administrativeNotes", event.target.value)}
            placeholder="Observações administrativas sobre o paciente"
            disabled={!editing}
          />
        </section>
      </div>
    </Card>
  );
}
