import React, { useState, useEffect } from "react";
import { X, CheckCircle2, AlertCircle, Plus, Trash2, ExternalLink, Download } from "lucide-react";
import type { PatientFile } from "@/lib/store";
import { 
  applyFileDestination, 
  usePatients,
  applyFileToEstoque,
  applyFileToFinanceiro,
  applyFileToClinicalRecord,
  applyFileToBudget,
  applyFileToDocumento
} from "@/lib/db";
import { extractStructuredData } from "@/lib/ocr";
import { toast } from "sonner";

interface ReviewModalProps {
  file: PatientFile;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReviewModal({ file, onClose, onSuccess }: ReviewModalProps) {
  const [patients] = usePatients();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [destination, setDestination] = useState(file.ocrDestinationSuggestion || "caixa_entrada");
  const [category, setCategory] = useState(file.category || "");
  const [notes, setNotes] = useState(file.notes || "");
  const [patientId, setPatientId] = useState<string>(file.patientId || "");

  // Stateful form data populated once from OCR on load
  const [hasParsed, setHasParsed] = useState(false);

  // 1. Estoque state
  const [fornecedor, setFornecedor] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [dataCompra, setDataCompra] = useState("");
  const [numeroNota, setNumeroNota] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("Outro");
  const [insumos, setInsumos] = useState<any[]>([]);

  // 2. Financeiro state
  const [finTipo, setFinTipo] = useState<"despesa" | "receita">("despesa");
  const [finValorBruto, setFinValorBruto] = useState<number | string>("");
  const [finTaxa, setFinTaxa] = useState<number | string>(0);
  const [finData, setFinData] = useState("");
  const [finMetodoPagamento, setFinMetodoPagamento] = useState("Outro");
  const [finCategoria, setFinCategoria] = useState("Geral");
  const [finDescricao, setFinDescricao] = useState("");
  const [finObservacao, setFinObservacao] = useState("");

  // 3. Ficha Clínica state
  const [clinTipo, setClinTipo] = useState("exame");
  const [clinData, setClinData] = useState("");
  const [clinTitulo, setClinTitulo] = useState("");
  const [clinResumo, setClinResumo] = useState("");
  const [clinObservacoes, setClinObservacoes] = useState("");

  // 4. Documentos state
  const [docCategoria, setDocCategoria] = useState("contrato");
  const [docTitulo, setDocTitulo] = useState("");
  const [docObservacao, setDocObservacao] = useState("");

  // 5. Orçamentos state
  const [budgetTitulo, setBudgetTitulo] = useState("");
  const [budgetStatus, setBudgetStatus] = useState("pendente");
  const [budgetObservacoes, setBudgetObservacoes] = useState("");
  const [budgetProcedimentos, setBudgetProcedimentos] = useState<any[]>([]);

  // 6. Caixa de Entrada state
  const [caixaCategoria, setCaixaCategoria] = useState("");
  const [caixaTitulo, setCaixaTitulo] = useState("");
  const [caixaObservacao, setCaixaObservacao] = useState("");

  useEffect(() => {
    if (!hasParsed && file) {
      let parsedEstoque: any = {};
      let parsedFinanceiro: any = {};
      let parsedClinical: any = {};
      let parsedBudget: any = {};

      if (file.extractedText) {
        parsedEstoque = extractStructuredData(file.extractedText, 'estoque') || {};
        parsedFinanceiro = extractStructuredData(file.extractedText, 'financeiro') || {};
        parsedClinical = extractStructuredData(file.extractedText, 'ficha_paciente') || {};
        parsedBudget = extractStructuredData(file.extractedText, 'orcamento') || {};
      }

      // 1. Estoque
      setFornecedor(parsedEstoque.vendor || parsedEstoque.fornecedor || "");
      setCnpj(parsedEstoque.cnpj || "");
      setDataCompra(parsedEstoque.date || file.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0]);
      setNumeroNota(parsedEstoque.invoiceNumber || parsedEstoque.numero_nota || "");
      setFormaPagamento(parsedEstoque.paymentMethod || "Outro");

      const rawItems = parsedEstoque.items || [];
      const cleanItems = rawItems
        .filter((item: any) => {
          const name = (item.name || "").toLowerCase().trim();
          return name && !["nota", "fiscal", "danfe", "item", "produto", "nota fiscal"].includes(name);
        })
        .map((item: any) => ({
          name: item.name || "",
          quantity: item.quantity || 1,
          unit: item.unit || "un",
          unitPrice: item.unitPrice || 0,
          totalPrice: item.totalPrice || (item.unitPrice || 0) * (item.quantity || 1),
          category: item.category || "Geral",
          action: "create",
          confidence: item.confidence || "Alta",
          use: true
        }));
      setInsumos(cleanItems);

      // 2. Financeiro
      setFinTipo(parsedFinanceiro.type === 'receita' ? 'receita' : 'despesa');
      setFinValorBruto(parsedFinanceiro.amount || "");
      setFinTaxa(parsedFinanceiro.fee || 0);
      setFinData(parsedFinanceiro.date || file.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0]);
      setFinMetodoPagamento(parsedFinanceiro.paymentMethod || "Outro");
      setFinCategoria(file.category || "Geral");
      setFinDescricao(parsedFinanceiro.description || "");
      setFinObservacao(file.notes || "");

      // 3. Ficha Clínica
      setClinTipo(parsedClinical.clinicalType || "exame");
      setClinData(parsedClinical.date || file.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0]);
      setClinTitulo(parsedClinical.title || "");
      setClinResumo(parsedClinical.summary || "");
      setClinObservacoes(file.notes || "");

      // 4. Documentos
      setDocCategoria("contrato");
      setDocTitulo(file.fileName || "");
      setDocObservacao(file.notes || "");

      // 5. Orçamentos
      setBudgetTitulo(parsedBudget.title || "Orçamento");
      setBudgetStatus(parsedBudget.status || "pendente");
      setBudgetObservacoes(file.notes || "");
      setBudgetProcedimentos(parsedBudget.procedures || []);

      // 6. Caixa de entrada metadata
      setCaixaCategoria(file.category || "");
      setCaixaTitulo(file.fileName || "");
      setCaixaObservacao(file.notes || "");

      setHasParsed(true);
    }
  }, [file, hasParsed]);

  const handleAddInsumo = () => {
    setInsumos(prev => [
      ...prev,
      {
        name: "",
        quantity: 1,
        unit: "un",
        unitPrice: 0,
        totalPrice: 0,
        category: "Geral",
        action: "create",
        use: true
      }
    ]);
  };

  const handleRemoveInsumo = (idx: number) => {
    setInsumos(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateInsumoField = (idx: number, field: string, val: any) => {
    setInsumos(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      
      // Automatic calculations
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = Number(updated[idx].quantity) || 0;
        const price = Number(updated[idx].unitPrice) || 0;
        updated[idx].totalPrice = qty * price;
      }
      return updated;
    });
  };

  const handleAddProcedure = () => {
    setBudgetProcedimentos(prev => [
      ...prev,
      { description: "", price: 0, notes: "" }
    ]);
  };

  const handleRemoveProcedure = (idx: number) => {
    setBudgetProcedimentos(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateProcedureField = (idx: number, field: string, val: any) => {
    setBudgetProcedimentos(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      
      let successMsg = "Dados aplicados com sucesso!";

      if (destination === 'estoque') {
        const itemsToUse = insumos.filter(i => i.use && i.name.trim() !== "");
        
        if (itemsToUse.length === 0) {
          throw new Error("Adicione pelo menos um insumo com nome antes de enviar para o Estoque.");
        }

        const invalidNames = ['nota', 'fiscal', 'danfe', 'item', 'produto', 'nota fiscal'];
        for (const item of itemsToUse) {
          if (!item.name || item.name.trim() === '') {
            throw new Error("Todos os insumos ativos precisam ter um nome preenchido.");
          }
          if (invalidNames.includes(item.name.toLowerCase().trim())) {
            throw new Error(`O nome '${item.name}' é inválido. Digite o nome real do insumo.`);
          }
        }

        const dataEstoque = {
          vendor: fornecedor,
          cnpj,
          date: dataCompra,
          invoiceNumber: numeroNota,
          paymentMethod: formaPagamento,
          notes: notes
        };

        await applyFileToEstoque(file.id, dataEstoque, itemsToUse, category || "Insumos");
        successMsg = "Insumos enviados para o Estoque.";

      } else if (destination === 'financeiro') {
        const amt = parseFloat(String(finValorBruto));
        if (isNaN(amt) || amt <= 0) {
          throw new Error("Informe um valor maior que R$ 0,00 para enviar ao Financeiro.");
        }

        const dataFinanceiro = {
          type: finTipo,
          amount: amt,
          fee: parseFloat(String(finTaxa)) || 0,
          netAmount: amt - (parseFloat(String(finTaxa)) || 0),
          date: finData,
          paymentMethod: finMetodoPagamento,
          description: finDescricao
        };

        await applyFileToFinanceiro(file.id, dataFinanceiro, patientId, finCategoria || category || "Geral", finObservacao || notes);
        successMsg = "Lançamento enviado para o Financeiro.";

      } else if (destination === 'ficha_paciente') {
        if (!patientId) {
          throw new Error("Selecione um paciente obrigatório para a Ficha Clínica.");
        }
        if (!clinTitulo.trim() && !clinResumo.trim()) {
          throw new Error("Preencha o título ou o resumo clínico.");
        }

        const dataClinica = {
          clinicalType: clinTipo,
          date: clinData,
          title: clinTitulo || "Registro Clínico",
          summary: clinResumo
        };

        await applyFileToClinicalRecord(file.id, dataClinica, patientId, category || "Registro Clínico", clinObservacoes || notes);
        successMsg = "Arquivo vinculado à Ficha Clínica.";

      } else if (destination === 'documento_paciente') {
        if (!patientId) {
          throw new Error("Selecione um paciente obrigatório para enviar o Documento.");
        }
        if (!docCategoria) {
          throw new Error("Escolha uma categoria para o documento.");
        }

        await applyFileToDocumento(file.id, patientId, docCategoria, docObservacao || notes);
        successMsg = "Documento enviado para o paciente.";

      } else if (destination === 'orcamento') {
        if (!patientId) {
          throw new Error("Selecione um paciente obrigatório para criar o Orçamento.");
        }
        if (budgetProcedimentos.length === 0) {
          throw new Error("Adicione pelo menos 1 procedimento para criar o Orçamento.");
        }

        const totalCalculated = budgetProcedimentos.reduce((sum, p) => sum + (Number(p.price) || 0), 0);

        const dataOrcamento = {
          title: budgetTitulo || "Orçamento de Tratamento",
          status: budgetStatus,
          totalAmount: totalCalculated,
          procedures: budgetProcedimentos
        };

        await applyFileToBudget(file.id, dataOrcamento, patientId, category || "Orçamento", budgetObservacoes || notes);
        successMsg = "Orçamento criado com sucesso.";

      } else {
        // Caixa de Entrada / Manter
        await applyFileDestination(file.id, {
          ocr_destination_suggestion: 'caixa_entrada',
          category: caixaCategoria || category,
          notes: caixaObservacao || notes,
          patient_id: patientId || null
        });
        successMsg = "Alterações salvas na Caixa de Entrada.";
      }

      toast.success(successMsg);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Erro ao aplicar destino.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card w-full max-w-6xl h-[92vh] rounded-xl border border-border shadow-xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-155">
        
        {/* Lado Esquerdo - Prévia do Arquivo */}
        <div className="w-full md:w-1/2 bg-muted/20 border-r border-border flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between bg-card">
            <div className="truncate max-w-[55%]">
              <h3 className="font-semibold text-foreground truncate text-sm" title={file.fileName}>{file.fileName}</h3>
            </div>
            
            <div className="flex items-center gap-2">
              {file.url && (
                <>
                  <a 
                    href={file.url} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 text-foreground rounded text-[11px] font-semibold transition-colors flex items-center gap-1 border border-border"
                  >
                    <ExternalLink className="h-3 w-3" /> Abrir em nova guia
                  </a>
                  <a 
                    href={file.url} 
                    download={file.fileName}
                    className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 text-foreground rounded text-[11px] font-semibold transition-colors flex items-center gap-1 border border-border"
                  >
                    <Download className="h-3 w-3" /> Baixar
                  </a>
                </>
              )}
              <button onClick={onClose} className="p-1 text-muted-foreground hover:bg-muted rounded-md md:hidden">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 p-1 md:p-2 flex flex-col bg-muted/10 overflow-hidden">
            {file.url ? (
              file.contentType.startsWith("image/") ? (
                <div className="flex-1 flex items-center justify-center overflow-hidden">
                  <img src={file.url} alt={file.fileName} className="max-w-full max-h-full object-contain rounded-lg shadow-sm border border-border/50" />
                </div>
              ) : file.contentType === "application/pdf" ? (
                <iframe src={file.url} className="w-full h-full flex-1 rounded-lg border border-border bg-background shadow-inner" title={file.fileName} />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground p-8">
                  <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-50 text-gold" />
                  <p className="text-sm font-medium">Prévia indisponível.</p>
                  <p className="text-xs mt-1">Este formato de arquivo não pode ser renderizado diretamente.</p>
                </div>
              )
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-muted-foreground animate-pulse">Carregando visualização...</p>
              </div>
            )}
          </div>
        </div>

        {/* Lado Direito - Ações e Formulário Manual */}
        <div className="w-full md:w-1/2 flex flex-col h-full bg-card overflow-hidden">
          <div className="p-4 border-b border-border hidden md:flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground text-sm">Revisar Arquivo</h3>
              <p className="text-[11px] text-muted-foreground">Confira o arquivo e preencha os dados manualmente antes de enviar.</p>
            </div>
            <button onClick={onClose} className="p-1 text-muted-foreground hover:bg-muted rounded-md transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-y-auto p-5 space-y-4">
            
            {/* Destino Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Enviar para o Módulo</label>
              <select 
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold focus:ring-1 focus:ring-gold font-medium"
                required
              >
                <option value="estoque">Estoque / Insumos</option>
                <option value="financeiro">Financeiro (Receitas / Despesas)</option>
                <option value="ficha_paciente">Ficha Clínica / Paciente</option>
                <option value="documento_paciente">Documentos do Paciente</option>
                <option value="orcamento">Orçamentos / Planos</option>
                <option value="caixa_entrada">Manter na Caixa de Entrada</option>
              </select>
            </div>

            {/* Sugestão de Leitura Automática (OCR) */}
            {file.extractedText && (
              <details className="bg-muted/15 border border-border rounded-lg p-3 group transition-all">
                <summary className="text-xs font-bold text-muted-foreground cursor-pointer select-none list-none flex items-center justify-between">
                  <span>Leitura automática sugerida (Texto Lido)</span>
                  <span className="text-[10px] text-gold font-semibold underline group-open:hidden">Expandir</span>
                  <span className="text-[10px] text-gold font-semibold underline hidden group-open:inline">Recolher</span>
                </summary>
                <div className="mt-2.5 space-y-2">
                  <textarea 
                    readOnly 
                    className="w-full h-28 text-[10px] font-mono text-muted-foreground bg-background/50 p-2 rounded-lg border border-border resize-y outline-none"
                    value={file.extractedText}
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-muted-foreground">Extraído via OCR secundário. Use apenas para referência.</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(file.extractedText || "");
                        toast.success("Texto copiado!");
                      }}
                      className="text-[10px] text-gold hover:underline font-semibold bg-secondary px-2 py-0.5 rounded border border-border"
                    >
                      Copiar texto
                    </button>
                  </div>
                </div>
              </details>
            )}

            {/* FORMULÁRIO DO ESTOQUE */}
            {destination === 'estoque' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="bg-gold/5 border border-gold/15 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gold">Dados da Nota / Compra</h4>
                  
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-muted-foreground">Fornecedor</label>
                      <input 
                        type="text" 
                        value={fornecedor} 
                        onChange={(e) => setFornecedor(e.target.value)} 
                        className="w-full mt-1.5 px-3 py-1.5 border rounded-lg bg-background border-border outline-none focus:border-gold" 
                        placeholder="Nome da empresa" 
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-muted-foreground">CNPJ (Opcional)</label>
                      <input 
                        type="text" 
                        value={cnpj} 
                        onChange={(e) => setCnpj(e.target.value)} 
                        className="w-full mt-1.5 px-3 py-1.5 border rounded-lg bg-background border-border outline-none focus:border-gold" 
                        placeholder="00.000.000/0000-00" 
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-muted-foreground">Data da Compra</label>
                      <input 
                        type="date" 
                        value={dataCompra} 
                        onChange={(e) => setDataCompra(e.target.value)} 
                        className="w-full mt-1.5 px-3 py-1.5 border rounded-lg bg-background border-border outline-none focus:border-gold" 
                        required 
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-muted-foreground">Número da Nota (Opcional)</label>
                      <input 
                        type="text" 
                        value={numeroNota} 
                        onChange={(e) => setNumeroNota(e.target.value)} 
                        className="w-full mt-1.5 px-3 py-1.5 border rounded-lg bg-background border-border outline-none focus:border-gold" 
                        placeholder="Nº Nota Fiscal" 
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="font-semibold text-muted-foreground">Forma de Pagamento (Opcional)</label>
                      <input 
                        type="text" 
                        value={formaPagamento} 
                        onChange={(e) => setFormaPagamento(e.target.value)} 
                        className="w-full mt-1.5 px-3 py-1.5 border rounded-lg bg-background border-border outline-none focus:border-gold" 
                        placeholder="Pix, Boleto, Cartão..." 
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">Tabela de Insumos</label>
                    <button 
                      type="button" 
                      onClick={handleAddInsumo} 
                      className="px-2 py-1 bg-gold/10 hover:bg-gold/20 text-gold text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar Insumo
                    </button>
                  </div>

                  <div className="border border-border rounded-xl overflow-x-auto bg-background/50 shadow-sm max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-muted/40 border-b sticky top-0">
                        <tr>
                          <th className="px-2 py-2 text-center w-8 text-muted-foreground font-semibold">Usar</th>
                          <th className="px-2 py-2 text-muted-foreground font-semibold">Nome do Insumo</th>
                          <th className="px-2 py-2 w-14 text-center text-muted-foreground font-semibold">Qtd</th>
                          <th className="px-2 py-2 w-14 text-muted-foreground font-semibold">Un</th>
                          <th className="px-2 py-2 w-20 text-right text-muted-foreground font-semibold">Custo Unit</th>
                          <th className="px-2 py-2 w-20 text-right text-muted-foreground font-semibold">Total</th>
                          <th className="px-2 py-2 w-24 text-muted-foreground font-semibold">Categoria</th>
                          <th className="px-2 py-2 w-24 text-muted-foreground font-semibold">Ação</th>
                          <th className="px-2 py-2 w-8 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {insumos.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="text-center p-6 text-muted-foreground italic bg-background">
                              Nenhum insumo adicionado. Clique em "Adicionar Insumo".
                            </td>
                          </tr>
                        ) : (
                          insumos.map((item, idx) => (
                            <tr key={idx} className={`${item.use ? '' : 'opacity-40 bg-muted/10'} hover:bg-muted/20 transition-all`}>
                              <td className="px-2 py-1.5 text-center">
                                <input 
                                  type="checkbox" 
                                  checked={item.use} 
                                  onChange={(e) => handleUpdateInsumoField(idx, 'use', e.target.checked)} 
                                  className="rounded border-gray-300 text-gold focus:ring-gold cursor-pointer"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input 
                                  type="text" 
                                  value={item.name} 
                                  onChange={(e) => handleUpdateInsumoField(idx, 'name', e.target.value)} 
                                  className="px-2 py-1 border border-border focus:border-gold rounded bg-background text-foreground text-xs outline-none w-44" 
                                  placeholder="Nome" 
                                  disabled={!item.use} 
                                  required={item.use}
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input 
                                  type="number" 
                                  min="1" 
                                  value={item.quantity} 
                                  onChange={(e) => handleUpdateInsumoField(idx, 'quantity', Number(e.target.value))} 
                                  className="px-1.5 py-1 text-center border border-border focus:border-gold rounded bg-background text-foreground text-xs outline-none w-12" 
                                  disabled={!item.use} 
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input 
                                  type="text" 
                                  value={item.unit} 
                                  onChange={(e) => handleUpdateInsumoField(idx, 'unit', e.target.value)} 
                                  className="px-1.5 py-1 border border-border focus:border-gold rounded bg-background text-foreground text-xs outline-none w-12" 
                                  placeholder="un" 
                                  disabled={!item.use} 
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input 
                                  type="number" 
                                  step="0.01" 
                                  value={item.unitPrice} 
                                  onChange={(e) => handleUpdateInsumoField(idx, 'unitPrice', Number(e.target.value))} 
                                  className="px-1.5 py-1 text-right border border-border focus:border-gold rounded bg-background text-foreground text-xs outline-none w-20" 
                                  disabled={!item.use} 
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input 
                                  type="number" 
                                  step="0.01" 
                                  value={item.totalPrice} 
                                  onChange={(e) => handleUpdateInsumoField(idx, 'totalPrice', Number(e.target.value))} 
                                  className="px-1.5 py-1 text-right border border-border focus:border-gold rounded bg-background text-foreground text-xs outline-none w-20" 
                                  disabled={!item.use} 
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input 
                                  type="text" 
                                  value={item.category} 
                                  onChange={(e) => handleUpdateInsumoField(idx, 'category', e.target.value)} 
                                  className="px-1.5 py-1 border border-border focus:border-gold rounded bg-background text-foreground text-xs outline-none w-20" 
                                  disabled={!item.use} 
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <select 
                                  value={item.action} 
                                  onChange={(e) => handleUpdateInsumoField(idx, 'action', e.target.value)} 
                                  className="px-1 py-1 border border-border rounded bg-background text-foreground text-xs outline-none cursor-pointer"
                                  disabled={!item.use}
                                >
                                  <option value="create">Criar Novo</option>
                                  <option value="update">Adicionar Qtd</option>
                                </select>
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <button 
                                  type="button" 
                                  onClick={() => handleRemoveInsumo(idx)} 
                                  className="text-rose-500 hover:bg-rose-50 p-1 rounded transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5"/>
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* FORMULÁRIO DO FINANCEIRO */}
            {destination === 'financeiro' && (
              <div className="space-y-3 bg-muted/15 p-4 rounded-xl border border-border animate-in fade-in duration-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Lançamento Financeiro</h4>
                
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-semibold text-muted-foreground">Tipo</label>
                    <select 
                      value={finTipo} 
                      onChange={(e) => setFinTipo(e.target.value as any)} 
                      className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background outline-none border-border"
                    >
                      <option value="despesa">Despesa (Débito)</option>
                      <option value="receita">Receita (Crédito)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-muted-foreground">Valor Bruto (R$)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={finValorBruto} 
                      onChange={(e) => setFinValorBruto(e.target.value)} 
                      className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background outline-none border-border focus:border-gold" 
                      placeholder="0.00" 
                      required
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-muted-foreground">Taxa (R$)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={finTaxa} 
                      onChange={(e) => setFinTaxa(e.target.value)} 
                      className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background outline-none border-border focus:border-gold" 
                      placeholder="0.00" 
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-muted-foreground">Valor Líquido Calculado (R$)</label>
                    <input 
                      type="number" 
                      value={((Number(finValorBruto) || 0) - (Number(finTaxa) || 0)).toFixed(2)} 
                      disabled 
                      className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-muted/50 text-muted-foreground outline-none border-border" 
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-muted-foreground">Data do Lançamento</label>
                    <input 
                      type="date" 
                      value={finData} 
                      onChange={(e) => setFinData(e.target.value)} 
                      className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background outline-none border-border focus:border-gold" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-muted-foreground">Método de Pagamento</label>
                    <select 
                      value={finMetodoPagamento} 
                      onChange={(e) => setFinMetodoPagamento(e.target.value)} 
                      className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background outline-none border-border"
                    >
                      <option value="Pix">Pix</option>
                      <option value="Cartão de Crédito">Cartão de Crédito</option>
                      <option value="Cartão de Débito">Cartão de Débito</option>
                      <option value="Boleto">Boleto</option>
                      <option value="Dinheiro">Dinheiro</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-muted-foreground">Categoria</label>
                    <input 
                      type="text" 
                      value={finCategoria} 
                      onChange={(e) => setFinCategoria(e.target.value)} 
                      className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background outline-none border-border focus:border-gold" 
                      placeholder="Ex: Insumos, Serviços" 
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-muted-foreground">Paciente Vinculado (Opcional)</label>
                    <select 
                      value={patientId} 
                      onChange={(e) => setPatientId(e.target.value)} 
                      className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background outline-none border-border"
                    >
                      <option value="">Nenhum paciente</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.fullName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="font-semibold text-muted-foreground">Descrição</label>
                    <input 
                      type="text" 
                      value={finDescricao} 
                      onChange={(e) => setFinDescricao(e.target.value)} 
                      className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background outline-none border-border focus:border-gold" 
                      placeholder="Breve descrição" 
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="font-semibold text-muted-foreground">Observações Internas</label>
                    <textarea 
                      value={finObservacao} 
                      onChange={(e) => setFinObservacao(e.target.value)} 
                      className="w-full mt-1.5 px-3 py-1.5 border rounded-lg bg-background outline-none border-border focus:border-gold resize-none" 
                      rows={2} 
                      placeholder="Mais informações..." 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* FORMULÁRIO DA FICHA CLÍNICA */}
            {destination === 'ficha_paciente' && (
              <div className="space-y-3 bg-muted/15 p-4 rounded-xl border border-border animate-in fade-in duration-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Registro Clínico do Paciente</h4>
                
                <div className="text-xs space-y-3">
                  <div>
                    <label className="font-semibold text-muted-foreground">Paciente *</label>
                    <select 
                      value={patientId} 
                      onChange={(e) => setPatientId(e.target.value)} 
                      className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background outline-none border-border"
                      required
                    >
                      <option value="">Selecione o paciente...</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.fullName} {p.cpf ? `(${p.cpf})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-muted-foreground">Tipo de Registro</label>
                      <select 
                        value={clinTipo} 
                        onChange={(e) => setClinTipo(e.target.value)} 
                        className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background outline-none border-border"
                      >
                        <option value="exame">Exame</option>
                        <option value="laudo">Laudo</option>
                        <option value="radiografia">Radiografia</option>
                        <option value="evolução">Evolução</option>
                        <option value="observação">Observação</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-semibold text-muted-foreground">Data</label>
                      <input 
                        type="date" 
                        value={clinData} 
                        onChange={(e) => setClinData(e.target.value)} 
                        className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background outline-none border-border" 
                        required 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-muted-foreground">Título do Registro</label>
                    <input 
                      type="text" 
                      value={clinTitulo} 
                      onChange={(e) => setClinTitulo(e.target.value)} 
                      className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background outline-none border-border focus:border-gold" 
                      placeholder="Ex: Laudo Panorâmica, Extração Dente 38" 
                      required
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-muted-foreground">Resumo Clínico Manual *</label>
                    <textarea 
                      value={clinResumo} 
                      onChange={(e) => setClinResumo(e.target.value)} 
                      className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background outline-none border-border focus:border-gold resize-y" 
                      rows={4} 
                      placeholder="Digite o resumo ou detalhes do exame/tratamento..." 
                      required
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-muted-foreground">Observações de Arquivo</label>
                    <textarea 
                      value={clinObservacoes} 
                      onChange={(e) => setClinObservacoes(e.target.value)} 
                      className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background outline-none border-border focus:border-gold resize-none" 
                      rows={2} 
                      placeholder="Observações adicionais..." 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* FORMULÁRIO DE DOCUMENTOS DO PACIENTE */}
            {destination === 'documento_paciente' && (
              <div className="space-y-3 bg-muted/15 p-4 rounded-xl border border-border animate-in fade-in duration-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Documentos do Paciente</h4>
                
                <div className="text-xs space-y-3">
                  <div>
                    <label className="font-semibold text-muted-foreground">Paciente *</label>
                    <select 
                      value={patientId} 
                      onChange={(e) => setPatientId(e.target.value)} 
                      className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background outline-none border-border"
                      required
                    >
                      <option value="">Selecione o paciente...</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.fullName}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-muted-foreground">Categoria do Documento *</label>
                    <select 
                      value={docCategoria} 
                      onChange={(e) => setDocCategoria(e.target.value)} 
                      className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background outline-none border-border"
                      required
                    >
                      <option value="contrato">Contrato</option>
                      <option value="termo">Termo de Consentimento</option>
                      <option value="receita">Receita</option>
                      <option value="atestado">Atestado</option>
                      <option value="exame">Exame</option>
                      <option value="radiografia">Radiografia</option>
                      <option value="autorização">Autorização</option>
                      <option value="documento pessoal">Documento Pessoal</option>
                      <option value="orçamento">Orçamento Assinado</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-muted-foreground">Título do Documento</label>
                    <input 
                      type="text" 
                      value={docTitulo} 
                      onChange={(e) => setDocTitulo(e.target.value)} 
                      className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background outline-none border-border focus:border-gold" 
                      placeholder="Ex: Contrato de Prestação de Serviços" 
                      required
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-muted-foreground">Observação</label>
                    <textarea 
                      value={docObservacao} 
                      onChange={(e) => setDocObservacao(e.target.value)} 
                      className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background outline-none border-border focus:border-gold resize-none" 
                      rows={3} 
                      placeholder="Observações sobre o documento..." 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* FORMULÁRIO DE ORÇAMENTOS */}
            {destination === 'orcamento' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="bg-muted/15 p-4 rounded-xl border border-border space-y-3 text-xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Novo Orçamento / Plano</h4>
                  
                  <div>
                    <label className="font-semibold text-muted-foreground">Paciente *</label>
                    <select 
                      value={patientId} 
                      onChange={(e) => setPatientId(e.target.value)} 
                      className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background outline-none border-border"
                      required
                    >
                      <option value="">Selecione o paciente...</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.fullName}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-muted-foreground">Título do Orçamento</label>
                      <input 
                        type="text" 
                        value={budgetTitulo} 
                        onChange={(e) => setBudgetTitulo(e.target.value)} 
                        className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background outline-none border-border focus:border-gold" 
                        placeholder="Ex: Plano de Implantes" 
                        required
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-muted-foreground">Status Inicial</label>
                      <select 
                        value={budgetStatus} 
                        onChange={(e) => setBudgetStatus(e.target.value)} 
                        className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background outline-none border-border"
                      >
                        <option value="pendente">Pendente</option>
                        <option value="aprovado">Aprovado</option>
                        <option value="recusado">Recusado</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-muted-foreground">Observações do Orçamento</label>
                    <textarea 
                      value={budgetObservacoes} 
                      onChange={(e) => setBudgetObservacoes(e.target.value)} 
                      className="w-full mt-1.5 px-3 py-1.5 border rounded-lg bg-background outline-none border-border focus:border-gold resize-none" 
                      rows={2} 
                      placeholder="Observações internas..." 
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">Procedimentos do Orçamento</label>
                    <button 
                      type="button" 
                      onClick={handleAddProcedure} 
                      className="px-2 py-1 bg-gold/10 hover:bg-gold/20 text-gold text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar procedimento
                    </button>
                  </div>

                  <div className="space-y-2">
                    {budgetProcedimentos.length === 0 ? (
                      <div className="text-center p-4 border border-dashed rounded-lg bg-background text-xs text-muted-foreground italic">
                        Nenhum procedimento adicionado. Adicione um para criar o orçamento.
                      </div>
                    ) : (
                      budgetProcedimentos.map((p, idx) => (
                        <div key={idx} className="flex gap-2 items-center bg-background p-2 rounded-lg border border-border shadow-sm text-xs">
                          <input 
                            type="text" 
                            value={p.description} 
                            onChange={(e) => handleUpdateProcedureField(idx, 'description', e.target.value)} 
                            className="flex-1 text-xs px-2.5 py-1.5 border rounded border-border outline-none focus:border-gold bg-background text-foreground" 
                            placeholder="Nome do Procedimento" 
                            required
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground text-[10px]">R$</span>
                            <input 
                              type="number" 
                              value={p.price} 
                              step="0.01" 
                              onChange={(e) => handleUpdateProcedureField(idx, 'price', Number(e.target.value))} 
                              className="w-20 text-xs px-2.5 py-1.5 border rounded border-border outline-none focus:border-gold text-right bg-background text-foreground" 
                              placeholder="Valor" 
                              required
                            />
                          </div>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveProcedure(idx)} 
                            className="text-rose-500 hover:bg-rose-50 p-1.5 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4"/>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  
                  {budgetProcedimentos.length > 0 && (
                    <div className="flex justify-between items-center bg-secondary/35 p-3 rounded-lg border border-border text-xs font-bold">
                      <span className="text-muted-foreground">Valor Total do Orçamento:</span>
                      <span className="text-foreground text-sm">
                        R$ {budgetProcedimentos.reduce((sum, p) => sum + (Number(p.price) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* FORMULÁRIO DE CAIXA DE ENTRADA (MANTER) */}
            {destination === 'caixa_entrada' && (
              <div className="space-y-3 bg-muted/15 p-4 rounded-xl border border-border animate-in fade-in duration-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Manter na Caixa de Entrada</h4>
                <p className="text-[11px] text-muted-foreground">O arquivo permanecerá como "Para Revisar" sem ser enviado para nenhum módulo específico.</p>
                
                <div className="text-xs space-y-3 mt-2">
                  <div>
                    <label className="font-semibold text-muted-foreground">Categoria do Arquivo</label>
                    <input 
                      type="text" 
                      value={caixaCategoria} 
                      onChange={(e) => setCaixaCategoria(e.target.value)} 
                      className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background outline-none border-border focus:border-gold" 
                      placeholder="Ex: Nota Fiscal, Boleto" 
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-muted-foreground">Título do Arquivo</label>
                    <input 
                      type="text" 
                      value={caixaTitulo} 
                      onChange={(e) => setCaixaTitulo(e.target.value)} 
                      className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background outline-none border-border focus:border-gold" 
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-muted-foreground">Observação</label>
                    <textarea 
                      value={caixaObservacao} 
                      onChange={(e) => setCaixaObservacao(e.target.value)} 
                      className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background outline-none border-border focus:border-gold resize-none" 
                      rows={3} 
                      placeholder="Observações internas sobre o arquivo..." 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Geral / Notas de Integração */}
            <div className="space-y-1.5 pt-2 border-t border-border/60">
              <label className="text-xs font-semibold text-muted-foreground">Anotações do Arquivo (Ficará vinculado ao registro original)</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold focus:ring-1 focus:ring-gold resize-none"
                placeholder="Observações adicionais..."
                rows={2}
              />
            </div>

            {/* Botão de Submissão final */}
            <div className="pt-4 mt-auto">
              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-gold-gradient px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 shadow-md shadow-amber-200/20"
              >
                {isSubmitting ? "Enviando informações..." : (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> 
                    {destination === 'estoque' ? 'Enviar para Estoque' : 
                     destination === 'financeiro' ? 'Enviar para Financeiro' : 
                     destination === 'ficha_paciente' ? 'Vincular à Ficha Clínica' : 
                     destination === 'documento_paciente' ? 'Enviar para Documentos' : 
                     destination === 'orcamento' ? 'Criar Orçamento' : 
                     'Manter na Caixa de Entrada'}
                  </>
                )}
              </button>
            </div>
            
          </form>
        </div>

      </div>
    </div>
  );
}
