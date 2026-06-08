import { useState, useRef } from "react";
import { 
  FileText, UploadCloud, Trash2, X, Plus, Loader2, Download, FileIcon
} from "lucide-react";
import { Button, Card, Label, Select, Input, Badge } from "@/components/ui-bits";
import { toast } from "sonner";
import { usePatientFiles, uploadPatientFile, deletePatientFile, usePatients } from "@/lib/db";
import { DOCUMENT_CATEGORIES, PatientFile } from "@/lib/store";
import { DocumentGeneratorModal } from "./DocumentGeneratorModal";

export function DocumentsTab({ patientId }: { patientId: string }) {
  const [patients] = usePatients();
  const patient = patients.find(p => p.id === patientId);
  const [files, loading, error, refetch] = usePatientFiles(patientId, "documento");
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const [selectedSubTab, setSelectedSubTab] = useState("Todos");
  
  // Custom categories state
  const [customCategoriesList, setCustomCategoriesList] = useState<string[]>(() => {
    const saved = localStorage.getItem("oralit_custom_document_categories");
    return saved ? JSON.parse(saved) : [];
  });
  const [customCategoryInput, setCustomCategoryInput] = useState("");
  
  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState(DOCUMENT_CATEGORIES[0]);
  const [notes, setNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const DOCUMENT_SUB_TABS = [
    "Todos", "Contrato", "Termo", "Exame", "Radiografia", "Receita", 
    "Atestado", "Orçamento", "Comprovante", "Documento pessoal", "Outro"
  ];

  const selectOptions = [
    ...DOCUMENT_CATEGORIES.filter(c => c !== "outro"),
    ...customCategoriesList.map(c => `outro:${c}`),
    "outro"
  ];

  const getCategoryCount = (catName: string) => {
    if (catName === "Todos") return files.length;
    if (catName === "Outro") {
      return files.filter(f => f.category === "outro" || f.category.startsWith("outro:")).length;
    }
    return files.filter(f => f.category.toLowerCase() === catName.toLowerCase()).length;
  };

  const filteredFiles = files.filter(file => {
    if (selectedSubTab === "Todos") return true;
    if (selectedSubTab === "Outro") {
      return file.category === "outro" || file.category.startsWith("outro:");
    }
    return file.category.toLowerCase() === selectedSubTab.toLowerCase();
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      // Check size (15MB)
      if (file.size > 15 * 1024 * 1024) {
        toast.error("Arquivo muito grande. Limite permitido: 15MB para documentos.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    try {
      await uploadPatientFile(patientId, selectedFile, "documento", category, notes);
      toast.success("Documento enviado com sucesso!");
      setShowUploadModal(false);
      setSelectedFile(null);
      setNotes("");
      setCategory(DOCUMENT_CATEGORIES[0]);
      refetch(); 
    } catch (err: any) {
      toast.error(err.message || "Erro ao fazer upload do documento.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (file: PatientFile) => {
    try {
      await deletePatientFile(file.id, file.filePath);
      toast.success("Documento excluído.");
      refetch();
    } catch (err: any) {
      toast.error("Não foi possível excluir agora.");
    }
  };

  const handleAddCustomCategory = () => {
    const value = customCategoryInput.trim();
    if (!value) return;
    const formatted = value.charAt(0).toUpperCase() + value.slice(1);
    const newCat = `outro:${formatted}`;
    
    if (!customCategoriesList.includes(formatted)) {
      const updated = [...customCategoriesList, formatted];
      setCustomCategoriesList(updated);
      localStorage.setItem("oralit_custom_document_categories", JSON.stringify(updated));
    }
    
    setCategory(newCat);
    setCustomCategoryInput("");
    toast.success(`Categoria "${formatted}" adicionada!`);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 text-rose-700 p-4 rounded-lg border border-rose-200">
        <h4 className="font-bold mb-1">Erro ao carregar documentos</h4>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-display font-bold text-lg flex items-center gap-2 text-foreground">
            <FileText className="h-5 w-5 text-gold" />
            Documentos
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Anexe PDFs e imagens de exames, contratos e termos de consentimento (até 15MB).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowGeneratorModal(true)}>
            <FileText className="h-4 w-4 mr-2" /> Gerar Documento
          </Button>
          <Button variant="gold" onClick={() => setShowUploadModal(true)}>
            <Plus className="h-4 w-4 mr-2" /> Enviar Documento
          </Button>
        </div>
      </div>

      {/* Sub-abas de categorias */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
        {DOCUMENT_SUB_TABS.map(tab => {
          const count = getCategoryCount(tab);
          const isActive = selectedSubTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setSelectedSubTab(tab)}
              className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                isActive 
                  ? "bg-gold border-gold text-white shadow-sm" 
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-gold/30"
              }`}
            >
              <span>{tab}</span>
              <span className={`text-[10px] px-1.5 py-0.25 rounded-full ${isActive ? "bg-white/20 text-white" : "bg-secondary text-muted-foreground"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {files.length === 0 ? (
        <Card className="p-8 bg-secondary/20 border-dashed text-center">
          <FileText className="h-12 w-12 text-gold/50 mx-auto mb-4" />
          <h3 className="font-semibold text-foreground mb-2">Nenhum documento anexado</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
            Guarde aqui laudos, orçamentos assinados, radiografias escaneadas e outros arquivos importantes.
          </p>
          <Button variant="outline" onClick={() => setShowUploadModal(true)}>
            Adicionar primeiro documento
          </Button>
        </Card>
      ) : filteredFiles.length === 0 ? (
        <Card className="p-8 bg-secondary/20 border-dashed text-center">
          <FileText className="h-12 w-12 text-gold/30 mx-auto mb-4" />
          <h3 className="font-semibold text-foreground mb-2">Sem arquivos</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Nenhum arquivo nesta categoria.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredFiles.map(file => (
            <div key={file.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border bg-card hover:border-gold/50 transition-all gap-3">
              <div className="flex items-start gap-4 overflow-hidden">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <FileIcon className="h-5 w-5 text-gold" />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-bold text-foreground truncate max-w-[250px] sm:max-w-[400px]" title={file.fileName}>
                      {file.fileName}
                    </h4>
                    <Badge tone="gold" className="text-[9px] py-0 capitalize shrink-0">
                      {file.category.startsWith("outro:") ? `Outro: ${file.category.substring(6)}` : file.category}
                    </Badge>
                    {file.ocrStatus === "processado" && (
                      <Badge tone="ok" className="text-[9px] py-0 shrink-0">Lido (IA)</Badge>
                    )}
                  </div>
                  {file.notes && (
                    <p className="text-xs text-muted-foreground italic line-clamp-2" title={file.notes}>
                      "{file.notes}"
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>{new Date(file.createdAt).toLocaleDateString("pt-BR")}</span>
                    <span>&bull;</span>
                    <span className="uppercase">{file.fileName.split('.').pop()}</span>
                    <span>&bull;</span>
                    <span>{formatFileSize(file.fileSize)}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-2 shrink-0">
                {file.url && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 px-3 text-xs font-semibold"
                    onClick={() => window.open(file.url, "_blank")}
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5 text-gold" /> Visualizar
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-transparent hover:border-rose-200"
                  onClick={() => handleDelete(file)}
                  title="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-secondary/30">
              <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-gold" />
                Anexar Documento
              </h2>
              <button
                className="text-muted-foreground hover:text-foreground transition-colors p-2"
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFile(null);
                  setCategory(DOCUMENT_CATEGORIES[0]);
                  setCustomCategoryInput("");
                }}
                disabled={isUploading}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <Label className="mb-1.5 block">Arquivo (PDF, JPG, PNG, WEBP - Até 15MB)</Label>
                <input 
                  type="file" 
                  accept="application/pdf, image/jpeg, image/png, image/webp" 
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isUploading}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/15 hover:bg-muted/30 px-3 py-3 text-sm font-semibold text-foreground transition-all cursor-pointer truncate max-w-full shadow-sm"
                >
                  <UploadCloud className="h-4 w-4 text-gold shrink-0" />
                  <span className="truncate">
                    {selectedFile ? selectedFile.name : "Selecionar Arquivo do Computador"}
                  </span>
                </button>
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={category} onChange={e => setCategory(e.target.value)} disabled={isUploading}>
                  {selectOptions.map(opt => {
                    let label = opt.charAt(0).toUpperCase() + opt.slice(1);
                    if (opt.startsWith("outro:")) {
                      label = `Outro: ${opt.substring(6)}`;
                    } else if (opt === "outro") {
                      label = "Outro (Especificar...)";
                    }
                    return <option key={opt} value={opt}>{label}</option>;
                  })}
                </Select>
              </div>

              {category === "outro" && (
                <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                  <Label>Especificar outro tipo</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={customCategoryInput} 
                      onChange={e => setCustomCategoryInput(e.target.value)} 
                      placeholder="Ex: panorâmica, autorização, guia..."
                      disabled={isUploading}
                    />
                    <Button 
                      type="button" 
                      variant="gold" 
                      onClick={handleAddCustomCategory}
                      disabled={!customCategoryInput.trim() || isUploading}
                    >
                      Adicionar
                    </Button>
                  </div>
                </div>
              )}

              <div>
                <Label>Observação / Título (Opcional)</Label>
                <Input 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  placeholder="Ex: Contrato assinado ortodontia" 
                  disabled={isUploading}
                />
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-border bg-secondary/30 flex justify-end gap-3 mt-auto">
              <Button variant="outline" onClick={() => {
                setShowUploadModal(false);
                setSelectedFile(null);
                setCategory(DOCUMENT_CATEGORIES[0]);
                setCustomCategoryInput("");
              }} disabled={isUploading}>
                Cancelar
              </Button>
              <Button 
                variant="gold" 
                onClick={handleUpload} 
                disabled={!selectedFile || isUploading || category === "outro"}
                className="min-w-[120px]"
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fazer Upload"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Generator Modal */}
      {showGeneratorModal && patient && (
        <DocumentGeneratorModal 
          patient={patient} 
          onClose={() => setShowGeneratorModal(false)}
          onSuccess={() => {
            setShowGeneratorModal(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
