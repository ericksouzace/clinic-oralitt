import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { PageHeader, Card, Button, Input, Select, Label, Badge, EmptyState } from "@/components/ui-bits";
import {
  PROCEDURE_CATEGORIES, uid, type Procedure,
} from "@/lib/store";
import { useProcedures, useCustomProcedureCategories, useProcedureSupplies, useSupplies } from "@/lib/db";
import { BRL, unitCost } from "@/lib/calc";
import { seedProcedures } from "@/lib/seed";
import { Plus, Trash2, Pencil, Copy, Search, X, Sparkles, Calculator, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/procedimentos")({
  head: () => ({ meta: [{ title: "Procedimentos — Oralit" }] }),
  component: ProceduresPage,
});

const empty = (): Omit<Procedure, "id"> => ({
  name: "", category: "Consulta", defaultMinutes: 30, labCost: 0, otherDirect: 0, note: "",
});

function ProcedureSuppliesManager({ proc, onBack, onClose }: { proc: Procedure, onBack: () => void, onClose: () => void }) {
  const [procSupplies, setProcSupplies] = useProcedureSupplies(proc.id);
  const [supplies] = useSupplies();

  const suppliesIndex = useMemo(() => Object.fromEntries(supplies.map(s => [s.id, s])), [supplies]);

  function addSupply() {
    const available = supplies.find(s => !procSupplies.some(ps => ps.supplyId === s.id));
    if (!available) return toast.error("Todos os insumos já foram adicionados.");
    setProcSupplies([...procSupplies, { id: uid(), procedureId: proc.id, supplyId: available.id, qty: 1 }]);
  }

  function updateSupply(i: number, patch: any) {
    setProcSupplies(procSupplies.map((ps, idx) => idx === i ? { ...ps, ...patch } : ps));
  }

  function removeSupply(i: number) {
    setProcSupplies(procSupplies.filter((_, idx) => idx !== i));
  }

  return (
    <>
      <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1 hover:bg-secondary rounded-md text-muted-foreground"><ChevronLeft className="h-5 w-5" /></button>
          <h3 className="font-display font-bold text-lg">Insumos Padrão: {proc.name}</h3>
        </div>
        <button onClick={onClose}><X className="h-4 w-4" /></button>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">Estes insumos serão pré-carregados ao precificar este procedimento.</p>
          <Button variant="outline" size="sm" onClick={addSupply} disabled={!supplies.length}>
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>

        {!supplies.length && (
          <div className="p-4 bg-amber-50 text-amber-800 rounded-lg text-sm">
            Nenhum insumo cadastrado na clínica ainda.
          </div>
        )}

        <div className="space-y-2 mt-4">
          {procSupplies.map((ps, i) => {
            const s = suppliesIndex[ps.supplyId];
            return (
              <div key={i} className="grid grid-cols-[1fr_80px_auto] gap-2 items-center">
                <Select value={ps.supplyId} onChange={e => updateSupply(i, { supplyId: e.target.value })}>
                  {supplies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
                <Input type="number" step="0.01" value={ps.qty} onChange={e => updateSupply(i, { qty: +e.target.value })} />
                <button className="p-2 text-muted-foreground hover:text-rose-500" onClick={() => removeSupply(i)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
          {procSupplies.length === 0 && supplies.length > 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum insumo padrão configurado.</p>
          )}
        </div>
      </div>
      <div className="flex gap-2 p-5 border-t border-border sticky bottom-0 bg-card">
        <Button variant="gold" onClick={onClose} className="w-full">Concluir</Button>
      </div>
    </>
  );
}

function ProceduresPage() {
  const [items, setItems] = useProcedures();
  const [customCats, setCustomCats] = useCustomProcedureCategories();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("todas");
  const [editing, setEditing] = useState<Procedure | null>(null);
  const [managingSuppliesFor, setManagingSuppliesFor] = useState<Procedure | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Omit<Procedure, "id">>(empty());
  const navigate = useNavigate({ from: "/procedimentos" });

  const allCats = useMemo(() => [...PROCEDURE_CATEGORIES, ...customCats.filter(c => !PROCEDURE_CATEGORIES.includes(c))], [customCats]);
  const filtered = items.filter(p =>
    (cat === "todas" || p.category === cat) &&
    (!q || p.name.toLowerCase().includes(q.toLowerCase()))
  );

  function openCreate() { setDraft(empty()); setEditing(null); setManagingSuppliesFor(null); setOpen(true); }
  function openEdit(p: Procedure) { setDraft({ ...p }); setEditing(p); setManagingSuppliesFor(null); setOpen(true); }
  function close() { setOpen(false); setEditing(null); setManagingSuppliesFor(null); }

  async function save(action: "save" | "precificar" | "insumos") {
    if (!draft.name.trim()) return toast.error("Informe o nome do procedimento.");
    if (!draft.defaultMinutes || draft.defaultMinutes <= 0) return toast.error("Tempo deve ser maior que zero.");
    
    let savedProc: Procedure;

    if (editing) {
      savedProc = { ...editing, ...draft };
      await setItems(items.map(p => p.id === editing.id ? savedProc : p));
      toast.success("Procedimento salvo com sucesso.");
    } else {
      savedProc = { id: uid(), ...draft };
      await setItems([...items, savedProc]);
      toast.success("Procedimento salvo com sucesso.");
    }

    if (action === "save") {
      close();
    } else if (action === "precificar") {
      close();
      navigate({ to: "/precificar", search: { p: savedProc.id } as any });
    } else if (action === "insumos") {
      setManagingSuppliesFor(savedProc);
    }
  }

  function duplicate(p: Procedure) {
    setItems([...items, { ...p, id: uid(), name: p.name + " (cópia)" }]);
    toast.success("Procedimento duplicado.");
  }

  function remove(id: string) {
    try {
      setItems(items.filter(p => p.id !== id));
      toast.success("Procedimento excluído.");
    } catch (err) {
      toast.error("Não foi possível excluir agora.");
    }
  }

  function addCat() {
    const n = prompt("Nome da nova categoria:")?.trim();
    if (!n) return;
    if (!customCats.includes(n)) setCustomCats([...customCats, n]);
    setDraft({ ...draft, category: n });
  }

  return (
    <AppLayout>
      <PageHeader
        title="Procedimentos"
        subtitle="Monte protocolos rápidos para precificar com consistência."
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setItems([...items, ...seedProcedures()]); toast.success("Exemplos carregados."); }}>
              <Sparkles className="h-3.5 w-3.5" /> Exemplo
            </Button>
            <Button variant="gold" size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> Novo</Button>
          </div>
        }
      />

      {!items.length ? (
        <EmptyState
          title="Nenhum procedimento ainda"
          description="Cadastre seus protocolos clínicos para reutilizar na precificação."
          action={<Button variant="gold" onClick={openCreate}><Plus className="h-4 w-4" /> Cadastrar</Button>}
        />
      ) : (
        <Card>
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar procedimento…" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <Select value={cat} onChange={e => setCat(e.target.value)} className="sm:w-56">
              <option value="todas">Todas as categorias</option>
              {allCats.map(c => <option key={c}>{c}</option>)}
            </Select>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {filtered.map(p => (
              <div key={p.id} className="rounded-xl border border-border bg-card p-4 hover:border-gold transition flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge>{p.category}</Badge>
                      <Badge tone="gold">{p.defaultMinutes} min</Badge>
                    </div>
                  </div>
                  <div className="flex">
                    <button className="p-1.5 text-muted-foreground hover:text-gold" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></button>
                    <button className="p-1.5 text-muted-foreground hover:text-foreground" onClick={() => duplicate(p)}><Copy className="h-4 w-4" /></button>
                    <button className="p-1.5 text-muted-foreground hover:text-rose-500" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                {!!p.otherDirect ? (
                  <div className="mt-3 text-xs text-muted-foreground flex gap-3">
                    <span>Valor: <b className="text-foreground">{BRL(p.otherDirect)}</b></span>
                  </div>
                ) : null}
                <div className="mt-auto pt-4 flex">
                  <Link to="/precificar" search={{ p: p.id } as never} className="w-full">
                    <Button variant="outline" size="sm" className="w-full border-gold text-gold-deep hover:bg-gold/5">
                      <Calculator className="h-3.5 w-3.5" /> Precificar este procedimento
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
            {!filtered.length && (
              <div className="sm:col-span-2 py-10 text-center text-sm text-muted-foreground">Nenhum procedimento encontrado.</div>
            )}
          </div>
        </Card>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={close}>
          <div className="bg-card w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl border border-border max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            
            {managingSuppliesFor ? (
              <ProcedureSuppliesManager 
                proc={managingSuppliesFor} 
                onBack={() => setManagingSuppliesFor(null)} 
                onClose={close} 
              />
            ) : (
              <>
                <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
                  <h3 className="font-display font-bold text-lg">{editing ? "Editar procedimento" : "Novo procedimento"}</h3>
                  <button onClick={close}><X className="h-4 w-4" /></button>
                </div>
                <div className="p-5 space-y-3">
                  <div>
                    <Label>Nome</Label>
                    <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Ex.: Restauração em resina" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Categoria</Label>
                      <Select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>
                        {allCats.map(c => <option key={c}>{c}</option>)}
                      </Select>
                      <button type="button" className="text-[11px] mt-1.5 text-gold-deep font-semibold hover:underline" onClick={addCat}>
                        + nova categoria
                      </button>
                    </div>
                    <div>
                      <Label>Tempo médio (min)</Label>
                      <Input type="number" value={draft.defaultMinutes} onChange={e => setDraft({ ...draft, defaultMinutes: +e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <Label hint="R$">Valor do procedimento</Label>
                      <Input type="number" step="0.01" value={draft.otherDirect || 0} onChange={e => setDraft({ ...draft, otherDirect: +e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Input value={draft.note || ""} onChange={e => setDraft({ ...draft, note: e.target.value })} />
                  </div>
                </div>
                <div className="p-5 border-t border-border bg-secondary/30 sticky bottom-0">
                  <div className="flex flex-col gap-2">
                    <Button variant="gold" onClick={() => save("precificar")} className="w-full">
                      Salvar e precificar
                    </Button>
                    <Button variant="outline" className="border-gold text-gold-deep hover:bg-gold/5" onClick={() => save("insumos")}>
                      Salvar e adicionar insumos padrão
                    </Button>
                    <Button variant="outline" onClick={() => save("save")}>
                      Salvar procedimento
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="ghost" disabled className="flex-1 opacity-50 relative">
                        Salvar e criar orçamento
                        <span className="absolute -top-2 -right-2 bg-muted text-[10px] px-1.5 py-0.5 rounded-full border border-border">Em breve</span>
                      </Button>
                      <Button variant="ghost" disabled className="flex-1 opacity-50 relative">
                        Salvar e vincular paciente
                        <span className="absolute -top-2 -right-2 bg-muted text-[10px] px-1.5 py-0.5 rounded-full border border-border">Em breve</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </AppLayout>
  );
}
