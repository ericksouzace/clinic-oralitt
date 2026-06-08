import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { BrainCircuit, Upload, FileText, ImageIcon, Search, Plus, Trash2, CheckCircle, FileScan, Archive, ScanText } from "lucide-react";
import { useOcrInbox, uploadPatientFile, deletePatientFile, usePatients, updatePatientFileOcr } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ReviewModal } from "@/components/patient-files/ReviewModal";
import type { PatientFile } from "@/lib/store";
import { extractTextFromImage, extractTextFromPdf, suggestFileDestinationFromText } from "@/lib/ocr";
import AppLayout from "@/components/AppLayout";

export const Route = createFileRoute("/central-ia")({
  component: CentralIAPage,
});

function CentralIAPage() {
  const [inbox, loading, error, refetchInbox] = useOcrInbox();
  const [patients] = usePatients();
  
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState("");
  const [uploadPatientId, setUploadPatientId] = useState("");
  const [ocrErrorDetails, setOcrErrorDetails] = useState<{fileId: string, error: string, step: string} | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [reviewingFile, setReviewingFile] = useState<PatientFile | null>(null);
  const [processingOcrIds, setProcessingOcrIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"caixa_entrada" | "para_revisar" | "aplicados" | "arquivados">("caixa_entrada");

  const countCaixaEntrada = inbox.filter(f => f.ocrStatus === "pendente" || f.ocrStatus === "processando").length;
  const countParaRevisar = inbox.filter(f => f.ocrStatus === "processando" || f.ocrStatus === "precisa_revisao" || f.ocrStatus === "processado" || f.ocrStatus === "processado_vazio" || f.ocrStatus === "revisado" || f.ocrStatus === "erro").length;
  const countAplicados = inbox.filter(f => f.ocrStatus === "aplicado").length;
  const countArquivados = inbox.filter(f => f.ocrStatus === "arquivado").length;

  const filteredInbox = inbox.filter(file => {
    switch (activeTab) {
      case "caixa_entrada":
        return file.ocrStatus === "pendente" || file.ocrStatus === "processando";
      case "para_revisar":
        return file.ocrStatus === "processando" || file.ocrStatus === "precisa_revisao" || file.ocrStatus === "processado" || file.ocrStatus === "processado_vazio" || file.ocrStatus === "revisado" || file.ocrStatus === "erro";
      case "aplicados":
        return file.ocrStatus === "aplicado";
      case "arquivados":
        return file.ocrStatus === "arquivado";
      default:
        return false;
    }
  });

  const handleProcessOcr = async (file: PatientFile) => {
    if (!file.url) {
      toast.error("Arquivo não possui URL válida.");
      return;
    }
    try {
      setProcessingOcrIds(prev => new Set(prev).add(file.id));
      
      let extractedText = "";
      if (file.contentType.startsWith("image/")) {
        extractedText = await extractTextFromImage(file.url);
      } else if (file.contentType === "application/pdf") {
        extractedText = await extractTextFromPdf(file.url);
      } else {
        toast.error("Formato não suportado para OCR.");
        return;
      }

      let finalStatus = "precisa_revisao";
      let newSuggestion = file.ocrDestinationSuggestion || "caixa_entrada";

      if (!extractedText || extractedText.trim().length < 10) {
        toast.warning("Não foi possível extrair texto útil deste arquivo.");
        finalStatus = "processado_vazio";
        await updatePatientFileOcr(file.id, extractedText, finalStatus, newSuggestion, true);
      } else {
        newSuggestion = suggestFileDestinationFromText(extractedText);
        finalStatus = "precisa_revisao";
        await updatePatientFileOcr(file.id, extractedText, finalStatus, newSuggestion, true);
        toast.success("OCR processado com sucesso!");
      }
      
      refetchInbox();

      // Auto open ReviewModal with updated info
      const updatedFile: PatientFile = {
        ...file,
        extractedText,
        ocrStatus: finalStatus,
        ocrDestinationSuggestion: newSuggestion,
        isOcrProcessed: true
      };
      setReviewingFile(updatedFile);
      setActiveTab("para_revisar");
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[OCR ERROR]", err);
      toast.error(`Falha ao processar OCR: ${errorMsg}`);
      setOcrErrorDetails({ fileId: file.id, error: errorMsg, step: 'Processamento principal' });
      await updatePatientFileOcr(file.id, "", "erro", file.ocrDestinationSuggestion || "caixa_entrada", false);
      refetchInbox();
      setActiveTab("para_revisar");
    } finally {
      setProcessingOcrIds(prev => {
        const next = new Set(prev);
        next.delete(file.id);
        return next;
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    if (!uploadCategory.trim()) {
      toast.error("Informe a categoria do arquivo (ex: Nota Fiscal, Comprovante).");
      return;
    }

    try {
      setIsUploading(true);
      const fileType = selectedFile.type.startsWith("image/") ? "foto_clinica" : "documento";
      await uploadPatientFile(
        uploadPatientId || null, 
        selectedFile, 
        fileType, 
        uploadCategory, 
        undefined, 
        "pendente" // OCR status inicial
      );
      toast.success("Arquivo enviado para análise!");
      setSelectedFile(null);
      setUploadCategory("");
      setUploadPatientId("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      refetchInbox();
    } catch (err: any) {
      toast.error(err.message || "Erro ao fazer upload.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (file: PatientFile) => {
    try {
      await deletePatientFile(file.id, file.filePath);
      toast.success("Arquivo excluído.");
      refetchInbox();
    } catch {
      toast.error("Não foi possível excluir agora.");
    }
  };

  const handleArchive = async (file: PatientFile) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      
      const { error } = await supabase
        .from("patient_files")
        .update({ ocr_status: "arquivado" })
        .eq("id", file.id)
        .eq("user_id", userData.user.id);
        
      if (error) throw error;
      toast.success("Arquivo arquivado.");
      refetchInbox();
    } catch {
      toast.error("Erro ao arquivar.");
    }
  };

  const formatDestino = (dest: string | undefined) => {
    if (!dest) return "Não identificado";
    const map: Record<string, string> = {
      "estoque": "Estoque",
      "financeiro": "Financeiro",
      "ficha_paciente": "Ficha do Paciente",
      "documento_paciente": "Documento do Paciente",
      "caixa_entrada": "Caixa de Entrada"
    };
    return map[dest] || dest;
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-200">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <BrainCircuit className="h-6 w-6 text-gold" />
          Central de PDFs e Arquivos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visualize arquivos, preencha os dados manualmente e envie cada informação para o módulo correto.
        </p>
      </div>

      {/* Área de Upload */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <Upload className="h-4 w-4" /> Enviar Novo Documento
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Arquivo</label>
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,application/pdf"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/15 hover:bg-muted/30 px-3 py-2 text-sm font-semibold text-foreground transition-all cursor-pointer truncate max-w-full h-[38px] shadow-sm"
            >
              <Upload className="h-4 w-4 text-gold shrink-0" />
              <span className="truncate">
                {selectedFile ? selectedFile.name : "Selecionar PDF ou Imagem"}
              </span>
            </button>
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Categoria *</label>
            <input 
              type="text"
              value={uploadCategory}
              onChange={e => setUploadCategory(e.target.value)}
              placeholder="Ex: Nota Fiscal"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold focus:ring-1 focus:ring-gold"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Paciente (Opcional)</label>
            <select 
              value={uploadPatientId}
              onChange={e => setUploadPatientId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold focus:ring-1 focus:ring-gold"
            >
              <option value="">Nenhum (Financeiro/Estoque)</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.fullName}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 flex items-end">
            <button
              onClick={handleUpload}
              disabled={isUploading || !selectedFile}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-gold-gradient px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isUploading ? "Enviando..." : (
                <>
                  <Plus className="h-4 w-4" /> Adicionar
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Abas e Listagem Inteligente */}
      <div className="flex flex-col gap-4">
        {/* Abas de Navegação da Central IA */}
        <div className="flex flex-wrap gap-1 border-b border-border pb-px">
          <button
            onClick={() => setActiveTab("caixa_entrada")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all outline-none ${
              activeTab === "caixa_entrada"
                ? "border-gold text-gold bg-gold/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            <span>Caixa de Entrada</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
              activeTab === "caixa_entrada" ? "bg-gold text-white" : "bg-secondary text-muted-foreground border border-border"
            }`}>
              {countCaixaEntrada}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("para_revisar")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all outline-none ${
              activeTab === "para_revisar"
                ? "border-gold text-gold bg-gold/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            <span>Para Revisar</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
              activeTab === "para_revisar" ? "bg-gold text-white" : "bg-secondary text-muted-foreground border border-border"
            }`}>
              {countParaRevisar}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("aplicados")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all outline-none ${
              activeTab === "aplicados"
                ? "border-gold text-gold bg-gold/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            <span>Aplicados</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
              activeTab === "aplicados" ? "bg-gold text-white" : "bg-secondary text-muted-foreground border border-border"
            }`}>
              {countAplicados}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("arquivados")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all outline-none ${
              activeTab === "arquivados"
                ? "border-gold text-gold bg-gold/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            <span>Arquivados</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
              activeTab === "arquivados" ? "bg-gold text-white" : "bg-secondary text-muted-foreground border border-border"
            }`}>
              {countArquivados}
            </span>
          </button>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          {ocrErrorDetails && (
            <div className="m-5 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              <h3 className="font-bold mb-1">Detalhes técnicos do erro:</h3>
              <p><strong>Arquivo ID:</strong> {ocrErrorDetails.fileId}</p>
              <p><strong>Etapa:</strong> {ocrErrorDetails.step}</p>
              <p className="font-mono text-xs mt-2 bg-white/50 p-2 rounded">{ocrErrorDetails.error}</p>
              <button onClick={() => setOcrErrorDetails(null)} className="mt-2 text-xs underline font-medium">Fechar erro</button>
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando caixa de entrada...</div>
          ) : filteredInbox.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <div className="h-12 w-12 rounded-full bg-secondary border border-border flex items-center justify-center mb-4">
                <CheckCircle className="h-6 w-6 text-gold" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                {activeTab === "caixa_entrada" ? "Caixa de entrada limpa!" :
                 activeTab === "para_revisar" ? "Nenhum arquivo para revisar!" :
                 activeTab === "aplicados" ? "Nenhum arquivo aplicado!" :
                 "Nenhum arquivo arquivado!"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {activeTab === "caixa_entrada" ? "Não há documentos pendentes de processamento no momento." :
                 activeTab === "para_revisar" ? "Todos os documentos processados foram revisados ou estão pendentes de OCR." :
                 activeTab === "aplicados" ? "Documentos que foram sincronizados com o estoque ou financeiro aparecerão aqui." :
                 "Documentos que foram arquivados para referência histórica aparecerão aqui."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredInbox.map(file => (
                <div key={file.id} className="p-5 hover:bg-muted/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                  
                  <div className="flex items-start gap-3">
                    <div className="mt-1 h-8 w-8 rounded-lg bg-secondary border border-border flex items-center justify-center flex-shrink-0 text-muted-foreground">
                      {file.contentType?.startsWith("image/") ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground break-all">{file.fileName}</h4>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                        <span className="font-medium bg-secondary/80 px-1.5 py-0.5 rounded border border-border">
                          {file.category}
                        </span>
                        <span>{new Date(file.createdAt).toLocaleDateString('pt-BR')}</span>
                        {(file as any).patientName ? (
                          <span className="flex items-center gap-1 text-gold">
                            <Search className="h-3 w-3" /> {(file as any).patientName}
                          </span>
                        ) : (
                          <span className="text-foreground/60 italic">Sem paciente vinculado</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:items-end gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <span className="text-muted-foreground">Destino sugerido:</span>
                      <span className="text-foreground">{formatDestino(file.ocrDestinationSuggestion)}</span>
                    </div>

                    <div className="mt-0.5">
                      {file.ocrStatus === "pendente" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          Aguardando OCR
                        </span>
                      )}
                      {file.ocrStatus === "processando" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-500 border border-blue-500/20 animate-pulse">
                          Processando...
                        </span>
                      )}
                      {(file.ocrStatus === "precisa_revisao" || file.ocrStatus === "processado") && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          Texto extraído disponível
                        </span>
                      )}
                      {file.ocrStatus === "processado_vazio" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          Sem texto útil
                        </span>
                      )}
                      {file.ocrStatus === "erro" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-500 border border-rose-500/20">
                          Erro no OCR
                        </span>
                      )}
                      {file.ocrStatus === "aplicado" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          Aplicado
                        </span>
                      )}
                      {file.ocrStatus === "arquivado" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-500/10 text-slate-500 border border-slate-500/20">
                          Arquivado
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <button 
                        onClick={() => setReviewingFile(file)}
                        className="px-3 py-1.5 rounded-lg bg-gold text-white text-xs font-semibold hover:bg-gold/90 transition-colors flex items-center gap-1.5 shadow-sm"
                      >
                        <BrainCircuit className="h-3.5 w-3.5" /> Revisar
                      </button>

                      {file.ocrStatus !== "aplicado" && file.ocrStatus !== "arquivado" && (
                        <button 
                          onClick={() => handleProcessOcr(file)}
                          disabled={processingOcrIds.has(file.id)}
                          className="px-3 py-1.5 rounded-lg border border-border bg-card text-muted-foreground text-xs font-semibold hover:bg-secondary hover:text-foreground transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <ScanText className="h-3.5 w-3.5" /> 
                          {processingOcrIds.has(file.id) ? "Processando..." : "Tentar leitura automática"}
                        </button>
                      )}

                      {file.ocrStatus !== "arquivado" && file.ocrStatus !== "aplicado" && (
                        <button 
                          onClick={() => handleArchive(file)}
                          className="px-2 py-1.5 rounded-lg border border-border bg-secondary text-foreground text-xs font-semibold hover:bg-border transition-colors"
                          title="Arquivar sem revisar"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <button 
                        onClick={() => handleDelete(file)}
                        className="px-2 py-1.5 rounded-lg border border-transparent text-rose-500 hover:bg-rose-50 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {reviewingFile && (
        <ReviewModal 
          file={reviewingFile}
          onClose={() => setReviewingFile(null)}
          onSuccess={() => {
            setReviewingFile(null);
            refetchInbox();
          }}
        />
      )}

      </div>
    </AppLayout>
  );
}
