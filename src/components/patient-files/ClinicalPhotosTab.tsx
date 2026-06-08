import { useState, useRef } from "react";
import { 
  ImageIcon, UploadCloud, Trash2, X, Plus, Loader2, Eye
} from "lucide-react";
import { Button, Card, Label, Select, Input, Badge } from "@/components/ui-bits";
import { toast } from "sonner";
import { usePatientFiles, uploadPatientFile, deletePatientFile } from "@/lib/db";
import { PHOTO_CATEGORIES, PatientFile } from "@/lib/store";

export function ClinicalPhotosTab({ patientId }: { patientId: string }) {
  const [files, loading, error, refetch] = usePatientFiles(patientId, "foto_clinica");
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedSubTab, setSelectedSubTab] = useState("Todas");
  
  // Custom categories state
  const [customCategoriesList, setCustomCategoriesList] = useState<string[]>(() => {
    const saved = localStorage.getItem("oralit_custom_photo_categories");
    return saved ? JSON.parse(saved) : [];
  });
  const [customCategoryInput, setCustomCategoryInput] = useState("");
  
  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState(PHOTO_CATEGORIES[0]);
  const [notes, setNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox state
  const [lightboxFile, setLightboxFile] = useState<PatientFile | null>(null);

  const PHOTO_SUB_TABS = [
    "Todas", "Intraoral", "Extraoral", "Sorriso", "Antes", "Depois", 
    "Radiografia", "Procedimento", "Evolução", "Outro"
  ];

  const selectOptions = [
    ...PHOTO_CATEGORIES.filter(c => c !== "outro"),
    ...customCategoriesList.map(c => `outro:${c}`),
    "outro"
  ];

  const getCategoryCount = (catName: string) => {
    if (catName === "Todas") return files.length;
    if (catName === "Outro") {
      return files.filter(f => f.category === "outro" || f.category.startsWith("outro:")).length;
    }
    return files.filter(f => f.category.toLowerCase() === catName.toLowerCase()).length;
  };

  const filteredFiles = files.filter(file => {
    if (selectedSubTab === "Todas") return true;
    if (selectedSubTab === "Outro") {
      return file.category === "outro" || file.category.startsWith("outro:");
    }
    return file.category.toLowerCase() === selectedSubTab.toLowerCase();
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      // Check size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Arquivo muito grande. Limite permitido: 10MB para fotos.");
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
      await uploadPatientFile(patientId, selectedFile, "foto_clinica", category, notes);
      toast.success("Foto enviada com sucesso!");
      setShowUploadModal(false);
      setSelectedFile(null);
      setNotes("");
      setCategory(PHOTO_CATEGORIES[0]);
      refetch(); 
    } catch (err: any) {
      toast.error(err.message || "Erro ao fazer upload da foto.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (file: PatientFile) => {
    try {
      await deletePatientFile(file.id, file.filePath);
      toast.success("Foto excluída.");
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
      localStorage.setItem("oralit_custom_photo_categories", JSON.stringify(updated));
    }
    
    setCategory(newCat);
    setCustomCategoryInput("");
    toast.success(`Categoria "${formatted}" adicionada!`);
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
        <h4 className="font-bold mb-1">Erro ao carregar fotos</h4>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-display font-bold text-lg flex items-center gap-2 text-foreground">
            <ImageIcon className="h-5 w-5 text-gold" />
            Fotos Clínicas
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Imagens limitadas a 10MB (JPG, PNG, WEBP).
          </p>
        </div>
        <Button variant="gold" onClick={() => setShowUploadModal(true)}>
          <Plus className="h-4 w-4 mr-2" /> Enviar Foto
        </Button>
      </div>

      {/* Sub-abas de categorias */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
        {PHOTO_SUB_TABS.map(tab => {
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
          <ImageIcon className="h-12 w-12 text-gold/50 mx-auto mb-4" />
          <h3 className="font-semibold text-foreground mb-2">Nenhuma foto registrada</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
            Adicione imagens intraorais, extraorais, exames de imagem e outras fotos clínicas do paciente.
          </p>
          <Button variant="outline" onClick={() => setShowUploadModal(true)}>
            Adicionar primeira foto
          </Button>
        </Card>
      ) : filteredFiles.length === 0 ? (
        <Card className="p-8 bg-secondary/20 border-dashed text-center">
          <ImageIcon className="h-12 w-12 text-gold/30 mx-auto mb-4" />
          <h3 className="font-semibold text-foreground mb-2">Sem arquivos</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Nenhum arquivo nesta categoria.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredFiles.map(file => (
            <div key={file.id} className="group relative rounded-xl border border-border bg-card overflow-hidden shadow-sm hover:border-gold/50 transition-all flex flex-col">
              <div 
                className="aspect-square bg-secondary/30 relative cursor-pointer overflow-hidden shrink-0"
                onClick={() => setLightboxFile(file)}
              >
                {file.url ? (
                  <img src={file.url} alt={file.fileName} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                )}
                
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Eye className="h-8 w-8 text-white drop-shadow-md" />
                </div>
              </div>
              
              <div className="p-3 flex-1 flex flex-col justify-between min-h-[110px]">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <Badge tone="gold" className="text-[9px] capitalize px-1.5 py-0 truncate max-w-[80px]" title={file.category.startsWith("outro:") ? file.category.substring(6) : file.category}>
                      {file.category.startsWith("outro:") ? `Outro: ${file.category.substring(6)}` : file.category}
                    </Badge>
                    <span className="text-[9px] text-muted-foreground shrink-0">
                      {new Date(file.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-foreground truncate" title={file.fileName}>
                    {file.fileName}
                  </h4>
                  {file.notes && (
                    <p className="text-[10px] text-muted-foreground line-clamp-1 italic mt-0.5" title={file.notes}>
                      "{file.notes}"
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-1.5 pt-2 mt-2 border-t border-border/50">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 flex-1 text-[10px] px-1 font-semibold"
                    onClick={() => setLightboxFile(file)}
                  >
                    <Eye className="h-3 w-3 mr-1 text-gold" /> Visualizar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 flex-1 text-[10px] px-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-transparent hover:border-rose-200 font-semibold"
                    onClick={() => handleDelete(file)}
                    title="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxFile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
          <button 
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2"
            onClick={() => setLightboxFile(null)}
          >
            <X className="h-8 w-8" />
          </button>
          <div className="max-w-5xl w-full max-h-[90vh] flex flex-col items-center">
            {lightboxFile.url && (
              <img 
                src={lightboxFile.url} 
                alt={lightboxFile.fileName} 
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl" 
              />
            )}
            <div className="mt-4 text-center text-white flex flex-col items-center">
              <Badge tone="gold" className="capitalize mb-2">
                {lightboxFile.category.startsWith("outro:") ? `Outro: ${lightboxFile.category.substring(6)}` : lightboxFile.category}
              </Badge>
              <p className="font-medium text-lg">{lightboxFile.notes || lightboxFile.fileName}</p>
              <p className="text-white/60 text-sm mt-1">{new Date(lightboxFile.createdAt).toLocaleString("pt-BR")}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4 bg-red-600/20 text-rose-400 hover:bg-red-600 hover:text-white border-red-500/30 hover:border-red-600 text-xs font-semibold px-3 py-1.5"
                onClick={() => {
                  handleDelete(lightboxFile);
                  setLightboxFile(null);
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir Foto
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-secondary/30">
              <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-gold" />
                Enviar Foto Clínica
              </h2>
              <button
                className="text-muted-foreground hover:text-foreground transition-colors p-2"
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFile(null);
                  setCategory(PHOTO_CATEGORIES[0]);
                  setCustomCategoryInput("");
                }}
                disabled={isUploading}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <Label>Arquivo de Imagem (Até 10MB)</Label>
                <input 
                  type="file" 
                  accept="image/jpeg, image/png, image/webp" 
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="w-full text-sm mt-1 block file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gold/10 file:text-gold hover:file:bg-gold/20 cursor-pointer"
                  disabled={isUploading}
                />
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
                      placeholder="Ex: panorâmica, foto inicial, guia..."
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
                  placeholder="Ex: Raio-X panorâmico antes do tratamento" 
                  disabled={isUploading}
                />
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-border bg-secondary/30 flex justify-end gap-3 mt-auto">
              <Button variant="outline" onClick={() => {
                setShowUploadModal(false);
                setSelectedFile(null);
                setCategory(PHOTO_CATEGORIES[0]);
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
    </div>
  );
}
