import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDollarSign,
  Plus,
  ReceiptText,
  Trash2,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Input, Label, Select } from "@/components/ui-bits";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deletePayment, savePayment, useClinicalRecords, usePatients, usePayments } from "@/lib/db";
import type { ClinicalRecord, Payment } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";

type Movement =
  | {
      id: string;
      type: "procedure";
      date: string;
      createdAt: string;
      title: string;
      teeth: string;
      amount: number;
      record: ClinicalRecord;
    }
  | {
      id: string;
      type: "payment";
      date: string;
      createdAt: string;
      title: string;
      teeth: string;
      amount: number;
      payment: Payment;
    };

const PAYMENT_METHODS = [
  "Pix",
  "Dinheiro",
  "Cartão de débito",
  "Cartão de crédito",
  "Transferência",
  "Boleto",
  "Outro",
];

function today() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(value?: string) {
  if (!value) return "—";
  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  return new Date(normalized).toLocaleDateString("pt-BR");
}

function paymentMethodLabel(value?: string) {
  return value?.trim() || "Pagamento";
}

export function FinanceTab({ patientId }: { patientId: string }) {
  const [clinicalRecords, clinicalError, clinicalLoading, tablesMissing] =
    useClinicalRecords(patientId);
  const [payments, paymentsLoading, refetchPayments] = usePayments(patientId);
  const [patients, setPatients] = usePatients();
  const patient = patients.find((item) => item.id === patientId);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentMethod, setPaymentMethod] = useState("Pix");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [invoicePreference, setInvoicePreference] = useState<boolean | null>(null);

  useEffect(() => {
    setInvoicePreference(patient?.invoicePreference ?? null);
  }, [patient?.invoicePreference]);

  const totalPerformed = useMemo(
    () => clinicalRecords.reduce((sum, record) => sum + Number(record.chargedAmount || 0), 0),
    [clinicalRecords],
  );

  const totalReceived = useMemo(
    () => payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [payments],
  );

  const balance = totalReceived - totalPerformed;

  const movements = useMemo<Movement[]>(() => {
    const procedureMovements: Movement[] = clinicalRecords.map((record) => ({
      id: `procedure-${record.id}`,
      type: "procedure",
      date: record.recordDate,
      createdAt: record.createdAt,
      title: record.description || record.procedureName || "Procedimento realizado",
      teeth: record.teeth && record.teeth.length > 0 ? record.teeth.join(", ") : "—",
      amount: Number(record.chargedAmount || 0),
      record,
    }));

    const paymentMovements: Movement[] = payments.map((payment) => ({
      id: `payment-${payment.id}`,
      type: "payment",
      date: payment.paymentDate || payment.createdAt,
      createdAt: payment.createdAt,
      title: `Pagamento · ${paymentMethodLabel(payment.paymentMethod)}`,
      teeth: "—",
      amount: Number(payment.amount || 0),
      payment,
    }));

    return [...procedureMovements, ...paymentMovements].sort((a, b) => {
      const dateCompare = String(b.date || "").localeCompare(String(a.date || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
  }, [clinicalRecords, payments]);

  const openPaymentModal = () => {
    setPaymentDate(today());
    setPaymentMethod("Pix");
    setPaymentAmount("");
    setPaymentModalOpen(true);
  };

  const handleSavePayment = async () => {
    const amount = Number(paymentAmount.replace(",", "."));
    if (!paymentDate) {
      toast.error("Informe a data do pagamento.");
      return;
    }
    if (!paymentMethod) {
      toast.error("Informe a forma de pagamento.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Informe um valor de pagamento maior que zero.");
      return;
    }

    try {
      setSavingPayment(true);
      await savePayment(
        {
          id: `temp-${crypto.randomUUID()}`,
          patientId,
          amount,
          paymentMethod,
          paymentDate,
          cardFee: 0,
          netAmount: amount,
          notes: undefined,
        },
        [],
      );
      toast.success("Pagamento adicionado ao extrato.");
      setPaymentModalOpen(false);
      refetchPayments();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível registrar o pagamento.");
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDeletePayment = async (payment: Payment) => {
    if (!window.confirm("Excluir este pagamento do extrato?")) return;

    try {
      setDeletingPaymentId(payment.id);
      await deletePayment(payment);
      toast.success("Pagamento removido.");
      refetchPayments();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível excluir o pagamento.");
    } finally {
      setDeletingPaymentId(null);
    }
  };

  const handleInvoicePreference = async (value: boolean) => {
    if (!patient || invoiceBusy || invoicePreference === value) return;
    const previous = invoicePreference;
    setInvoicePreference(value);

    try {
      setInvoiceBusy(true);
      await setPatients((current) =>
        current.map((item) =>
          item.id === patientId ? { ...item, invoicePreference: value } : item,
        ),
      );
      toast.success(`Nota fiscal: ${value ? "Sim" : "Não"}.`);
    } catch (error: any) {
      setInvoicePreference(previous);
      toast.error(error?.message || "Não foi possível salvar a opção de nota fiscal.");
    } finally {
      setInvoiceBusy(false);
    }
  };

  if (clinicalLoading || paymentsLoading) {
    return (
      <div className="py-10 text-center text-sm font-medium text-muted-foreground">
        Carregando financeiro...
      </div>
    );
  }

  if (tablesMissing) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
        Estrutura financeira indisponível no Supabase.
      </div>
    );
  }

  if (clinicalError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
        {clinicalError}
      </div>
    );
  }

  const balanceTone =
    balance > 0.009
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : balance < -0.009
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-slate-200 bg-slate-50 text-slate-700";

  const balanceHint =
    balance > 0.009
      ? "Crédito disponível do paciente"
      : balance < -0.009
        ? "Valor pendente do paciente"
        : "Saldo zerado";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <WalletCards className="h-5 w-5 text-[#C9A227]" />
            <h2 className="font-display text-lg font-bold text-foreground">
              Procedimentos realizados
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Extrato com procedimentos executados e pagamentos recebidos.
          </p>
        </div>

        <Button
          type="button"
          className="bg-[#C9A227] font-semibold text-white hover:bg-[#b59122]"
          onClick={openPaymentModal}
        >
          <Plus className="mr-2 h-4 w-4" /> Adicionar pagamento
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border border-border bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-[#C9A227]" /> Procedimentos
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            {formatCurrency(totalPerformed)}
          </div>
        </Card>
        <Card className="border border-border bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <CircleDollarSign className="h-4 w-4 text-emerald-600" /> Pagamentos
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-700">
            {formatCurrency(totalReceived)}
          </div>
        </Card>
        <Card className={`border p-4 ${balanceTone}`}>
          <div className="text-xs font-bold uppercase tracking-wide">Saldo atual</div>
          <div className="mt-2 text-xl font-extrabold">{formatCurrency(balance)}</div>
          <div className="mt-1 text-[11px] font-medium opacity-80">{balanceHint}</div>
        </Card>
      </div>

      <Card className="overflow-hidden border border-border bg-white p-0">
        <div className="flex flex-col gap-3 border-b border-border bg-[#fcfbf8] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">
            Pagamentos aumentam o saldo. Procedimentos realizados reduzem o saldo.
          </div>

          <div className="flex items-center gap-2 sm:ml-auto">
            <div className="mr-1 flex items-center gap-1.5 text-xs font-bold text-foreground">
              <ReceiptText className="h-4 w-4 text-[#C9A227]" /> Nota fiscal
            </div>
            <button
              type="button"
              disabled={invoiceBusy || !patient}
              onClick={() => void handleInvoicePreference(true)}
              className={`h-8 rounded-lg border px-3 text-xs font-bold transition ${
                invoicePreference === true
                  ? "border-emerald-500 bg-emerald-600 text-white"
                  : "border-border bg-white text-muted-foreground hover:border-emerald-300"
              }`}
            >
              Sim
            </button>
            <button
              type="button"
              disabled={invoiceBusy || !patient}
              onClick={() => void handleInvoicePreference(false)}
              className={`h-8 rounded-lg border px-3 text-xs font-bold transition ${
                invoicePreference === false
                  ? "border-slate-500 bg-slate-700 text-white"
                  : "border-border bg-white text-muted-foreground hover:border-slate-300"
              }`}
            >
              Não
            </button>
            {invoicePreference === null && (
              <span className="hidden text-[11px] font-semibold text-amber-700 lg:inline">
                Selecione
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[130px_minmax(280px,1fr)_150px_160px_48px] items-center gap-3 border-b border-border bg-secondary/30 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Data</span>
              <span>Movimento</span>
              <span>Dentes</span>
              <span className="text-right">Valor</span>
              <span />
            </div>

            {movements.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                Nenhum procedimento ou pagamento registrado.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {movements.map((movement) => (
                  <div
                    key={movement.id}
                    className={`grid grid-cols-[130px_minmax(280px,1fr)_150px_160px_48px] items-center gap-3 px-4 py-3 ${
                      movement.type === "payment" ? "bg-emerald-50/35" : "bg-white"
                    }`}
                  >
                    <span className="text-sm font-medium text-foreground">
                      {formatDate(movement.date)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            movement.type === "payment"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-[#fff4cf] text-[#8A6A16]"
                          }`}
                        >
                          {movement.type === "payment" ? "Pagamento" : "Procedimento"}
                        </span>
                        <span className="truncate text-sm font-semibold text-foreground">
                          {movement.title}
                        </span>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">{movement.teeth}</span>
                    <span
                      className={`text-right text-sm font-bold ${
                        movement.type === "payment" ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {movement.type === "payment" ? "+ " : movement.amount > 0 ? "− " : ""}
                      {formatCurrency(movement.amount)}
                    </span>
                    <div className="flex justify-end">
                      {movement.type === "payment" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          disabled={deletingPaymentId === movement.payment.id}
                          onClick={() => void handleDeletePayment(movement.payment)}
                          title="Excluir pagamento"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={`flex items-center justify-between border-t px-4 py-4 ${balanceTone}`}>
              <div>
                <div className="text-sm font-bold">Saldo</div>
                <div className="mt-0.5 text-[11px] font-medium opacity-75">{balanceHint}</div>
              </div>
              <span className="text-xl font-extrabold">{formatCurrency(balance)}</span>
            </div>
          </div>
        </div>
      </Card>

      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar pagamento</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
              />
            </div>

            <div>
              <Label>Forma de pagamento</Label>
              <Select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label>Valor</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  placeholder="0,00"
                  className="pl-10"
                  autoFocus
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPaymentModalOpen(false)}
              disabled={savingPayment}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-[#C9A227] font-semibold text-white hover:bg-[#b59122]"
              onClick={() => void handleSavePayment()}
              disabled={savingPayment}
            >
              {savingPayment ? "Salvando..." : "Adicionar pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
