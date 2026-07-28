import { jsPDF } from "jspdf";

export interface BudgetPdfItem {
  description: string;
  teeth?: string;
  value: number;
}

export interface BudgetPdfInput {
  patientName: string;
  items: BudgetPdfItem[];
  total: number;
  issuedAt?: Date;
  notes?: string;
}

const GOLD: [number, number, number] = [201, 162, 39];
const DARK_GOLD: [number, number, number] = [125, 93, 20];
const INK: [number, number, number] = [31, 41, 55];
const MUTED: [number, number, number] = [100, 116, 139];
const LIGHT: [number, number, number] = [250, 248, 242];

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function dateBR(value: Date) {
  return value.toLocaleDateString("pt-BR");
}

function safeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function drawHeader(doc: jsPDF, issuedAt: Date) {
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.text("ORALIT", 16, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("CLÍNICA ODONTOLÓGICA", 16, 21);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("ORÇAMENTO ODONTOLÓGICO", 194, 13, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Emissão: ${dateBR(issuedAt)}`, 194, 20, { align: "right" });
}

function drawFooter(doc: jsPDF, page: number) {
  doc.setDrawColor(225, 228, 232);
  doc.line(16, 282, 194, 282);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("Documento gerado pelo sistema Oralit.", 16, 288);
  doc.text(`Página ${page}`, 194, 288, { align: "right" });
}

export function createBudgetPdf(input: BudgetPdfInput) {
  const issuedAt = input.issuedAt || new Date();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  let page = 1;
  let y = 39;

  const addPage = () => {
    drawFooter(doc, page);
    doc.addPage();
    page += 1;
    drawHeader(doc, issuedAt);
    y = 38;
  };

  drawHeader(doc, issuedAt);

  doc.setFillColor(...LIGHT);
  doc.roundedRect(16, y, 178, 22, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...DARK_GOLD);
  doc.text("PACIENTE", 21, y + 7);
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(input.patientName || "Paciente", 21, y + 15);
  y += 30;

  const colX = { procedure: 19, teeth: 134, value: 191 };
  const drawTableHeader = () => {
    doc.setFillColor(245, 246, 248);
    doc.roundedRect(16, y, 178, 10, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("PROCEDIMENTO", colX.procedure, y + 6.4);
    doc.text("DENTES", colX.teeth, y + 6.4);
    doc.text("VALOR", colX.value, y + 6.4, { align: "right" });
    y += 12;
  };

  drawTableHeader();

  const items =
    input.items.length > 0
      ? input.items
      : [{ description: "Nenhum procedimento informado", teeth: "—", value: 0 }];

  items.forEach((item, index) => {
    const procedureLines = doc.splitTextToSize(item.description || "Procedimento", 106) as string[];
    const teethLines = doc.splitTextToSize(item.teeth || "—", 37) as string[];
    const lineCount = Math.max(procedureLines.length, teethLines.length, 1);
    const rowHeight = Math.max(10, lineCount * 4.5 + 4);

    if (y + rowHeight > 268) {
      addPage();
      drawTableHeader();
    }

    if (index % 2 === 1) {
      doc.setFillColor(253, 252, 249);
      doc.rect(16, y - 1, 178, rowHeight, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(procedureLines, colX.procedure, y + 4.5);
    doc.setTextColor(...MUTED);
    doc.text(teethLines, colX.teeth, y + 4.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK_GOLD);
    doc.text(currency(item.value), colX.value, y + 4.5, { align: "right" });

    doc.setDrawColor(235, 237, 240);
    doc.line(16, y + rowHeight - 1, 194, y + rowHeight - 1);
    y += rowHeight;
  });

  if (y + 34 > 268) addPage();

  y += 4;
  doc.setFillColor(...GOLD);
  doc.roundedRect(111, y, 83, 19, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text("VALOR TOTAL", 118, y + 7);
  doc.setFontSize(15);
  doc.text(currency(input.total), 188, y + 13, { align: "right" });
  y += 27;

  if (input.notes?.trim()) {
    const noteLines = doc.splitTextToSize(input.notes.trim(), 168) as string[];
    const noteHeight = Math.max(20, noteLines.length * 4.5 + 12);
    if (y + noteHeight > 268) addPage();
    doc.setFillColor(...LIGHT);
    doc.roundedRect(16, y, 178, noteHeight, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...DARK_GOLD);
    doc.text("OBSERVAÇÕES", 21, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(noteLines, 21, y + 14);
    y += noteHeight + 8;
  }

  if (y + 34 > 268) addPage();
  doc.setDrawColor(170, 176, 185);
  doc.line(24, y + 22, 91, y + 22);
  doc.line(119, y + 22, 186, y + 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("Responsável pela clínica", 57.5, y + 27, { align: "center" });
  doc.text("Paciente ou responsável", 152.5, y + 27, { align: "center" });

  drawFooter(doc, page);
  return doc;
}

export function createBudgetPdfFile(input: BudgetPdfInput) {
  const doc = createBudgetPdf(input);
  const date = (input.issuedAt || new Date()).toISOString().split("T")[0];
  const patient = safeFilePart(input.patientName || "paciente") || "paciente";
  const fileName = `orcamento-oralit-${patient}-${date}.pdf`;
  const blob = doc.output("blob");
  return new File([blob], fileName, { type: "application/pdf" });
}

export function openBudgetPdf(input: BudgetPdfInput) {
  const doc = createBudgetPdf(input);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
