import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type {
  Supply, FixedCost, Procedure, Settings, HistoryItem, Patient, PatientStatus, 
  Anamnesis, AnamnesisStatus, OdontogramEntry, Appointment
} from "@/lib/store";
import { DEFAULT_SETTINGS } from "@/lib/store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function strOrNull(s: string | null | undefined): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  return trimmed === "" ? null : trimmed;
}

function logSupabaseError(context: string, error: any) {
  if (!error) return;
  console.error(`[${context}] error message:`, error.message);
  console.error(`[${context}] error details:`, error.details);
  console.error(`[${context}] error hint:`, error.hint);
  console.error(`[${context}] error code:`, error.code);
}

export async function getCurrentUserOrThrow() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    toast.error("Você precisa estar logado para realizar esta ação.");
    throw new Error("Not authenticated");
  }
  return user;
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

// ---------------------------------------------------------------------------
// Supplies
// ---------------------------------------------------------------------------

type DbSupply = {
  id: string;
  user_id: string;
  name: string;
  category: string;
  brand: string | null;
  supplier: string | null;
  package_cost: number;
  yield_quantity: number;
  unit: string | null;
  stock_quantity: number | null;
  minimum_stock: number | null;
  expiration_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function dbToSupply(r: DbSupply): Supply {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    brand: r.brand ?? "",
    packCost: r.package_cost,
    packYield: r.yield_quantity,
    unit: r.unit ?? "",
    stock: r.stock_quantity ?? 0,
    minStock: r.minimum_stock ?? 0,
    note: r.notes ?? "",
  };
}

function supplyToDb(s: Omit<Supply, "id">, userId: string) {
  return {
    user_id: userId,
    name: strOrNull(s.name) ?? "Sem nome",
    category: strOrNull(s.category) ?? "Geral",
    brand: strOrNull(s.brand),
    supplier: null,
    package_cost: Number(s.packCost || 0),
    yield_quantity: Number(s.packYield || 1),
    unit: strOrNull(s.unit),
    stock_quantity: s.stock != null ? Number(s.stock) : null,
    minimum_stock: s.minStock != null ? Number(s.minStock) : null,
    expiration_date: null,
    notes: strOrNull(s.note),
  };
}

export function useSupplies(): [Supply[], (v: Supply[] | ((p: Supply[]) => Supply[])) => Promise<void>, boolean] {
  const [items, setItems] = useState<Supply[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("supplies")
        .select("*")
        .eq("user_id", user.id)
        .order("name");
      if (error) {
        logSupabaseError("supplies load", error);
        throw error;
      }
      if (data) setItems((data as DbSupply[]).map(dbToSupply));
    } catch (e: any) {
      // already logged
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setter = useCallback(async (v: Supply[] | ((p: Supply[]) => Supply[])) => {
    try {
      setLoading(true);
      const user = await getCurrentUserOrThrow();
      const next = typeof v === "function" ? v(items) : v;

      const currentIds = new Set(items.map(i => i.id));
      const nextIds = new Set(next.map(i => i.id));

      for (const id of currentIds) {
        if (!nextIds.has(id)) {
          const { error } = await supabase.from("supplies").delete().eq("id", id).eq("user_id", user.id);
          if (error) { logSupabaseError("supplies delete", error); throw error; }
        }
      }

      for (const item of next) {
        if (!currentIds.has(item.id)) {
          const { data, error } = await supabase.from("supplies")
            .insert({ ...supplyToDb(item, user.id) })
            .select().single();
          if (error) { logSupabaseError("supplies insert", error); throw error; }
          item.id = (data as DbSupply).id;
        }
      }

      for (const item of next) {
        if (currentIds.has(item.id)) {
          const orig = items.find(x => x.id === item.id);
          if (JSON.stringify(orig) !== JSON.stringify(item)) {
            const { error } = await supabase.from("supplies")
              .update(supplyToDb(item, user.id))
              .eq("id", item.id).eq("user_id", user.id);
            if (error) { logSupabaseError("supplies update", error); throw error; }
          }
        }
      }
      setItems([...next]);
    } catch (e: any) {
      toast.error("Erro ao sincronizar insumos com o Supabase.");
    } finally {
      setLoading(false);
    }
  }, [items]);

  return [items, setter, loading];
}

// ---------------------------------------------------------------------------
// Fixed Costs
// ---------------------------------------------------------------------------

type DbFixedCost = {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function dbToFixedCost(r: DbFixedCost): FixedCost {
  return { id: r.id, name: r.name, value: r.amount };
}

function fixedCostToDb(c: Omit<FixedCost, "id">, userId: string) {
  return {
    user_id: userId,
    name: strOrNull(c.name) ?? "Sem nome",
    category: null,
    amount: Number(c.value || 0),
    notes: null
  };
}

export function useFixedCosts(): [FixedCost[], (v: FixedCost[] | ((p: FixedCost[]) => FixedCost[])) => Promise<void>, boolean] {
  const [items, setItems] = useState<FixedCost[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("fixed_costs")
        .select("*")
        .eq("user_id", user.id)
        .order("name");
      if (error) { logSupabaseError("fixed_costs load", error); throw error; }
      if (data) setItems((data as DbFixedCost[]).map(dbToFixedCost));
    } catch (e: any) {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setter = useCallback(async (v: FixedCost[] | ((p: FixedCost[]) => FixedCost[])) => {
    try {
      setLoading(true);
      const user = await getCurrentUserOrThrow();
      const next = typeof v === "function" ? v(items) : v;

      const currentIds = new Set(items.map(i => i.id));
      const nextIds = new Set(next.map(i => i.id));

      for (const id of currentIds) {
        if (!nextIds.has(id)) {
          const { error } = await supabase.from("fixed_costs").delete().eq("id", id).eq("user_id", user.id);
          if (error) { logSupabaseError("fixed_costs delete", error); throw error; }
        }
      }

      for (const item of next) {
        if (!currentIds.has(item.id)) {
          const { data, error } = await supabase.from("fixed_costs")
            .insert(fixedCostToDb(item, user.id))
            .select().single();
          if (error) { logSupabaseError("fixed_costs insert", error); throw error; }
          item.id = (data as DbFixedCost).id;
        }
      }

      for (const item of next) {
        if (currentIds.has(item.id)) {
          const orig = items.find(x => x.id === item.id);
          if (JSON.stringify(orig) !== JSON.stringify(item)) {
            const { error } = await supabase.from("fixed_costs")
              .update(fixedCostToDb(item, user.id))
              .eq("id", item.id).eq("user_id", user.id);
            if (error) { logSupabaseError("fixed_costs update", error); throw error; }
          }
        }
      }
      setItems([...next]);
    } catch (e: any) {
      toast.error("Erro ao sincronizar custos fixos.");
    } finally {
      setLoading(false);
    }
  }, [items]);

  return [items, setter, loading];
}

// ---------------------------------------------------------------------------
// Procedures
// ---------------------------------------------------------------------------

type DbProcedure = {
  id: string;
  user_id: string;
  name: string;
  category: string;
  default_time_minutes: number;
  lab_cost: number | null;
  other_direct_costs: number | null;
  desired_margin: number | null;
  suggested_price: number | null;
  notes: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
};

function dbToProcedure(r: DbProcedure): Procedure {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    defaultMinutes: r.default_time_minutes,
    labCost: r.lab_cost ?? 0,
    otherDirect: r.other_direct_costs ?? 0,
    note: r.notes ?? "",
    suggestedPrice: r.suggested_price ?? 0,
    suggestedPricePix: r.suggested_price ?? 0,
  };
}

function procedureToDb(p: Omit<Procedure, "id">, userId: string) {
  return {
    user_id: userId,
    name: strOrNull(p.name) ?? "Sem nome",
    category: strOrNull(p.category) ?? "Geral",
    default_time_minutes: Number(p.defaultMinutes || 30),
    lab_cost: Number(p.labCost || 0),
    other_direct_costs: Number(p.otherDirect || 0),
    desired_margin: null,
    suggested_price: p.suggestedPrice != null ? Number(p.suggestedPrice) : (p.suggestedPricePix != null ? Number(p.suggestedPricePix) : null),
    notes: strOrNull(p.note),
    status: null,
  };
}

export function useProcedures(): [Procedure[], (v: Procedure[] | ((p: Procedure[]) => Procedure[])) => Promise<void>, boolean] {
  const [items, setItems] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("procedures")
        .select("*")
        .eq("user_id", user.id)
        .order("name");
      if (error) { logSupabaseError("procedures load", error); throw error; }
      if (data) setItems((data as DbProcedure[]).map(dbToProcedure));
    } catch (e: any) {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setter = useCallback(async (v: Procedure[] | ((p: Procedure[]) => Procedure[])) => {
    try {
      setLoading(true);
      const user = await getCurrentUserOrThrow();
      const next = typeof v === "function" ? v(items) : v;

      const currentIds = new Set(items.map(i => i.id));
      const nextIds = new Set(next.map(i => i.id));

      for (const id of currentIds) {
        if (!nextIds.has(id)) {
          const { error } = await supabase.from("procedures").delete().eq("id", id).eq("user_id", user.id);
          if (error) { logSupabaseError("procedures delete", error); throw error; }
        }
      }

      for (const item of next) {
        if (!currentIds.has(item.id)) {
          const { data, error } = await supabase.from("procedures")
            .insert(procedureToDb(item, user.id))
            .select().single();
          if (error) { logSupabaseError("procedures insert", error); throw error; }
          item.id = (data as DbProcedure).id;
        }
      }

      for (const item of next) {
        if (currentIds.has(item.id)) {
          const orig = items.find(x => x.id === item.id);
          if (JSON.stringify(orig) !== JSON.stringify(item)) {
            const { error } = await supabase.from("procedures")
              .update(procedureToDb(item, user.id))
              .eq("id", item.id).eq("user_id", user.id);
            if (error) { logSupabaseError("procedures update", error); throw error; }
          }
        }
      }
      setItems([...next]);
    } catch (e: any) {
      toast.error("Erro ao sincronizar procedimentos.");
    } finally {
      setLoading(false);
    }
  }, [items]);

  return [items, setter, loading];
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

type DbSettings = {
  id: string;
  user_id: string;
  clinic_name: string | null;
  primary_color: string | null;
  default_margin: number | null;
  default_tax: number | null;
  card_fee_credit: number | null;
  card_fee_debit: number | null;
  technical_reserve: number | null;
  working_days_per_month: number | null;
  clinical_hours_per_day: number | null;
  default_appointment_duration: number | null;
  created_at: string;
  updated_at: string;
};

function dbToSettings(r: DbSettings): Settings {
  return {
    marginPct: r.default_margin ?? DEFAULT_SETTINGS.marginPct,
    reservePct: r.technical_reserve ?? DEFAULT_SETTINGS.reservePct,
    taxPct: r.default_tax ?? DEFAULT_SETTINGS.taxPct,
    cardFeePct: r.card_fee_credit ?? DEFAULT_SETTINGS.cardFeePct,
    daysPerMonth: r.working_days_per_month ?? DEFAULT_SETTINGS.daysPerMonth,
    hoursPerDay: r.clinical_hours_per_day ?? DEFAULT_SETTINGS.hoursPerDay,
    rounding: DEFAULT_SETTINGS.rounding,
  };
}

function settingsToDb(s: Settings, userId: string) {
  return {
    user_id: userId,
    clinic_name: null,
    primary_color: null,
    default_margin: Number(s.marginPct),
    default_tax: Number(s.taxPct),
    card_fee_credit: Number(s.cardFeePct),
    card_fee_debit: null,
    technical_reserve: Number(s.reservePct),
    working_days_per_month: Number(s.daysPerMonth),
    clinical_hours_per_day: Number(s.hoursPerDay),
    default_appointment_duration: null,
  };
}

export function useSettings(): [Settings, (v: Settings | ((p: Settings) => Settings)) => Promise<void>, boolean] {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const rowIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;
      const { data, error } = await supabase.from("settings")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
        
      if (error) { logSupabaseError("settings load", error); throw error; }

      if (!data || data.length === 0) {
        const { data: created, error: createErr } = await supabase.from("settings")
          .insert(settingsToDb(DEFAULT_SETTINGS, user.id))
          .select().single();
        if (createErr) { logSupabaseError("settings create", createErr); throw createErr; }
        rowIdRef.current = (created as DbSettings).id;
        setSettings(dbToSettings(created as DbSettings));
      } else {
        rowIdRef.current = (data[0] as DbSettings).id;
        setSettings(dbToSettings(data[0] as DbSettings));
      }
    } catch (e: any) {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setter = useCallback(async (v: Settings | ((p: Settings) => Settings)) => {
    try {
      setLoading(true);
      const user = await getCurrentUserOrThrow();
      const next = typeof v === "function" ? v(settings) : v;
      
      let targetId = rowIdRef.current;
      if (!targetId) {
         const { data: existing } = await supabase.from("settings").select("id").eq("user_id", user.id).limit(1);
         if (existing && existing.length > 0) {
           targetId = existing[0].id;
           rowIdRef.current = targetId;
         }
      }

      const payload = settingsToDb(next, user.id);

      if (targetId) {
        const { error } = await supabase.from("settings")
          .update(payload)
          .eq("id", targetId)
          .eq("user_id", user.id);
        if (error) { logSupabaseError("settings update", error); throw error; }
      } else {
        const { data, error } = await supabase.from("settings")
          .insert(payload)
          .select().single();
        if (error) { logSupabaseError("settings insert fallback", error); throw error; }
        rowIdRef.current = (data as DbSettings).id;
      }
      
      setSettings(next);
    } catch (e: any) {
      toast.error("Erro ao salvar configurações no Supabase.");
      throw e;
    } finally {
      setLoading(false);
    }
  }, [settings]);

  return [settings, setter, loading];
}

// ---------------------------------------------------------------------------
// Pricing History
// ---------------------------------------------------------------------------

type DbHistory = {
  id: string;
  user_id: string;
  patient_id: string | null;
  procedure_id: string | null;
  procedure_name: string;
  total_supply_cost: number;
  fixed_cost: number;
  lab_cost: number;
  other_costs: number;
  real_cost: number;
  suggested_price_pix: number;
  suggested_price_card: number;
  charged_price: number | null;
  estimated_profit: number;
  net_margin: number;
  price_health: string | null;
  created_at: string;
};

function dbToHistory(r: DbHistory): HistoryItem {
  return {
    id: r.id,
    createdAt: new Date(r.created_at).getTime(),
    procedureId: r.procedure_id ?? "",
    procedureName: r.procedure_name,
    minutes: Number(r.price_health) || 0,
    labCost: r.lab_cost,
    otherDirect: r.other_costs,
    supplies: [],
    customCosts: [],
    result: {
      suppliesCost: r.total_supply_cost,
      fixedProportional: r.fixed_cost,
      realCost: r.real_cost,
      targetPrice: r.suggested_price_card,
      pricePix: r.suggested_price_pix,
      priceCard: r.suggested_price_card,
      estimatedProfit: r.estimated_profit,
      netMargin: r.net_margin,
    },
    settings: DEFAULT_SETTINGS,
  };
}

function historyToDb(h: HistoryItem, userId: string) {
  return {
    user_id: userId,
    patient_id: null,
    procedure_id: strOrNull(h.procedureId),
    procedure_name: strOrNull(h.procedureName) ?? "Sem nome",
    total_supply_cost: Number(h.result.suppliesCost || 0),
    fixed_cost: Number(h.result.fixedProportional || 0),
    lab_cost: Number(h.labCost || 0),
    other_costs: Number(h.otherDirect || 0),
    real_cost: Number(h.result.realCost || 0),
    suggested_price_pix: Number(h.result.pricePix || 0),
    suggested_price_card: Number(h.result.priceCard || 0),
    charged_price: null,
    estimated_profit: Number(h.result.estimatedProfit || 0),
    net_margin: Number(h.result.netMargin || 0),
    price_health: String(h.minutes || 0),
  };
}

export function useHistory(): [HistoryItem[], (v: HistoryItem[] | ((p: HistoryItem[]) => HistoryItem[])) => Promise<void>, boolean] {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;
      const { data, error } = await supabase.from("pricing_history").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) { logSupabaseError("pricing_history load", error); throw error; }
      if (data) setItems((data as DbHistory[]).map(dbToHistory));
    } catch (e: any) {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setter = useCallback(async (v: HistoryItem[] | ((p: HistoryItem[]) => HistoryItem[])) => {
    try {
      setLoading(true);
      const user = await getCurrentUserOrThrow();
      const next = typeof v === "function" ? v(items) : v;

      const currentIds = new Set(items.map(i => i.id));
      const nextIds = new Set(next.map(i => i.id));

      for (const id of currentIds) {
        if (!nextIds.has(id)) {
          const { error } = await supabase.from("pricing_history").delete().eq("id", id).eq("user_id", user.id);
          if (error) { logSupabaseError("pricing_history delete", error); throw error; }
        }
      }

      for (const item of next) {
        if (!currentIds.has(item.id)) {
          const { data, error } = await supabase.from("pricing_history")
            .insert(historyToDb(item, user.id))
            .select().single();
          if (error) { logSupabaseError("pricing_history insert", error); throw error; }
          item.id = (data as DbHistory).id;
        }
      }

      setItems([...next]);
    } catch (e: any) {
      toast.error("Erro ao sincronizar histórico.");
    } finally {
      setLoading(false);
    }
  }, [items]);

  return [items, setter, loading];
}

// ---------------------------------------------------------------------------
// Custom Categories
// ---------------------------------------------------------------------------

type DbCustomCategory = {
  id: string;
  user_id: string;
  type: string;
  name: string;
  created_at: string;
};

function useCategoryType(type: "supply_category" | "procedure_category" | "fixed_cost_category") {
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const idsRef = useRef<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;
      const { data, error } = await supabase.from("custom_categories").select("*").eq("user_id", user.id).eq("type", type).order("name");
      if (error) { logSupabaseError(`custom_categories load ${type}`, error); throw error; }
      if (data) {
        const rows = data as DbCustomCategory[];
        rows.forEach(r => idsRef.current.set(r.name, r.id));
        setItems(rows.map(r => r.name));
      }
    } catch (e: any) {} finally { setLoading(false); }
  }, [type]);

  useEffect(() => { load(); }, [load]);

  const setter = useCallback(async (v: string[] | ((p: string[]) => string[])) => {
    try {
      setLoading(true);
      const user = await getCurrentUserOrThrow();
      const next = typeof v === "function" ? v(items) : v;

      for (const name of next) {
        if (!idsRef.current.has(name)) {
          const { data, error } = await supabase.from("custom_categories")
            .insert({ user_id: user.id, type, name: strOrNull(name) ?? "Categoria" })
            .select().single();
          if (error) { logSupabaseError(`custom_categories insert ${type}`, error); throw error; }
          idsRef.current.set(name, (data as DbCustomCategory).id);
        }
      }

      for (const name of items) {
        if (!next.includes(name)) {
          const id = idsRef.current.get(name);
          if (id) {
            const { error } = await supabase.from("custom_categories").delete().eq("id", id).eq("user_id", user.id);
            if (error) { logSupabaseError(`custom_categories delete ${type}`, error); throw error; }
            idsRef.current.delete(name);
          }
        }
      }
      setItems([...next]);
    } catch (e: any) {
      toast.error(`Erro ao sincronizar categorias (${type}).`);
    } finally {
      setLoading(false);
    }
  }, [items, type]);

  return [items, setter, loading] as const;
}

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------

type DbPatient = {
  id: string;
  user_id: string;
  record_number: string | null;
  full_name: string;
  cpf: string | null;
  rg: string | null;
  issuing_agency: string | null;
  birth_date: string | null;
  gender: string | null;
  marital_status: string | null;
  profession: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  administrative_notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

function dbToPatient(r: DbPatient): Patient {
  return {
    id: r.id,
    recordNumber: r.record_number ?? "",
    fullName: r.full_name || "Sem nome",
    cpf: r.cpf ?? "",
    rg: r.rg ?? "",
    issuingAgency: r.issuing_agency ?? "",
    birthDate: r.birth_date ?? "",
    gender: r.gender ?? "",
    maritalStatus: r.marital_status ?? "",
    profession: r.profession ?? "",
    phone: r.phone ?? "",
    whatsapp: r.whatsapp ?? "",
    address: r.address ?? "",
    administrativeNotes: r.administrative_notes ?? "",
    status: (r.status as PatientStatus) || "ativo",
    createdAt: r.created_at
  };
}

function patientToDb(p: Partial<Patient>, userId: string) {
  return {
    user_id: userId,
    record_number: strOrNull(p.recordNumber),
    full_name: p.fullName || "Sem nome",
    cpf: strOrNull(p.cpf),
    rg: strOrNull(p.rg),
    issuing_agency: strOrNull(p.issuingAgency),
    birth_date: strOrNull(p.birthDate),
    gender: strOrNull(p.gender),
    marital_status: strOrNull(p.maritalStatus),
    profession: strOrNull(p.profession),
    phone: strOrNull(p.phone),
    whatsapp: strOrNull(p.whatsapp),
    address: strOrNull(p.address),
    administrative_notes: strOrNull(p.administrativeNotes),
    status: p.status || "ativo",
  };
}

export interface CustomStatusType {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export function usePatients(): [Patient[], (v: Patient[] | ((p: Patient[]) => Patient[])) => Promise<void>, boolean, string | null] {
  const [items, setItems] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setErrorState(null);
      const user = await getCurrentUser();
      if (!user) {
        setErrorState("Usuário não autenticado. Faça login.");
        return;
      }
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) { 
        logSupabaseError("patients load", error); 
        setErrorState(error.message || "Erro desconhecido ao carregar pacientes.");
        throw error; 
      }
      
      if (data) setItems((data as DbPatient[]).map(dbToPatient));
    } catch (e: any) {
    } finally { 
      setLoading(false); 
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setter = useCallback(async (v: Patient[] | ((p: Patient[]) => Patient[])) => {
    try {
      setLoading(true);
      const user = await getCurrentUserOrThrow();
      const next = typeof v === "function" ? v(items) : v;

      const currentIds = new Set(items.map(i => i.id));
      const nextIds = new Set(next.map(i => i.id));

      for (const id of currentIds) {
        if (!nextIds.has(id)) {
          const { error } = await supabase.from("patients").delete().eq("id", id).eq("user_id", user.id);
          if (error) { logSupabaseError("patients delete", error); throw error; }
        }
      }

      for (const item of next) {
        if (!currentIds.has(item.id)) {
          const { data, error } = await supabase.from("patients")
            .insert(patientToDb(item, user.id))
            .select().single();
          if (error) { logSupabaseError("patients insert", error); throw error; }
          item.id = (data as DbPatient).id;
          item.createdAt = (data as DbPatient).created_at;
        }
      }

      for (const item of next) {
        if (currentIds.has(item.id)) {
          const orig = items.find(x => x.id === item.id);
          if (JSON.stringify(orig) !== JSON.stringify(item)) {
            const { error } = await supabase.from("patients")
              .update(patientToDb(item, user.id))
              .eq("id", item.id).eq("user_id", user.id);
            if (error) { logSupabaseError("patients update", error); throw error; }
          }
        }
      }
      
      setItems([...next]);
    } catch (e: any) {
      toast.error("Erro ao sincronizar pacientes.");
      throw e;
    } finally {
      setLoading(false);
    }
  }, [items]);

  return [items, setter, loading, errorState];
}

// ---------------------------------------------------------------------------
// Anamneses
// ---------------------------------------------------------------------------

function dbToAnamnesis(row: any): Anamnesis {
  return {
    id: row.id,
    patientId: row.patient_id,
    mainComplaint: row.main_complaint || undefined,
    medications: row.medications || undefined,
    allergies: row.allergies || undefined,
    bloodPressure: row.blood_pressure || undefined,
    heartProblem: row.heart_problem,
    diabetes: row.diabetes,
    bleedingProblem: row.bleeding_problem,
    healingProblem: row.healing_problem,
    previousSurgery: row.previous_surgery,
    pregnancy: row.pregnancy,
    healthProblems: row.health_problems || undefined,
    anesthesiaReaction: row.anesthesia_reaction,
    toothOrGumPain: row.tooth_or_gum_pain || undefined,
    gumBleeding: row.gum_bleeding,
    brushingFrequency: row.brushing_frequency || undefined,
    flossUse: row.floss_use || undefined,
    smoker: row.smoker,
    truthDeclaration: row.truth_declaration,
    signature: row.signature || undefined,
    status: row.status as AnamnesisStatus,
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function anamnesisToDb(item: Anamnesis, userId: string) {
  return {
    id: item.id,
    user_id: userId,
    patient_id: item.patientId,
    main_complaint: item.mainComplaint || null,
    medications: item.medications || null,
    allergies: item.allergies || null,
    blood_pressure: item.bloodPressure || null,
    heart_problem: item.heartProblem ?? null,
    diabetes: item.diabetes ?? null,
    bleeding_problem: item.bleedingProblem ?? null,
    healing_problem: item.healingProblem ?? null,
    previous_surgery: item.previousSurgery ?? null,
    pregnancy: item.pregnancy ?? null,
    health_problems: item.healthProblems || null,
    anesthesia_reaction: item.anesthesiaReaction ?? null,
    tooth_or_gum_pain: item.toothOrGumPain || null,
    gum_bleeding: item.gumBleeding || null,
    brushing_frequency: item.brushingFrequency || null,
    floss_use: item.flossUse || null,
    smoker: item.smoker ?? null,
    truth_declaration: item.truthDeclaration ?? null,
    signature: item.signature || null,
    status: item.status,
    notes: item.notes || null,
  };
}

export function useAnamneses(patientId: string) {
  const [items, setItems] = useState<Anamnesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);

  const setter = async (action: React.SetStateAction<Anamnesis[]>) => {
    try {
      setErrorState(null);
      const user = await getCurrentUser();
      if (!user) throw new Error("Usuário não autenticado");
      const next = typeof action === "function" ? action(items) : action;

      const added = next.filter(n => !items.find(i => i.id === n.id));
      const removed = items.filter(i => !next.find(n => n.id === i.id));
      const updated = next.filter(n => {
        const old = items.find(i => i.id === n.id);
        return old && JSON.stringify(old) !== JSON.stringify(n);
      });

      if (added.length > 0) {
        const { error } = await supabase.from("anamneses").insert(added.map(a => anamnesisToDb(a, user.id)));
        if (error) { logSupabaseError("Insert Anamnesis", error); throw error; }
      }
      if (removed.length > 0) {
        for (const r of removed) {
          const { error } = await supabase.from("anamneses").delete().eq("id", r.id).eq("user_id", user.id).eq("patient_id", patientId);
          if (error) { logSupabaseError("Delete Anamnesis", error); throw error; }
        }
      }
      if (updated.length > 0) {
        for (const u of updated) {
          const { error } = await supabase.from("anamneses").update({
            ...anamnesisToDb(u, user.id),
            updated_at: new Date().toISOString()
          }).eq("id", u.id).eq("user_id", user.id).eq("patient_id", patientId);
          if (error) { logSupabaseError("Update Anamnesis", error); throw error; }
        }
      }
      setItems(next);
    } catch (e: any) {
      console.error(e);
      setErrorState(e.message || "Erro desconhecido ao salvar anamnese");
      throw e;
    }
  };

  useEffect(() => {
    let active = true;
    const fetchItems = async () => {
      try {
        setErrorState(null);
        setLoading(true);
        const user = await getCurrentUser();
        if (!user || !patientId) return;
        const { data, error } = await supabase.from("anamneses")
          .select("*")
          .eq("user_id", user.id)
          .eq("patient_id", patientId)
          .order("created_at", { ascending: false });
        if (error) { logSupabaseError("Fetch Anamneses", error); throw error; }
        if (active && data) setItems(data.map(dbToAnamnesis));
      } catch (e: any) {
        console.error(e);
        if (active) setErrorState(e.message || "Erro desconhecido ao buscar anamneses");
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchItems();
    return () => { active = false; };
  }, [patientId]);

  return [items, setter, loading, errorState] as const;
}

// ---------------------------------------------------------------------------
// Odontogram
// ---------------------------------------------------------------------------

function dbToOdontogram(row: any): OdontogramEntry {
  return {
    id: row.id,
    patientId: row.patient_id,
    toothNumber: row.tooth_number,
    toothRegion: row.tooth_region,
    status: row.status,
    notes: row.notes || undefined,
    procedureId: row.procedure_id || undefined,
    budgetId: row.budget_id || undefined,
    clinicalRecordId: row.clinical_record_id || undefined,
    color: row.color || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function cleanUuid(val?: string | null): string | undefined | null {
  if (!val || val.trim() === "" || val.startsWith("temp-")) return null;
  // basic regex for uuid validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(val)) return null;
  return val;
}

function odontogramToDb(item: OdontogramEntry, userId: string) {
  const payload: any = {
    user_id: userId,
    patient_id: cleanUuid(item.patientId),
    tooth_number: item.toothNumber,
    tooth_region: item.toothRegion,
    status: item.status,
    notes: item.notes || null,
    procedure_id: cleanUuid(item.procedureId),
    budget_id: cleanUuid(item.budgetId),
    clinical_record_id: cleanUuid(item.clinicalRecordId),
    color: item.color || null,
  };

  const cleanId = cleanUuid(item.id);
  if (cleanId) {
    payload.id = cleanId;
  }

  return payload;
}

export function useOdontogramEntries(patientId: string) {
  const [items, setItems] = useState<OdontogramEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);

  const setter = async (action: React.SetStateAction<OdontogramEntry[]>) => {
    try {
      setErrorState(null);
      const user = await getCurrentUser();
      if (!user) throw new Error("Usuário não autenticado");
      const next = typeof action === "function" ? action(items) : action;

      const added = next.filter(n => !items.find(i => i.id === n.id));
      const removed = items.filter(i => !next.find(n => n.id === i.id));
      const updated = next.filter(n => {
        const old = items.find(i => i.id === n.id);
        return old && JSON.stringify(old) !== JSON.stringify(n);
      });

      if (added.length > 0) {
        const { error } = await supabase.from("odontogram_entries").insert(added.map(a => odontogramToDb(a, user.id)));
        if (error) { logSupabaseError("Insert Odontogram", error); throw error; }
      }
      if (removed.length > 0) {
        for (const r of removed) {
          const cleanId = cleanUuid(r.id);
          if (cleanId) {
            const { error } = await supabase.from("odontogram_entries").delete().eq("id", cleanId).eq("user_id", user.id).eq("patient_id", patientId);
            if (error) { logSupabaseError("Delete Odontogram", error); throw error; }
          }
        }
      }
      if (updated.length > 0) {
        for (const u of updated) {
          const cleanId = cleanUuid(u.id);
          if (cleanId) {
            const { error } = await supabase.from("odontogram_entries").update({
              ...odontogramToDb(u, user.id),
              updated_at: new Date().toISOString()
            }).eq("id", cleanId).eq("user_id", user.id).eq("patient_id", patientId);
            if (error) { logSupabaseError("Update Odontogram", error); throw error; }
          }
        }
      }
      
      // Re-fetch to replace temporary IDs with real database UUIDs
      const { data } = await supabase.from("odontogram_entries")
          .select("*")
          .eq("user_id", user.id)
          .eq("patient_id", patientId)
          .order("created_at", { ascending: false });
      
      if (data) {
        setItems(data.map(dbToOdontogram));
      } else {
        setItems(next);
      }
    } catch (e: any) {
      console.error(e);
      setErrorState(e.message || "Erro desconhecido ao salvar odontograma");
      throw e;
    }
  };

  useEffect(() => {
    let active = true;
    const fetchItems = async () => {
      try {
        setErrorState(null);
        setLoading(true);
        const user = await getCurrentUser();
        if (!user || !patientId) return;
        const { data, error } = await supabase.from("odontogram_entries")
          .select("*")
          .eq("user_id", user.id)
          .eq("patient_id", patientId)
          .order("created_at", { ascending: false });
        if (error) { logSupabaseError("Fetch Odontogram", error); throw error; }
        if (active && data) setItems(data.map(dbToOdontogram));
      } catch (e: any) {
        console.error(e);
        if (active) setErrorState(e.message || "Erro desconhecido ao buscar odontograma");
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchItems();
    return () => { active = false; };
  }, [patientId]);

  return [items, setter, loading, errorState] as const;
}

export function useOdontogramStatusTypes() {
  const [types, setTypes] = useState<CustomStatusType[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchTypes = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('odontogram_status_types')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
        
      if (error) {
        logSupabaseError("Fetch Status Types", error);
        setError(error.message);
        return;
      }
      setTypes(data as CustomStatusType[]);
    } catch (e: any) {
      console.error(e);
      setError(e.message);
    }
  }, []);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  const addType = async (type: Omit<CustomStatusType, 'id'>) => {
    const user = await getCurrentUserOrThrow();
    const { error } = await supabase
      .from('odontogram_status_types')
      .insert([{
        user_id: user.id,
        name: type.name,
        color: type.color,
        description: type.description,
      }]);

    if (error) {
      logSupabaseError("Insert Status Type", error);
      throw error;
    }
    fetchTypes();
  };

  return { types, error, addType };
}

export function useCustomSupplyCategories() { return useCategoryType("supply_category"); }
export function useCustomProcedureCategories() { return useCategoryType("procedure_category"); }
export function useCustomFixedCostCategories() { return useCategoryType("fixed_cost_category"); }

// ---------------------------------------------------------------------------
// Procedure Supplies
// ---------------------------------------------------------------------------

export type ProcedureSupply = {
  id: string;
  procedureId: string;
  supplyId: string;
  qty: number;
};

type DbProcedureSupply = {
  id: string;
  user_id: string;
  procedure_id: string;
  supply_id: string;
  quantity: number;
  created_at: string;
};

export function useProcedureSupplies(procedureId: string): [ProcedureSupply[], (v: ProcedureSupply[] | ((p: ProcedureSupply[]) => ProcedureSupply[])) => Promise<void>, boolean] {
  const [items, setItems] = useState<ProcedureSupply[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!procedureId) return;
    try {
      const user = await getCurrentUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("procedure_supplies")
        .select("*")
        .eq("user_id", user.id)
        .eq("procedure_id", procedureId);
      if (error) { logSupabaseError("procedure_supplies load", error); throw error; }
      if (data) {
        setItems((data as DbProcedureSupply[]).map(r => ({
          id: r.id, procedureId: r.procedure_id, supplyId: r.supply_id, qty: r.quantity
        })));
      }
    } catch (e: any) {} finally { setLoading(false); }
  }, [procedureId]);

  useEffect(() => { load(); }, [load]);

  const setter = useCallback(async (v: ProcedureSupply[] | ((p: ProcedureSupply[]) => ProcedureSupply[])) => {
    if (!procedureId) return;
    try {
      setLoading(true);
      const user = await getCurrentUserOrThrow();
      const next = typeof v === "function" ? v(items) : v;

      const currentIds = new Set(items.map(i => i.id));
      const nextIds = new Set(next.map(i => i.id));

      for (const id of currentIds) {
        if (!nextIds.has(id)) {
          const { error } = await supabase.from("procedure_supplies").delete().eq("id", id).eq("user_id", user.id);
          if (error) { logSupabaseError("procedure_supplies delete", error); throw error; }
        }
      }

      for (const item of next) {
        if (!currentIds.has(item.id)) {
          const { data, error } = await supabase.from("procedure_supplies")
            .insert({ user_id: user.id, procedure_id: procedureId, supply_id: item.supplyId, quantity: Number(item.qty || 1) })
            .select().single();
          if (error) { logSupabaseError("procedure_supplies insert", error); throw error; }
          item.id = (data as DbProcedureSupply).id;
        }
      }

      for (const item of next) {
        if (currentIds.has(item.id)) {
          const orig = items.find(x => x.id === item.id);
          if (JSON.stringify(orig) !== JSON.stringify(item)) {
            const { error } = await supabase.from("procedure_supplies")
              .update({ supply_id: item.supplyId, quantity: Number(item.qty || 1) })
              .eq("id", item.id).eq("user_id", user.id);
            if (error) { logSupabaseError("procedure_supplies update", error); throw error; }
          }
        }
      }
      setItems([...next]);
    } catch (e: any) {
      toast.error("Erro ao sincronizar insumos do procedimento.");
    } finally {
      setLoading(false);
    }
  }, [items, procedureId]);

  return [items, setter, loading];
}

// --- Treatment Plans ---

export function useTreatmentPlans(patientId?: string): [TreatmentPlan[], string | null, boolean, boolean] {
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tablesMissing, setTablesMissing] = useState(false);

  useEffect(() => {
    let active = true;
    async function fetchPlans() {
      if (!patientId) {
        if (active) { setPlans([]); setLoading(false); }
        return;
      }
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          if (active) { setPlans([]); setLoading(false); setError("Não autenticado"); }
          return;
        }

        const { data: plansData, error: plansError } = await supabase.from("treatment_plans")
          .select("*")
          .eq("user_id", userData.user.id)
          .eq("patient_id", patientId)
          .order("created_at", { ascending: false });

        if (plansError) {
          if (plansError.code === "42P01") {
            if (active) { setTablesMissing(true); setLoading(false); }
            return;
          }
          throw plansError;
        }

        const planIds = (plansData || []).map((p: any) => p.id);
        
        let itemsData: any[] = [];
        if (planIds.length > 0) {
          const { data: iData, error: itemsError } = await supabase.from("treatment_plan_items")
            .select("*, procedures(name)")
            .eq("user_id", userData.user.id)
            .in("treatment_plan_id", planIds)
            .order("created_at", { ascending: true });
          
          if (itemsError) throw itemsError;
          itemsData = iData || [];
        }

        if (active) {
          const formattedPlans: TreatmentPlan[] = (plansData || []).map((p: any) => {
            const planItems = itemsData.filter(i => i.treatment_plan_id === p.id).map(i => ({
              id: i.id,
              userId: i.user_id,
              treatmentPlanId: i.treatment_plan_id,
              procedureId: i.procedure_id,
              toothNumber: i.tooth_number,
              toothRegion: i.tooth_region,
              description: i.description,
              priority: i.priority,
              estimatedPrice: i.estimated_price,
              status: i.status,
              createdAt: i.created_at,
              updatedAt: i.updated_at,
              procedureName: i.procedures?.name
            } as TreatmentPlanItem));

            return {
              id: p.id,
              userId: p.user_id,
              patientId: p.patient_id,
              title: p.title,
              diagnosis: p.diagnosis,
              notes: p.notes,
              status: p.status,
              startDate: p.start_date,
              expectedEndDate: p.expected_end_date,
              createdAt: p.created_at,
              updatedAt: p.updated_at,
              items: planItems
            } as TreatmentPlan;
          });
          setPlans(formattedPlans);
          setLoading(false);
        }
      } catch (err: any) {
        logSupabaseError("useTreatmentPlans", err);
        if (active) {
          setError(err.message || "Erro ao carregar planos de tratamento");
          setLoading(false);
        }
      }
    }
    fetchPlans();
    return () => { active = false; };
  }, [patientId]);

  return [plans, error, loading, tablesMissing];
}

export async function saveTreatmentPlan(plan: TreatmentPlan) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");

  const dbObj = {
    user_id: userData.user.id,
    patient_id: plan.patientId,
    title: plan.title,
    diagnosis: plan.diagnosis,
    notes: plan.notes,
    status: plan.status,
    start_date: plan.startDate,
    expected_end_date: plan.expectedEndDate
  };

  if (plan.id && !plan.id.startsWith("temp-")) {
    const { error } = await supabase.from("treatment_plans").update(dbObj).eq("id", plan.id).eq("user_id", userData.user.id);
    if (error) { logSupabaseError("update treatment_plans", error); throw error; }
  } else {
    const { error } = await supabase.from("treatment_plans").insert(dbObj);
    if (error) { logSupabaseError("insert treatment_plans", error); throw error; }
  }
}

export async function deleteTreatmentPlan(id: string) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  const { error } = await supabase.from("treatment_plans").delete().eq("id", id).eq("user_id", userData.user.id);
  if (error) { logSupabaseError("delete treatment_plans", error); throw error; }
}

export async function saveTreatmentPlanItem(item: TreatmentPlanItem) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");

  const dbObj = {
    user_id: userData.user.id,
    treatment_plan_id: item.treatmentPlanId,
    procedure_id: item.procedureId || null,
    tooth_number: item.toothNumber || null,
    tooth_region: item.toothRegion || null,
    description: item.description,
    priority: item.priority,
    estimated_price: item.estimatedPrice,
    status: item.status
  };

  if (item.id && !item.id.startsWith("temp-")) {
    const { error } = await supabase.from("treatment_plan_items").update(dbObj).eq("id", item.id).eq("user_id", userData.user.id);
    if (error) { logSupabaseError("update treatment_plan_items", error); throw error; }
  } else {
    const { error } = await supabase.from("treatment_plan_items").insert(dbObj);
    if (error) { logSupabaseError("insert treatment_plan_items", error); throw error; }
  }
}

export async function deleteTreatmentPlanItem(id: string) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  const { error } = await supabase.from("treatment_plan_items").delete().eq("id", id).eq("user_id", userData.user.id);
  if (error) { logSupabaseError("delete treatment_plan_items", error); throw error; }
}

// --- Clinical Records / Evolução Clínica ---

export function useClinicalRecords(patientId?: string): [ClinicalRecord[], string | null, boolean, boolean] {
  const [records, setRecords] = useState<ClinicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tablesMissing, setTablesMissing] = useState(false);

  useEffect(() => {
    let active = true;
    async function fetchRecords() {
      if (!patientId) {
        if (active) { setRecords([]); setLoading(false); }
        return;
      }
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          if (active) { setRecords([]); setLoading(false); setError("Não autenticado"); }
          return;
        }

        const { data: recData, error: recError } = await supabase.from("clinical_records")
          .select("*, procedures(name)")
          .eq("user_id", userData.user.id)
          .eq("patient_id", patientId)
          .order("record_date", { ascending: false });

        if (recError) {
          if (recError.code === "42P01") {
            if (active) { setTablesMissing(true); setLoading(false); }
            return;
          }
          throw recError;
        }

        const recordIds = (recData || []).map((r: any) => r.id);
        
        let suppliesData: any[] = [];
        if (recordIds.length > 0) {
          const { data: sData, error: sError } = await supabase.from("clinical_record_supplies")
            .select("*, supplies(name)")
            .eq("user_id", userData.user.id)
            .in("clinical_record_id", recordIds);
          
          if (sError) throw sError;
          suppliesData = sData || [];
        }

        if (active) {
          const formattedRecords: ClinicalRecord[] = (recData || []).map((r: any) => {
            const recSupplies = suppliesData.filter(s => s.clinical_record_id === r.id).map(s => ({
              id: s.id,
              userId: s.user_id,
              clinicalRecordId: s.clinical_record_id,
              patientId: s.patient_id,
              supplyId: s.supply_id,
              quantityUsed: s.quantity_used,
              unitCost: s.unit_cost,
              totalCost: s.total_cost,
              createdAt: s.created_at,
              supplyName: s.supplies?.name
            } as ClinicalRecordSupply));

            return {
              id: r.id,
              userId: r.user_id,
              patientId: r.patient_id,
              procedureId: r.procedure_id,
              recordDate: r.record_date,
              teeth: r.teeth || [],
              description: r.description,
              notes: r.notes,
              chargedAmount: r.charged_amount,
              realCost: r.real_cost,
              estimatedProfit: r.estimated_profit,
              signature: r.signature,
              createdAt: r.created_at,
              updatedAt: r.updated_at,
              procedureName: r.procedures?.name,
              supplies: recSupplies
            } as ClinicalRecord;
          });
          setRecords(formattedRecords);
          setLoading(false);
        }
      } catch (err: any) {
        logSupabaseError("useClinicalRecords", err);
        if (active) {
          setError(err.message || "Erro ao carregar fichas clínicas");
          setLoading(false);
        }
      }
    }
    fetchRecords();
    return () => { active = false; };
  }, [patientId]);

  return [records, error, loading, tablesMissing];
}

export async function saveClinicalRecord(record: ClinicalRecord, items: ClinicalRecordSupply[]) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");

  const dbObj = {
    user_id: userData.user.id,
    patient_id: record.patientId,
    procedure_id: record.procedureId || null,
    record_date: record.recordDate,
    teeth: record.teeth || [],
    description: record.description,
    notes: record.notes,
    charged_amount: record.chargedAmount || 0,
    real_cost: record.realCost || 0,
    estimated_profit: record.estimatedProfit || 0,
    signature: record.signature
  };

  let recordId = record.id;
  let isNew = false;
  if (recordId && !recordId.startsWith("temp-")) {
    const { error } = await supabase.from("clinical_records").update(dbObj).eq("id", recordId).eq("user_id", userData.user.id);
    if (error) { logSupabaseError("update clinical_records", error); throw error; }
  } else {
    isNew = true;
    const { data, error } = await supabase.from("clinical_records").insert(dbObj).select().single();
    if (error) { logSupabaseError("insert clinical_records", error); throw error; }
    recordId = (data as any).id;
  }

  // Handle supplies sync and stock movements
  // Load existing items in DB first for this clinical record to compare
  const { data: currentItems, error: itemsError } = await supabase.from("clinical_record_supplies")
    .select("*")
    .eq("clinical_record_id", recordId)
    .eq("user_id", userData.user.id);
  
  if (itemsError) throw itemsError;

  const oldItems = currentItems || [];

  // Helper to adjust stock
  const adjustStockAndCreateMovement = async (supplyId: string, quantityChange: number, movementType: 'entrada' | 'saida', reason: string) => {
    if (quantityChange <= 0) return;
    
    // Get current stock
    const { data: sData } = await supabase.from("supplies").select("stock_quantity").eq("id", supplyId).single();
    const currentStock = sData ? Number(sData.stock_quantity || 0) : 0;
    const newStock = movementType === 'entrada' ? currentStock + quantityChange : currentStock - quantityChange;
    
    // Update stock
    await supabase.from("supplies").update({ stock_quantity: newStock }).eq("id", supplyId);
    
    // Create movement
    await supabase.from("stock_movements").insert({
      user_id: userData.user.id,
      supply_id: supplyId,
      patient_id: record.patientId,
      movement_type: movementType,
      quantity: quantityChange,
      reason: reason
    });
  };

  if (isNew) {
    // For a new clinical record, everything is a new usage (saida)
    for (const item of items) {
      if (item.supplyId) {
        const qty = item.quantityUsed || 1;
        await adjustStockAndCreateMovement(item.supplyId, qty, 'saida', `Uso em ficha clínica: ${recordId}`);
      }
    }
  } else {
    // For an existing record: compare old and new
    // 1. Identify deleted supplies (in oldItems but not in items)
    for (const old of oldItems) {
      const matched = items.find(n => n.supplyId === old.supply_id);
      if (!matched) {
        // Deleted
        const qty = old.quantity_used || 1;
        await adjustStockAndCreateMovement(old.supply_id, qty, 'entrada', `Estorno por remoção em evolução clínica: ${recordId}`);
      }
    }

    // 2. Identify new or updated supplies
    for (const item of items) {
      if (!item.supplyId) continue;
      const oldMatch = oldItems.find(o => o.supply_id === item.supplyId);
      if (!oldMatch) {
        // New supply added to existing record
        const qty = item.quantityUsed || 1;
        await adjustStockAndCreateMovement(item.supplyId, qty, 'saida', `Uso em ficha clínica: ${recordId}`);
      } else {
        // Exists in both: compare quantities
        const oldQty = oldMatch.quantity_used || 0;
        const newQty = item.quantityUsed || 0;
        const diff = newQty - oldQty;
        if (diff > 0) {
          // Used more (saida)
          await adjustStockAndCreateMovement(item.supplyId, diff, 'saida', `Ajuste (saída) em ficha clínica: ${recordId}`);
        } else if (diff < 0) {
          // Used less (entrada)
          await adjustStockAndCreateMovement(item.supplyId, Math.abs(diff), 'entrada', `Ajuste (entrada) em ficha clínica: ${recordId}`);
        }
      }
    }
  }

  // Now perform actual database inserts/updates/deletes for clinical_record_supplies
  const currentIds = new Set(oldItems.map((x: any) => x.id));
  const nextIds = new Set(items.filter(x => !x.id.startsWith("temp-")).map(x => x.id));

  // Deletions
  for (const cid of currentIds) {
    if (!nextIds.has(cid)) {
      await supabase.from("clinical_record_supplies").delete().eq("id", cid).eq("user_id", userData.user.id);
    }
  }

  // Insertions
  for (const item of items) {
    if (item.id.startsWith("temp-") || !currentIds.has(item.id)) {
      await supabase.from("clinical_record_supplies").insert({
        user_id: userData.user.id,
        clinical_record_id: recordId,
        patient_id: record.patientId,
        supply_id: item.supplyId || null,
        quantity_used: item.quantityUsed || 1,
        unit_cost: item.unitCost || 0,
        total_cost: item.totalCost || 0
      });
    }
  }

  // Updates
  for (const item of items) {
    if (!item.id.startsWith("temp-") && currentIds.has(item.id)) {
      await supabase.from("clinical_record_supplies").update({
        supply_id: item.supplyId || null,
        quantity_used: item.quantityUsed || 1,
        unit_cost: item.unitCost || 0,
        total_cost: item.totalCost || 0
      }).eq("id", item.id).eq("user_id", userData.user.id);
    }
  }
}

export async function deleteClinicalRecord(id: string) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  // Load supplies for this record to estorno
  const { data: currentItems } = await supabase.from("clinical_record_supplies")
    .select("*")
    .eq("clinical_record_id", id)
    .eq("user_id", userData.user.id);
  
  if (currentItems && currentItems.length > 0) {
    for (const item of currentItems) {
      if (item.supply_id) {
        const qty = item.quantity_used || 1;
        // Get current stock
        const { data: sData } = await supabase.from("supplies").select("stock_quantity").eq("id", item.supply_id).single();
        const currentStock = sData ? Number(sData.stock_quantity || 0) : 0;
        const newStock = currentStock + qty;
        
        // Update stock
        await supabase.from("supplies").update({ stock_quantity: newStock }).eq("id", item.supply_id);
        
        // Create movement
        await supabase.from("stock_movements").insert({
          user_id: userData.user.id,
          supply_id: item.supply_id,
          patient_id: item.patient_id,
          movement_type: 'entrada',
          quantity: qty,
          reason: `Estorno por exclusão de evolução clínica: ${id}`
        });
      }
    }
  }

  // Delete clinical record supplies explicitly to avoid constraint problems
  await supabase.from("clinical_record_supplies").delete().eq("clinical_record_id", id).eq("user_id", userData.user.id);

  const { error } = await supabase.from("clinical_records").delete().eq("id", id).eq("user_id", userData.user.id);
  if (error) { logSupabaseError("delete clinical_records", error); throw error; }
}

// --- Financeiro: Orçamentos ---

export function useBudgets(patientId?: string): [Budget[], string | null, boolean, boolean] {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tablesMissing, setTablesMissing] = useState(false);

  useEffect(() => {
    let active = true;
    async function fetchBudgets() {
      if (!patientId) {
        if (active) { setBudgets([]); setLoading(false); }
        return;
      }
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          if (active) { setBudgets([]); setLoading(false); setError("Não autenticado"); }
          return;
        }

        const { data: bData, error: bError } = await supabase.from("budgets")
          .select("*")
          .eq("user_id", userData.user.id)
          .eq("patient_id", patientId)
          .order("created_at", { ascending: false });

        if (bError) {
          if (bError.code === "42P01") {
            if (active) { setTablesMissing(true); setLoading(false); }
            return;
          }
          throw bError;
        }

        const budgetIds = (bData || []).map((b: any) => b.id);
        
        let itemsData: any[] = [];
        if (budgetIds.length > 0) {
          const { data: iData, error: iError } = await supabase.from("budget_items")
            .select("*, procedures(name)")
            .eq("user_id", userData.user.id)
            .in("budget_id", budgetIds)
            .order("created_at", { ascending: true });
          
          if (iError) throw iError;
          itemsData = iData || [];
        }

        if (active) {
          const formattedBudgets: Budget[] = (bData || []).map((b: any) => {
            const bItems = itemsData.filter(i => i.budget_id === b.id).map(i => ({
              id: i.id,
              userId: i.user_id,
              budgetId: i.budget_id,
              procedureId: i.procedure_id,
              toothNumber: i.tooth_number,
              toothRegion: i.tooth_region,
              description: i.description,
              quantity: i.quantity,
              unitPrice: i.unit_price,
              totalPrice: i.total_price,
              createdAt: i.created_at,
              procedureName: i.procedures?.name
            } as BudgetItem));

            return {
              id: b.id,
              userId: b.user_id,
              patientId: b.patient_id,
              treatmentPlanId: b.treatment_plan_id,
              title: b.title,
              totalAmount: b.total_amount,
              discount: b.discount,
              finalAmount: b.final_amount,
              status: b.status,
              validUntil: b.valid_until,
              notes: b.notes,
              createdAt: b.created_at,
              updatedAt: b.updated_at,
              items: bItems
            } as Budget;
          });
          setBudgets(formattedBudgets);
          setLoading(false);
        }
      } catch (err: any) {
        logSupabaseError("useBudgets", err);
        if (active) {
          setError(err.message || "Erro ao carregar orçamentos");
          setLoading(false);
        }
      }
    }
    fetchBudgets();
    return () => { active = false; };
  }, [patientId]);

  return [budgets, error, loading, tablesMissing];
}

export async function saveBudget(budget: Budget, items: BudgetItem[]) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");

  const dbObj = {
    user_id: userData.user.id,
    patient_id: budget.patientId,
    treatment_plan_id: budget.treatmentPlanId || null,
    title: budget.title,
    total_amount: budget.totalAmount || 0,
    discount: budget.discount || 0,
    final_amount: budget.finalAmount || 0,
    status: budget.status || "rascunho",
    valid_until: budget.validUntil || null,
    notes: budget.notes
  };

  let budgetId = budget.id;
  if (budgetId && !budgetId.startsWith("temp-")) {
    const { error } = await supabase.from("budgets").update({ ...dbObj, updated_at: new Date().toISOString() }).eq("id", budgetId).eq("user_id", userData.user.id);
    if (error) { logSupabaseError("update budgets", error); throw error; }
  } else {
    const { data, error } = await supabase.from("budgets").insert(dbObj).select().single();
    if (error) { logSupabaseError("insert budgets", error); throw error; }
    budgetId = (data as any).id;
  }

  // Handle items sync
  const { data: currentItems, error: itemsError } = await supabase.from("budget_items")
    .select("id")
    .eq("budget_id", budgetId)
    .eq("user_id", userData.user.id);
  
  if (itemsError) throw itemsError;

  const currentIds = new Set((currentItems || []).map((x: any) => x.id));
  const nextIds = new Set(items.filter(x => !x.id.startsWith("temp-")).map(x => x.id));

  for (const cid of currentIds) {
    if (!nextIds.has(cid)) {
      await supabase.from("budget_items").delete().eq("id", cid).eq("user_id", userData.user.id);
    }
  }

  for (const item of items) {
    const iObj = {
      user_id: userData.user.id,
      budget_id: budgetId,
      procedure_id: item.procedureId || null,
      tooth_number: item.toothNumber,
      tooth_region: item.toothRegion,
      description: item.description,
      quantity: item.quantity || 1,
      unit_price: item.unitPrice || 0,
      total_price: item.totalPrice || 0
    };
    
    if (item.id.startsWith("temp-") || !currentIds.has(item.id)) {
      await supabase.from("budget_items").insert(iObj);
    } else {
      await supabase.from("budget_items").update(iObj).eq("id", item.id).eq("user_id", userData.user.id);
    }
  }
}

export async function deleteBudget(id: string) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  const { error } = await supabase.from("budgets").delete().eq("id", id).eq("user_id", userData.user.id);
  if (error) { logSupabaseError("delete budgets", error); throw error; }
}

export async function updateBudgetStatus(id: string, status: string) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  const { error } = await supabase.from("budgets").update({ status, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", userData.user.id);
  if (error) { logSupabaseError("update budget status", error); throw error; }
}

// --- Financeiro: Parcelas ---

export function useInstallments(patientId?: string): [PaymentInstallment[], boolean] {
  const [installments, setInstallments] = useState<PaymentInstallment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function fetch() {
      if (!patientId) { if (active) { setInstallments([]); setLoading(false); } return; }
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        const { data, error } = await supabase.from("payment_installments")
          .select("*")
          .eq("user_id", userData.user.id)
          .eq("patient_id", patientId)
          .order("due_date", { ascending: true })
          .order("installment_number", { ascending: true });

        if (error) {
          if (error.code !== "42P01") throw error;
          if (active) setLoading(false);
          return;
        }
        
        if (active && data) {
          setInstallments(data.map((d: any) => ({
            id: d.id,
            userId: d.user_id,
            patientId: d.patient_id,
            budgetId: d.budget_id,
            installmentNumber: d.installment_number,
            amount: d.amount,
            paidAmount: d.paid_amount,
            remainingAmount: d.remaining_amount,
            dueDate: d.due_date,
            status: d.status,
            notes: d.notes,
            createdAt: d.created_at,
            updatedAt: d.updated_at
          })));
          setLoading(false);
        }
      } catch (err) {
        logSupabaseError("useInstallments", err);
        if (active) setLoading(false);
      }
    }
    fetch();
    return () => { active = false; };
  }, [patientId]);

  return [installments, loading];
}

export async function saveInstallments(installments: Partial<PaymentInstallment>[]) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");

  for (const inst of installments) {
    const dbObj = {
      user_id: userData.user.id,
      patient_id: inst.patientId,
      budget_id: inst.budgetId,
      installment_number: inst.installmentNumber,
      amount: inst.amount || 0,
      paid_amount: inst.paidAmount || 0,
      remaining_amount: inst.remainingAmount || 0,
      due_date: inst.dueDate,
      status: inst.status || 'pendente',
      notes: inst.notes
    };

    if (inst.id && !inst.id.startsWith("temp-")) {
      const { error } = await supabase.from("payment_installments").update({ ...dbObj, updated_at: new Date().toISOString() }).eq("id", inst.id).eq("user_id", userData.user.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("payment_installments").insert(dbObj);
      if (error) throw error;
    }
  }
}

export async function updateInstallmentStatus(id: string, updates: Partial<PaymentInstallment>) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  const dbObj: any = { updated_at: new Date().toISOString() };
  if (updates.status !== undefined) dbObj.status = updates.status;
  if (updates.paidAmount !== undefined) dbObj.paid_amount = updates.paidAmount;
  if (updates.remainingAmount !== undefined) dbObj.remaining_amount = updates.remainingAmount;
  if (updates.dueDate !== undefined) dbObj.due_date = updates.dueDate;
  if (updates.amount !== undefined) dbObj.amount = updates.amount;

  const { error } = await supabase.from("payment_installments").update(dbObj).eq("id", id).eq("user_id", userData.user.id);
  if (error) { logSupabaseError("update installment", error); throw error; }
}

// --- Financeiro: Pagamentos ---

export function usePayments(patientId?: string): [Payment[], boolean] {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function fetch() {
      if (!patientId) { if (active) { setPayments([]); setLoading(false); } return; }
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        const { data, error } = await supabase.from("payments")
          .select("*, payment_splits(*)")
          .eq("user_id", userData.user.id)
          .eq("patient_id", patientId)
          .order("payment_date", { ascending: false });

        if (error) {
          if (error.code !== "42P01") throw error;
          if (active) setLoading(false);
          return;
        }
        
        if (active && data) {
          setPayments(data.map((d: any) => ({
            id: d.id,
            userId: d.user_id,
            patientId: d.patient_id,
            budgetId: d.budget_id,
            installmentId: d.installment_id,
            amount: d.amount,
            paymentMethod: d.payment_method,
            paymentDate: d.payment_date,
            cardFee: d.card_fee,
            netAmount: d.net_amount,
            notes: d.notes,
            attachmentUrl: d.attachment_url,
            createdAt: d.created_at,
            splits: (d.payment_splits || []).map((s: any) => ({
              id: s.id,
              userId: s.user_id,
              paymentId: s.payment_id,
              paymentMethod: s.payment_method,
              amount: s.amount,
              createdAt: s.created_at
            }))
          })));
          setLoading(false);
        }
      } catch (err) {
        logSupabaseError("usePayments", err);
        if (active) setLoading(false);
      }
    }
    fetch();
    return () => { active = false; };
  }, [patientId]);

  return [payments, loading];
}

export async function savePayment(payment: Partial<Payment>, splits: Partial<PaymentSplit>[], installmentToUpdate?: Partial<PaymentInstallment>) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");

  const dbObj = {
    user_id: userData.user.id,
    patient_id: payment.patientId,
    budget_id: payment.budgetId || null,
    installment_id: payment.installmentId || null,
    amount: payment.amount || 0,
    payment_method: payment.paymentMethod || null,
    payment_date: payment.paymentDate || new Date().toISOString().split("T")[0],
    card_fee: payment.cardFee || 0,
    net_amount: payment.netAmount || 0,
    notes: payment.notes
  };

  let paymentId = payment.id;
  if (paymentId && !paymentId.startsWith("temp-")) {
    const { error } = await supabase.from("payments").update(dbObj).eq("id", paymentId).eq("user_id", userData.user.id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("payments").insert(dbObj).select().single();
    if (error) throw error;
    paymentId = (data as any).id;
  }

  // Payment splits
  for (const s of splits) {
    if (s.id && !s.id.startsWith("temp-")) continue; // Only handle new splits for now
    await supabase.from("payment_splits").insert({
      user_id: userData.user.id,
      payment_id: paymentId,
      payment_method: s.paymentMethod,
      amount: s.amount
    });
  }

  // Update installment status if provided
  if (installmentToUpdate) {
    const { error } = await supabase.from("payment_installments").update({
      paid_amount: installmentToUpdate.paidAmount,
      remaining_amount: installmentToUpdate.remainingAmount,
      status: installmentToUpdate.status,
      updated_at: new Date().toISOString()
    }).eq("id", installmentToUpdate.id).eq("user_id", userData.user.id);
    if (error) throw error;
  }
}

export async function deletePayment(payment: Payment) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  // First delete the payment (which cascades splits or we delete splits first)
  const { error: splitError } = await supabase.from("payment_splits").delete().eq("payment_id", payment.id).eq("user_id", userData.user.id);
  if (splitError) throw splitError;

  const { error } = await supabase.from("payments").delete().eq("id", payment.id).eq("user_id", userData.user.id);
  if (error) { logSupabaseError("delete payment", error); throw error; }

  // Recalculate if it has an installment
  if (payment.installmentId) {
    const { data: instData } = await supabase.from("payment_installments").select("*").eq("id", payment.installmentId).single();
    if (instData) {
      const newPaid = Math.max(0, Number(instData.paid_amount) - payment.amount);
      const newRem = instData.amount - newPaid;
      const newStatus = newRem <= 0.01 ? "pago" : (newPaid > 0 ? "parcialmente pago" : "pendente");
      await supabase.from("payment_installments").update({
        paid_amount: newPaid,
        remaining_amount: newRem,
        status: newStatus,
        updated_at: new Date().toISOString()
      }).eq("id", payment.installmentId).eq("user_id", userData.user.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Appointments / Agenda
// ---------------------------------------------------------------------------

export function useAppointments(patientId?: string): [Appointment[], boolean, boolean] {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tablesMissing, setTablesMissing] = useState(false);

  useEffect(() => {
    let active = true;
    async function fetchAppointments() {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          if (active) setLoading(false);
          return;
        }

        let query = supabase.from("appointments")
          .select("*, patients(full_name, phone), procedures(name), treatment_plans(title)")
          .eq("user_id", userData.user.id);

        if (patientId) {
          query = query.eq("patient_id", patientId);
        }

        query = query.order("appointment_date", { ascending: true })
                     .order("start_time", { ascending: true });

        const { data, error } = await query;

        if (error) {
          if (error.code === "42P01" || error.code === "42703") {
            if (active) { setTablesMissing(true); setLoading(false); }
            return;
          }
          throw error;
        }

        if (active && data) {
          setAppointments(data.map((d: any) => ({
            id: d.id,
            userId: d.user_id,
            patientId: d.patient_id,
            procedureId: d.procedure_id,
            treatmentPlanId: d.treatment_plan_id,
            title: d.title || `Consulta - ${d.patients?.full_name || ''}`,
            appointmentDate: d.appointment_date,
            startTime: d.start_time,
            endTime: d.end_time,
            status: d.status,
            type: d.type || 'consulta',
            notes: d.notes,
            whatsappReminder: d.whatsapp_reminder ?? false,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
            patientName: d.patients?.full_name || 'Paciente Não Identificado',
            patientPhone: d.patients?.phone || '',
            procedureName: d.procedures?.name || '',
            treatmentPlanTitle: d.treatment_plans?.title || ''
          })));
          setLoading(false);
        }
      } catch (err: any) {
        logSupabaseError("useAppointments", err);
        if (active) {
          if (err.message?.includes("column") || err.message?.includes("relation")) {
            setTablesMissing(true);
          }
          setLoading(false);
        }
      }
    }
    fetchAppointments();
    return () => { active = false; };
  }, [patientId]);

  return [appointments, loading, tablesMissing];
}

export async function saveAppointment(app: Appointment) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");

  const dbObj = {
    user_id: userData.user.id,
    patient_id: app.patientId,
    procedure_id: app.procedureId || null,
    treatment_plan_id: app.treatmentPlanId || null,
    title: app.title,
    appointment_date: app.appointmentDate,
    start_time: app.startTime,
    end_time: app.endTime,
    status: app.status || "agendado",
    type: app.type || "consulta",
    notes: app.notes || null,
    whatsapp_reminder: app.whatsappReminder ?? false
  };

  if (app.id && !app.id.startsWith("temp-")) {
    const { error } = await supabase.from("appointments")
      .update({ ...dbObj, updated_at: new Date().toISOString() })
      .eq("id", app.id)
      .eq("user_id", userData.user.id);
    if (error) { logSupabaseError("update appointments", error); throw error; }
  } else {
    const { error } = await supabase.from("appointments").insert(dbObj);
    if (error) { logSupabaseError("insert appointments", error); throw error; }
  }
}

export async function deleteAppointment(id: string) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  const { error } = await supabase.from("appointments")
    .delete()
    .eq("id", id)
    .eq("user_id", userData.user.id);
  if (error) { logSupabaseError("delete appointments", error); throw error; }
}
