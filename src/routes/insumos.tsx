import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import {
  PageHeader, Card, Button, Input, Select, Label, Badge, EmptyState,
} from "@/components/ui-bits";
import {
  SUPPLY_CATEGORIES, uid, type Supply,
} from "@/lib/store";
import { useSupplies, useCustomSupplyCategories } from "@/lib/db";
import { BRL, unitCost } from "@/lib/calc";
import { seedSupplies } from "@/lib/seed";
import { Plus, Trash2, Pencil, Search, Download, X, Sparkles, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/insumos")({
  head: () => ({ meta: [{ title: "Insumos — Oralit" }] }),
  component: InsumosPage,
});

const emptySupply = (): Omit<Supply, "id"> => ({
  name: "", category: "Descartáveis", brand: "", packCost: 0, packYield: 1,
  unit: "", stock: 0, minStock: 0, note: "",
});

function InsumosPage() {
  const [supplies, setSupplies] = useSupplies();
  const [customCats, setCustomCats] = useCustomSupplyCategories();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("todas");
  const [editing, setEditing] = useState<Supply | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Omit<Supply, "id">>(emptySupply());

  const allCats = useMemo(() => [...SUPPLY_CATEGORIES, ...customCats.filter(c => !SUPPLY_CATEGORIES.includes(c))], [customCats]);
  const filtered = supplies.filter(s =>
    (cat === "todas" || s.category === cat) &&
    (!query || s.name.toLowerCase().includes(query.toLowerCase()))
  );

  function openCreate() { setDraft(emptySupply()); setEditing(null); setCreating(true); }
  function openEdit(s: Supply) { setDraft({ ...s }); setEditing(s); setCreating(true); }
  function close() { setCreating(false); setEditing(null); }

  function save() {
    if (!draft.name.trim()) return toast.error("Informe o nome do insumo.");
    if (!draft.packYield || draft.packYield <= 0) return toast.error("O rendimento precisa ser maior que zero.");
    if (draft.packCost < 0) return toast.error("Custo não pode ser negativo.");
    if (editing) {
      setSupplies(supplies.map(s => s.id === editing.id ? { ...editing, ...draft } : s));
      toast.success("Insumo atualizado.");
    } else {
      setSupplies([...supplies, { id: uid(), ...draft }]);
      toast.success("Insumo cadastrado.");
    }
    close();
  }
  function remove(id: string) {
    if (!confirm("Excluir este insumo?")) return;
    setSupplies(supplies.filter(s => s.id !== id));
    toast.success("Insumo removido.");
  }
  function addCustomCat() {
    const name = prompt("Nome da nova categoria:");
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!customCats.includes(trimmed)) setCustomCats([...customCats, trimmed]);
    setDraft({ ...draft, category: trimmed });
  }
  function exportCsv() {
    const header = "Nome,Categoria,Marca,Custo embalagem,Rendimento,Custo unitário,Estoque\n";
    const body = supplies.map(s =>
      [s.name, s.category, s.brand || "", s.packCost, s.packYield, unitCost(s).toFixed(4), s.stock ?? ""]
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "oralit-insumos.csv"; a.click();
    URL.revokeObjectURL(url);
  }
  function loadExamples() {
    if (supplies.length && !confirm("Adicionar exemplos aos insumos atuais?")) return;
    setSupplies([...supplies, ...seedSupplies()]);
    toast.success("Exemplos profissionais carregados.");
  }

  return (
    <AppLayout>
      <PageHeader
        title="Insumos"
        subtitle="Cadastre materiais uma vez e reutilize nos procedimentos."
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!supplies.length}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="gold" size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Novo insumo
            </Button>
          </div>
        }
      />

      {!supplies.length && (
        <EmptyState
          title="Nenhum insumo ainda"
          description="Comece cadastrando os materiais que você usa nos procedimentos. Você também pode carregar uma base profissional de exemplo."
          action={
            <div className="flex gap-2 justify-center">
              <Button variant="gold" onClick={openCreate}><Plus className="h-4 w-4" /> Cadastrar</Button>
              <Button variant="outline" onClick={loadExamples}><Sparkles className="h-4 w-4" /> Carregar exemplo</Button>
            </div>
          }
        />
      )}

      {supplies.length > 0 && (
        <Card>
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar insumo…" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <Select value={cat} onChange={e => setCat(e.target.value)} className="sm:w-56">
              <option value="todas">Todas as categorias</option>
              {allCats.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>

          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 px-5 font-medium">Insumo</th>
                  <th className="py-2 px-2 font-medium">Categoria</th>
                  <th className="py-2 px-2 font-medium text-right">Embalagem</th>
                  <th className="py-2 px-2 font-medium text-right">Rendim.</th>
                  <th className="py-2 px-2 font-medium text-right">Custo/uso</th>
                  <th className="py-2 px-2 font-medium text-right">Estoque</th>
                  <th className="py-2 px-5 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const low = s.minStock != null && s.stock != null && s.stock <= s.minStock;
                  return (
                    <tr key={s.id} className="border-b border-border/60 hover:bg-secondary/40">
                      <td className="py-2.5 px-5">
                        <div className="font-semibold">{s.name}</div>
                        {s.brand && <div className="text-xs text-muted-foreground">{s.brand}</div>}
                      </td>
                      <td className="py-2 px-2"><Badge>{s.category}</Badge></td>
                      <td className="py-2 px-2 text-right">{BRL(s.packCost)}</td>
                      <td className="py-2 px-2 text-right">{s.packYield} {s.unit}</td>
                      <td className="py-2 px-2 text-right font-semibold text-gold-gradient">{BRL(unitCost(s))}</td>
                      <td className="py-2 px-2 text-right">
                        {s.stock != null ? (
                          <span className={low ? "text-rose-600 font-semibold inline-flex items-center gap-1" : ""}>
                            {low && <AlertCircle className="h-3 w-3" />}{s.stock}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-2 px-5 text-right">
                        <button className="p-1.5 hover:text-gold" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></button>
                        <button className="p-1.5 hover:text-rose-500" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr><td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Nenhum insumo encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={close}>
          <div className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card">
              <h3 className="font-display font-bold text-lg">{editing ? "Editar insumo" : "Novo insumo"}</h3>
              <button onClick={close} className="p-1 rounded-lg hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <Label>Nome do insumo</Label>
                <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Ex.: Resina composta" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoria</Label>
                  <Select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>
                    {allCats.map(c => <option key={c}>{c}</option>)}
                  </Select>
                  <button className="text-[11px] mt-1.5 text-gold-deep font-semibold hover:underline" onClick={addCustomCat} type="button">
                    + nova categoria
                  </button>
                </div>
                <div>
                  <Label>Marca/fornecedor</Label>
                  <Input value={draft.brand || ""} onChange={e => setDraft({ ...draft, brand: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label hint="R$">Custo da embalagem</Label>
                  <Input type="number" step="0.01" value={draft.packCost} onChange={e => setDraft({ ...draft, packCost: +e.target.value })} />
                </div>
                <div>
                  <Label>Rendimento</Label>
                  <Input type="number" value={draft.packYield} onChange={e => setDraft({ ...draft, packYield: +e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Unidade</Label>
                  <Input value={draft.unit || ""} onChange={e => setDraft({ ...draft, unit: e.target.value })} placeholder="un" />
                </div>
                <div>
                  <Label>Estoque</Label>
                  <Input type="number" value={draft.stock ?? 0} onChange={e => setDraft({ ...draft, stock: +e.target.value })} />
                </div>
                <div>
                  <Label>Mínimo</Label>
                  <Input type="number" value={draft.minStock ?? 0} onChange={e => setDraft({ ...draft, minStock: +e.target.value })} />
                </div>
              </div>
              <div className="rounded-lg bg-secondary p-3 text-xs flex justify-between">
                <span className="text-muted-foreground">Custo unitário calculado</span>
                <span className="font-bold text-gold-gradient">
                  {BRL(draft.packYield > 0 ? draft.packCost / draft.packYield : 0)}
                </span>
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-border sticky bottom-0 bg-card">
              <Button variant="ghost" onClick={close} className="flex-1">Cancelar</Button>
              <Button variant="gold" onClick={save} className="flex-1">{editing ? "Salvar" : "Cadastrar"}</Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
