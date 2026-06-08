import Tesseract from 'tesseract.js';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Configurar o worker do PDF.js localmente
GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
console.log("[OCR] PDF.js worker local configurado para:", GlobalWorkerOptions.workerSrc);

async function fetchFileBlob(url: string): Promise<Blob> {
  console.log(`[OCR] filePath: ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Erro ao baixar arquivo do Storage (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  if (blob.size === 0) throw new Error("Arquivo baixado está vazio (0 bytes).");
  console.log(`[OCR] blob size: ${blob.size} bytes`);
  console.log(`[OCR] blob type: ${blob.type}`);
  return blob;
}

export async function extractTextFromImage(fileUrl: string): Promise<string> {
  try {
    const blob = await fetchFileBlob(fileUrl);
    const objectUrl = URL.createObjectURL(blob);
    
    let result;
    try {
      result = await Tesseract.recognize(objectUrl, 'por', {
        logger: (m) => { if (m.status === 'recognizing text' && m.progress % 0.2 === 0) console.log("Tesseract Progress:", m.progress) }
      });
    } catch (err) {
      console.warn("[OCR] Falha com idioma 'por', tentando 'eng'...", err);
      result = await Tesseract.recognize(objectUrl, 'eng');
    }
    
    URL.revokeObjectURL(objectUrl);
    return result.data.text;
  } catch (error) {
    console.error("Erro no OCR da Imagem:", error);
    throw error;
  }
}

export async function extractTextFromPdf(fileUrl: string): Promise<string> {
  try {
    const blob = await fetchFileBlob(fileUrl);
    const arrayBuffer = await blob.arrayBuffer();
    const loadingTask = getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let text = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(' ');
      text += pageText + '\n';
    }
    
    console.log(`[OCR] PDF.js extraiu ${text.trim().length} caracteres.`);

    // Fallback para PDFs escaneados ou contendo apenas imagem
    if (!text || text.trim().length < 30) {
      console.log(`[OCR] Texto insuficiente. Iniciando fallback Tesseract para ${pdf.numPages} página(s).`);
      text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // Alta qualidade para OCR
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
          canvasContext: ctx,
          viewport: viewport
        };
        
        await page.render(renderContext).promise;
        console.log(`[OCR] Página ${i} renderizada para imagem.`);
        
        const dataUrl = canvas.toDataURL('image/png');
        
        const result = await Tesseract.recognize(dataUrl, 'por', {
          logger: (m) => {
            if (m.status === 'recognizing text' && m.progress % 0.2 === 0) {
              console.log(`Tesseract Progress (Pag ${i}):`, m.progress);
            }
          }
        });
        
        text += result.data.text + '\n';
        console.log(`[OCR] Tesseract extraiu ${result.data.text.length} caracteres da página ${i}.`);
      }
      console.log(`[OCR] Fallback concluído. Tamanho final: ${text.trim().length} caracteres.`);
    }
    
    return text;
  } catch (error) {
    console.error("Erro no OCR do PDF:", error);
    throw error;
  }
}

export function suggestFileDestinationFromText(text: string): string {
  if (!text) return 'caixa_entrada';
  const lowerText = text.toLowerCase();
  
  // Regra de prioridade: Se tem produtos/insumos odontológicos -> Estoque
  const productKeywords = ['resina', 'ácido', 'acido', 'adesivo', 'anestésico', 'anestesico', 'luva', 'sugador', 'microbrush'];
  const hasProduct = productKeywords.some(k => lowerText.includes(k));
  const hasNf = lowerText.includes('nota fiscal') || lowerText.includes('nf-e') || lowerText.includes('cnpj');
  
  if (hasProduct || (hasNf && lowerText.includes('quantidade'))) return 'estoque';

  const financeiroKeywords = ['comprovante', 'pix', 'transferência', 'transferencia', 'pagamento', 'valor pago', 'recibo'];
  if (financeiroKeywords.some(k => lowerText.includes(k))) return 'financeiro';

  const fichaKeywords = ['exame', 'laudo', 'radiografia', 'tomografia', 'diagnóstico', 'diagnostico', 'paciente', 'dente'];
  if (fichaKeywords.some(k => lowerText.includes(k))) return 'ficha_paciente';

  const documentoKeywords = ['contrato', 'termo', 'autorização', 'autorizacao', 'receita', 'atestado', 'orçamento', 'orcamento'];
  if (documentoKeywords.some(k => lowerText.includes(k))) return 'documento_paciente';

  return 'caixa_entrada';
}

export function extractStructuredData(text: string, destination: string): any {
  if (!text) return {};
  
  if (destination === 'estoque') return extractInventoryItems(text);
  if (destination === 'financeiro') return extractFinancialData(text);
  if (destination === 'ficha_paciente') return extractClinicalSummary(text);
  if (destination === 'documento_paciente') return extractDocumentMetadata(text);
  if (destination === 'orcamento') return extractBudgetData(text);

  return {};
}

// === Funções Auxiliares ===

function extractMoney(str: string): number | null {
  const match = str.match(/(?:R\$|R\$ )?\s?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g);
  if (!match) return null;
  const values = match.map(v => parseFloat(v.replace(/[^\d,]/g, '').replace(',', '.')));
  return Math.max(...values);
}

function extractMoneyFromLine(line: string): number[] {
  const match = line.match(/(?:R\$)?\s?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g);
  if (!match) return [];
  return match.map(v => parseFloat(v.replace(/\./g, '').replace(',', '.')));
}

function extractDate(str: string): string | null {
  const match = str.match(/(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`; // YYYY-MM-DD
}

function parseQuantity(value: string): number {
  const match = value.match(/\b(\d+)\b/);
  if (match) {
    const q = parseInt(match[1], 10);
    return q > 0 ? q : 1;
  }
  return 1;
}

function isBlacklistedItem(name: string): boolean {
  const blacklist = [
    'nota fiscal', 'fictícia', 'ficticia', 'teste', 'documento', 'emitente',
    'fornecedor', 'destinatário', 'destinatario', 'cnpj', 'cpf', 'telefone',
    'endereço', 'endereco', 'rua', 'cidade', 'data', 'número', 'numero',
    'série', 'serie', 'chave de acesso', 'subtotal', 'desconto', 'frete',
    'valor total', 'total da nota', 'forma de pagamento', 'pagamento', 'pix',
    'observação', 'observacao', 'informações', 'informacoes', 'código',
    'codigo', 'descrição', 'descricao', 'unidade', 'quantidade', 'valor unitário', 'valor unitario'
  ];
  
  const lowerName = name.toLowerCase();
  
  // Se for igual a um dos termos
  if (blacklist.includes(lowerName)) return true;
  
  // Se for muito composto por eles (ex: "Valor Total", "NOTA FISCAL", etc)
  for (const bad of blacklist) {
    if (lowerName === bad) return true;
    if (lowerName.startsWith(bad) && bad.length > 5) return true;
  }
  
  return false;
}

function cleanProductName(name: string): string {
  let cleaned = name.replace(/^[\d\-\.\s]+/, ''); // Tira código no começo
  cleaned = cleaned.replace(/(?:R\$)?\s?\d{1,3}(?:\.\d{3})*,\d{2}/g, ''); // Tira valores
  cleaned = cleaned.replace(/\b\d+\s*(un|cx|pct|kg|g|ml)\b/gi, ''); // Tira qtd un
  cleaned = cleaned.replace(/\bqtd\s*\d+\b/gi, ''); // Tira 'qtd X'
  cleaned = cleaned.replace(/^[^\wÀ-ÖØ-öø-ÿ]+/g, ''); // Lixo no começo
  cleaned = cleaned.replace(/[^\wÀ-ÖØ-öø-ÿ]+$/g, ''); // Lixo no fim
  cleaned = cleaned.trim();
  
  if (cleaned.length > 80) cleaned = cleaned.substring(0, 80) + '...';
  return cleaned;
}

// === Estoque ===

const dentalDictionary = [
  'resina', 'resina composta', 'z350', 'filtek', 'ácido fosfórico', 'acido fosforico', 'gel 37',
  'adesivo', 'sistema adesivo', 'bond', 'microbrush', 'aplicador', 'luva', 'luva nitrílica', 'luva latex',
  'sugador', 'sugador descartável', 'anestésico', 'anestesico', 'lidocaína', 'lidocaina', 'epinefrina',
  'algodão', 'algodao', 'gaze', 'máscara', 'mascara', 'seringa', 'agulha', 'fio de sutura', 'broca',
  'cimento', 'ionômero', 'ionomero', 'matriz', 'cunha', 'revelador', 'fixador', 'selante', 'flúor',
  'fluor', 'pasta profilática', 'barreira gengival', 'moldeira', 'silicona', 'alginato', 'gesso',
  'eugenol', 'hipoclorito', 'clorexidina'
];

function scoreInventoryCandidate(candidate: { name: string, qty: number, unit: string, price: number, code: boolean }): number {
  let score = 0;
  const lowerName = candidate.name.toLowerCase();

  // Positivos
  if (dentalDictionary.some(term => lowerName.includes(term))) score += 3;
  if (candidate.qty > 0) score += 1;
  if (candidate.unit && candidate.unit.length > 0) score += 1;
  if (candidate.price > 0) score += 1;
  if (candidate.code) score += 1;

  // Negativos
  if (isBlacklistedItem(candidate.name)) score -= 5;
  if (candidate.name.length < 3) score -= 3;
  
  const headers = ['documento', 'nota fiscal', 'cnpj', 'total', 'emitente'];
  if (headers.some(h => lowerName.includes(h))) score -= 5;

  return score;
}

function extractInventoryItems(text: string) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const items = [];
  
  const cnpjMatch = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}\-\d{2}/);
  const date = extractDate(text);
  const totalAmount = extractMoney(text);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();
    
    // Tenta achar código numérico no início (001, 1., etc)
    const hasCode = /^\d+/.test(line);
    
    const candidateName = cleanProductName(line);
    if (!candidateName) continue;
    if (isBlacklistedItem(candidateName)) continue;

    // Procura na linha atual: Qtd, Unidade, Valores
    let qty = 1;
    let unit = 'un';
    let unitPrice = 0;
    let totalPrice = 0;

    const unitMatch = line.match(/\b(un|cx|pct|kg|g|ml)\b/i);
    if (unitMatch) unit = unitMatch[1].toLowerCase();

    const qtyMatch = line.match(/\b(\d+)\s*(un|cx|pct|kg|g|ml)\b/i) || line.match(/\b(?:qtd|quantidade)\s*:?\s*(\d+)\b/i);
    if (qtyMatch && parseInt(qtyMatch[1], 10) > 0) {
      qty = parseInt(qtyMatch[1], 10);
    } else {
      // Tenta achar número solto que não seja dinheiro
      const cleanLineForQty = line.replace(/(?:R\$)?\s?\d{1,3}(?:\.\d{3})*,\d{2}/g, '');
      const looseQty = cleanLineForQty.match(/\b(\d+)\b/);
      if (looseQty && parseInt(looseQty[1], 10) > 0 && parseInt(looseQty[1], 10) < 1000) {
        qty = parseInt(looseQty[1], 10);
      }
    }

    const prices = extractMoneyFromLine(line);
    if (prices.length >= 2) {
      unitPrice = prices[0];
      totalPrice = prices[prices.length - 1];
    } else if (prices.length === 1) {
      totalPrice = prices[0];
      unitPrice = totalPrice / qty;
    }

    // Camada 3: Lookahead (Linhas quebradas)
    if (prices.length === 0 && (hasCode || dentalDictionary.some(t => lowerLine.includes(t)))) {
      // Olha até as próximas 3 linhas
      for (let j = 1; j <= 3 && i + j < lines.length; j++) {
        const lookLine = lines[i + j];
        const lookPrices = extractMoneyFromLine(lookLine);
        
        if (lookPrices.length > 0) {
          if (lookPrices.length >= 2) {
             unitPrice = lookPrices[0];
             totalPrice = lookPrices[lookPrices.length - 1];
          } else {
             totalPrice = lookPrices[0];
             unitPrice = totalPrice / qty;
          }
          break; // Achou valores, para de olhar
        }
      }
    }

    const candidate = {
      name: candidateName.charAt(0).toUpperCase() + candidateName.slice(1),
      qty,
      unit,
      price: unitPrice || totalPrice, // Para o score
      code: hasCode
    };

    const score = scoreInventoryCandidate(candidate);

    if (score >= 1) {
      items.push({
        id: `tmp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: candidate.name,
        quantity: qty,
        unit: unit,
        unitPrice: unitPrice,
        totalPrice: totalPrice,
        score: score,
        confidence: score >= 3 ? 'Alta' : 'Baixa',
        action: 'create',
        use: score >= 3
      });
    }
  }

  // Deduplicação básica (nomes muito parecidos se seguidos) e filtro
  const uniqueItems = [];
  const seen = new Set();
  for (const item of items) {
    if (!seen.has(item.name.toLowerCase())) {
      seen.add(item.name.toLowerCase());
      uniqueItems.push(item);
    }
  }

  return {
    cnpj: cnpjMatch ? cnpjMatch[0] : '',
    date: date || new Date().toISOString().split('T')[0],
    totalAmount: totalAmount || 0,
    items: uniqueItems
  };
}

// === Financeiro ===

function extractFinancialData(text: string) {
  const lowerText = text.toLowerCase();
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let amount = 0;
  
  // Tentar encontrar "valor pago" prioritariamente
  for (const line of lines) {
    if (line.toLowerCase().includes('valor pago') || line.toLowerCase().includes('total pago')) {
       const vals = extractMoneyFromLine(line);
       if (vals.length > 0) { amount = Math.max(...vals); break; }
    }
  }

  if (amount === 0) {
    amount = extractMoney(text) || 0;
  }

  const date = extractDate(text);
  
  let paymentMethod = 'Outro';
  if (lowerText.includes('pix')) paymentMethod = 'Pix';
  else if (lowerText.includes('cartão') || lowerText.includes('cartao')) paymentMethod = 'Cartão de Crédito';
  else if (lowerText.includes('boleto')) paymentMethod = 'Boleto';
  else if (lowerText.includes('transferência') || lowerText.includes('ted') || lowerText.includes('doc')) paymentMethod = 'Transferência';

  let type = 'despesa';
  if (lowerText.includes('comprovante') && !lowerText.includes('pagamento')) type = 'receita';
  else if (lowerText.includes('recebimento')) type = 'receita';

  return {
    amount: amount === 0 ? null : amount,
    date: date || new Date().toISOString().split('T')[0],
    paymentMethod,
    type,
    description: 'Lançamento financeiro detectado via OCR'
  };
}

// === Ficha Clínica / Exames ===

function extractClinicalSummary(text: string) {
  const date = extractDate(text);
  const lowerText = text.toLowerCase();
  
  const clinicalTerms = ['laudo', 'radiografia', 'tomografia', 'panorâmica', 'periapical', 'diagnóstico', 'dente', 'região', 'cárie', 'fratura', 'lesão', 'endodontia', 'canal', 'periodontia', 'osso']
    .filter(term => lowerText.includes(term));
    
  return {
    date: date || new Date().toISOString().split('T')[0],
    clinicalTerms,
    summary: `Detectado: ${clinicalTerms.join(', ')}.\nTexto sugerido para ficha:\n${text.substring(0, 300)}...`
  };
}

// === Documentos ===

function extractDocumentMetadata(text: string) {
  const date = extractDate(text);
  const lowerText = text.toLowerCase();
  
  let docType = 'Documento';
  if (lowerText.includes('termo')) docType = 'Termo de Consentimento';
  else if (lowerText.includes('contrato')) docType = 'Contrato';
  else if (lowerText.includes('receita') || lowerText.includes('prescrição')) docType = 'Receituário';
  else if (lowerText.includes('atestado')) docType = 'Atestado';
  else if (lowerText.includes('autorização')) docType = 'Autorização';

  return {
    date: date || new Date().toISOString().split('T')[0],
    docType,
    summary: `Documento do tipo: ${docType}.`
  };
}

// === Orçamentos ===

function extractBudgetData(text: string) {
  const date = extractDate(text);
  const totalAmount = extractMoney(text);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  const procedures = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prices = extractMoneyFromLine(line);
    // Se a linha tem um valor, consideramos procedimento
    if (prices.length > 0) {
      let desc = line.replace(/(?:R\$)?\s?\d{1,3}(?:\.\d{3})*,\d{2}/g, '').trim();
      if (desc.length > 3 && !isBlacklistedItem(desc)) {
         procedures.push({
           description: desc.charAt(0).toUpperCase() + desc.slice(1),
           price: prices[prices.length - 1]
         });
      }
    }
  }

  return {
    date: date || new Date().toISOString().split('T')[0],
    totalAmount: totalAmount || 0,
    procedures: procedures.length > 0 ? procedures : [{ description: 'Procedimento não identificado', price: totalAmount || 0 }]
  };
}
