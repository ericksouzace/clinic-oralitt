import { uid, type Supply, type FixedCost, type Procedure } from "./store";

export function seedSupplies(): Supply[] {
  return [
    { id: uid(), name: "Luva de procedimento", category: "Biossegurança", packCost: 35, packYield: 100, unit: "par" },
    { id: uid(), name: "Máscara descartável", category: "Biossegurança", packCost: 25, packYield: 50, unit: "un" },
    { id: uid(), name: "Sugador descartável", category: "Descartáveis", packCost: 18, packYield: 40, unit: "un" },
    { id: uid(), name: "Resina composta", category: "Dentística", packCost: 180, packYield: 25, unit: "aplicação" },
    { id: uid(), name: "Adesivo odontológico", category: "Dentística", packCost: 220, packYield: 60, unit: "aplicação" },
    { id: uid(), name: "Ácido fosfórico", category: "Dentística", packCost: 22, packYield: 30, unit: "aplicação" },
    { id: uid(), name: "Anestésico tubete", category: "Anestesia", packCost: 95, packYield: 50, unit: "tubete" },
    { id: uid(), name: "Fio de sutura", category: "Cirurgia", packCost: 90, packYield: 12, unit: "un" },
    { id: uid(), name: "Gaze estéril", category: "Biossegurança", packCost: 28, packYield: 100, unit: "un" },
    { id: uid(), name: "Campo descartável", category: "Biossegurança", packCost: 40, packYield: 20, unit: "un" },
  ];
}

export function seedFixed(): FixedCost[] {
  return [
    { id: uid(), name: "Aluguel", value: 2800 },
    { id: uid(), name: "Condomínio", value: 450 },
    { id: uid(), name: "Água", value: 120 },
    { id: uid(), name: "Energia", value: 380 },
    { id: uid(), name: "Internet", value: 180 },
    { id: uid(), name: "Software de gestão", value: 220 },
    { id: uid(), name: "Auxiliar/recepção", value: 2200 },
    { id: uid(), name: "Contabilidade", value: 350 },
    { id: uid(), name: "Limpeza", value: 400 },
    { id: uid(), name: "Marketing", value: 500 },
    { id: uid(), name: "Manutenção", value: 200 },
    { id: uid(), name: "Depreciação de equipamentos", value: 600 },
  ];
}

export function seedProcedures(): Procedure[] {
  return [
    { id: uid(), name: "Restauração em resina", category: "Restauração", defaultMinutes: 45 },
    { id: uid(), name: "Profilaxia", category: "Profilaxia", defaultMinutes: 30 },
    { id: uid(), name: "Clareamento de consultório", category: "Clareamento", defaultMinutes: 60, otherDirect: 80 },
    { id: uid(), name: "Extração simples", category: "Cirurgia", defaultMinutes: 30 },
    { id: uid(), name: "Tratamento endodôntico unirradicular", category: "Endodontia", defaultMinutes: 90 },
    { id: uid(), name: "Coroa provisória", category: "Prótese", defaultMinutes: 50, labCost: 180 },
    { id: uid(), name: "Consulta inicial", category: "Consulta", defaultMinutes: 30 },
  ];
}
