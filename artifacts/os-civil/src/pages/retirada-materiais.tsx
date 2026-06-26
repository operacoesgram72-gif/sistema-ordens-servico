import { useState, useEffect, useRef } from "react";
import { PackageOpen, Plus, Trash2, Pencil, Check, X, Image as ImageIcon } from "lucide-react";
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
  date: string;
  tipoMaterial: string;
  quantidade: string;
  justificativa: string;
  foto: string | null;
  tipo: string;
  createdAt: string;
};

type FormState = {
  date: string;
  tipoMaterial: string;
  quantidade: string;
  justificativa: string;
  foto: string | null;
  tipo: string;
};

const emptyForm = (): FormState => ({
  date: new Date().toISOString().slice(0, 10),
  tipoMaterial: "",
  quantidade: "",
  justificativa: "",
  foto: null,
  tipo: "retirada",
});

export default function RetiradaMateriais() {
  const { toast } = useToast();
  const { unit } = useUnit();
  const [records, setRecords] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  const fetchAll = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/material-withdrawals?unidade=${unit}`);
      if (res.ok) setRecords(await res.json());
    } catch {
      toast({ title: "Erro ao carregar registros", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [unit]);

  const handleField = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const b64 = reader.result as string;
      setForm(prev => ({ ...prev, foto: b64 }));
      setPhotoPreview(b64);
    };
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setPhotoPreview(null);
    setShowForm(true);
  };

  const openEdit = (r: Withdrawal) => {
    setEditingId(r.id);
    setForm({
      date: r.date,
      tipoMaterial: r.tipoMaterial,
      quantidade: r.quantidade,
      justificativa: r.justificativa,
      foto: r.foto ?? null,
      tipo: r.tipo,
    });
    setPhotoPreview(r.foto ?? null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.date || !form.tipoMaterial || !form.quantidade || !form.justificativa) {
      toast({ title: "Campos obrigatórios", description: "Preencha todos os campos.", variant: "destructive" });
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <PackageOpen className="w-7 h-7 text-primary" />
            Retirada de Materiais e Ferramentas
          </h1>
          <p className="text-muted-foreground mt-1">
            Registro de retirada e entrega de materiais e ferramentas.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          Novo Registro
        </Button>
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
              <div className="space-y-1.5">
                <Label>Data <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.date} onChange={e => handleField("date", e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Tipo de Operação <span className="text-destructive">*</span></Label>
                <div className="flex gap-4 pt-1.5">
                  {[
                    { value: "retirada", label: "Retirada" },
                    { value: "entrega", label: "Entrega" },
                  ].map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="tipo-form"
                        value={opt.value}
                        checked={form.tipo === opt.value}
                        onChange={() => handleField("tipo", opt.value)}
                        className="w-4 h-4 accent-primary"
                      />
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
                <Label>Foto (opcional)</Label>
                <div className="flex items-center gap-3">
                  <Button variant="outline" type="button" size="sm" onClick={() => document.getElementById("foto-mgmt")?.click()}>
                    <ImageIcon className="w-4 h-4 mr-2" />
                    {photoPreview ? "Trocar Foto" : "Anexar Foto"}
                  </Button>
                  <input id="foto-mgmt" type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                  {photoPreview && (
                    <button type="button" onClick={() => { setPhotoPreview(null); setForm(p => ({ ...p, foto: null })); }} className="text-muted-foreground hover:text-destructive">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {photoPreview && (
                  <div className="w-32 h-24 rounded-md overflow-hidden border border-border mt-2">
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
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

      {/* Photo viewer */}
      {viewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setViewPhoto(null)}>
          <img src={viewPhoto} alt="Foto" className="max-w-full max-h-full rounded-lg" />
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
            <table className="w-full text-sm border-collapse" style={{ minWidth: "800px" }}>
              <thead>
                <tr className="bg-muted/40 border-b border-border text-xs text-muted-foreground">
                  <th className="text-left px-4 py-3 font-semibold border-r border-border/40">Data</th>
                  <th className="text-left px-4 py-3 font-semibold border-r border-border/40">Tipo</th>
                  <th className="text-left px-4 py-3 font-semibold border-r border-border/40">Material/Ferramenta</th>
                  <th className="text-left px-4 py-3 font-semibold border-r border-border/40">Quantidade</th>
                  <th className="text-left px-4 py-3 font-semibold border-r border-border/40">Justificativa</th>
                  <th className="text-center px-4 py-3 font-semibold border-r border-border/40">Foto</th>
                  <th className="text-center px-4 py-3 font-semibold w-20">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-muted/10 transition-colors group">
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
                      {r.foto ? (
                        <button onClick={() => setViewPhoto(r.foto!)} className="mx-auto flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors">
                          <ImageIcon className="w-4 h-4" />
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
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
