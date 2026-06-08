import { useEffect, useState, useCallback, useSyncExternalStore } from "react";

const PREFIX = "oralit:";

export type Supply = {
  id: string;
  name: string;
  category: string;
  brand?: string;
  packCost: number;
  packYield: number;
  unit?: string;
  stock?: number;
  minStock?: number;
  note?: string;
};

export type FixedCost = {
  id: string;
  name: string;
  value: number;
};

export type Procedure = {
  id: string;
  name: string;
  category: string;
  defaultMinutes: number;
  labCost?: number;
  otherDirect?: number;
  note?: string;
  suggestedPrice?: number;
  suggestedPricePix?: number;
};

export type Settings = {
  marginPct: number; // %
  reservePct: number;
  taxPct: number;
  cardFeePct: number;
  daysPerMonth: number;
  hoursPerDay: number;
  rounding: number; // 0, 5, 10, 50, 100
};

export type PatientStatus = "ativo" | "em tratamento" | "retorno" | "inativo" | "finalizado";

export type Patient = {
  id: string;
  recordNumber?: string;
  fullName: string;
  cpf?: string;
  rg?: string;
  issuingAgency?: string;
  birthDate?: string; // YYYY-MM-DD
  gender?: string;
  maritalStatus?: string;
  profession?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  administrativeNotes?: string;
  status: PatientStatus;
  createdAt: string;
};

export type AnamnesisStatus = "rascunho" | "concluída" | "assinada";

export type Anamnesis = {
  id: string;
  patientId: string;
  mainComplaint?: string;
  medications?: string;
  allergies?: string;
  bloodPressure?: string;
  heartProblem?: boolean;
  diabetes?: boolean;
  bleedingProblem?: boolean;
  healingProblem?: boolean;
  previousSurgery?: boolean;
  pregnancy?: boolean;
  healthProblems?: string;
  anesthesiaReaction?: boolean;
  toothOrGumPain?: string;
  gumBleeding?: boolean;
  brushingFrequency?: string;
  flossUse?: string;
  smoker?: boolean;
  truthDeclaration?: boolean;
  signature?: string;
  status: AnamnesisStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type ToothStatusType = typeof TOOTH_STATUS[number];

export interface OdontogramEntry {
  id: string;
  userId: string;
  patientId?: string;
  toothNumber: string;
  toothRegion: string;
  status: string;
  color: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TreatmentPlan {
  id: string;
  userId: string;
  patientId: string;
  title: string;
  diagnosis?: string;
  notes?: string;
  status: 'planejado' | 'em andamento' | 'concluído' | 'pausado' | 'cancelado';
  startDate?: string;
  expectedEndDate?: string;
  createdAt: string;
  updatedAt: string;
  items?: TreatmentPlanItem[];
}

export interface TreatmentPlanItem {
  id: string;
  userId: string;
  treatmentPlanId: string;
  procedureId?: string;
  toothNumber?: string;
  toothRegion?: string;
  description?: string;
  priority: 'baixa' | 'média' | 'alta' | 'urgente';
  estimatedPrice?: number;
  status: 'planejado' | 'aprovado' | 'em execução' | 'concluído' | 'cancelado';
  createdAt: string;
  updatedAt: string;
  
  // Virtual field mapped for UI display if needed
  procedureName?: string;
}

export type AppointmentStatus = 'agendado' | 'confirmado' | 'em atendimento' | 'concluído' | 'faltou' | 'cancelado' | 'remarcado';

export type AppointmentType = 'consulta' | 'avaliação' | 'retorno' | 'procedimento' | 'emergência' | 'manutenção' | 'orçamento' | 'outro';

export interface Appointment {
  id: string;
  userId: string;
  patientId: string;
  procedureId?: string;
  treatmentPlanId?: string;
  title: string;
  appointmentDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  status: AppointmentStatus;
  type: AppointmentType;
  notes?: string;
  whatsappReminder: boolean;
  createdAt: string;
  updatedAt: string;
  
  // Virtual / joined fields for UI helper mapping:
  patientName?: string;
  patientPhone?: string;
  procedureName?: string;
  treatmentPlanTitle?: string;
}


export interface ClinicalRecordSupply {
  id: string;
  userId: string;
  clinicalRecordId: string;
  patientId: string;
  supplyId?: string;
  quantityUsed: number;
  unitCost: number;
  totalCost: number;
  createdAt: string;

  // Virtual field mapped for UI display
  supplyName?: string;
}

export interface ClinicalRecord {
  id: string;
  userId: string;
  patientId: string;
  procedureId?: string;
  recordDate: string;
  teeth?: string[];
  description?: string;
  notes?: string;
  chargedAmount: number;
  realCost: number;
  estimatedProfit: number;
  signature?: string;
  createdAt: string;
  updatedAt: string;

  // Virtual fields
  procedureName?: string;
  supplies?: ClinicalRecordSupply[];
}

// --- Financeiro ---
export interface Budget {
  id: string;
  userId: string;
  patientId: string;
  treatmentPlanId?: string;
  title?: string;
  totalAmount: number;
  discount: number;
  finalAmount: number;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'vencido' | 'cancelado';
  validUntil?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  
  // Virtual
  items?: BudgetItem[];
}

export interface BudgetItem {
  id: string;
  userId: string;
  budgetId: string;
  procedureId?: string;
  toothNumber?: string;
  toothRegion?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  createdAt: string;

  // Virtual
  procedureName?: string;
}

export interface PaymentInstallment {
  id: string;
  userId: string;
  patientId: string;
  budgetId: string;
  installmentNumber: number;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate?: string;
  status: 'pendente' | 'parcialmente pago' | 'pago' | 'atrasado' | 'cancelado' | 'renegociado';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  userId: string;
  patientId: string;
  budgetId?: string;
  installmentId?: string;
  amount: number;
  paymentMethod?: string;
  paymentDate?: string;
  cardFee: number;
  netAmount: number;
  notes?: string;
  attachmentUrl?: string;
  createdAt: string;

  // Virtual
  splits?: PaymentSplit[];
}

export interface PaymentSplit {
  id: string;
  userId: string;
  paymentId: string;
  paymentMethod: string;
  amount: number;
  createdAt: string;
}

export type PatientFileType = 'foto_clinica' | 'documento';

export interface PatientFile {
  id: string;
  userId: string;
  patientId?: string | null;
  fileName: string;
  filePath: string;
  fileSize: number;
  contentType: string;
  fileType: PatientFileType;
  category: string;
  status: string;
  notes?: string;
  // OCR fields
  ocrStatus?: string;
  extractedText?: string;
  ocrDestinationSuggestion?: string;
  isOcrProcessed?: boolean;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
  
  // Virtual for UI
  url?: string;
}

export const PHOTO_CATEGORIES = [
  "intraoral", "extraoral", "sorriso", "antes", "depois", 
  "radiografia", "procedimento", "evolução", "outro"
];

export const DOCUMENT_CATEGORIES = [
  "contrato", "termo", "exame", "radiografia", "receita", 
  "atestado", "orçamento", "comprovante", "documento pessoal", "outro"
];

export type FixedCostFrequency = "mensal" | "anual" | "bimestral" | "trimestral" | "semestral";

export type SupplyUsage = { supplyId: string; qty: number };
export type CustomCost = { name: string; value: number };

export type HistoryItem = {
  id: string;
  createdAt: number;
  procedureId: string;
  procedureName: string;
  minutes: number;
  labCost: number;
  otherDirect: number;
  supplies: SupplyUsage[];
  customCosts: CustomCost[];
  result: {
    suppliesCost: number;
    fixedProportional: number;
    realCost: number;
    targetPrice: number;
    pricePix: number;
    priceCard: number;
    estimatedProfit: number;
    netMargin: number;
  };
  settings: Settings;
};

export const DEFAULT_SETTINGS: Settings = {
  marginPct: 30,
  reservePct: 5,
  taxPct: 8,
  cardFeePct: 4.5,
  daysPerMonth: 22,
  hoursPerDay: 6,
  rounding: 5,
};

export const SUPPLY_CATEGORIES = [
  "Descartáveis","Anestesia","Dentística","Endodontia","Periodontia",
  "Cirurgia","Prótese","Ortodontia","Implantodontia","Radiologia",
  "Biossegurança","Laboratório","Outro"
];

export const PROCEDURE_CATEGORIES = [
  "Consulta","Profilaxia","Restauração","Clareamento","Endodontia",
  "Cirurgia","Periodontia","Prótese","Ortodontia","Implantodontia",
  "Radiologia","Outro"
];

export const PATIENT_STATUS: PatientStatus[] = [
  "ativo", "em tratamento", "retorno", "inativo", "finalizado"
];

export const PATIENT_GENDERS = ["Masculino", "Feminino", "Outro"];

export const PATIENT_MARITAL_STATUSES = ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "Separado(a)", "Outro"];

export const ANAMNESIS_STATUS: AnamnesisStatus[] = [
  "rascunho", "concluída", "assinada"
];

export const TOOTH_REGIONS = [
  "inteiro",
  "superior esquerdo",
  "superior direito",
  "inferior esquerdo",
  "inferior direito",
  "centro",
  "raiz/base",
];

export const TOOTH_STATUS = [
  "cárie",
  "restauração",
  "amálgama",
  "canal",
  "coroa",
  "implante",
  "dor",
  "ausente",
  "extração indicada",
  "extração realizada",
];

export const STATUS_COLORS: Record<string, string> = {
  "cárie": "#ef4444",
  "restauração": "#3b82f6",
  "amálgama": "#94a3b8",
  "canal": "#a855f7",
  "coroa": "#fbbf24",
  "implante": "#a16207",
  "dor": "#f97316",
  "ausente": "#cbd5e1",
  "extração indicada": "#991b1b",
  "extração realizada": "#1e293b",
};

const listeners = new Map<string, Set<() => void>>();

function emit(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
  emit(key);
}

export function usePersisted<T>(key: string, fallback: T): [T, (v: T | ((p: T) => T)) => void] {
  const subscribe = useCallback((cb: () => void) => {
    let set = listeners.get(key);
    if (!set) { set = new Set(); listeners.set(key, set); }
    set.add(cb);
    return () => { set!.delete(cb); };
  }, [key]);
  const getSnap = useCallback(() => {
    if (typeof window === "undefined") return JSON.stringify(fallback);
    return localStorage.getItem(PREFIX + key) ?? JSON.stringify(fallback);
  }, [key, fallback]);
  const raw = useSyncExternalStore(subscribe, getSnap, () => JSON.stringify(fallback));
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const value: T = hydrated ? (() => {
    try { return JSON.parse(raw) as T; } catch { return fallback; }
  })() : fallback;
  const setValue = useCallback((v: T | ((p: T) => T)) => {
    const next = typeof v === "function" ? (v as (p: T) => T)(value) : v;
    write(key, next);
  }, [key, value]);
  return [value, setValue];
}

// Legacy hooks removed. Use hooks from @/lib/db instead.

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function clearAll() {
  if (typeof window === "undefined") return;
  Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k));
  ["supplies","fixedCosts","procedures","settings","history","supplyCats","procCats"].forEach(emit);
}
