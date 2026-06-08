import React, { useState, useEffect, useMemo, useRef } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import AppLayout from "@/components/AppLayout";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Card, Button, Input, Select, Label, Badge, EmptyState, Textarea } from "@/components/ui-bits";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  MessageCircle, Plus, Edit3, Trash2, Info, AlertTriangle, AlertCircle, RefreshCw, Send, Search, Sparkles, Copy, CheckCircle2, Clipboard
} from "lucide-react";
import { toast } from "sonner";
import { usePatients, useAppointments, useProcedures, useTreatmentPlans, useBudgets, useInstallments } from "@/lib/db";
import {
  WhatsAppTemplate, WhatsAppMessageLog, WhatsAppSettings,
  DEFAULT_TEMPLATES, getWhatsAppSettings, saveWhatsAppSettings,
  getWhatsAppTemplates, saveWhatsAppTemplate, deleteWhatsAppTemplate,
  getWhatsAppLogs, sendWhatsAppMessage, renderWhatsAppTemplate,
  checkWhatsappDatabaseReady, createDefaultTemplates, normalizeBrazilPhone, buildWaMeLink
} from "@/lib/whatsapp";

export const Route = createFileRoute("/whatsapp")({
  head: () => ({ meta: [{ title: "Central WhatsApp — Oralit" }] }),
  component: WhatsAppPage,
  errorComponent: WhatsAppErrorComponent,
});

interface WhatsAppPreferences {
  openInNewTab: boolean;
  autoCopy: boolean;
  saveHistory: boolean;
}

const OBJECTIVE_SUGGESTIONS: Record<string, { label: string; [key: string]: string }> = {
  confirmar_consulta: {
    label: "Confirmar consulta",
    Professional: "Prezado(a) {{paciente_nome}}, confirmamos sua consulta para o procedimento de {{procedimento_ou_plano}} na {{clinica_nome}} no dia {{data_consulta}} às {{hora_consulta}} com o(a) profissional {{profissional_nome}}. Caso necessite reagendar, favor nos avisar com antecedência. Atenciosamente.",
    Friendly: "Olá, {{paciente_primeiro_nome}}! Tudo bem? Passando para confirmar seu atendimento de {{procedimento_ou_plano}} na {{clinica_nome}} no dia {{data_consulta}} às {{hora_consulta}}. Esperamos você com muito carinho! Tenha um ótimo dia! 😊",
    Direct: "Confirmação de consulta: {{paciente_nome}}, dia {{data_consulta}} às {{hora_consulta}} para {{procedimento_ou_plano}} na {{clinica_nome}}. Responda SIM para confirmar ou NÃO para reagendar.",
    Premium: "Olá, {{paciente_primeiro_nome}}. Gostaríamos de confirmar o seu horário exclusivo para {{procedimento_ou_plano}} na {{clinica_nome}} no dia {{data_consulta}} às {{hora_consulta}}. Preparamos nossa estrutura para lhe proporcionar a melhor experiência possível. Até breve.",
    Humanized: "Olá, {{paciente_primeiro_nome}}! Tudo bem por aí? Passando para lembrar que no dia {{data_consulta}} às {{hora_consulta}} temos nosso encontro marcado na {{clinica_nome}} para o procedimento de {{procedimento_ou_plano}}. Tudo certo para nos vermos? ✨"
  },
  lembrar_consulta: {
    label: "Lembrar consulta",
    Professional: "Prezado(a) {{paciente_nome}}, lembramos de sua consulta agendada para {{procedimento_ou_plano}} no dia {{data_consulta}} às {{hora_consulta}} na {{clinica_nome}}.",
    Friendly: "Olá, {{paciente_primeiro_nome}}! Só passando para te lembrar que sua consulta de {{procedimento_ou_plano}} na {{clinica_nome}} está marcada para {{data_consulta}} às {{hora_consulta}}. Nos vemos logo! Boa consulta! 🌸",
    Direct: "Lembrete: Consulta de {{paciente_nome}} para {{procedimento_ou_plano}} na {{clinica_nome}} agendada para {{data_consulta}} às {{hora_consulta}}.",
    Premium: "Olá, {{paciente_primeiro_nome}}. Passando para lembrá-lo da sua consulta de {{procedimento_ou_plano}} amanhã às {{hora_consulta}} na {{clinica_nome}}. Nosso espaço e equipe médica estão prontos para receber você.",
    Humanized: "Olá, {{paciente_primeiro_nome}}! Como vai? Lembra que temos um compromisso com o seu tratamento de {{procedimento_ou_plano}} no dia {{data_consulta}} às {{hora_consulta}}? Estamos animados para te ver. Qualquer dúvida, estamos aqui!"
  },
  cobrar_parcela: {
    label: "Cobrar parcela",
    Professional: "Prezado(a) {{paciente_nome}}, informamos que a sua parcela referente a {{procedimento_ou_plano}} no valor de {{valor}} com vencimento em {{data_vencimento}} está disponível para pagamento. Solicitamos a regularização. Agradecemos a atenção.",
    Friendly: "Olá, {{paciente_primeiro_nome}}! Tudo bem? Só passando para lembrar da sua parcela de {{valor}} referente a {{procedimento_ou_plano}} que vence em {{data_vencimento}}. Se precisar da chave Pix ou do link de pagamento, é só nos avisar por aqui. Muito obrigado! 👍",
    Direct: "Aviso de vencimento: Parcela de {{valor}} para {{procedimento_ou_plano}} vence em {{data_vencimento}}. Chave Pix CNPJ: [insira chave Pix]. Favor enviar comprovante.",
    Premium: "Olá, {{paciente_primeiro_nome}}. Esperamos que esteja bem. Lembramos que o vencimento da parcela do seu plano de tratamento de {{procedimento_ou_plano}} no valor de {{valor}} está agendado para o dia {{data_vencimento}}. Para maior comodidade, você pode efetuar o pagamento via Pix ou transferência. Agradecemos a preferência pela {{clinica_nome}}.",
    Humanized: "Olá, {{paciente_primeiro_nome}}! Tudo bem? Passando para te dar aquele lembrete amigável sobre a mensalidade do seu tratamento de {{procedimento_ou_plano}} ({{valor}}) que vence em {{data_vencimento}}. Nos ajuda muito a manter tudo organizado por aqui! Caso já tenha pago, pode desconsiderar. Obrigado!"
  },
  enviar_orcamento: {
    label: "Enviar orçamento",
    Professional: "Prezado(a) {{paciente_nome}}, enviamos o orçamento detalhado referente ao plano de tratamento de {{procedimento_ou_plano}} na {{clinica_nome}}, totalizando {{valor}}. Ficamos à disposição para esclarecimentos.",
    Friendly: "Olá, {{paciente_primeiro_nome}}! Tudo bem? Conforme conversamos, aqui está o orçamento do seu tratamento de {{procedimento_ou_plano}} no valor de {{valor}}. Preparamos tudo para que você possa conquistar o sorriso dos seus sonhos! Vamos começar? 😉",
    Direct: "Orçamento para {{paciente_nome}}: Valor total do tratamento de {{procedimento_ou_plano}} é {{valor}}. Condições de pagamento em até [X] vezes. Entre em contato para aprovar.",
    Premium: "Olá, {{paciente_primeiro_nome}}. É um privilégio apresentar o seu plano de tratamento de {{procedimento_ou_plano}} na {{clinica_nome}}. O investimento total para a reabilitação do seu sorriso é de {{valor}}, com opções personalizadas de financiamento. Ficamos à sua inteira disposição para agendamentos.",
    Humanized: "Olá, {{paciente_primeiro_nome}}! Tudo bem? Elaboramos com muito cuidado o orçamento do seu tratamento de {{procedimento_ou_plano}} no valor de {{valor}}. Queremos muito te ajudar a ter um sorriso lindo e saudável. Vamos bater um papo para ver qual a melhor forma de pagamento para você?"
  },
  pos_atendimento: {
    label: "Pós-atendimento",
    Professional: "Prezado(a) {{paciente_nome}}, agradecemos a preferência pelos serviços da {{clinica_nome}}. Seguem as recomendações pós-operatórias para o procedimento de {{procedimento_ou_plano}} realizado. Caso sinta dor ou desconforto acentuado, entre em contato imediatamente.",
    Friendly: "Olá, {{paciente_primeiro_nome}}! Como você está se sentindo após o procedimento de {{procedimento_ou_plano}} hoje? Espero que esteja super bem! Lembre-se de tomar os cuidados recomendados. Qualquer coisinha, estamos aqui! 💕",
    Direct: "Pós-atendimento {{paciente_nome}}: Cuidados para o procedimento de {{procedimento_ou_plano}} nas próximas horas. Dúvidas ou dores? Ligue para o consultório.",
    Premium: "Olá, {{paciente_primeiro_nome}}. Esperamos que a sua recuperação após o procedimento de {{procedimento_ou_plano}} hoje esteja ocorrendo com total conforto. Lembre-se de seguir o protocolo prescrito. É uma honra cuidar da sua saúde e bem-estar.",
    Humanized: "Olá, {{paciente_primeiro_nome}}! Como você está depois do procedimento de {{procedimento_ou_plano}} de hoje? Espero que esteja confortável e sem dor. Passando só para lembrar de repousar e tomar os medicamentos se necessário. Estamos acompanhando você de perto! Um abraço!"
  },
  reagendar: {
    label: "Reagendar",
    Professional: "Prezado(a) {{paciente_nome}}, por motivos operacionais, solicitamos o reagendamento da sua consulta de {{procedimento_ou_plano}} marcada para {{data_consulta}} às {{hora_consulta}}. Pedimos desculpas pelo transtorno e solicitamos contato.",
    Friendly: "Olá, {{paciente_primeiro_nome}}! Tudo bem? Precisamos fazer um pequeno ajuste no horário da sua consulta de {{procedimento_ou_plano}}. Você teria disponibilidade para outro dia ou horário? Desculpe o incômodo! 🥺",
    Direct: "Aviso: Consulta de {{paciente_nome}} para {{procedimento_ou_plano}} precisa ser remarcada. Entre em contato ou informe outro horário de preferência.",
    Premium: "Olá, {{paciente_primeiro_nome}}. Gostaria de solicitar a gentileza de reagendarmos o seu atendimento de {{procedimento_ou_plano}} na {{clinica_nome}}. Buscamos garantir o máximo de atenção ao seu caso. Qual o seu melhor horário na próxima semana?",
    Humanized: "Olá, {{paciente_primeiro_nome}}! Tudo bem? Aconteceu um imprevisto na agenda e precisaremos ajustar o seu atendimento de {{procedimento_ou_plano}}. Conseguimos ver um novo dia que fique confortável para você? Sentimos muito pelo ocorrido!"
  },
  recuperar_paciente: {
    label: "Recuperar paciente",
    Professional: "Prezado(a) {{paciente_nome}}, identificamos que seu último atendimento de {{procedimento_ou_plano}} na {{clinica_nome}} ocorreu há algum tempo. Lembramos a importância das consultas de rotina para a manutenção da saúde bucal.",
    Friendly: "Olá, {{paciente_primeiro_nome}}! Sentimos sua falta aqui no consultório desde o seu tratamento de {{procedimento_ou_plano}}! Que tal agendarmos uma limpeza preventiva para deixar seu sorriso brilhando de novo? Vamos marcar? 🥰",
    Direct: "Alerta de retorno: {{paciente_nome}}, já faz tempo desde sua última consulta para {{procedimento_ou_plano}} na {{clinica_nome}}. Agende seu retorno de rotina.",
    Premium: "Olá, {{paciente_primeiro_nome}}. A prevenção é a chave para a longevidade estética e funcional do seu sorriso. Convidamos você para uma consulta de retorno preventivo referente ao seu tratamento de {{procedimento_ou_plano}}.",
    Humanized: "Olá, {{paciente_primeiro_nome}}! Tudo bem? Faz tempo que não te vemos por aqui desde o seu tratamento de {{procedimento_ou_plano}}! Como está a saúde dos seus dentes? Lembre-se que um check-up preventivo evita muitos problemas. Que tal escolhermos um dia para você dar uma passada aqui?"
  },
  mensagem_livre: {
    label: "Mensagem livre",
    Professional: "Prezado(a) {{paciente_nome}}, [escreva sua mensagem livre aqui] - {{clinica_nome}}",
    Friendly: "Olá, {{paciente_primeiro_nome}}! 😊 [escreva sua mensagem livre aqui] - Abraços da equipe {{clinica_nome}}",
    Direct: "[escreva sua mensagem livre aqui]",
    Premium: "Olá, {{paciente_primeiro_nome}}. [escreva sua mensagem livre aqui] - Atenciosamente, {{clinica_nome}}",
    Humanized: "Olá, {{paciente_primeiro_nome}}! Tudo bem? [escreva sua mensagem livre aqui] - Um forte abraço!"
  }
};

const formatCurrency = (val: number | string | undefined | null) => {
  if (val === undefined || val === null) return "R$ 0,00";
  const num = typeof val === "number" ? val : parseFloat(val) || 0;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const formatPhoneForDisplay = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("55") && (cleaned.length === 12 || cleaned.length === 13)) {
    cleaned = cleaned.substring(2);
  }
  if (cleaned.length === 11) {
    return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
  } else if (cleaned.length === 10) {
    return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6)}`;
  }
  return phone;
};

export function WhatsAppPage() {
  const [patients, , patientsLoading, patientsError] = usePatients();
  const [appointments] = useAppointments();
  const [procedures] = useProcedures();

  const [settings, setSettingsState] = useState<WhatsAppSettings>({
    provider: "manual",
    clinicName: "Clínica Oralit",
    requireConsent: false,
    dailyLimit: 100,
    sendWindowStart: "08:00",
    sendWindowEnd: "18:00",
    defaultSignature: "Equipe Clínica Oralit"
  });
  
  const [settingsDraft, setSettingsDraft] = useState<WhatsAppSettings>({ ...settings });
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [logs, setLogs] = useState<WhatsAppMessageLog[]>([]);
  const [missingTablesAlert, setMissingTablesAlert] = useState(false);
  const [missingTables, setMissingTables] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Local preferences
  const [preferences, setPreferences] = useState<WhatsAppPreferences>({
    openInNewTab: true,
    autoCopy: true,
    saveHistory: true
  });

  const [activeTab, setActiveTab] = useState<"painel" | "templates" | "historico" | "configuracoes">("painel");

  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateDraft, setTemplateDraft] = useState<Partial<WhatsAppTemplate>>({});
  
  const [isCustomMsgModalOpen, setIsCustomMsgModalOpen] = useState(false);
  const [customMsgPayload, setCustomMsgPayload] = useState({
    patientId: "",
    phone: "",
    message: "",
    templateId: ""
  });

  // Searchable Patient select states for Modal
  const [patientSearch, setPatientSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Message Creator states
  const [creatorObj, setCreatorObj] = useState("confirmar_consulta");
  const [creatorTone, setCreatorTone] = useState("Premium");
  const [creatorPatientId, setCreatorPatientId] = useState("");
  const [creatorPatientName, setCreatorPatientName] = useState("");
  const [creatorDate, setCreatorDate] = useState("");
  const [creatorTime, setCreatorTime] = useState("");
  const [creatorValue, setCreatorValue] = useState("");
  const [creatorDateVencimento, setCreatorDateVencimento] = useState("");
  const [creatorProcKey, setCreatorProcKey] = useState("");
  const [creatorProcName, setCreatorProcName] = useState("");
  const [isCustomProc, setIsCustomProc] = useState(false);
  const [creatorObs, setCreatorObs] = useState("");
  const [creatorFreeText, setCreatorFreeText] = useState("");


  // Searchable Patient select states for Creator
  const [patientSearchCreator, setPatientSearchCreator] = useState("");
  const [showDropdownCreator, setShowDropdownCreator] = useState(false);

  // History search and filter states
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("todos");

  // Fetch plans, budgets, and installments dynamically based on patient selection
  const [patientPlans] = useTreatmentPlans(creatorPatientId || undefined);
  const [patientBudgets] = useBudgets(creatorPatientId || undefined);
  const [patientInstallments] = useInstallments(creatorPatientId || undefined);

  // Fetch plans, budgets, and installments dynamically for Modal
  const [modalPlans] = useTreatmentPlans(customMsgPayload.patientId || undefined);
  const [modalBudgets] = useBudgets(customMsgPayload.patientId || undefined);
  const [modalInstallments] = useInstallments(customMsgPayload.patientId || undefined);

  // Modal procedure/plan selector states
  const [modalProcKey, setModalProcKey] = useState("");
  const [modalProcName, setModalProcName] = useState("");
  const [modalValue, setModalValue] = useState("");
  const [isCustomProcModal, setIsCustomProcModal] = useState(false);

  // Refs for tracking click outside and patient sync
  const creatorPatientRef = useRef<HTMLDivElement>(null);
  const modalPatientRef = useRef<HTMLDivElement>(null);
  const lastSyncedPatientId = useRef<string | null>(null);
  const lastSyncedModalPatientId = useRef<string | null>(null);

  const loadAll = async () => {
    try {
      setLoadingData(true);
      
      const dbCheck = await checkWhatsappDatabaseReady();
      setMissingTables(dbCheck.missingTables);

      const resSettings = await getWhatsAppSettings();
      const resTemplates = await getWhatsAppTemplates();
      const resLogs = await getWhatsAppLogs();

      // Enforce provider manual as primary
      const cleanSettings = {
        ...resSettings.settings,
        provider: "manual" as const
      };

      setSettingsState(cleanSettings);
      setSettingsDraft(cleanSettings);
      setTemplates(resTemplates.templates);
      setLogs(resLogs.logs);

      if (!dbCheck.ready || resSettings.missingTable || resTemplates.missingTable || resLogs.missingTable) {
        setMissingTablesAlert(true);
      } else {
        setMissingTablesAlert(false);
      }
    } catch (e) {
      console.error(e);
      setMissingTablesAlert(true);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadAll();
    
    // Load local preferences
    const localPrefs = localStorage.getItem("oralit:whatsapp_preferences");
    if (localPrefs) {
      try {
        setPreferences(prev => ({ ...prev, ...JSON.parse(localPrefs) }));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Detect URL search parameters for redirects from Agenda/Finance/etc.
  useEffect(() => {
    if (!loadingData && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const patientId = params.get("patientId");
      const templateId = params.get("templateId");
      
      if (patientId || templateId) {
        const selectedPatient = patients.find(p => p.id === patientId);
        const selectedTemplate = templates.find(t => t.id === templateId) || DEFAULT_TEMPLATES.find(t => t.id === templateId);
        
        let customText = "";
        if (selectedTemplate) {
          const pName = selectedPatient?.fullName || "";
          const pFirst = pName.split(" ")[0] || "";
          
          const context = {
            paciente_nome: pName,
            paciente_primeiro_nome: pFirst,
            clinica_nome: settings.clinicName,
            data_consulta: params.get("data_consulta") || params.get("date") || "dd/mm/aaaa",
            hora_consulta: params.get("hora_consulta") || params.get("time") || "00:00",
            profissional_nome: params.get("profissional_nome") || "Dentista",
            procedimento_nome: params.get("procedimento_nome") || "Procedimento",
            valor: params.get("valor") || params.get("valor_parcela") || params.get("orcamento_valor") || "R$ 0,00",
            valor_parcela: params.get("valor_parcela") || params.get("valor") || "R$ 0,00",
            orcamento_valor: params.get("orcamento_valor") || params.get("valor") || "R$ 0,00",
            data_vencimento: params.get("data_vencimento") || "dd/mm/aaaa",
            plano_nome: params.get("plano_nome") || "Plano de Tratamento",
            mensagem_texto: ""
          };
          customText = renderWhatsAppTemplate(selectedTemplate.body, context);
        } else {
          customText = params.get("message") || "";
        }

        setCustomMsgPayload({
          patientId: patientId || "",
          phone: selectedPatient?.whatsapp || selectedPatient?.phone || "",
          message: customText,
          templateId: templateId || ""
        });
        
        if (selectedPatient) {
          setPatientSearch(selectedPatient.fullName);
        }
        
        setIsCustomMsgModalOpen(true);
        
        // Clear query parameters
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    }
  }, [loadingData, patients, templates, settings.clinicName]);

  // Update Modal message dynamically based on template and procedural context
  const updateModalMessage = (templateId: string, procKey: string, procName: string, val: string, pId: string) => {
    const t = templates.find(x => x.id === templateId) || DEFAULT_TEMPLATES.find(x => x.id === templateId);
    if (!t) return;

    const p = patients.find(x => x.id === pId);
    
    const isBudgetSelected = procKey.startsWith("budget-");
    const isPlanSelected = procKey.startsWith("plan-");
    const isProcSelected = procKey.startsWith("proc-");
    const isCustomSelected = procKey === "custom";

    let procNameContext = "";
    let planNameContext = "";
    let procOuPlanNameContext = "";

    if (isProcSelected) {
      procNameContext = procName;
      procOuPlanNameContext = procName;
    } else if (isBudgetSelected || isPlanSelected) {
      planNameContext = procName;
      procOuPlanNameContext = procName;
    } else if (isCustomSelected) {
      procOuPlanNameContext = procName;
    }

    const finalValue = val && val !== "R$ 0,00" ? val : "";

    const context = {
      paciente_nome: p?.fullName || "Maria Silva",
      paciente_primeiro_nome: (p?.fullName || "Maria").split(" ")[0],
      clinica_nome: settings.clinicName,
      data_consulta: creatorDate || "10/06/2026",
      hora_consulta: creatorTime || "14:30",
      profissional_nome: "Dr. Carlos Dourado",
      procedimento_nome: procNameContext || "",
      plano_nome: planNameContext || "",
      procedimento_ou_plano: procOuPlanNameContext || "seu procedimento",
      valor: finalValue,
      valor_parcela: finalValue,
      orcamento_valor: finalValue,
      data_vencimento: creatorDateVencimento || "15/06/2026",
      mensagem_texto: ""
    };

    const rendered = renderWhatsAppTemplate(t.body, context);
    setCustomMsgPayload(prev => ({
      ...prev,
      message: rendered
    }));
  };

  // Click outside listener to close search dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (creatorPatientRef.current && !creatorPatientRef.current.contains(event.target as Node)) {
        setShowDropdownCreator(false);
      }
      if (modalPatientRef.current && !modalPatientRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync Creator fields when creatorPatientId changes
  useEffect(() => {
    if (!creatorPatientId) {
      lastSyncedPatientId.current = null;
      return;
    }
    if (lastSyncedPatientId.current === creatorPatientId) return;
    lastSyncedPatientId.current = creatorPatientId;

    // 1. Next agendamento
    const patientAppts = appointments.filter(a => a.patientId === creatorPatientId && a.status !== 'cancelado');
    const todayStr = new Date().toISOString().split('T')[0];
    const upcoming = patientAppts
      .filter(a => a.appointmentDate >= todayStr)
      .sort((a, b) => {
        const da = a.appointmentDate + 'T' + a.startTime;
        const db = b.appointmentDate + 'T' + b.startTime;
        return da.localeCompare(db);
      });
    const nextAppt = upcoming[0] || [...patientAppts].sort((a, b) => {
      const da = a.appointmentDate + 'T' + a.startTime;
      const db = b.appointmentDate + 'T' + b.startTime;
      return db.localeCompare(da);
    })[0];

    if (nextAppt) {
      const [y, m, d] = nextAppt.appointmentDate.split('-');
      if (y && m && d) {
        setCreatorDate(`${d}/${m}/${y}`);
      } else {
        setCreatorDate(nextAppt.appointmentDate);
      }
      setCreatorTime(nextAppt.startTime ? nextAppt.startTime.slice(0, 5) : "");
      if (nextAppt.procedureName) {
        setCreatorProcName(nextAppt.procedureName);
      }
    } else {
      setCreatorDate("");
      setCreatorTime("");
    }

    // 2. Unpaid Installment
    if (patientInstallments && patientInstallments.length > 0) {
      const unpaidInstallment = [...patientInstallments]
        .filter(i => i.status === 'pendente' || i.status === 'atrasado')
        .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))[0];

      if (unpaidInstallment) {
        setCreatorValue(formatCurrency(unpaidInstallment.amount));
        if (unpaidInstallment.dueDate) {
          const [y, m, d] = unpaidInstallment.dueDate.split('-');
          if (y && m && d) {
            setCreatorDateVencimento(`${d}/${m}/${y}`);
          } else {
            setCreatorDateVencimento(unpaidInstallment.dueDate);
          }
        } else {
          setCreatorDateVencimento("");
        }
      } else {
        setCreatorValue("");
        setCreatorDateVencimento("");
      }
    } else {
      setCreatorValue("");
      setCreatorDateVencimento("");
    }

    // 3. Plan / Budget
    if (patientBudgets && patientBudgets.length > 0) {
      const activeBudget = patientBudgets.find(b => b.status === 'enviado' || b.status === 'aprovado') || patientBudgets[0];
      setCreatorProcKey(`budget-${activeBudget.id}`);
      setCreatorProcName(activeBudget.title || "Orçamento");
      setCreatorValue(formatCurrency(activeBudget.finalAmount));
    } else if (patientPlans && patientPlans.length > 0) {
      const activePlan = patientPlans[0];
      setCreatorProcKey(`plan-${activePlan.id}`);
      setCreatorProcName(activePlan.title || "Plano de Tratamento");
      const sum = activePlan.items?.reduce((acc, curr) => acc + (curr.estimatedPrice || 0), 0) || 0;
      setCreatorValue(formatCurrency(sum));
    } else {
      setCreatorProcKey("");
      setCreatorProcName("");
    }
  }, [creatorPatientId, appointments, patientInstallments, patientBudgets, patientPlans]);

  // Sync Modal fields when customMsgPayload.patientId changes
  useEffect(() => {
    if (!customMsgPayload.patientId) {
      lastSyncedModalPatientId.current = null;
      return;
    }
    if (lastSyncedModalPatientId.current === customMsgPayload.patientId) return;
    lastSyncedModalPatientId.current = customMsgPayload.patientId;

    if (modalBudgets && modalBudgets.length > 0) {
      const activeBudget = modalBudgets.find(b => b.status === 'enviado' || b.status === 'aprovado') || modalBudgets[0];
      setModalProcKey(`budget-${activeBudget.id}`);
      setModalProcName(activeBudget.title || "Orçamento");
      setModalValue(formatCurrency(activeBudget.finalAmount));
      updateModalMessage(customMsgPayload.templateId, `budget-${activeBudget.id}`, activeBudget.title || "Orçamento", formatCurrency(activeBudget.finalAmount), customMsgPayload.patientId);
    } else if (modalPlans && modalPlans.length > 0) {
      const activePlan = modalPlans[0];
      setModalProcKey(`plan-${activePlan.id}`);
      setModalProcName(activePlan.title || "Plano de Tratamento");
      const sum = activePlan.items?.reduce((acc, curr) => acc + (curr.estimatedPrice || 0), 0) || 0;
      setModalValue(formatCurrency(sum));
      updateModalMessage(customMsgPayload.templateId, `plan-${activePlan.id}`, activePlan.title || "Plano de Tratamento", formatCurrency(sum), customMsgPayload.patientId);
    } else {
      setModalProcKey("");
      setModalProcName("");
      setModalValue("");
      updateModalMessage(customMsgPayload.templateId, "", "", "", customMsgPayload.patientId);
    }
  }, [customMsgPayload.patientId, modalBudgets, modalPlans]);

  // Computed generated message (creatorResult)
  const creatorResult = useMemo(() => {
    if (creatorObj === "mensagem_livre") {
      return creatorFreeText;
    }
    const templateRule = OBJECTIVE_SUGGESTIONS[creatorObj]?.[creatorTone];
    if (!templateRule) return "";

    const pName = creatorPatientName || "Maria Silva";
    const pFirst = pName.split(" ")[0];

    const isBudgetSelected = creatorProcKey.startsWith("budget-");
    const isPlanSelected = creatorProcKey.startsWith("plan-");
    const isProcSelected = creatorProcKey.startsWith("proc-");
    const isCustomSelected = creatorProcKey === "custom";

    let procName = "";
    let planName = "";
    let procOuPlanName = "";

    if (isProcSelected) {
      procName = creatorProcName;
      procOuPlanName = creatorProcName;
    } else if (isBudgetSelected || isPlanSelected) {
      planName = creatorProcName;
      procOuPlanName = creatorProcName;
    } else if (isCustomSelected) {
      procOuPlanName = creatorProcName;
    }

    const finalValue = creatorValue && creatorValue !== "R$ 0,00" ? creatorValue : "";

    const context = {
      paciente_nome: pName,
      paciente_primeiro_nome: pFirst,
      clinica_nome: settings.clinicName,
      data_consulta: creatorDate || "10/06/2026",
      hora_consulta: creatorTime || "14:30",
      profissional_nome: "Dr. Carlos Dourado",
      procedimento_nome: procName || "",
      plano_nome: planName || "",
      procedimento_ou_plano: procOuPlanName || "seu procedimento",
      valor: finalValue,
      valor_parcela: finalValue,
      orcamento_valor: finalValue,
      data_vencimento: creatorDateVencimento || "15/06/2026",
      mensagem_texto: creatorObs || ""
    };

    let result = renderWhatsAppTemplate(templateRule, context);
    if (creatorObs) {
      result += `\n\nObservação: ${creatorObs}`;
    }
    return result;
  }, [creatorObj, creatorTone, creatorPatientName, creatorDate, creatorTime, creatorValue, creatorDateVencimento, creatorProcKey, creatorProcName, creatorObs, creatorFreeText, settings.clinicName]);

  // Sync creatorFreeText template whenever contextual variables change (but not creatorFreeText itself)
  useEffect(() => {
    if (creatorObj === "mensagem_livre") {
      const templateRule = OBJECTIVE_SUGGESTIONS.mensagem_livre?.[creatorTone];
      if (templateRule) {
        const pName = creatorPatientName || "Maria Silva";
        const pFirst = pName.split(" ")[0];
        
        const isBudgetSelected = creatorProcKey.startsWith("budget-");
        const isPlanSelected = creatorProcKey.startsWith("plan-");
        const isProcSelected = creatorProcKey.startsWith("proc-");
        const isCustomSelected = creatorProcKey === "custom";

        let procName = "";
        let planName = "";
        let procOuPlanName = "";

        if (isProcSelected) {
          procName = creatorProcName;
          procOuPlanName = creatorProcName;
        } else if (isBudgetSelected || isPlanSelected) {
          planName = creatorProcName;
          procOuPlanName = creatorProcName;
        } else if (isCustomSelected) {
          procOuPlanName = creatorProcName;
        }

        const finalValue = creatorValue && creatorValue !== "R$ 0,00" ? creatorValue : "";

        const context = {
          paciente_nome: pName,
          paciente_primeiro_nome: pFirst,
          clinica_nome: settings.clinicName,
          data_consulta: creatorDate || "10/06/2026",
          hora_consulta: creatorTime || "14:30",
          profissional_nome: "Dr. Carlos Dourado",
          procedimento_nome: procName || "",
          plano_nome: planName || "",
          procedimento_ou_plano: procOuPlanName || "seu procedimento",
          valor: finalValue,
          valor_parcela: finalValue,
          orcamento_valor: finalValue,
          data_vencimento: creatorDateVencimento || "15/06/2026",
          mensagem_texto: creatorObs || ""
        };
        const initialText = renderWhatsAppTemplate(templateRule, context);
        setCreatorFreeText(initialText);
      }
    } else {
      setCreatorFreeText("");
    }
  }, [creatorObj, creatorTone, creatorPatientName, creatorProcKey, creatorProcName, creatorValue, creatorDate, creatorTime, creatorDateVencimento, creatorObs, settings.clinicName]);

  const handleSaveSettings = async (nextSettings: WhatsAppSettings) => {
    try {
      setSavingSettings(true);
      await saveWhatsAppSettings({
        ...nextSettings,
        provider: "manual"
      });
      setSettingsState({
        ...nextSettings,
        provider: "manual"
      });
      setSettingsDraft({
        ...nextSettings,
        provider: "manual"
      });
      toast.success("Configurações da clínica salvas!");
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível salvar agora.");
    } finally {
      setSavingSettings(false);
    }
  };

  const dummyPreviewContext = {
    paciente_nome: "Maria Silva",
    paciente_primeiro_nome: "Maria",
    clinica_nome: settings.clinicName,
    data_consulta: "10/06/2026",
    hora_consulta: "14:30",
    profissional_nome: "Dr. Carlos Dourado",
    procedimento_nome: "Limpeza Preventiva",
    procedimento_ou_plano: "Limpeza Preventiva",
    valor: "R$ 150,00",
    valor_parcela: "R$ 150,00",
    orcamento_valor: "R$ 150,00",
    data_vencimento: "15/06/2026",
    plano_nome: "Ortodontia Estética",
    mensagem_texto: "Seu tratamento foi concluído com sucesso!"
  };

  const handleDuplicateTemplate = async (tpl: WhatsAppTemplate) => {
    const duplicated: WhatsAppTemplate = {
      ...tpl,
      id: `tpl-custom-${Date.now()}`,
      name: `${tpl.name} (Cópia)`
    };
    await saveWhatsAppTemplate(duplicated);
    loadAll();
  };

  const handleTestTemplate = (tpl: WhatsAppTemplate) => {
    setCustomMsgPayload({
      patientId: "",
      phone: "",
      message: renderWhatsAppTemplate(tpl.body, dummyPreviewContext),
      templateId: tpl.id
    });
    setPatientSearch("");
    setIsCustomMsgModalOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateDraft.name?.trim()) return toast.error("Informe o nome do template.");
    if (!templateDraft.body?.trim()) return toast.error("Informe o texto da mensagem.");
    
    const matches = templateDraft.body.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) || [];
    const variables = matches.map(m => m.replace(/\{\{\s*|\s*\}\}/g, ""));

    const newTpl: WhatsAppTemplate = {
      id: templateDraft.id || `tpl-custom-${Date.now()}`,
      name: templateDraft.name.trim(),
      category: templateDraft.category || "geral",
      body: templateDraft.body.trim(),
      variables: Array.from(new Set(variables)),
      isActive: templateDraft.isActive ?? true
    };

    await saveWhatsAppTemplate(newTpl);
    setIsTemplateModalOpen(false);
    loadAll();
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await deleteWhatsAppTemplate(id);
      toast.success("Template excluído.");
      loadAll();
    } catch (err) {
      toast.error("Não foi possível excluir agora.");
    }
  };

  // Dispatch message manually (Copy or Open wa.me)
  const handleDispatchMessage = async (action: "copiada" | "aberta_no_whatsapp", msgContent?: string, phoneNum?: string, patId?: string, tplId?: string) => {
    const messageText = msgContent !== undefined ? msgContent : customMsgPayload.message;
    const rawPhone = phoneNum !== undefined ? phoneNum : customMsgPayload.phone;
    const finalPatientId = patId !== undefined ? patId : customMsgPayload.patientId;
    const finalTemplateId = tplId !== undefined ? tplId : customMsgPayload.templateId;

    if (!messageText.trim()) {
      return toast.error("Digite ou escolha uma mensagem antes de continuar.");
    }
    if (!rawPhone.trim()) {
      return toast.error("Informe o telefone do paciente.");
    }

    const normalized = normalizeBrazilPhone(rawPhone);
    if (normalized.length < 10) {
      return toast.error("Telefone inválido. Confira DDD e número do paciente.");
    }

    try {
      if (action === "copiada") {
        await navigator.clipboard.writeText(messageText);
        toast.success("Mensagem copiada para a área de transferência!");
      }

      if (preferences.saveHistory) {
        await sendWhatsAppMessage({
          patientId: finalPatientId || "00000000-0000-0000-0000-000000000000",
          phone: normalized,
          message: messageText,
          templateId: finalTemplateId || undefined,
          action: action
        });
      } else if (action === "aberta_no_whatsapp") {
        const link = buildWaMeLink(normalized, messageText);
        window.open(link, preferences.openInNewTab ? "_blank" : "_self", "noopener,noreferrer");
      }

      if (action === "aberta_no_whatsapp") {
        toast.success("WhatsApp aberto com sucesso!");
        setIsCustomMsgModalOpen(false);
      }
      loadAll();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao despachar mensagem: " + err.message);
    }
  };

  // Search filtered patients list for Modal
  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q) {
      return [...patients].sort((a, b) => a.fullName.localeCompare(b.fullName)).slice(0, 10);
    }
    return patients.filter(p => 
      p.fullName.toLowerCase().includes(q) || 
      (p.phone && p.phone.includes(q)) ||
      (p.whatsapp && p.whatsapp.includes(q))
    ).slice(0, 10);
  }, [patients, patientSearch]);

  // Search filtered patients list for Creator
  const filteredPatientsCreator = useMemo(() => {
    const q = patientSearchCreator.trim().toLowerCase();
    if (!q) {
      return [...patients].sort((a, b) => a.fullName.localeCompare(b.fullName)).slice(0, 10);
    }
    return patients.filter(p => 
      p.fullName.toLowerCase().includes(q) || 
      (p.phone && p.phone.includes(q)) ||
      (p.whatsapp && p.whatsapp.includes(q))
    ).slice(0, 10);
  }, [patients, patientSearchCreator]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const q = historySearch.toLowerCase();
      if (q && !log.phone.includes(q) && !log.message.toLowerCase().includes(q)) {
        const patientName = patients.find(p => p.id === log.patientId)?.fullName || "";
        if (!patientName.toLowerCase().includes(q)) return false;
      }
      if (historyStatusFilter !== "todos" && log.status !== historyStatusFilter) return false;
      return true;
    });
  }, [logs, historySearch, historyStatusFilter, patients]);

  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayLogs = logs.filter(l => l.createdAt.startsWith(todayStr));
    const opened = todayLogs.filter(l => l.status === "manual_aberta").length;
    const copied = todayLogs.filter(l => l.status === "manual_copiada").length;
    const hasPhone = patients.filter(p => !!(p.phone || p.whatsapp)).length;
    const lastSend = logs.length > 0 ? new Date(logs[0].createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "Nenhum";

    return { opened, copied, hasPhone, lastSend };
  }, [logs, patients]);

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; tone: "ok" | "danger" | "warn" | "neutral" | "gold"; className?: string }> = {
      manual_copiada: { label: "Copiada", tone: "neutral", className: "bg-[#FFF8E1] text-[#C9A227] border-[#C9A227]/30" },
      manual_aberta:  { label: "Aberta no WhatsApp", tone: "ok", className: "bg-emerald-50 text-emerald-800 border-emerald-100" },
      manual_erro:    { label: "Erro", tone: "danger" }
    };
    const c = map[status] || { label: status, tone: "neutral" };
    return <Badge tone={c.tone} className={c.className}>{c.label}</Badge>;
  };

  // Insert variable at text cursor for Modal Textarea
  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = customMsgPayload.message;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const insertText = `{{${variable}}}`;
    
    const newMessage = before + insertText + after;
    setCustomMsgPayload({
      ...customMsgPayload,
      message: newMessage
    });

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
    }, 50);
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-200">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-5">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-extrabold text-slate-800 flex items-center gap-2">
              <MessageCircle className="h-7 w-7 text-[#C9A227]" />
              Central WhatsApp
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Crie mensagens profissionais e abra o WhatsApp manualmente com segurança.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-gray-200 text-slate-700 hover:bg-gray-50 font-bold"
              onClick={() => {
                setCustomMsgPayload({ patientId: "", phone: "", message: "", templateId: "" });
                setPatientSearch("");
                setIsCustomMsgModalOpen(true);
              }}
            >
              <Send className="h-4 w-4 mr-1.5 text-[#C9A227]" /> Nova mensagem
            </Button>
            <Button
              variant="gold"
              size="sm"
              className="bg-[#C9A227] hover:bg-[#b08f1f] text-white font-bold"
              onClick={() => {
                setTemplateDraft({ id: "", name: "", category: "geral", body: "", isActive: true });
                setIsTemplateModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Criar template
            </Button>
          </div>
        </div>

        {/* Database Missing Warning Banner */}
        {missingTablesAlert && (
          <div className="bg-[#FFF8E1]/40 border border-[#C9A227]/20 rounded-2xl p-4 flex items-start gap-3.5 shadow-sm">
            <AlertTriangle className="h-5 w-5 text-[#C9A227] shrink-0 mt-0.5" />
            <div className="text-xs text-slate-800 space-y-1">
              <p className="font-extrabold text-[#C9A227]">⚠️ Sincronização em Nuvem Indisponível</p>
              <p className="leading-relaxed">
                As tabelas do banco de dados (message_templates, message_logs) estão ausentes ou inacessíveis. 
                O sistema continuará funcionando no **Modo Local Premium** (armazenando templates e histórico no seu navegador).
              </p>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Abertas no WhatsApp", value: stats.opened, desc: "Envios abertos hoje", color: "text-[#C9A227]" },
            { label: "Copiadas Hoje", value: stats.copied, desc: "Copiadas para envio", color: "text-[#C9A227]" },
            { label: "Pacientes com Telefone", value: stats.hasPhone, desc: "Contatos disponíveis", color: "text-slate-700" },
            { label: "Último Envio", value: stats.lastSend, desc: "Horário do último envio", color: "text-[#C9A227]" }
          ].map((stat, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm transition hover:shadow-md">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">{stat.label}</span>
              <div className={`text-2xl font-extrabold ${stat.color} mb-1`}>
                {loadingData ? "—" : stat.value}
              </div>
              <span className="text-[10px] text-slate-400 block">{stat.desc}</span>
            </div>
          ))}
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-100 overflow-x-auto no-scrollbar">
          {[
            { id: "painel", label: "Painel" },
            { id: "templates", label: "Templates" },
            { id: "historico", label: "Histórico manual" },
            { id: "configuracoes", label: "Configurações simples" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-[#C9A227] text-[#C9A227] bg-[#FFF8E1]/10"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* SUBABA: PAINEL / CRIADOR DE MENSAGENS */}
        {activeTab === "painel" && (
          <div className="w-full">
            <Card className="w-full bg-white border-gray-100 p-6 rounded-2xl shadow-sm space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-gray-50">
                <Sparkles className="h-5 w-5 text-[#C9A227]" />
                <div>
                  <h3 className="font-display font-bold text-base text-slate-800">Criador de Mensagens</h3>
                  <p className="text-xs text-slate-400">Gere textos personalizados localmente com base no tom e objetivo da clínica.</p>
                </div>
              </div>

              {/* Row 1: Objetivo & Tom */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-700 font-bold">1. Objetivo da Mensagem</Label>
                  <Select value={creatorObj} onChange={e => setCreatorObj(e.target.value)}>
                    <option value="confirmar_consulta">Confirmar consulta</option>
                    <option value="lembrar_consulta">Lembrar consulta</option>
                    <option value="reagendar">Reagendar consulta</option>
                    <option value="pos_atendimento">Pós-atendimento</option>
                    <option value="enviar_orcamento">Orçamento enviado</option>
                    <option value="cobrar_parcela">Parcela vencendo</option>
                    <option value="parcela_vencida">Parcela vencida</option>
                    <option value="retorno_avaliacao">Retorno de avaliação</option>
                    <option value="recuperar_paciente">Recuperar paciente sumido</option>
                    <option value="aniversario">Aniversário</option>
                    <option value="mensagem_livre">Mensagem livre</option>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-700 font-bold">2. Tom da Linguagem</Label>
                  <Select value={creatorTone} onChange={e => setCreatorTone(e.target.value)}>
                    <option value="Premium">💎 Premium / Sofisticado</option>
                    <option value="Professional">💼 Profissional / Formal</option>
                    <option value="Friendly">😊 Simpático / Acolhedor</option>
                    <option value="Humanized">✨ Humanizado / Próximo</option>
                    <option value="Direct">⚡ Direto / Objetivo</option>
                  </Select>
                </div>
              </div>

              {/* Row 2: Patient & Procedure/Plan */}
              <div className="grid sm:grid-cols-2 gap-4 pt-2">
                {/* Searchable patient selection for Creator */}
                <div className="space-y-1.5" ref={creatorPatientRef}>
                  <Label className="text-xs text-slate-700 font-bold">Selecionar Paciente *</Label>
                  <Popover open={showDropdownCreator} onOpenChange={setShowDropdownCreator}>
                    <PopoverTrigger asChild>
                      <div className="relative cursor-pointer">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <Input
                          placeholder="Pesquisar paciente..."
                          value={patientSearchCreator}
                          onChange={e => {
                            setPatientSearchCreator(e.target.value);
                            setShowDropdownCreator(true);
                            if (!e.target.value) {
                              setCreatorPatientId("");
                              setCreatorPatientName("");
                              setCreatorProcKey("");
                              setCreatorProcName("");
                            }
                          }}
                          onFocus={() => setShowDropdownCreator(true)}
                          className="pl-8 h-8.5 text-xs border-slate-350 bg-white text-slate-900"
                          style={{ backgroundColor: "#FFFFFF", color: "#0F172A", borderColor: "#CBD5E1", opacity: 1 }}
                        />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="p-0 bg-white border border-slate-200 rounded-xl shadow-xl z-[9999] overflow-hidden max-h-60 flex flex-col" 
                      align="start"
                      style={{ width: 'var(--radix-popover-trigger-width)', backgroundColor: '#FFFFFF', opacity: 1 }}
                    >
                      <div className="overflow-y-auto max-h-60">
                        {patientsError ? (
                          <div className="p-3 text-[10px] text-rose-500 font-semibold text-center">Não foi possível carregar pacientes.</div>
                        ) : filteredPatientsCreator.length === 0 ? (
                          <div className="p-3 text-[10px] text-slate-400 text-center">Nenhum paciente cadastrado. Cadastre um paciente para gerar mensagens.</div>
                        ) : (
                          filteredPatientsCreator.map(p => {
                            const isSelected = p.id === creatorPatientId;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                className={`w-full text-left px-4 py-2 text-xs hover:bg-[#FFF8E1]/30 hover:text-[#C9A227] transition border-b border-gray-50 last:border-b-0 flex justify-between items-center font-medium ${
                                  isSelected ? "bg-[#FFF8E1] text-[#C9A227]" : "text-slate-700"
                                }`}
                                onClick={() => {
                                  setCreatorPatientId(p.id);
                                  setCreatorPatientName(p.fullName);
                                  setPatientSearchCreator(p.fullName);
                                  setShowDropdownCreator(false);
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="font-semibold text-slate-800">{p.fullName}</span>
                                  {p.phone || p.whatsapp ? (
                                    <span className="text-[10px] text-slate-400 mt-0.5">{formatPhoneForDisplay(p.whatsapp || p.phone || "")}</span>
                                  ) : null}
                                </div>
                                {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-[#C9A227]" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {creatorPatientId ? (
                    <span className="text-[10px] text-emerald-600 block mt-1 font-bold">
                      Vinculado: {creatorPatientName} {(() => {
                        const p = patients.find(x => x.id === creatorPatientId);
                        const rawPh = p?.whatsapp || p?.phone;
                        return rawPh ? `· ${formatPhoneForDisplay(rawPh)}` : "";
                      })()}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Nenhum paciente selecionado.
                    </span>
                  )}
                </div>

                {/* Integrated Procedimento/Plano selection */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-700 font-bold">Procedimento ou Plano</Label>
                  <Select
                    value={creatorProcKey}
                    onChange={e => {
                      const val = e.target.value;
                      setCreatorProcKey(val);
                      if (val === "custom") {
                        setIsCustomProc(true);
                      } else {
                        setIsCustomProc(false);
                        if (val.startsWith("proc-")) {
                          const id = val.replace("proc-", "");
                          const proc = procedures.find(x => x.id === id);
                          if (proc) {
                            setCreatorProcName(proc.name);
                            setCreatorValue(formatCurrency(proc.suggestedPrice || 0));
                          }
                        } else if (val.startsWith("budget-")) {
                          const id = val.replace("budget-", "");
                          const b = patientBudgets.find(x => x.id === id);
                          if (b) {
                            setCreatorProcName(b.title || "Orçamento");
                            setCreatorValue(formatCurrency(b.finalAmount || 0));
                          }
                        } else if (val.startsWith("plan-")) {
                          const id = val.replace("plan-", "");
                          const pl = patientPlans.find(x => x.id === id);
                          if (pl) {
                            setCreatorProcName(pl.title || "Plano de Tratamento");
                            // Sum items cost
                            const sum = pl.items?.reduce((acc, curr) => acc + (curr.estimatedPrice || 0), 0) || 0;
                            setCreatorValue(formatCurrency(sum));
                          }
                        } else {
                          setCreatorProcName("");
                          setCreatorValue("");
                        }
                      }
                    }}
                  >
                    <option value="">Sem procedimento/plano</option>
                    {procedures && procedures.length > 0 && (
                      <optgroup label="Procedimentos da Clínica">
                        {procedures.map(p => (
                          <option key={`proc-${p.id}`} value={`proc-${p.id}`}>
                            {p.name} ({formatCurrency(p.suggestedPrice || 0)})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {creatorPatientId && patientBudgets && patientBudgets.length > 0 && (
                      <optgroup label="Orçamentos do Paciente">
                        {patientBudgets.map(b => (
                          <option key={`budget-${b.id}`} value={`budget-${b.id}`}>
                            Orçamento: {b.title || "Sem título"} ({formatCurrency(b.finalAmount || 0)})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {creatorPatientId && patientPlans && patientPlans.length > 0 && (
                      <optgroup label="Planos do Paciente">
                        {patientPlans.map(pl => (
                          <option key={`plan-${pl.id}`} value={`plan-${pl.id}`}>
                            Plano: {pl.title || "Sem título"}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <option value="custom">Outro / escrever manualmente</option>
                  </Select>
                </div>
              </div>

              {/* Row 3: Fallback Custom Inputs for Procedure/Plano */}
              {isCustomProc && (
                <div className="grid grid-cols-2 gap-3 mt-2 animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 block font-bold">NOME MANUAL</span>
                    <Input
                      placeholder="Ex: Clareamento Dental"
                      value={creatorProcName}
                      onChange={e => setCreatorProcName(e.target.value)}
                      className="h-8 text-xs border-gray-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 block font-bold">VALOR MANUAL</span>
                    <Input
                      placeholder="Ex: R$ 400,00"
                      value={creatorValue}
                      onChange={e => setCreatorValue(e.target.value)}
                      className="h-8 text-xs border-gray-200"
                    />
                  </div>
                </div>
              )}

              {/* Row 4: Data Consulta, Horário, Vencimento Parcela, Observações */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 block font-bold">DATA CONSULTA</span>
                  <Input
                    placeholder="Ex: 10/06/2026"
                    value={creatorDate}
                    onChange={e => setCreatorDate(e.target.value)}
                    className="h-8 text-xs border-gray-200"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 block font-bold">HORÁRIO</span>
                  <Input
                    placeholder="Ex: 14:30"
                    value={creatorTime}
                    onChange={e => setCreatorTime(e.target.value)}
                    className="h-8 text-xs border-gray-200"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 block font-bold">VENCIMENTO PARCELA</span>
                  <Input
                    placeholder="Ex: 15/06/2026"
                    value={creatorDateVencimento}
                    onChange={e => setCreatorDateVencimento(e.target.value)}
                    className="h-8 text-xs border-gray-200"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 block font-bold">OBSERVAÇÕES</span>
                  <Input
                    placeholder="Ex: Jejum de 2h"
                    value={creatorObs}
                    onChange={e => setCreatorObs(e.target.value)}
                    className="h-8 text-xs border-gray-200"
                  />
                </div>
              </div>

              {/* Row 5: Suggested Output with editable Textarea fallback for Mensagem livre */}
              <div className="bg-[#FFF8E1]/20 border border-[#C9A227]/20 rounded-xl p-4.5 space-y-3.5 mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-[#C9A227]" />
                    {creatorObj === "mensagem_livre" ? "Editor de Mensagem Livre" : "Mensagem Gerada"}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleDispatchMessage("copiada", creatorResult, patients.find(x => x.id === creatorPatientId)?.phone || "55000000000", creatorPatientId)}
                      className="p-1.5 bg-white border hover:bg-gray-50 rounded-lg transition text-slate-600 cursor-pointer"
                      title="Copiar mensagem"
                    >
                      <Clipboard className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        const p = patients.find(x => x.id === creatorPatientId);
                        const ph = p?.whatsapp || p?.phone || "";
                        if (!ph.trim() && creatorPatientId) {
                          return toast.error("Paciente selecionado não possui telefone cadastrado.");
                        }
                        handleDispatchMessage("aberta_no_whatsapp", creatorResult, ph || "55000000000", creatorPatientId);
                      }}
                      className="p-1.5 bg-white border hover:bg-gray-50 hover:text-emerald-600 rounded-lg transition text-slate-600 cursor-pointer"
                      title="Abrir no WhatsApp"
                    >
                      <Send className="h-3.5 w-3.5 text-[#C9A227]" />
                    </button>
                    <button
                      onClick={() => {
                        const p = patients.find(x => x.id === creatorPatientId);
                        setCustomMsgPayload({
                          patientId: creatorPatientId,
                          phone: p?.whatsapp || p?.phone || "",
                          message: creatorResult,
                          templateId: ""
                        });
                        if (p) {
                          setPatientSearch(p.fullName);
                        }
                        setIsCustomMsgModalOpen(true);
                      }}
                      className="px-3 py-1 bg-[#C9A227] hover:bg-[#b08f1f] text-white text-xs font-bold rounded-lg transition cursor-pointer"
                    >
                      Usar no modal
                    </button>
                  </div>
                </div>

                {creatorObj === "mensagem_livre" ? (
                  <textarea
                    placeholder="Escreva aqui a mensagem que deseja enviar ao paciente..."
                    value={creatorFreeText}
                    onChange={e => {
                      setCreatorFreeText(e.target.value);
                    }}
                    rows={5}
                    className="w-full text-xs border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-[#C9A227] focus:border-[#C9A227] bg-white select-text pointer-events-auto"
                  />
                ) : (
                  <p className="text-xs text-slate-700 bg-white border p-3 rounded-lg leading-relaxed select-all">
                    {creatorResult}
                  </p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* SUBABA: TEMPLATES */}
        {activeTab === "templates" && (
          <div className="space-y-6">
            {templates.length === 0 ? (
              <div className="py-12 text-center bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
                <Sparkles className="h-10 w-10 text-[#C9A227] mx-auto mb-3" />
                <h4 className="font-display font-bold text-base text-slate-800 mb-1">Nenhum template encontrado</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mb-4 leading-relaxed">
                  Crie um novo template.
                </p>
                <Button
                  variant="gold"
                  size="sm"
                  className="bg-[#C9A227] hover:bg-[#b08f1f] text-white font-bold"
                  onClick={async () => {
                    await createDefaultTemplates();
                    loadAll();
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Semear templates padrão
                </Button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map(tpl => (
                  <Card key={tpl.id} className="flex flex-col justify-between hover:border-[#C9A227]/30 transition shadow-sm bg-white p-5 rounded-2xl border-gray-100">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-display font-bold text-sm text-slate-800 line-clamp-1">{tpl.name}</h4>
                        <Badge tone={tpl.isActive ? "ok" : "neutral"} className="text-[9px] uppercase font-bold shrink-0">
                          {tpl.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>

                      <div className="flex">
                        <Badge tone="neutral" className="text-[9px] uppercase font-bold">
                          {tpl.category.replace("_", " ")}
                        </Badge>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] text-[#C9A227] font-bold uppercase tracking-wider block">Prévia do Modelo:</span>
                        <p className="text-xs text-slate-800 bg-[#FFF8E1]/10 border border-[#C9A227]/10 p-2.5 rounded-xl leading-relaxed min-h-[60px]">
                          "{renderWhatsAppTemplate(tpl.body, dummyPreviewContext)}"
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end gap-1.5 pt-3 mt-4 border-t border-gray-50">
                      <button
                        className="p-1.5 text-slate-400 hover:text-[#C9A227] hover:bg-gray-50 rounded-lg transition cursor-pointer"
                        onClick={() => {
                          setTemplateDraft(tpl);
                          setIsTemplateModalOpen(true);
                        }}
                        title="Editar template"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1.5 text-slate-400 hover:text-[#C9A227] hover:bg-gray-50 rounded-lg transition cursor-pointer"
                        onClick={() => handleTestTemplate(tpl)}
                        title="Usar template"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1.5 text-slate-400 hover:text-[#C9A227] hover:bg-gray-50 rounded-lg transition cursor-pointer"
                        onClick={() => handleDuplicateTemplate(tpl)}
                        title="Duplicar template"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-gray-50 rounded-lg transition cursor-pointer"
                        onClick={() => handleDeleteTemplate(tpl.id)}
                        title="Excluir template"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SUBABA: HISTÓRICO */}
        {activeTab === "historico" && (
          <Card className="bg-white border-gray-100 p-6 rounded-2xl shadow-sm">
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between mb-4 border-b border-gray-50 pb-4">
              <h3 className="font-display font-bold text-base text-slate-800">Histórico de Mensagens</h3>
              
              <div className="flex flex-wrap w-full md:w-auto gap-2 items-center">
                <div className="relative flex-1 md:w-64 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por paciente, telefone..."
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    className="h-8 w-full rounded-lg border border-gray-200 pl-8 pr-3 text-xs outline-none focus:ring-1 focus:ring-[#C9A227]"
                  />
                </div>
                
                <select
                  value={historyStatusFilter}
                  onChange={e => setHistoryStatusFilter(e.target.value)}
                  className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs outline-none focus:ring-1 focus:ring-[#C9A227]"
                >
                  <option value="todos">Todos os status</option>
                  <option value="manual_aberta">Abertas no WhatsApp</option>
                  <option value="manual_copiada">Copiadas</option>
                  <option value="manual_erro">Falhas</option>
                </select>
              </div>
            </div>

            {missingTablesAlert ? (
              <div className="py-8 text-center text-xs text-rose-500 font-semibold">
                Histórico manual indisponível no momento.
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Nenhum registro de envio manual encontrado.
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-50 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      <th className="py-3 px-6">Data/Hora</th>
                      <th className="py-3 px-3">Paciente</th>
                      <th className="py-3 px-3">Telefone</th>
                      <th className="py-3 px-3">Mensagem</th>
                      <th className="py-3 px-3">Ação Realizada</th>
                      <th className="py-3 px-6 text-right">Canal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map(log => {
                      const pName = patients.find(p => p.id === log.patientId)?.fullName || "Paciente avulso";
                      return (
                        <tr key={log.id} className="border-b border-gray-50/50 hover:bg-gray-50/50 text-xs transition">
                          <td className="py-3.5 px-6 text-slate-400">
                            {new Date(log.createdAt).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-700">{pName}</td>
                          <td className="py-3 px-3 text-slate-500 font-mono">{log.phone}</td>
                          <td className="py-3 px-3 max-w-[200px] truncate text-slate-500" title={log.message}>
                            {log.message}
                          </td>
                          <td className="py-3 px-3">{getStatusBadge(log.status)}</td>
                          <td className="py-3 px-6 text-right font-bold text-slate-400">MANUAL</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* SUBABA: CONFIGURAÇÕES */}
        {activeTab === "configuracoes" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 bg-white border-gray-100 p-6 rounded-2xl shadow-sm space-y-6">
              <h3 className="font-display font-bold text-base text-slate-800 border-b pb-3 flex items-center gap-1.5">
                Configurações Simples
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Defina preferências básicas para mensagens manuais da Clínica Oralit.
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Nome da Clínica</Label>
                  <Input
                    value={settingsDraft.clinicName}
                    onChange={e => setSettingsDraft({ ...settingsDraft, clinicName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone da Clínica (WhatsApp)</Label>
                  <Input
                    value={settingsDraft.clinicPhone || ""}
                    onChange={e => setSettingsDraft({ ...settingsDraft, clinicPhone: e.target.value })}
                    placeholder="Ex: 5585999999999"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Assinatura padrão</Label>
                  <Input
                    value={settingsDraft.defaultSignature}
                    onChange={e => setSettingsDraft({ ...settingsDraft, defaultSignature: e.target.value })}
                    placeholder="Ex: Equipe Clínica Oralit"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-50">
                <Button
                  variant="gold"
                  className="bg-[#C9A227] hover:bg-[#b08f1f] text-white font-bold"
                  onClick={() => handleSaveSettings(settingsDraft)}
                  disabled={savingSettings}
                >
                  {savingSettings ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar configurações"
                  )}
                </Button>
              </div>
            </Card>

            <Card className="bg-white border-gray-100 p-6 rounded-2xl shadow-sm space-y-5">
              <h3 className="font-display font-bold text-base text-slate-800 border-b pb-3">Preferências de Envio</h3>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="prefNewTab"
                    checked={preferences.openInNewTab}
                    onChange={e => {
                      const next = { ...preferences, openInNewTab: e.target.checked };
                      setPreferences(next);
                      localStorage.setItem("oralit:whatsapp_preferences", JSON.stringify(next));
                      toast.success("Preferência atualizada!");
                    }}
                    className="accent-[#C9A227] h-4.5 w-4.5 rounded mt-0.5"
                  />
                  <Label htmlFor="prefNewTab" className="cursor-pointer select-none leading-tight font-medium text-slate-700">
                    Abrir WhatsApp em nova aba
                    <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                      Abre a página wa.me em um novo separador do navegador.
                    </span>
                  </Label>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="prefHistory"
                    checked={preferences.saveHistory}
                    onChange={e => {
                      const next = { ...preferences, saveHistory: e.target.checked };
                      setPreferences(next);
                      localStorage.setItem("oralit:whatsapp_preferences", JSON.stringify(next));
                      toast.success("Preferência atualizada!");
                    }}
                    className="accent-[#C9A227] h-4.5 w-4.5 rounded mt-0.5"
                  />
                  <Label htmlFor="prefHistory" className="cursor-pointer select-none leading-tight font-medium text-slate-700">
                    Registrar histórico manual
                    <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                      Grava o registro de envio no banco de dados local da clínica.
                    </span>
                  </Label>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Modal: Novo/Editar Template */}
        <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
          <DialogContent 
            className="max-w-xl bg-white rounded-2xl p-6 border border-[#E7E2D8] shadow-2xl z-[99999] opacity-100" 
            style={{ backgroundColor: "#FFFFFF", opacity: 1, border: "1px solid #E7E2D8", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
          >
            <DialogHeader>
              <DialogTitle className="text-base font-extrabold text-slate-900">
                {templateDraft.id ? "Editar Template" : "Novo Template"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div>
                <Label className="text-slate-900 font-bold text-xs block mb-1">Nome do Template *</Label>
                <input
                  type="text"
                  placeholder="Ex: Confirmação de Orçamento"
                  value={templateDraft.name || ""}
                  onChange={e => setTemplateDraft({ ...templateDraft, name: e.target.value })}
                  className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-500 outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227] transition"
                  style={{ backgroundColor: "#FFFFFF", color: "#0F172A", borderColor: "#CBD5E1", opacity: 1 }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-slate-900 font-bold text-xs block mb-1">Categoria</Label>
                  <select
                    value={templateDraft.category || "geral"}
                    onChange={e => setTemplateDraft({ ...templateDraft, category: e.target.value })}
                    className="w-full h-9 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227] transition font-medium"
                    style={{ backgroundColor: "#FFFFFF", color: "#0F172A", borderColor: "#CBD5E1", opacity: 1 }}
                  >
                    <option value="agenda">Agenda</option>
                    <option value="financeiro">Financeiro</option>
                    <option value="ficha_clinica">Ficha Clínica</option>
                    <option value="paciente">Paciente</option>
                    <option value="geral">Geral</option>
                  </select>
                </div>
                <div className="flex flex-col justify-end">
                  <div className="flex items-center gap-2 pb-2.5">
                    <input
                      type="checkbox"
                      id="tplActiveCheck"
                      checked={templateDraft.isActive ?? true}
                      onChange={e => setTemplateDraft({ ...templateDraft, isActive: e.target.checked })}
                      className="accent-[#C9A227] h-4.5 w-4.5 rounded cursor-pointer"
                      style={{ opacity: 1 }}
                    />
                    <Label htmlFor="tplActiveCheck" className="mb-0 cursor-pointer select-none font-bold text-xs text-slate-800">Ativar template</Label>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-slate-900 font-bold text-xs block mb-1">Corpo da Mensagem *</Label>
                <textarea
                  placeholder="Escreva sua mensagem. Use tags dinâmicas como {{paciente_primeiro_nome}} para preenchimento automático."
                  value={templateDraft.body || ""}
                  onChange={e => setTemplateDraft({ ...templateDraft, body: e.target.value })}
                  rows={4}
                  className="w-full text-xs border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-[#C9A227] focus:border-[#C9A227] bg-white text-slate-900 placeholder-slate-500 select-text"
                  style={{ backgroundColor: "#FFFFFF", color: "#0F172A", borderColor: "#CBD5E1", opacity: 1 }}
                />
                
                <div className="mt-2 text-[10px] text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-300" style={{ backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }}>
                  <span className="font-bold text-slate-800 block mb-1.5">Variáveis disponíveis (clique para adicionar):</span>
                  <div className="flex flex-wrap gap-1">
                    {["paciente_nome", "paciente_primeiro_nome", "clinica_nome", "data_consulta", "hora_consulta", "profissional_nome", "procedimento_nome", "valor", "data_vencimento"].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setTemplateDraft({ ...templateDraft, body: (templateDraft.body || "") + `{{${tag}}}` })}
                        className="bg-white hover:bg-[#FFF8E1]/40 hover:border-[#C9A227] hover:text-[#C9A227] px-2.5 py-1 rounded-lg border border-slate-300 text-[10px] font-semibold text-slate-800 transition cursor-pointer"
                        style={{ backgroundColor: "#FFFFFF", color: "#1E293B", borderColor: "#CBD5E1", opacity: 1 }}
                      >
                        {`{{`}{tag}{`}}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 border-t pt-4">
              <Button 
                variant="outline" 
                className="border-slate-300 text-slate-800 hover:bg-slate-100 font-bold animate-none" 
                style={{ backgroundColor: "#FFFFFF", color: "#1E293B", borderColor: "#CBD5E1", opacity: 1 }}
                onClick={() => setIsTemplateModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                variant="gold" 
                className="bg-[#C9A227] hover:bg-[#b08f1f] text-white font-extrabold" 
                style={{ backgroundColor: "#C9A227", color: "#FFFFFF", opacity: 1 }}
                onClick={handleSaveTemplate}
              >
                Salvar Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Nova Mensagem Customizada (MODAL MANUAL PREMIUM) */}
        <Dialog open={isCustomMsgModalOpen} onOpenChange={setIsCustomMsgModalOpen}>
          <DialogContent 
            className="max-w-xl bg-white rounded-2xl p-6 border border-[#E7E2D8] shadow-2xl z-[9999] opacity-100" 
            style={{ backgroundColor: "#FFFFFF", opacity: 1, border: "1px solid #E7E2D8", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
          >
            <DialogHeader>
              <DialogTitle className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-[#C9A227]" />
                Nova Mensagem WhatsApp
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs text-slate-700">
              
              {/* Searchable patient selection */}
              <div className="space-y-1.5" ref={modalPatientRef}>
                <Label className="text-xs text-slate-750 font-bold">1. Selecionar Paciente *</Label>
                <Popover open={showDropdown} onOpenChange={setShowDropdown}>
                  <PopoverTrigger asChild>
                    <div className="relative cursor-pointer">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Pesquisar por nome ou telefone..."
                        value={patientSearch}
                        onChange={e => {
                          setPatientSearch(e.target.value);
                          setShowDropdown(true);
                          if (!e.target.value) {
                            setCustomMsgPayload(prev => ({ ...prev, patientId: "", phone: "" }));
                          }
                        }}
                        onFocus={() => setShowDropdown(true)}
                        className="pl-8 h-8.5 text-xs border-slate-350 bg-white text-slate-900"
                        style={{ backgroundColor: "#FFFFFF", color: "#0F172A", borderColor: "#CBD5E1", opacity: 1 }}
                      />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="p-0 bg-white border border-slate-200 rounded-xl shadow-xl z-[9999] overflow-hidden max-h-60 flex flex-col" 
                    align="start"
                    style={{ width: 'var(--radix-popover-trigger-width)', backgroundColor: '#FFFFFF', opacity: 1 }}
                  >
                    <div className="overflow-y-auto max-h-60">
                      {patientsError ? (
                        <div className="p-3 text-[10px] text-rose-500 font-semibold text-center">Não foi possível carregar pacientes.</div>
                      ) : filteredPatients.length === 0 ? (
                        <div className="p-3 text-[10px] text-slate-400 text-center">Nenhum paciente cadastrado. Cadastre um paciente para gerar mensagens.</div>
                      ) : (
                        filteredPatients.map(p => {
                          const isSelected = p.id === customMsgPayload.patientId;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              className={`w-full text-left px-4 py-2 text-xs hover:bg-[#FFF8E1]/30 hover:text-[#C9A227] transition border-b border-gray-50 last:border-b-0 flex justify-between items-center font-medium ${
                                isSelected ? "bg-[#FFF8E1] text-[#C9A227]" : "text-slate-700"
                              }`}
                              onClick={() => {
                                setCustomMsgPayload({
                                  ...customMsgPayload,
                                  patientId: p.id,
                                  phone: p.whatsapp || p.phone || ""
                                });
                                setPatientSearch(p.fullName);
                                setShowDropdown(false);
                              }}
                            >
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-800">{p.fullName}</span>
                                {p.phone || p.whatsapp ? (
                                  <span className="text-[10px] text-slate-400 mt-0.5">{formatPhoneForDisplay(p.whatsapp || p.phone || "")}</span>
                                ) : null}
                              </div>
                              {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-[#C9A227]" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                {customMsgPayload.patientId ? (
                  <span className="text-[10px] text-emerald-600 block mt-1 font-bold">
                    Vinculado: {patients.find(x => x.id === customMsgPayload.patientId)?.fullName} {(() => {
                      const p = patients.find(x => x.id === customMsgPayload.patientId);
                      const rawPh = p?.whatsapp || p?.phone;
                      return rawPh ? `· ${formatPhoneForDisplay(rawPh)}` : "";
                    })()}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Nenhum paciente selecionado.
                  </span>
                )}
              </div>

              {/* Edit phone */}
              <div>
                <Label className="text-slate-700 font-bold">2. Telefone Destinatário</Label>
                <Input
                  value={customMsgPayload.phone}
                  onChange={e => setCustomMsgPayload({ ...customMsgPayload, phone: e.target.value })}
                  placeholder="DDD + Número"
                  className="border-gray-200"
                />
                {customMsgPayload.phone && (
                  <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                    Prévia do número normalizado: <strong>{normalizeBrazilPhone(customMsgPayload.phone)}</strong>
                  </span>
                )}
              </div>

              {/* Integrated Procedimento/Plano selection for Modal */}
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-bold">3. Procedimento ou Plano</Label>
                <Select
                  value={modalProcKey}
                  onChange={e => {
                    const val = e.target.value;
                    setModalProcKey(val);
                    let finalProcName = "";
                    let finalValue = "";
                    let customSelected = false;

                    if (val === "custom") {
                      customSelected = true;
                      setIsCustomProcModal(true);
                    } else {
                      setIsCustomProcModal(false);
                      if (val.startsWith("proc-")) {
                        const id = val.replace("proc-", "");
                        const proc = procedures.find(x => x.id === id);
                        if (proc) {
                          finalProcName = proc.name;
                          finalValue = formatCurrency(proc.suggestedPrice || 0);
                        }
                      } else if (val.startsWith("budget-")) {
                        const id = val.replace("budget-", "");
                        const b = modalBudgets.find(x => x.id === id);
                        if (b) {
                          finalProcName = b.title || "Orçamento";
                          finalValue = formatCurrency(b.finalAmount || 0);
                        }
                      } else if (val.startsWith("plan-")) {
                        const id = val.replace("plan-", "");
                        const pl = modalPlans.find(x => x.id === id);
                        if (pl) {
                          finalProcName = pl.title || "Plano de Tratamento";
                          const sum = pl.items?.reduce((acc, curr) => acc + (curr.estimatedPrice || 0), 0) || 0;
                          finalValue = formatCurrency(sum);
                        }
                      }
                      setModalProcName(finalProcName);
                      setModalValue(finalValue);
                    }

                    if (!customSelected) {
                      updateModalMessage(customMsgPayload.templateId, val, finalProcName, finalValue, customMsgPayload.patientId);
                    }
                  }}
                >
                  <option value="">Sem procedimento/plano</option>
                  {procedures && procedures.length > 0 && (
                    <optgroup label="Procedimentos da Clínica">
                      {procedures.map(p => (
                        <option key={`modal-proc-${p.id}`} value={`proc-${p.id}`}>
                          {p.name} ({formatCurrency(p.suggestedPrice || 0)})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {customMsgPayload.patientId && modalBudgets && modalBudgets.length > 0 && (
                    <optgroup label="Orçamentos do Paciente">
                      {modalBudgets.map(b => (
                        <option key={`modal-budget-${b.id}`} value={`budget-${b.id}`}>
                          Orçamento: {b.title || "Sem título"} ({formatCurrency(b.finalAmount || 0)})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {customMsgPayload.patientId && modalPlans && modalPlans.length > 0 && (
                    <optgroup label="Planos do Paciente">
                      {modalPlans.map(pl => (
                        <option key={`modal-plan-${pl.id}`} value={`plan-${pl.id}`}>
                          Plano: {pl.title || "Sem título"}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value="custom">Outro / escrever manualmente</option>
                </Select>
              </div>

              {/* Fallback Custom Inputs for Procedure/Plano in Modal */}
              {isCustomProcModal && (
                <div className="grid grid-cols-2 gap-3 mt-2 animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 block font-bold">NOME MANUAL</span>
                    <Input
                      placeholder="Ex: Clareamento Dental"
                      value={modalProcName}
                      onChange={e => {
                        setModalProcName(e.target.value);
                        updateModalMessage(customMsgPayload.templateId, "custom", e.target.value, modalValue, customMsgPayload.patientId);
                      }}
                      className="h-8 text-xs border-gray-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 block font-bold">VALOR MANUAL</span>
                    <Input
                      placeholder="Ex: R$ 400,00"
                      value={modalValue}
                      onChange={e => {
                        setModalValue(e.target.value);
                        updateModalMessage(customMsgPayload.templateId, "custom", modalProcName, e.target.value, customMsgPayload.patientId);
                      }}
                      className="h-8 text-xs border-gray-200"
                    />
                  </div>
                </div>
              )}

              {/* Template select */}
              <div>
                <Label className="text-slate-700 font-bold">4. Modelo de Mensagem (Opcional)</Label>
                <Select
                  value={customMsgPayload.templateId}
                  onChange={e => {
                    const nextTplId = e.target.value;
                    setCustomMsgPayload(prev => ({
                      ...prev,
                      templateId: nextTplId
                    }));
                    updateModalMessage(nextTplId, modalProcKey, modalProcName, modalValue, customMsgPayload.patientId);
                  }}
                >
                  <option value="">-- Usar Texto Livre --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                  {templates.length === 0 && DEFAULT_TEMPLATES.map(t => (
                    <option key={t.id} value={t.id}>{t.name} (Padrão)</option>
                  ))}
                </Select>
              </div>

              {/* Textarea with ref and inserting variables chips */}
              <div>
                <Label className="text-slate-700 font-bold">5. Mensagem Livre ou Editada</Label>
                <textarea
                  ref={textareaRef}
                  value={customMsgPayload.message}
                  onChange={e => setCustomMsgPayload({ ...customMsgPayload, message: e.target.value })}
                  placeholder="Escreva a mensagem aqui..."
                  rows={4}
                  className="w-full text-xs border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-[#C9A227] focus:border-[#C9A227] bg-white select-text pointer-events-auto"
                />
                
                {/* Dynamic Variable Chips */}
                <div className="mt-2 space-y-1 bg-gray-50 p-2.5 rounded border border-gray-100">
                  <span className="font-semibold text-[10px] text-slate-500 block mb-1">Inserir variáveis na posição do cursor:</span>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { key: "paciente_nome", label: "Nome Paciente" },
                      { key: "paciente_primeiro_nome", label: "Primeiro Nome" },
                      { key: "clinica_nome", label: "Nome Clínica" },
                      { key: "data_consulta", label: "Data Consulta" },
                      { key: "hora_consulta", label: "Hora Consulta" },
                      { key: "profissional_nome", label: "Profissional" },
                      { key: "procedimento_nome", label: "Procedimento" },
                      { key: "plano_nome", label: "Plano" },
                      { key: "procedimento_ou_plano", label: "Procedimento ou Plano" },
                      { key: "valor", label: "Valor" },
                      { key: "data_vencimento", label: "Vencimento" }
                    ].map(chip => (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={() => insertVariable(chip.key)}
                        className="bg-white hover:bg-[#FFF8E1]/40 border hover:border-[#C9A227] px-2 py-0.5 rounded text-[9px] font-medium transition text-slate-600 cursor-pointer"
                      >
                        [{chip.label}]
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Dynamic Preview */}
              <div className="space-y-1 bg-[#FFF8E1]/10 border border-[#C9A227]/10 p-3 rounded-xl">
                <span className="text-[10px] text-[#C9A227] block font-bold">PRÉVIA RENDERIZADA:</span>
                <p className="text-xs text-slate-750 italic leading-relaxed">
                  "{renderWhatsAppTemplate(customMsgPayload.message, {
                    paciente_nome: patients.find(x => x.id === customMsgPayload.patientId)?.fullName || "Maria Silva",
                    paciente_primeiro_nome: (patients.find(x => x.id === customMsgPayload.patientId)?.fullName || "Maria").split(" ")[0],
                    clinica_nome: settings.clinicName,
                    data_consulta: creatorDate || "10/06/2026",
                    hora_consulta: creatorTime || "14:30",
                    profissional_nome: "Dr. Carlos Dourado",
                    procedimento_nome: modalProcName || "Procedimento",
                    plano_nome: modalProcName || "Plano",
                    procedimento_ou_plano: modalProcName || "seu procedimento",
                    valor: modalValue || "R$ 150,00",
                    data_vencimento: creatorDateVencimento || "15/06/2026"
                  })}"
                </p>
              </div>

            </div>

            <DialogFooter className="gap-2 border-t pt-4">
              <Button variant="ghost" className="text-slate-500" onClick={() => setIsCustomMsgModalOpen(false)}>Cancelar</Button>
              <Button
                variant="outline"
                className="border-gray-200 text-slate-700 font-bold"
                onClick={() => handleDispatchMessage("copiada")}
              >
                <Clipboard className="w-3.5 h-3.5 mr-1 text-[#C9A227]" />
                Copiar Mensagem
              </Button>
              <Button
                variant="gold"
                className="bg-[#C9A227] hover:bg-[#b08f1f] text-white font-bold"
                onClick={() => handleDispatchMessage("aberta_no_whatsapp")}
              >
                <Send className="w-3.5 h-3.5 mr-1" />
                Abrir WhatsApp
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
}

function WhatsAppErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  
  useEffect(() => {
    if (typeof reportLovableError === "function") {
      reportLovableError(error, { boundary: "whatsapp_route_error" });
    } else {
      console.error(error);
    }
  }, [error]);

  return (
    <div className="flex min-h-[400px] items-center justify-center bg-white border border-gray-100 rounded-2xl p-8 shadow-sm m-6">
      <div className="max-w-md text-center space-y-4">
        <div className="inline-flex p-3 bg-amber-50 rounded-full text-[#C9A227]">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-display font-extrabold text-slate-800">
          Não foi possível carregar esta seção
        </h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          Alguns dados não foram carregados agora, mas você ainda pode usar o WhatsApp manual.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            variant="gold"
            className="bg-[#C9A227] hover:bg-[#b08f1f] text-white font-bold"
          >
            Tentar novamente
          </Button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-gray-50 transition"
          >
            Voltar ao painel
          </a>
        </div>
      </div>
    </div>
  );
}
