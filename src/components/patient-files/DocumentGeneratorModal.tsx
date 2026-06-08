import { useState, useRef, useEffect } from "react";
import { X, FileText, Loader2, Check } from "lucide-react";
import { Button, Label, Select, Textarea, Input } from "@/components/ui-bits";
import { Patient } from "@/lib/store";
import { SignatureCapture, SignatureCaptureRef } from "./SignatureCapture";
import { uploadPatientFile } from "@/lib/db";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

interface DocumentGeneratorModalProps {
  patient: Patient;
  onClose: () => void;
  onSuccess: () => void;
}

const TEMPLATES = [
  "Orçamento odontológico",
  "Termo de consentimento",
  "Receita simples",
  "Atestado",
  "Declaração de comparecimento",
  "Orientação pós-procedimento",
  "Contrato simples de tratamento",
  "Encaminhamento odontológico",
  "Autorização de procedimento"
];

function getInitialText(type: string, patient: Patient): string {
  const dataLocal = new Date().toLocaleDateString("pt-BR", { dateStyle: "long" });
  const nome = patient.fullName || "___________________________";
  const cpf = patient.cpf || "___________________";
  const rg = patient.rg || "___________________";

  switch (type) {
    case "Orçamento odontológico":
      return `PACIENTE: ${nome}\nCPF: ${cpf}\nDATA: ${dataLocal}\n\nORÇAMENTO ODONTOLÓGICO\n\nProcedimentos propostos:\n1. [Procedimento 1] - R$ 0,00\n2. [Procedimento 2] - R$ 0,00\n\nValor Total: R$ 0,00\n\nCondições de pagamento: \n[Detalhar condições]\n\nValidade deste orçamento: 15 dias.`;
    
    case "Termo de consentimento":
      return `TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO\n\nEu, ${nome}, portador(a) do CPF ${cpf} e RG ${rg}, autorizo o(a) cirurgião(ã)-dentista a realizar o tratamento odontológico proposto (_________________________________).\n\nFui devidamente informado(a) sobre:\n1. O diagnóstico e a natureza do tratamento;\n2. Os riscos inerentes ao procedimento;\n3. Os cuidados pós-operatórios necessários;\n4. As possíveis complicações caso não siga as orientações.\n\nDeclaro que compreendi todas as explicações e concordo voluntariamente com a realização do procedimento.\n\nLocal e Data:\n_____________________, ${dataLocal}`;
    
    case "Receita simples":
      return `RECEITUÁRIO ODONTOLÓGICO\n\nPaciente: ${nome}\nData: ${dataLocal}\n\nUso interno / externo:\n\n1. [Nome do Medicamento] - [Quantidade]\n   Tomar 1 comprimido a cada 8 horas por 3 dias.\n\n2. [Nome do Medicamento] - [Quantidade]\n   Aplicar no local afetado 2 vezes ao dia.\n\n[Assinatura e carimbo do dentista]`;
    
    case "Atestado":
      return `ATESTADO ODONTOLÓGICO\n\nAtesto para os devidos fins que o(a) paciente ${nome}, inscrito(a) no CPF sob o nº ${cpf}, esteve sob meus cuidados profissionais no dia ${dataLocal}, no período das [Horário Inicial] às [Horário Final].\n\nNecessita de [Número] dia(s) de repouso por motivo de tratamento odontológico.\n\nCID 10: [Código - Opcional]`;
    
    case "Declaração de comparecimento":
      return `DECLARAÇÃO DE COMPARECIMENTO\n\nDeclaro para os devidos fins que o(a) Sr(a). ${nome}, portador(a) do CPF ${cpf}, compareceu a esta clínica odontológica para atendimento no dia ${dataLocal}, no período das [Horário Inicial] às [Horário Final].`;
    
    case "Orientação pós-procedimento":
      return `ORIENTAÇÕES PÓS-OPERATÓRIAS\n\nPaciente: ${nome}\n\nPara o sucesso do seu tratamento, siga rigorosamente as instruções abaixo:\n\n1. Não fazer bochechos nas primeiras 24 horas;\n2. Alimentação líquida ou pastosa, e fria nas primeiras 24 horas;\n3. Aplicar compressa de gelo na face (15 minutos com intervalo de 10 minutos) durante as primeiras horas;\n4. Evitar esforço físico e exposição ao sol;\n5. Tomar a medicação prescrita no horário correto;\n6. Higienizar os outros dentes normalmente, com cuidado na área operada.\n\nEm caso de dor forte, sangramento excessivo ou dúvidas, entre em contato imediatamente com a clínica.`;
    
    case "Contrato simples de tratamento":
      return `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ODONTOLÓGICOS\n\nCONTRATANTE: ${nome}, CPF: ${cpf}.\nCONTRATADA: Clínica Oralit.\n\nCláusula 1 - Objeto: O presente contrato tem como objeto a prestação de serviços odontológicos, especificamente o tratamento de [Descrever Tratamento].\n\nCláusula 2 - Valor e Pagamento: Pelos serviços prestados, a CONTRATANTE pagará à CONTRATADA o valor de R$ [Valor], que será pago da seguinte forma: [Forma de Pagamento].\n\nCláusula 3 - Obrigações: O paciente compromete-se a comparecer pontualmente às consultas e seguir as orientações clínicas.\n\nPor estarem justas e contratadas, assinam o presente.\n\nData: ${dataLocal}`;
    
    case "Encaminhamento odontológico":
      return `ENCAMINHAMENTO ODONTOLÓGICO\n\nAo(A) colega Dr(a). [Nome do Especialista]\n\nEncaminho o(a) paciente ${nome}, com [Idade] anos, para avaliação e possível tratamento na especialidade de [Especialidade].\n\nMotivo do encaminhamento / Histórico clínico:\n[Descrever o caso clínico brevemente]\n\nAgradeço antecipadamente pela atenção e conduta profissional.\n\nAtenciosamente,\n\nData: ${dataLocal}`;
    
    case "Autorização de procedimento":
      return `AUTORIZAÇÃO DE PROCEDIMENTO (MENORES / INCAPAZES)\n\nEu, _________________________________, portador(a) do CPF ___________________, responsável legal pelo(a) paciente ${nome}, autorizo a realização do procedimento odontológico [Nome do Procedimento].\n\nDeclaro estar ciente de todos os passos clínicos, riscos e benefícios do tratamento propostos.\n\nData: ${dataLocal}`;
      
    default:
      return `Documento para ${nome}\nData: ${dataLocal}\n\n`;
  }
}

export function DocumentGeneratorModal({ patient, onClose, onSuccess }: DocumentGeneratorModalProps) {
  const [templateType, setTemplateType] = useState<string>(TEMPLATES[0]);
  const [documentText, setDocumentText] = useState<string>("");
  const [requireSignature, setRequireSignature] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const signatureRef = useRef<SignatureCaptureRef>(null);

  useEffect(() => {
    setDocumentText(getInitialText(templateType, patient));
  }, [templateType, patient]);

  const handleGenerate = async () => {
    if (!documentText.trim()) {
      toast.error("O texto do documento não pode estar vazio.");
      return;
    }
    
    if (requireSignature && signatureRef.current && signatureRef.current.isEmpty()) {
      toast.error("A assinatura digital é obrigatória, ou desmarque a opção de assinatura.");
      return;
    }

    setIsGenerating(true);
    
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const marginX = 20;
      const marginY = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let currentY = marginY;

      // Logo / Cabeçalho
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(201, 162, 39); // Dourado Oralit
      doc.text("Clínica Oralit", marginX, currentY);
      
      currentY += 10;
      
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(templateType.toUpperCase(), marginX, currentY);

      currentY += 15;

      // Corpo do Documento
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      
      const maxLineWidth = pageWidth - marginX * 2;
      const textLines = doc.splitTextToSize(documentText, maxLineWidth);
      
      for (let i = 0; i < textLines.length; i++) {
        if (currentY > pageHeight - 30) {
           doc.addPage();
           currentY = marginY;
        }
        doc.text(textLines[i], marginX, currentY);
        currentY += 6;
      }

      currentY += 15;

      // Assinatura
      if (requireSignature) {
        let sigBase64 = null;
        if (signatureRef.current && !signatureRef.current.isEmpty()) {
          sigBase64 = signatureRef.current.getBase64();
        }
        
        if (currentY > pageHeight - 50) {
          doc.addPage();
          currentY = marginY;
        }
        
        const sigWidth = 60;
        const sigHeight = 25;
        const sigX = marginX + (maxLineWidth / 2) - (sigWidth / 2);
        
        if (sigBase64) {
           doc.addImage(sigBase64, "PNG", sigX, currentY, sigWidth, sigHeight);
        }
        
        currentY += sigHeight + 5;
        
        doc.setLineWidth(0.5);
        doc.line(sigX - 10, currentY, sigX + sigWidth + 10, currentY);
        currentY += 5;
        
        doc.setFontSize(10);
        doc.text(patient.fullName || "Assinatura do Paciente", marginX + (maxLineWidth / 2), currentY, { align: "center" });
      }

      currentY += 15;
      
      // Rodapé
      if (currentY > pageHeight - 20) {
         doc.addPage();
         currentY = marginY;
      }
      const today = new Date().toLocaleDateString("pt-BR");
      const time = new Date().toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text(`Gerado digitalmente pelo sistema Oralit em ${today} às ${time}`, marginX, currentY);

      const pdfBlob = doc.output("blob");
      
      const safeType = templateType.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
      const safeName = (patient.fullName || "paciente").toLowerCase().replace(/[^a-z0-9]/g, "-").split("-")[0];
      const fileName = `${safeType}-${safeName}.pdf`;
      
      const file = new File([pdfBlob], fileName, { type: "application/pdf" });

      let category = "outro";
      if (templateType === "Orçamento odontológico") category = "orçamento";
      else if (templateType.includes("Termo")) category = "termo";
      else if (templateType.includes("Receita")) category = "receita";
      else if (templateType.includes("Atestado")) category = "atestado";
      else if (templateType.includes("Contrato")) category = "contrato";
      else if (templateType.includes("Declaração")) category = "documento pessoal";

      await uploadPatientFile(patient.id, file, "documento", category, `Documento gerado via sistema: ${templateType}`);
      
      toast.success("Documento gerado e salvo com sucesso!");
      onSuccess();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao gerar PDF e salvar.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-3xl max-h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-secondary/30 shrink-0">
          <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-gold" />
            Gerar Documento Oficial
          </h2>
          <button
            className="text-muted-foreground hover:text-foreground transition-colors p-2"
            onClick={onClose}
            disabled={isGenerating}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Modelo do Documento</Label>
              <Select value={templateType} onChange={e => setTemplateType(e.target.value)} disabled={isGenerating}>
                {TEMPLATES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </div>
            <div className="flex items-center pt-6">
               <Label className="flex items-center gap-2 cursor-pointer border p-2.5 rounded-lg w-full bg-secondary/20 hover:bg-secondary/40 transition">
                  <input 
                    type="checkbox"
                    className="w-4 h-4 text-gold border-border rounded focus:ring-gold"
                    checked={requireSignature} 
                    onChange={(e) => setRequireSignature(e.target.checked)} 
                    disabled={isGenerating}
                  />
                  <span>Coletar assinatura digital do paciente</span>
               </Label>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <Label>Conteúdo do Documento</Label>
              <span className="text-[10px] text-muted-foreground">Você pode editar o texto livremente antes de gerar.</span>
            </div>
            <Textarea 
              value={documentText} 
              onChange={e => setDocumentText(e.target.value)} 
              className="h-[300px] font-mono text-sm resize-y"
              disabled={isGenerating}
            />
          </div>

          {requireSignature && (
            <div className="pt-2 border-t border-border">
               <SignatureCapture ref={signatureRef} />
            </div>
          )}
        </div>
        
        <div className="px-6 py-4 border-t border-border bg-secondary/30 flex justify-end gap-3 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>
            Cancelar
          </Button>
          <Button 
            variant="gold" 
            onClick={handleGenerate} 
            disabled={isGenerating}
            className="min-w-[140px]"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <><Check className="h-4 w-4 mr-2" /> Gerar e Salvar PDF</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
