import { useState } from "react";
import { salvarRetiradaMateriais } from "@/lib/supabase";
import { Link, useSearch } from "wouter";
import { Save, Image as ImageIcon, X, CheckCircle2, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

type MaterialItem = { tipoMaterial: string; quantidade: string };

export default function RegistrarMateriais() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const search = useSearch();
  const unitFromUrl = new URLSearchParams(search).get("u") || "AM";

  const [form, setForm] = useState({
    nome: "",
    date: new Date().toISOString().slice(0, 10),
    justificativa: "",
    tipo: "retirada",
  });

  const [materials, setMaterials] = useState<MaterialItem[]>([{ tipoMaterial: "", quantidade: "" }]);
  const [photos, setPhotos] = useState<string[]>([]);

  const handleField = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const addMaterial = () =>
    setMaterials(m => [...m, { tipoMaterial: "", quantidade: "" }]);

  const removeMaterial = (i: number) =>
    setMaterials(m => m.filter((_, j) => j !== i));

  const updateMaterial = (i: number, field: keyof MaterialItem, value: string) =>
    setMaterials(m => m.map((item, j) => j === i ? { ...item, [field]: value } : item));

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => setPhotos(p => [...p, reader.result as string]);
    });
    e.target.value = "";
  };

  const removePhoto = (i: number) => setPhotos(p => p.filter((_, j) => j !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast({ title: "Nome obrigatório", description: "Informe seu nome antes de enviar.", variant: "destructive" });
      return;
    }
    if (!form.date || !form.justificativa) {
      toast({ title: "Campos obrigatórios", description: "Preencha data e justificativa.", variant: "destructive" });
      return;
    }
    const validMaterials = materials.filter(m => m.tipoMaterial.trim() && m.quantidade.trim());
    if (validMaterials.length === 0) {
      toast({ title: "Informe pelo menos um material", description: "Preencha o tipo e a quantidade.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const fotoJson = photos.length > 0 ? JSON.stringify(photos) : null;
      for (const mat of validMaterials) {
        const res = await fetch(`${BASE_URL}/api/material-withdrawals`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            tipoMaterial: mat.tipoMaterial,
            quantidade: mat.quantidade,
            foto: fotoJson,
            unidade: unitFromUrl,
          }),
        });
        if (!res.ok) throw new Error("Erro ao registrar");
        salvarRetiradaMateriais({
          ...form,
          tipoMaterial: mat.tipoMaterial,
          quantidade: mat.quantidade,
          foto: fotoJson,
          unidade: unitFromUrl,
        });
      }
      setSubmitted(true);
    } catch {
      toast({ title: "Erro", description: "Não foi possível registrar. Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSubmitted(false);
    setForm({ nome: "", date: new Date().toISOString().slice(0, 10), justificativa: "", tipo: "retirada" });
    setMaterials([{ tipoMaterial: "", quantidade: "" }]);
    setPhotos([]);
  };

  return (
    <div className="min-h-screen bg-background text-foreground dark flex flex-col">
      <header className="border-b border-border bg-card px-6 py-3 flex items-center gap-4 shrink-0">
        <img src="/logo-amazonica.png" alt="Logo Rede Amazônica" className="h-10 w-10 object-contain" />
        <div className="border-l border-border pl-4">
          <div className="font-bold text-sm leading-tight">Grupo Rede Amazônica</div>
          <div className="text-xs text-muted-foreground">Departamento: Operações</div>
        </div>
        <div className="ml-auto">
          <span className="text-xs font-semibold text-primary uppercase tracking-widest">Painel de Serviços</span>
        </div>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-2xl space-y-6">
          <div className="flex items-center gap-3">
            <Link href={`/registrar?u=${unitFromUrl}`}>
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Retirada de Materiais e Ferramentas</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Registre a retirada ou entrega de materiais e ferramentas.</p>
            </div>
          </div>

          {submitted ? (
            <Card className="bg-card border-border/50">
              <CardContent className="p-10 flex flex-col items-center text-center gap-4">
                <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                <div>
                  <h2 className="text-2xl font-bold">Registro Salvo!</h2>
                  <p className="text-muted-foreground mt-1">Seu registro foi enviado com sucesso.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full">
                  <Button onClick={resetForm} variant="outline" className="flex-1">
                    Novo Registro
                  </Button>
                  <Link href={`/registrar?u=${unitFromUrl}`}>
                    <Button className="flex-1 w-full">Voltar ao Menu</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-border/50">
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-5">

                  {/* 1 — Identificação */}
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome do Responsável <span className="text-destructive">*</span></Label>
                    <Input
                      id="nome"
                      placeholder="Seu nome completo..."
                      value={form.nome}
                      onChange={e => handleField("nome", e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="date">Data <span className="text-destructive">*</span></Label>
                      <Input id="date" type="date" value={form.date} onChange={e => handleField("date", e.target.value)} required />
                    </div>

                    <div className="space-y-2">
                      <Label>Tipo de Operação <span className="text-destructive">*</span></Label>
                      <div className="flex gap-4 pt-2">
                        {[{ value: "retirada", label: "Retirada" }, { value: "entrega", label: "Entrega" }].map(opt => (
                          <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="tipo"
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
                  </div>

                  {/* 2 — Materiais */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Materiais / Ferramentas <span className="text-destructive">*</span></Label>
                      <Button type="button" variant="outline" size="sm" onClick={addMaterial} className="gap-1.5 h-7 text-xs">
                        <Plus className="w-3.5 h-3.5" />
                        Adicionar Item
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {materials.map((mat, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            placeholder="Tipo de material/ferramenta..."
                            value={mat.tipoMaterial}
                            onChange={e => updateMaterial(i, "tipoMaterial", e.target.value)}
                            className="flex-1"
                          />
                          <Input
                            placeholder="Qtd."
                            value={mat.quantidade}
                            onChange={e => updateMaterial(i, "quantidade", e.target.value)}
                            className="w-28"
                          />
                          {materials.length > 1 && (
                            <button type="button" onClick={() => removeMaterial(i)} className="text-muted-foreground hover:text-destructive shrink-0">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Clique em "+ Adicionar Item" para registrar múltiplos materiais na mesma retirada.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="justificativa">Justificativa <span className="text-destructive">*</span></Label>
                    <Textarea
                      id="justificativa"
                      placeholder="Descreva o motivo da retirada ou entrega..."
                      className="min-h-[100px]"
                      value={form.justificativa}
                      onChange={e => handleField("justificativa", e.target.value)}
                      required
                    />
                  </div>

                  {/* 3 — Fotos */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Fotos (opcional)</Label>
                      <Button variant="outline" type="button" size="sm" onClick={() => document.getElementById("foto-mat")?.click()} className="gap-1.5 h-7 text-xs">
                        <ImageIcon className="w-3.5 h-3.5" />
                        Adicionar Fotos
                      </Button>
                      <input
                        id="foto-mat"
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handlePhotos}
                      />
                    </div>
                    {photos.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {photos.map((src, i) => (
                          <div key={i} className="relative w-24 h-20 rounded-md overflow-hidden border border-border group">
                            <img src={src} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removePhoto(i)}
                              className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {photos.length > 0 && (
                      <p className="text-xs text-muted-foreground">{photos.length} foto(s) selecionada(s) — passe o mouse para remover</p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-border/50">
                    <Button type="submit" disabled={loading} size="lg" className="w-full">
                      {loading ? "Registrando..." : <><Save className="w-4 h-4 mr-2" />Registrar</>}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
