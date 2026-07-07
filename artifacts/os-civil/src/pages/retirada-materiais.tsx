import { useState, useEffect, useCallback } from "react";
import { PackageOpen, Plus, Trash2, Pencil, Check, X, Image as ImageIcon, RefreshCw } from "lucide-react";
import { useUnit } from "@/contexts/unit-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

type Withdrawal = {
  id: number;
  nome: string;
  date: string;
  tipoMaterial: string;
  quantidade: string;
  justificativa: string;
  foto: string | null;
  tipo: string;
  createdAt: string;
};

type FormState = {
  nome: string;
  date: string;
  tipoMaterial: string;
  quantidade: string;
  justificativa: string;
  foto: string | null;
  tipo: string;
};

const emptyForm = (): FormState => ({
  nome: "",
  date: new Date().toISOString().slice(0, 10),
  tipoMaterial: "",
  quantidade: "",
  justificativa: "",
  foto: null,
  tipo: "retirada",
});

/** Parse foto field — may be a single base64 string OR a JSON array of strings */
function parsePhotos(foto: string | null): string[] {
  if (!foto) return [];
  if (foto.startsWith("[")) {
    try { return JSON.parse(foto) as string[]; } catch { /* fall through */ }
  }
  return [foto];
}

export default function RetiradaMateriais() {
  const { toast } = useToast();
  const { unit } = useUnit();
  const [records, setRecords] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/material-withdrawals?unidade=${unit}`);
      if (res.ok) setRecords(await res.json());
    } catch {
      toast({ title: "Erro ao carregar registros", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [unit]);

  useEffect(() => { setLoading(true); fetchAll(); }, [unit]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
  };

  const handleField = (field: keyof FormState, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const b64 = reader.result as string;
        setPhotoPreviews(p => [...p, b64]);
        setForm(prev => {
          const existing = parsePhotos(prev.foto);
          return { ...prev, foto: JSON.stringify([...existing, b64]) };
        });
      };
    });
    e.target.value = "";
  };

  const removePhoto = (i: number) => {
    setPhotoPreviews(p => p.filter((_, j) => j !== i));
    setForm(prev => {
      const existing = parsePhotos(prev.foto).filter((_, j) => j !== i);
      return { ...prev, foto: existing.length > 0 ? JSON.stringify(existing) : null };
    });
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setPhotoPreviews([]);
    setShowForm(true);
  };

  const openEdit = (r: Withdrawal) => {
    setEditingId(r.id);
    const photos = parsePhotos(r.foto);
    setForm({
      nome: r.nome || "",
      date: r.date,
      tipoMaterial: r.tipoMaterial,
      quantidade: r.quantidade,
      justificativa: r.justificativa,
      foto: r.foto ?? null,
      tipo: r.tipo,
    });
    setPhotoPreviews(photos);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nome || !form.date || !form.tipoMaterial || !form.quantidade || !form.justificativa) {
      toast({ title: "Campos obrigatórios", description: "Preencha Nome, Data, Material, Quantidade e Justificativa.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const url = editingId
        ? `${BASE_URL}/api/material-withdrawals/${editingId}`
        : `${BASE_URL}/api/material-withdrawals`;
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, unidade: unit }),
      });
      if (!res.ok) throw new Error();
      toast({ title: editingId ? "Registro atualizado!" : "Registro criado!" });
      setShowForm(false);
      await fetchAll();
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Deseja excluir este registro?")) return;
    try {
      await fetch(`${BASE_URL}/api/material-withdrawals/${id}`, { method: "DELETE" });
      toast({ title: "Registro excluído" });
      await fetchAll();
    } catch {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  };

  const tipoBadge = (tipo: string) =>
    tipo === "retirada"
      ? "bg-amber-500/15 text-amber-400 border border-amber-600/30"
      : "bg-emerald-500/15 text-emerald-400 border border-emerald-600/30";

  return (
    <div className="p-4 md:p-6 max-w-full mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <PackageOpen className="w-7 h-7 text-primary" />
            Retirada de Materiais e Ferramentas
          </h1>
          <p className="text-muted-foreground mt-1">
            Registro de retirada e entrega de materiais e ferramentas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Registro
          </Button>
        </div>
      </div>

      {/* Modal de formulário */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-card border border-border rounded-lg w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">{editingId ? "Editar Registro" : "Novo Registro"}</h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Nome <span className="text-destructive">*</span></Label>
                <Input placeholder="Nome do responsável pela retirada..." value={form.nome} onChange={e => handleField("nome", e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Data <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.date} onChange={e => handleField("date", e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Tipo de Operação <span className="text-destructive">*</span></Label>
                <div className="flex gap-4 pt-1.5">
                  {[{ value: "retirada", label: "Retirada" }, { value: "entrega", label: "Entrega" }].map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="tipo-form" value={opt.value} checked={form.tipo === opt.value} onChange={() => handleField("tipo", opt.value)} className="w-4 h-4 accent-primary" />
                      <span className="text-sm font-medium">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Tipo de Material/Ferramenta <span className="text-destructive">*</span></Label>
                <Input placeholder="Ex: Furadeira, Parafusos..." value={form.tipoMaterial} onChange={e => handleField("tipoMaterial", e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Quantidade <span className="text-destructive">*</span></Label>
                <Input placeholder="Ex: 2 unidades, 1 caixa..." value={form.quantidade} onChange={e => handleField("quantidade", e.target.value)} />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label>Justificativa <span className="text-destructive">*</span></Label>
                <Textarea placeholder="Descreva o motivo..." className="min-h-[80px]" value={form.justificativa} onChange={e => handleField("justificativa", e.target.value)} />
              </div>

              <div className="sm:col-span-2 space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Fotos (opcional)</Label>
                  <Button variant="outline" type="button" size="sm" onClick={() => document.getElementById("foto-mgmt")?.click()} className="gap-1.5 h-7 text-xs">
                    <ImageIcon className="w-3.5 h-3.5" />
                    Adicionar Fotos
                  </Button>
                  <input id="foto-mgmt" type="file" accept="image/*" multiple className="hidden" onChange={handlePhotos} />
                </div>
                {photoPreviews.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {photoPreviews.map((src, i) => (
                      <div key={i} className="relative w-20 h-16 rounded-md overflow-hidden border border-border group">
                        <img src={src} alt="Preview" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removePhoto(i)} className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2 border-t border-border/50">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? "Salvando..." : <><Check className="w-4 h-4 mr-2" />Salvar</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setLightbox(null)}>
          {lightbox.photos.length > 1 && (
            <>
              <button className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/40 rounded-full p-2" onClick={e => { e.stopPropagation(); setLightbox(l => l ? { ...l, index: (l.index - 1 + l.photos.length) % l.photos.length } : null); }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/40 rounded-full p-2" onClick={e => { e.stopPropagation(); setLightbox(l => l ? { ...l, index: (l.index + 1) % l.photos.length } : null); }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </>
          )}
          <img src={lightbox.photos[lightbox.index]} alt="Foto" className="max-w-full max-h-[90vh] rounded-lg object-contain" onClick={e => e.stopPropagation()} />
          {lightbox.photos.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {lightbox.photos.map((_, i) => (
                <button key={i} onClick={e => { e.stopPropagation(); setLightbox(l => l ? { ...l, index: i } : null); }} className={`w-2 h-2 rounded-full ${i === lightbox.index ? "bg-white" : "bg-white/40"}`} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabela de registros */}
      <Card className="bg-card border-border/50">
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-10 text-center text-muted-foreground">Carregando...</div>
          ) : records.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              Nenhum registro encontrado. Clique em "Novo Registro" para começar.
            </div>
          ) : (
            <table className="w-full text-sm border-collapse" style={{ minWidth: "900px" }}>
              <thead>
                <tr className="bg-muted/40 border-b border-border text-xs text-muted-foreground">
                  <th className="text-left px-4 py-3 font-semibold border-r border-border/40">Nome</th>
                  <th className="text-left px-4 py-3 font-semibold border-r border-border/40">Data</th>
                  <th className="text-left px-4 py-3 font-semibold border-r border-border/40">Tipo</th>
                  <th className="text-left px-4 py-3 font-semibold border-r border-border/40">Material/Ferramenta</th>
                  <th className="text-left px-4 py-3 font-semibold border-r border-border/40">Quantidade</th>
                  <th className="text-left px-4 py-3 font-semibold border-r border-border/40">Justificativa</th>
                  <th className="text-center px-4 py-3 font-semibold border-r border-border/40">Fotos</th>
                  <th className="text-center px-4 py-3 font-semibold w-20">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {records.map(r => {
                  const photos = parsePhotos(r.foto);
                  return (
                    <tr key={r.id} className="hover:bg-muted/10 transition-colors group">
                      <td className="px-4 py-3 border-r border-border/30 font-medium">{r.nome || <span className="text-muted-foreground italic">—</span>}</td>
                      <td className="px-4 py-3 border-r border-border/30 whitespace-nowrap text-sm">
                        {r.date ? new Date(r.date + "T00:00:00").toLocaleDateString("pt-BR") : "-"}
                      </td>
                      <td className="px-4 py-3 border-r border-border/30">
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", tipoBadge(r.tipo))}>
                          {r.tipo === "retirada" ? "Retirada" : "Entrega"}
                        </span>
                      </td>
                      <td className="px-4 py-3 border-r border-border/30 font-medium">{r.tipoMaterial}</td>
                      <td className="px-4 py-3 border-r border-border/30">{r.quantidade}</td>
                      <td className="px-4 py-3 border-r border-border/30 text-muted-foreground max-w-[240px] truncate" title={r.justificativa}>
                        {r.justificativa}
                      </td>
                      <td className="px-4 py-3 border-r border-border/30 text-center">
                        {photos.length > 0 ? (
                          <button
                            onClick={() => setLightbox({ photos, index: 0 })}
                            className="relative mx-auto inline-flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                          >
                            <ImageIcon className="w-4 h-4" />
                            {photos.length > 1 && (
                              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                                {photos.length}
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="text-muted-foreground/40 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(r)} className="text-muted-foreground hover:text-primary transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(r.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
