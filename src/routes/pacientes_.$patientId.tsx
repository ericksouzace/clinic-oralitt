import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Edit3, Calendar, Phone, Activity, FileText, DollarSign, Image as ImageIcon, Plus, ClipboardList, CheckCircle, Trash2, Clock } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { PageHeader, Card, Button, Badge, Input, Label, Select, Textarea } from "@/components/ui-bits";
import { Patient, Anamnesis, AnamnesisStatus, ANAMNESIS_STATUS, OdontogramEntry, TOOTH_REGIONS, TOOTH_STATUS } from "@/lib/store";
import { usePatients, useAnamneses, useOdontogramEntries, useAppointments } from "@/lib/db";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { OdontogramTab } from "@/components/odontogram/OdontogramTab";
import { TreatmentPlanTab } from "@/components/treatment-plan/TreatmentPlanTab";
import { ClinicalRecordTab } from "@/components/clinical-record/ClinicalRecordTab";
import { FinanceTab } from "@/components/finance/FinanceTab";



export const Route = createFileRoute("/pacientes_/$patientId")({
  head: () => ({ meta: [{ title: "Ficha do Paciente — Oralit" }] }),
  component: PatientProfilePage,
});

function calcAge(birthDate: string | undefined): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

const TAB_MAP = {
  "resumo": "Resumo",
  "dados-pessoais": "Dados pessoais",
  "anamnese": "Anamnese",
  "odontograma": "Odontograma",
  "plano-tratamento": "Plano de tratamento",
  "ficha-clinica": "Ficha clínica",
  "financeiro": "Financeiro",
  "fotos-clinicas": "Fotos clínicas",
  "documentos": "Documentos"
} as const;

type TabType = keyof typeof TAB_MAP;
const TABS = Object.keys(TAB_MAP) as TabType[];

function PatientProfilePage() {
  const { patientId } = Route.useParams();
  const router = useRouter();
  const [patients, , loading, error] = usePatients();
  const [anamneses, setAnamneses, loadingAnamnesis, errorAnamnesis] = useAnamneses(patientId);
  const [odontEntries] = useOdontogramEntries(patientId);
  const [appointments] = useAppointments(patientId);

  // Filter next and past appointments for resume tab
  const nextAppt = appointments.find(a => {
    if (a.status === "cancelado" || a.status === "concluído") return false;
    const todayStr = new Date().toISOString().split("T")[0];
    return a.appointmentDate >= todayStr;
  });

  const pastAppts = appointments
    .filter(a => {
      const todayStr = new Date().toISOString().split("T")[0];
      return a.appointmentDate < todayStr || a.status === "concluído" || a.status === "cancelado" || a.status === "faltou";
    })
    .sort((a, b) => {
      const dateCompare = b.appointmentDate.localeCompare(a.appointmentDate);
      if (dateCompare !== 0) return dateCompare;
      return b.startTime.localeCompare(a.startTime);
    })
    .slice(0, 3);
  
  const [activeTab, setActiveTabState] = useState<TabType>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab") as TabType;
      if (tab && TAB_MAP[tab]) {
        return tab;
      }
    }
    return "odontograma";
  });

  const setActiveTab = (tab: TabType) => {
    setActiveTabState(tab);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", tab);
      window.history.replaceState(null, "", "?" + params.toString());
      router.invalidate();
    }
  };
  
  const [anamnesisDraft, setAnamnesisDraft] = useState<Anamnesis | null>(null);

  if (loading) {
    return (
      <AppLayout>
        <div className="py-10 text-center text-muted-foreground text-sm font-medium animate-pulse">
          Carregando ficha do paciente...
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="py-16 text-center">
          <h2 className="text-xl font-display font-bold mb-2 text-rose-600">Erro ao carregar dados do paciente</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">{error}</p>
          <Button variant="outline" onClick={() => router.navigate({ to: "/pacientes" })}>
            Voltar para Pacientes
          </Button>
        </div>
      </AppLayout>
    );
  }

  const patient = patients.find(p => p.id === patientId);

  if (!patient) {
    return (
      <AppLayout>
        <div className="py-16 text-center">
          <h2 className="text-xl font-display font-bold mb-2">Paciente não encontrado</h2>
          <p className="text-muted-foreground mb-6">Este paciente não existe ou você não tem permissão para acessá-lo.</p>
          <Button variant="gold" onClick={() => router.navigate({ to: "/pacientes" })}>
            Voltar para Pacientes
          </Button>
        </div>
      </AppLayout>
    );
  }

  const age = calcAge(patient.birthDate);

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <Button variant="outline" onClick={() => router.navigate({ to: "/pacientes" })} className="h-9 px-3 text-xs">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>



      {/* Anamnesis Modal */}
      {anamnesisDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-secondary/30">
              <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-gold" />
                {anamnesisDraft.id ? "Editar Anamnese" : "Nova Anamnese"}
              </h2>
              <button
                className="text-muted-foreground hover:text-foreground transition-colors p-2"
                onClick={() => setAnamnesisDraft(null)}
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-8">
              {/* Seção 1 */}
              <section>
                <h3 className="text-sm font-bold text-gold tracking-wider uppercase mb-4 flex items-center gap-2">
                  <span className="w-6 h-[1px] bg-gold/30"></span> Queixa e Saúde Geral
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Label>Queixa Principal</Label>
                    <Textarea rows={2} value={anamnesisDraft.mainComplaint || ""} onChange={e => setAnamnesisDraft({...anamnesisDraft, mainComplaint: e.target.value})} placeholder="Qual o motivo da consulta?" />
                  </div>
                  <div>
                    <Label>Faz uso de alguma medicação?</Label>
                    <Input value={anamnesisDraft.medications || ""} onChange={e => setAnamnesisDraft({...anamnesisDraft, medications: e.target.value})} placeholder="Qual(is)?" />
                  </div>
                  <div>
                    <Label>Possui alguma alergia?</Label>
                    <Input value={anamnesisDraft.allergies || ""} onChange={e => setAnamnesisDraft({...anamnesisDraft, allergies: e.target.value})} placeholder="Medicamentos, látex, etc..." />
                  </div>
                  <div>
                    <Label>Como é a sua pressão arterial?</Label>
                    <Select value={anamnesisDraft.bloodPressure || ""} onChange={e => setAnamnesisDraft({...anamnesisDraft, bloodPressure: e.target.value})}>
                      <option value="">Selecione...</option>
                      <option value="Normal">Normal</option>
                      <option value="Alta">Alta</option>
                      <option value="Baixa">Baixa</option>
                      <option value="Não sabe">Não sabe</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Outros problemas de saúde?</Label>
                    <Input value={anamnesisDraft.healthProblems || ""} onChange={e => setAnamnesisDraft({...anamnesisDraft, healthProblems: e.target.value})} placeholder="Doenças pré-existentes..." />
                  </div>
                </div>
              </section>

              {/* Seção 2 */}
              <section>
                <h3 className="text-sm font-bold text-gold tracking-wider uppercase mb-4 flex items-center gap-2">
                  <span className="w-6 h-[1px] bg-gold/30"></span> Condições Clínicas
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { key: "heartProblem", label: "Problema Cardíaco?" },
                    { key: "diabetes", label: "Diabetes?" },
                    { key: "bleedingProblem", label: "Problema com sangramento?" },
                    { key: "healingProblem", label: "Problema de cicatrização?" },
                    { key: "previousSurgery", label: "Cirurgia recente?" },
                    { key: "pregnancy", label: "Gestante?" },
                    { key: "anesthesiaReaction", label: "Reação à anestesia?" },
                  ].map(field => (
                    <div key={field.key}>
                      <Label>{field.label}</Label>
                      <Select 
                        value={anamnesisDraft[field.key as keyof Anamnesis] === true ? "true" : anamnesisDraft[field.key as keyof Anamnesis] === false ? "false" : ""}
                        onChange={e => setAnamnesisDraft({...anamnesisDraft, [field.key]: e.target.value === "true" ? true : e.target.value === "false" ? false : null})}
                      >
                        <option value="">Selecione</option>
                        <option value="true">Sim</option>
                        <option value="false">Não</option>
                      </Select>
                    </div>
                  ))}
                </div>
              </section>

              {/* Seção 3 */}
              <section>
                <h3 className="text-sm font-bold text-gold tracking-wider uppercase mb-4 flex items-center gap-2">
                  <span className="w-6 h-[1px] bg-gold/30"></span> Saúde Bucal
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Dor nos dentes ou gengiva?</Label>
                    <Input value={anamnesisDraft.toothOrGumPain || ""} onChange={e => setAnamnesisDraft({...anamnesisDraft, toothOrGumPain: e.target.value})} placeholder="Descreva brevemente..." />
                  </div>
                  <div>
                    <Label>Sangramento gengival?</Label>
                    <Select 
                      value={anamnesisDraft.gumBleeding === true ? "true" : anamnesisDraft.gumBleeding === false ? "false" : ""}
                      onChange={e => setAnamnesisDraft({...anamnesisDraft, gumBleeding: e.target.value === "true" ? true : e.target.value === "false" ? false : null})}
                    >
                      <option value="">Selecione</option>
                      <option value="true">Sim</option>
                      <option value="false">Não</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Frequência de escovação</Label>
                    <Select value={anamnesisDraft.brushingFrequency || ""} onChange={e => setAnamnesisDraft({...anamnesisDraft, brushingFrequency: e.target.value})}>
                      <option value="">Selecione...</option>
                      <option value="1x ao dia">1x ao dia</option>
                      <option value="2x ao dia">2x ao dia</option>
                      <option value="3x ou mais">3x ou mais</option>
                      <option value="Raramente">Raramente</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Uso de fio dental</Label>
                    <Select value={anamnesisDraft.flossUse || ""} onChange={e => setAnamnesisDraft({...anamnesisDraft, flossUse: e.target.value})}>
                      <option value="">Selecione...</option>
                      <option value="Diariamente">Diariamente</option>
                      <option value="Às vezes">Às vezes</option>
                      <option value="Nunca">Nunca</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Fumante?</Label>
                    <Select 
                      value={anamnesisDraft.smoker === true ? "true" : anamnesisDraft.smoker === false ? "false" : ""}
                      onChange={e => setAnamnesisDraft({...anamnesisDraft, smoker: e.target.value === "true" ? true : e.target.value === "false" ? false : null})}
                    >
                      <option value="">Selecione</option>
                      <option value="true">Sim</option>
                      <option value="false">Não</option>
                    </Select>
                  </div>
                </div>
              </section>

              {/* Seção 4 */}
              <section>
                <h3 className="text-sm font-bold text-gold tracking-wider uppercase mb-4 flex items-center gap-2">
                  <span className="w-6 h-[1px] bg-gold/30"></span> Declaração e Assinatura
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Declaração de veracidade</Label>
                    <Select 
                      value={anamnesisDraft.truthDeclaration === true ? "true" : anamnesisDraft.truthDeclaration === false ? "false" : ""}
                      onChange={e => setAnamnesisDraft({...anamnesisDraft, truthDeclaration: e.target.value === "true" ? true : e.target.value === "false" ? false : null})}
                    >
                      <option value="">Confirma a veracidade?</option>
                      <option value="true">Sim, declaro que as informações são verdadeiras</option>
                      <option value="false">Não aceito declarar</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Assinatura (Nome)</Label>
                    <Input value={anamnesisDraft.signature || ""} onChange={e => setAnamnesisDraft({...anamnesisDraft, signature: e.target.value})} placeholder="Assinatura do paciente..." />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Observações adicionais da Clínica</Label>
                    <Textarea rows={2} value={anamnesisDraft.notes || ""} onChange={e => setAnamnesisDraft({...anamnesisDraft, notes: e.target.value})} placeholder="Anotações internas..." />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Status da Anamnese</Label>
                    <Select value={anamnesisDraft.status} onChange={e => setAnamnesisDraft({...anamnesisDraft, status: e.target.value as AnamnesisStatus})}>
                      {ANAMNESIS_STATUS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </Select>
                  </div>
                </div>
              </section>

            </div>
            
            <div className="px-6 py-4 border-t border-border bg-secondary/30 flex justify-end gap-3 mt-auto">
              <Button variant="outline" onClick={() => setAnamnesisDraft(null)}>Cancelar</Button>
              <Button variant="gold" onClick={async () => {
                const isNew = !anamnesisDraft.id;
                const draft = isNew ? { ...anamnesisDraft, id: crypto.randomUUID() } : anamnesisDraft;
                await setAnamneses(prev => {
                  if (isNew) return [draft, ...prev];
                  return prev.map(a => a.id === draft.id ? draft : a);
                });
                alert("Anamnese " + (isNew ? "salva" : "atualizada") + " com sucesso.");
                setAnamnesisDraft(null);
              }}>
                <CheckCircle className="h-4 w-4 mr-2" /> Salvar Anamnese
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header do Paciente */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm mb-6 flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-2xl font-display font-bold text-foreground">{patient.fullName}</h1>
            <Badge variant={
              patient.status === "ativo" || patient.status === "em tratamento" ? "success" : 
              patient.status === "retorno" ? "warning" : "secondary"
            } className="capitalize">
              {patient.status}
            </Badge>
          </div>
          
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {patient.recordNumber && (
              <span className="flex items-center gap-1.5"><FileText className="h-4 w-4" /> PR: {patient.recordNumber}</span>
            )}
            {age !== null && (
              <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {age} anos</span>
            )}
            {(patient.phone || patient.whatsapp) && (
              <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" /> {patient.whatsapp || patient.phone}</span>
            )}
          </div>
        </div>
      </div>

      {/* Navegação de Abas */}
      <div className="flex overflow-x-auto no-scrollbar border-b border-border mb-6">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab 
                ? "border-gold text-gold" 
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {TAB_MAP[tab]}
          </button>
        ))}
      </div>

      {/* Conteúdo das Abas */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        
        {activeTab === "resumo" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <Card className="p-5">
                <h3 className="font-display font-bold mb-4 flex items-center gap-2"><FileText className="h-4 w-4 text-gold" /> Visão Geral</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between border-b border-border/50 pb-2">
                    <dt className="text-muted-foreground">Cadastrado em</dt>
                    <dd className="font-medium">{new Date(patient.createdAt).toLocaleDateString()}</dd>
                  </div>
                  <div className="flex justify-between border-b border-border/50 pb-2">
                    <dt className="text-muted-foreground">Telefone</dt>
                    <dd className="font-medium">{patient.phone || "-"}</dd>
                  </div>
                  <div className="flex justify-between border-b border-border/50 pb-2">
                    <dt className="text-muted-foreground">WhatsApp</dt>
                    <dd className="font-medium">{patient.whatsapp || "-"}</dd>
                  </div>
                </dl>
                {patient.administrativeNotes && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <dt className="text-xs text-muted-foreground font-semibold uppercase mb-1">Anotações Administrativas</dt>
                    <dd className="text-sm bg-secondary/50 p-3 rounded-lg border border-border/50">{patient.administrativeNotes}</dd>
                  </div>
                )}
              </Card>
            </div>
            
            <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
              <Card className="p-5 flex flex-col h-auto min-h-[160px] col-span-1 sm:col-span-2 bg-white border border-border">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                  <h4 className="font-semibold text-sm flex items-center gap-2 text-gray-800">
                    <Calendar className="h-4 w-4 text-gold" />
                    Agenda do Paciente
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs h-7 py-1 px-2.5 text-muted-foreground"
                      onClick={() => router.navigate({ to: "/agenda" })}
                    >
                      Ver agenda completa
                    </Button>
                    <Button 
                      className="bg-[#C9A227] hover:bg-[#b59122] text-white text-xs h-7 py-1 px-2.5 font-semibold"
                      onClick={() => router.navigate({ 
                        to: "/agenda", 
                        search: { newAppt: "true", patientId: patient.id } as any 
                      })}
                    >
                      <Plus className="w-3 h-3 mr-1" /> Novo agendamento
                    </Button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mt-2">
                  {/* Próximo agendamento */}
                  <div className="border-r border-border/50 pr-4">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-2">Próximo Atendimento</span>
                    {nextAppt ? (
                      <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3">
                        <div className="flex justify-between items-start">
                          <span className="font-extrabold text-xs text-[#C9A227] bg-white px-2 py-0.5 rounded border border-amber-500/10 shadow-sm flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 shrink-0 text-gold" />
                            {new Date(nextAppt.appointmentDate + "T00:00:00").toLocaleDateString("pt-BR")} às {nextAppt.startTime}
                          </span>
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 capitalize bg-white">
                            {nextAppt.status}
                          </Badge>
                        </div>
                        <h5 className="font-bold text-xs text-gray-800 mt-2 truncate">{nextAppt.title}</h5>
                        {nextAppt.notes && (
                          <p className="text-[11px] text-muted-foreground italic truncate mt-1">"{nextAppt.notes}"</p>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-6 border border-dashed rounded-xl bg-gray-50/50 flex flex-col items-center justify-center">
                        <Clock className="h-5 w-5 text-muted-foreground/40 mb-1" />
                        <p className="text-xs text-muted-foreground italic">Nenhum atendimento agendado</p>
                      </div>
                    )}
                  </div>

                  {/* Últimos atendimentos */}
                  <div className="pl-0 md:pl-2">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-2">Últimos Atendimentos</span>
                    {pastAppts.length > 0 ? (
                      <div className="space-y-2">
                        {pastAppts.map(appt => (
                          <div key={appt.id} className="flex justify-between items-center text-xs py-1.5 border-b border-border/40 last:border-0">
                            <div className="min-w-0 pr-2">
                              <p className="font-bold text-gray-800 truncate">{appt.title}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(appt.appointmentDate + "T00:00:00").toLocaleDateString("pt-BR")} às {appt.startTime}
                              </p>
                            </div>
                            <Badge variant="outline" className={`text-[9px] px-1 py-0 uppercase shrink-0 ${
                              appt.status === "concluído" ? "bg-teal-600/10 text-teal-800 border-teal-600/20" :
                              appt.status === "faltou" ? "bg-rose-500/10 text-rose-700 border-rose-500/20" :
                              appt.status === "cancelado" ? "bg-red-500/10 text-red-700 border-red-500/20" :
                              "bg-gray-500/10 text-gray-700"
                            }`}>
                              {appt.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 border border-dashed rounded-xl bg-gray-50/50 flex flex-col items-center justify-center">
                        <Clock className="h-5 w-5 text-muted-foreground/40 mb-1" />
                        <p className="text-xs text-muted-foreground italic">Sem histórico de atendimentos</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
              <Card className="p-5 flex flex-col h-auto min-h-[128px]">
                <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
                  <Activity className="h-4 w-4 text-gold" />
                  Últimos Eventos Odontológicos
                </h4>
                {(!odontEntries || odontEntries.length === 0) ? (
                  <p className="text-xs text-muted-foreground my-auto text-center">Nenhum evento registrado</p>
                ) : (
                  <div className="space-y-2 text-xs flex-1 overflow-y-auto max-h-[150px]">
                    {odontEntries.slice(0, 4).map(entry => (
                      <div key={entry.id} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: entry.color || "black" }} />
                          <span className="font-medium truncate text-foreground/90 capitalize">{entry.status}</span>
                        </div>
                        <span className="text-muted-foreground font-semibold shrink-0">Dente {entry.toothNumber}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              <Card className="p-5 flex flex-col justify-center items-center text-center h-32 bg-secondary/20 border-dashed border-2">
                <DollarSign className="h-6 w-6 text-gold mb-2" />
                <h4 className="font-semibold text-sm">Orçamentos / Financeiro</h4>
                <p className="text-xs text-muted-foreground mt-1">Em breve</p>
              </Card>
              <Card className="p-5 flex flex-col justify-center items-center text-center h-32 bg-secondary/20 border-dashed border-2">
                <ImageIcon className="h-6 w-6 text-gold mb-2" />
                <h4 className="font-semibold text-sm">Imagens e Arquivos</h4>
                <p className="text-xs text-muted-foreground mt-1">Em breve</p>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "dados-pessoais" && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-bold text-lg">Informações Cadastrais</h2>
              <Button variant="outline" size="sm" onClick={() => router.navigate({ to: "/pacientes" })}>
                <Edit3 className="h-3.5 w-3.5 mr-2" /> Editar pelo modal
              </Button>
            </div>
            
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-8 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs font-semibold uppercase mb-1">Nome Completo</dt>
                <dd className="font-medium">{patient.fullName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-semibold uppercase mb-1">Data de Nascimento</dt>
                <dd className="font-medium">{patient.birthDate ? new Date(patient.birthDate).toLocaleDateString() : "-"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-semibold uppercase mb-1">Idade</dt>
                <dd className="font-medium">{age !== null ? `${age} anos` : "-"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-semibold uppercase mb-1">CPF</dt>
                <dd className="font-medium">{patient.cpf || "-"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-semibold uppercase mb-1">RG</dt>
                <dd className="font-medium">{patient.rg ? `${patient.rg} ${patient.issuingAgency || ""}` : "-"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-semibold uppercase mb-1">Sexo</dt>
                <dd className="font-medium">{patient.gender || "-"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-semibold uppercase mb-1">Estado Civil</dt>
                <dd className="font-medium">{patient.maritalStatus || "-"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-semibold uppercase mb-1">Profissão</dt>
                <dd className="font-medium">{patient.profession || "-"}</dd>
              </div>
              <div className="sm:col-span-2 md:col-span-3 pt-4 border-t border-border mt-2">
                <dt className="text-muted-foreground text-xs font-semibold uppercase mb-1">Endereço</dt>
                <dd className="font-medium">{patient.address || "Não informado"}</dd>
              </div>
            </div>
          </Card>
        )}

        {activeTab === "anamnese" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-lg flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-gold" />
                Histórico de Anamneses
              </h2>
              <Button variant="gold" onClick={() => setAnamnesisDraft({
                id: "",
                patientId: patientId,
                status: "rascunho",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              } as Anamnesis)}>
                <Plus className="h-4 w-4 mr-2" /> Nova Anamnese
              </Button>
            </div>

            {errorAnamnesis && (
              <div className="bg-rose-50 text-rose-700 p-4 rounded-lg border border-rose-200">
                <h4 className="font-bold mb-1">Erro ao carregar anamneses</h4>
                <p className="text-sm">{errorAnamnesis}</p>
              </div>
            )}

            {loadingAnamnesis ? (
              <div className="text-center py-10 text-muted-foreground animate-pulse">
                Carregando histórico...
              </div>
            ) : anamneses.length === 0 ? (
              <div className="text-center py-16 bg-secondary/20 rounded-2xl border-2 border-dashed border-border/60">
                <div className="h-16 w-16 bg-gold/10 text-gold rounded-full flex items-center justify-center mx-auto mb-4">
                  <ClipboardList className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-display font-semibold mb-1">Nenhuma anamnese</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Nenhuma anamnese cadastrada para este paciente. Clique no botão acima para preencher a primeira ficha clínica de saúde.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {anamneses.map(anamnesis => (
                  <Card key={anamnesis.id} className="p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-semibold">{new Date(anamnesis.createdAt).toLocaleDateString()}</span>
                        <Badge tone={
                          anamnesis.status === "assinada" ? "ok" :
                          anamnesis.status === "concluída" ? "gold" : "warn"
                        }>
                          {anamnesis.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        <span className="font-medium">Queixa principal:</span> {anamnesis.mainComplaint || "Não informada"}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setAnamnesisDraft({...anamnesis})}>
                      <Edit3 className="h-4 w-4 mr-2" /> Ver / Editar
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "odontograma" && (
          <div className="space-y-6">
            <OdontogramTab patientId={patient.id} />
          </div>
        )}

        {activeTab === "plano-tratamento" && (
          <TreatmentPlanTab patientId={patient.id} />
        )}

        {activeTab === "financeiro" && (
          <FinanceTab patientId={patient.id} />
        )}

        {activeTab === "fotos-clinicas" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-lg flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-gold" />
                  Fotos clínicas
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Registre fotos dos atendimentos e procedimentos do paciente organizadas por data.
                </p>
              </div>
              <Button variant="gold">
                <Plus className="h-4 w-4 mr-2" /> Novo registro de fotos
              </Button>
            </div>

            <Card className="p-6 bg-secondary/10 border-dashed">
              <div className="text-center py-12">
                <ImageIcon className="h-12 w-12 text-gold opacity-50 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Estrutura de fotos clínicas em preparação</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  A integração com armazenamento será configurada na próxima etapa. Estrutura de fotos clínicas ainda precisa ser criada no Supabase.
                </p>
              </div>
            </Card>
          </div>
        )}

        {activeTab === "ficha-clinica" && (
          <ClinicalRecordTab patientId={patient.id} />
        )}

        {activeTab !== "resumo" && activeTab !== "dados-pessoais" && activeTab !== "anamnese" && activeTab !== "odontograma" && activeTab !== "plano-tratamento" && activeTab !== "financeiro" && activeTab !== "fotos-clinicas" && activeTab !== "ficha-clinica" && (
          <div className="py-24 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-muted-foreground mb-4">
              <Activity className="h-8 w-8 opacity-50" />
            </div>
            <h3 className="text-xl font-display font-semibold mb-2">{TAB_MAP[activeTab] || activeTab}</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Este módulo estará disponível na próxima fase de desenvolvimento da plataforma.
            </p>
            <Badge tone="warn" className="mt-4">Em breve</Badge>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
