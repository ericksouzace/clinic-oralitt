import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

export type WhatsAppProvider = "manual" | "meta";

export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: string;
  body: string;
  variables: string[];
  isActive: boolean;
}

export interface WhatsAppMessageLog {
  id: string;
  patientId: string;
  patientName?: string;
  appointmentId?: string;
  phone: string;
  message: string;
  status: "pendente" | "agendada" | "enviada" | "falhou" | "aberta_manual" | "aceito_meta" | "entregue" | "lida" | "manual_copiada" | "manual_aberta" | "manual_erro";
  errorMessage?: string;
  createdAt: string;
  templateId?: string;
  provider: WhatsAppProvider;
  origin?: string;
}

export interface WhatsAppSettings {
  provider: WhatsAppProvider;
  clinicName: string;
  clinicPhone?: string;
  requireConsent: boolean;
  dailyLimit: number;
  sendWindowStart: string;
  sendWindowEnd: string;
  defaultSignature: string;
  customApiUrl?: string;
  customInstance?: string;
}

// ─── Presets ──────────────────────────────────────────────────────────────────

export const DEFAULT_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: "tpl-confirmacao",
    name: "Confirmação de Consulta",
    category: "agenda",
    body: "Olá, {{paciente_primeiro_nome}}! Tudo bem? Passando para confirmar seu atendimento de {{procedimento_ou_plano}} na {{clinica_nome}} no dia {{data_consulta}} às {{hora_consulta}}. Podemos confirmar?",
    variables: ["paciente_primeiro_nome", "clinica_nome", "data_consulta", "hora_consulta", "procedimento_ou_plano"],
    isActive: true
  },
  {
    id: "tpl-lembrete-24h",
    name: "Lembrete de Consulta",
    category: "agenda",
    body: "Olá, {{paciente_primeiro_nome}}! Lembramos que seu atendimento de {{procedimento_ou_plano}} está agendado para amanhã, dia {{data_consulta}}, às {{hora_consulta}}, na {{clinica_nome}}. Nos vemos logo! 😊",
    variables: ["paciente_primeiro_nome", "data_consulta", "hora_consulta", "clinica_nome", "procedimento_ou_plano"],
    isActive: true
  },
  {
    id: "tpl-lembrete-dia",
    name: "Lembrete no dia",
    category: "agenda",
    body: "Olá, {{paciente_primeiro_nome}}! Seu atendimento de {{procedimento_ou_plano}} na {{clinica_nome}} está marcado para hoje às {{hora_consulta}}. Estamos aguardando você.",
    variables: ["paciente_primeiro_nome", "clinica_nome", "hora_consulta", "procedimento_ou_plano"],
    isActive: true
  },
  {
    id: "tpl-reagendamento",
    name: "Reagendamento",
    category: "agenda",
    body: "Olá, {{paciente_primeiro_nome}}! Precisamos ajustar o horário do seu atendimento de {{procedimento_ou_plano}}. Pode nos informar quais horários ficam melhores para você?",
    variables: ["paciente_primeiro_nome", "procedimento_ou_plano"],
    isActive: true
  },
  {
    id: "tpl-pos-atendimento",
    name: "Pós-atendimento",
    category: "ficha_clinica",
    body: "Olá, {{paciente_primeiro_nome}}! Como você está se sentindo após o procedimento de {{procedimento_ou_plano}} realizado hoje? Qualquer dúvida ou desconforto, estamos à disposição.",
    variables: ["paciente_primeiro_nome", "procedimento_ou_plano"],
    isActive: true
  },
  {
    id: "tpl-orientacoes-pre",
    name: "Orientações pré-procedimento",
    category: "ficha_clinica",
    body: "Olá, {{paciente_primeiro_nome}}! Seguem algumas orientações importantes para o seu procedimento de {{procedimento_ou_plano}} agendado para {{data_consulta}}: [insira orientações pré-operatórias]. Em caso de dúvidas, fale conosco.",
    variables: ["paciente_primeiro_nome", "procedimento_ou_plano", "data_consulta"],
    isActive: true
  },
  {
    id: "tpl-orientacoes-pos",
    name: "Orientações pós-procedimento",
    category: "ficha_clinica",
    body: "Olá, {{paciente_primeiro_nome}}! Seguem as recomendações pós-operatórias para o procedimento de {{procedimento_ou_plano}}: [insira recomendações pós-operatórias]. Evite esforços e mantenha o repouso. Conte conosco na sua recuperação!",
    variables: ["paciente_primeiro_nome", "procedimento_ou_plano"],
    isActive: true
  },
  {
    id: "tpl-orcamento-enviado",
    name: "Orçamento enviado",
    category: "financeiro",
    body: "Olá, {{paciente_primeiro_nome}}! Seu orçamento referente a {{procedimento_ou_plano}} no valor de {{valor}} já está disponível. Podemos tirar suas dúvidas e combinar a forma de pagamento?",
    variables: ["paciente_primeiro_nome", "procedimento_ou_plano", "valor"],
    isActive: true
  },
  {
    id: "tpl-aprovacao-orcamento",
    name: "Aprovação de orçamento",
    category: "financeiro",
    body: "Olá, {{paciente_primeiro_nome}}! Ficamos muito felizes com a aprovação do seu orçamento de {{procedimento_ou_plano}} no valor de {{valor}}. Vamos agendar o início do seu tratamento?",
    variables: ["paciente_primeiro_nome", "procedimento_ou_plano", "valor"],
    isActive: true
  },
  {
    id: "tpl-parcela-vencendo",
    name: "Parcela vencendo",
    category: "financeiro",
    body: "Olá, {{paciente_primeiro_nome}}! Lembramos que a parcela do seu tratamento de {{procedimento_ou_plano}} no valor de {{valor}} vence no dia {{data_vencimento}}. Se precisar do Pix, é só avisar.",
    variables: ["paciente_primeiro_nome", "procedimento_ou_plano", "valor", "data_vencimento"],
    isActive: true
  },
  {
    id: "tpl-parcela-vencida",
    name: "Parcela vencida",
    category: "financeiro",
    body: "Olá, {{paciente_primeiro_nome}}! Identificamos que a parcela referente a {{procedimento_ou_plano}} no valor de {{valor}} está vencida. Podemos ajudar com a regularização?",
    variables: ["paciente_primeiro_nome", "procedimento_ou_plano", "valor"],
    isActive: true
  },
  {
    id: "tpl-retorno-odontologico",
    name: "Retorno odontológico",
    category: "paciente",
    body: "Olá, {{paciente_primeiro_nome}}! Já faz algum tempo desde o seu último tratamento de {{procedimento_ou_plano}}. Gostaríamos de agendar seu retorno preventivo de rotina. Qual o melhor dia para você?",
    variables: ["paciente_primeiro_nome", "procedimento_ou_plano"],
    isActive: true
  },
  {
    id: "tpl-aniversario",
    name: "Aniversário",
    category: "paciente",
    body: "Olá, {{paciente_primeiro_nome}}! A {{clinica_nome}} deseja um feliz aniversário, com muita saúde, alegria e sorrisos! ✨",
    variables: ["paciente_primeiro_nome", "clinica_nome"],
    isActive: true
  }
];

const DEFAULT_SETTINGS: WhatsAppSettings = {
  provider: "manual",
  clinicName: "Clínica Oralit",
  clinicPhone: "",
  requireConsent: false,
  dailyLimit: 100,
  sendWindowStart: "08:00",
  sendWindowEnd: "18:00",
  defaultSignature: "Clínica Oralit"
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function normalizeBrazilPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 0) return "";
  
  // Se já tem código de país
  if (cleaned.startsWith("55") && cleaned.length >= 12) {
    return cleaned;
  }
  
  // Adiciona código de país 55
  if (cleaned.length === 10 || cleaned.length === 11) {
    return "55" + cleaned;
  }
  
  return cleaned;
}

export function buildWaMeLink(phone: string, message: string): string {
  const normalized = normalizeBrazilPhone(phone);
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function renderWhatsAppTemplate(templateBody: string, context: Record<string, any>): string {
  let rendered = templateBody;
  const keys = Object.keys(context);
  for (const key of keys) {
    const value = context[key] !== undefined && context[key] !== null ? String(context[key]) : "";
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi");
    rendered = rendered.replace(regex, value);
  }
  return rendered;
}

// Check database error helper
export function isTableMissingError(err: any): boolean {
  if (!err) return false;
  const code = err.code || "";
  const msg = err.message || "";
  return code === "42P01" || msg.includes("does not exist") || msg.includes("relation") || msg.includes("PGRST205");
}

export interface DbCheckResult {
  ready: boolean;
  missingTables: string[];
  rlsErrors: Record<string, string>;
  otherErrors: Record<string, string>;
}

export async function checkWhatsappDatabaseReady(): Promise<DbCheckResult> {
  const result: DbCheckResult = {
    ready: true,
    missingTables: [],
    rlsErrors: {},
    otherErrors: {}
  };

  const tables = ["whatsapp_settings", "message_templates", "message_logs", "message_queue"];

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select("id").limit(1);
      if (error) {
        console.error(`[WhatsApp DB Check] Error on table "${table}":`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });

        if (isTableMissingError(error)) {
          result.missingTables.push(table);
          result.ready = false;
        } else if (error.code === "42501" || error.message?.includes("row-level security")) {
          result.rlsErrors[table] = error.message || "Erro de permissão RLS";
        } else {
          result.otherErrors[table] = `${error.code}: ${error.message}`;
        }
      }
    } catch (e: any) {
      console.error(`[WhatsApp DB Check] Exception on table "${table}":`, e);
      result.otherErrors[table] = e.message || "Exceção inesperada";
    }
  }

  return result;
}

// ─── Database Operations ──────────────────────────────────────────────────────

// Settings
export async function getWhatsAppSettings(): Promise<{ settings: WhatsAppSettings; missingTable: boolean }> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { settings: DEFAULT_SETTINGS, missingTable: false };

    const { data, error } = await supabase
      .from("whatsapp_settings")
      .select("*")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (error) {
      if (isTableMissingError(error)) {
        // Fallback local
        const local = localStorage.getItem("oralit:whatsapp_settings");
        return { 
          settings: local ? JSON.parse(local) : DEFAULT_SETTINGS, 
          missingTable: true 
        };
      }
      throw error;
    }

    if (data) {
      return {
        settings: {
          provider: data.provider as WhatsAppProvider,
          clinicName: data.clinic_name,
          clinicPhone: data.clinic_phone || "",
          requireConsent: data.require_consent,
          dailyLimit: data.daily_limit,
          sendWindowStart: data.send_window_start?.slice(0, 5) || "08:00",
          sendWindowEnd: data.send_window_end?.slice(0, 5) || "18:00",
          defaultSignature: data.default_signature || ""
        },
        missingTable: false
      };
    }

    // Auto-inserir registro padrão se a tabela existe mas o registro do usuário não existe
    const dbPayload = {
      user_id: userData.user.id,
      provider: DEFAULT_SETTINGS.provider,
      clinic_name: DEFAULT_SETTINGS.clinicName,
      clinic_phone: DEFAULT_SETTINGS.clinicPhone || null,
      require_consent: DEFAULT_SETTINGS.requireConsent,
      daily_limit: DEFAULT_SETTINGS.dailyLimit,
      send_window_start: DEFAULT_SETTINGS.sendWindowStart + ":00",
      send_window_end: DEFAULT_SETTINGS.sendWindowEnd + ":00",
      default_signature: DEFAULT_SETTINGS.defaultSignature
    };

    const { data: inserted, error: insertError } = await supabase
      .from("whatsapp_settings")
      .insert(dbPayload)
      .select()
      .maybeSingle();

    if (insertError) {
      console.error("Failed to insert default whatsapp settings:", insertError);
      return { settings: DEFAULT_SETTINGS, missingTable: false };
    }

    if (inserted) {
      return {
        settings: {
          provider: inserted.provider as WhatsAppProvider,
          clinicName: inserted.clinic_name,
          clinicPhone: inserted.clinic_phone || "",
          requireConsent: inserted.require_consent,
          dailyLimit: inserted.daily_limit,
          sendWindowStart: inserted.send_window_start?.slice(0, 5) || "08:00",
          sendWindowEnd: inserted.send_window_end?.slice(0, 5) || "18:00",
          defaultSignature: inserted.default_signature || ""
        },
        missingTable: false
      };
    }

    return { settings: DEFAULT_SETTINGS, missingTable: false };
  } catch (err) {
    console.error("Error fetching whatsapp settings:", err);
    return { settings: DEFAULT_SETTINGS, missingTable: true };
  }
}

export async function saveWhatsAppSettings(settings: WhatsAppSettings): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  const dbPayload = {
    user_id: userData.user.id,
    provider: settings.provider,
    clinic_name: settings.clinicName,
    clinic_phone: settings.clinicPhone || null,
    require_consent: settings.requireConsent,
    daily_limit: settings.dailyLimit,
    send_window_start: settings.sendWindowStart + ":00",
    send_window_end: settings.sendWindowEnd + ":00",
    default_signature: settings.defaultSignature
  };

  try {
    const { error } = await supabase
      .from("whatsapp_settings")
      .upsert(dbPayload, { onConflict: "user_id" });

    if (error) {
      if (isTableMissingError(error)) {
        localStorage.setItem("oralit:whatsapp_settings", JSON.stringify(settings));
        toast.info("Configuração salva localmente (tabela Supabase ausente).");
        return;
      }
      throw error;
    }
    toast.success("Configurações atualizadas no banco de dados!");
  } catch (err: any) {
    console.error("Failed to save whatsapp settings:", err);
    toast.error("Erro ao salvar configurações: " + err.message);
  }
}

// Templates
export async function getWhatsAppTemplates(): Promise<{ templates: WhatsAppTemplate[]; missingTable: boolean }> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { templates: DEFAULT_TEMPLATES, missingTable: false };

    const { data, error } = await supabase
      .from("message_templates")
      .select("*")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: true });

    if (error) {
      if (isTableMissingError(error)) {
        const local = localStorage.getItem("oralit:whatsapp_templates");
        return { 
          templates: local ? JSON.parse(local) : DEFAULT_TEMPLATES, 
          missingTable: true 
        };
      }
      throw error;
    }

    if (data && data.length > 0) {
      const formatted = data.map((t: any) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        body: t.body,
        variables: t.variables || [],
        isActive: t.is_active
      }));
      return { templates: formatted, missingTable: false };
    }

    // Retorna vazio para que o frontend possa oferecer a criação dos modelos padrões
    return { templates: [], missingTable: false };
  } catch (err) {
    console.error("Error fetching templates:", err);
    return { templates: DEFAULT_TEMPLATES, missingTable: true };
  }
}

export async function createDefaultTemplates(): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  const dbPayloads = DEFAULT_TEMPLATES.map(tpl => ({
    user_id: userData.user.id,
    name: tpl.name,
    category: tpl.category,
    body: tpl.body,
    variables: tpl.variables,
    is_active: tpl.isActive
  }));

  try {
    const { error } = await supabase
      .from("message_templates")
      .insert(dbPayloads);

    if (error) throw error;
    toast.success("Templates padrão criados com sucesso!");
  } catch (err: any) {
    console.error("Failed to create default templates:", err);
    toast.error("Erro ao criar templates padrão: " + err.message);
  }
}

export async function saveWhatsAppTemplate(template: WhatsAppTemplate): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  const isNew = template.id.startsWith("tpl-") || template.id.length < 10;
  const idValue = isNew ? undefined : template.id;

  const dbPayload = {
    id: idValue,
    user_id: userData.user.id,
    name: template.name,
    category: template.category,
    body: template.body,
    variables: template.variables,
    is_active: template.isActive,
    updated_at: new Date().toISOString()
  };

  try {
    const { error } = await supabase
      .from("message_templates")
      .upsert(dbPayload);

    if (error) {
      if (isTableMissingError(error)) {
        const { templates } = await getWhatsAppTemplates();
        let nextTemplates;
        const exists = templates.some(t => t.id === template.id);
        if (exists) {
          nextTemplates = templates.map(t => t.id === template.id ? template : t);
        } else {
          nextTemplates = [...templates, { ...template, id: crypto.randomUUID() }];
        }
        localStorage.setItem("oralit:whatsapp_templates", JSON.stringify(nextTemplates));
        toast.info("Template salvo localmente (tabela Supabase ausente).");
        return;
      }
      throw error;
    }
    toast.success("Template salvo com sucesso!");
  } catch (err: any) {
    console.error("Failed to save template:", err);
    toast.error("Erro ao salvar template: " + err.message);
  }
}

export async function deleteWhatsAppTemplate(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("message_templates")
      .delete()
      .eq("id", id);

    if (error) {
      if (isTableMissingError(error)) {
        const { templates } = await getWhatsAppTemplates();
        const nextTemplates = templates.filter(t => t.id !== id);
        localStorage.setItem("oralit:whatsapp_templates", JSON.stringify(nextTemplates));
        toast.info("Template removido localmente.");
        return;
      }
      throw error;
    }
    toast.success("Template excluído.");
  } catch (err: any) {
    console.error("Failed to delete template:", err);
    toast.error("Erro ao excluir: " + err.message);
  }
}

// Logs / Histórico
export async function getWhatsAppLogs(): Promise<{ logs: WhatsAppMessageLog[]; missingTable: boolean }> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { logs: [], missingTable: false };

    // We can also fetch patient name directly from public.patients locally or via select.
    // Querying with relation if possible, else manual match
    const { data, error } = await supabase
      .from("message_logs")
      .select("*")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      if (isTableMissingError(error)) {
        const local = localStorage.getItem("oralit:whatsapp_logs");
        return { 
          logs: local ? JSON.parse(local) : [], 
          missingTable: true 
        };
      }
      throw error;
    }

    if (data) {
      const logs = data.map((d: any) => ({
        id: d.id,
        patientId: d.patient_id,
        appointmentId: d.appointment_id || undefined,
        phone: d.phone,
        message: d.message,
        status: d.status as any,
        errorMessage: d.error_message || undefined,
        createdAt: d.created_at,
        templateId: d.template_id || undefined,
        provider: d.provider as WhatsAppProvider,
        origin: d.budget_id ? "financeiro" : d.appointment_id ? "agenda" : d.clinical_record_id ? "ficha_clinica" : "manual"
      }));
      return { logs, missingTable: false };
    }

    return { logs: [], missingTable: false };
  } catch (err) {
    console.error("Error fetching whatsapp logs:", err);
    return { logs: [], missingTable: true };
  }
}

export async function addWhatsAppLog(log: Omit<WhatsAppMessageLog, "id" | "createdAt">): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  const dbPayload = {
    user_id: userData.user.id,
    patient_id: log.patientId,
    appointment_id: log.appointmentId || null,
    phone: log.phone,
    message: log.message,
    status: log.status,
    error_message: log.errorMessage || null,
    provider: log.provider,
    created_at: new Date().toISOString()
  };

  try {
    const { error } = await supabase
      .from("message_logs")
      .insert(dbPayload);

    if (error) {
      if (isTableMissingError(error)) {
        const local = localStorage.getItem("oralit:whatsapp_logs");
        const list: WhatsAppMessageLog[] = local ? JSON.parse(local) : [];
        const newLogEntry: WhatsAppMessageLog = {
          ...log,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString()
        };
        localStorage.setItem("oralit:whatsapp_logs", JSON.stringify([newLogEntry, ...list].slice(0, 100)));
        return;
      }
      throw error;
    }
  } catch (err) {
    console.error("Failed to insert whatsapp log:", err);
  }
}

// Sending Dispatcher
export async function sendWhatsAppMessage(payload: {
  patientId: string;
  phone: string;
  message: string;
  templateId?: string;
  appointmentId?: string;
  budgetId?: string;
  installmentId?: string;
  clinicalRecordId?: string;
  action?: "copiada" | "aberta_no_whatsapp";
}): Promise<{ success: boolean; status: string; error?: string }> {
  try {
    const link = buildWaMeLink(payload.phone, payload.message);
    const statusVal = payload.action === "copiada" ? "manual_copiada" : "manual_aberta";

    // Salva no log
    await addWhatsAppLog({
      patientId: payload.patientId,
      phone: payload.phone,
      message: payload.message,
      status: statusVal,
      templateId: payload.templateId,
      appointmentId: payload.appointmentId,
      provider: "manual"
    });

    if (payload.action === "aberta_no_whatsapp" || !payload.action) {
      if (typeof window !== "undefined") {
        window.open(link, "_blank", "noopener,noreferrer");
      }
    }

    return { success: true, status: statusVal };
  } catch (err: any) {
    console.error("Error dispatching message:", err);
    let errMsg = err.message || "Erro de envio.";
    if (errMsg.includes("invalid_type") || errMsg.includes("Required") || errMsg.startsWith("[")) {
      errMsg = "Não foi possível enviar a mensagem. Verifique paciente, telefone e texto da mensagem.";
    }
    return { success: false, status: "manual_erro", error: errMsg };
  }
}
