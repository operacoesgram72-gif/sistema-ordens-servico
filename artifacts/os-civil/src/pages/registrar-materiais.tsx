import { useState } from "react";
import { Link, useSearch } from "wouter";
import { Save, Image as ImageIcon, X, CheckCircle2, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function RegistrarMateriais() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const search = useSearch();
  const unitFromUrl = new URLSearchParams(search).get("u") || "AM";

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    tipoMaterial: "",
    quantidade: "",
    justificativa: "",
    tipo: "retirada",
  });

  const handleField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => setFotoBase64(reader.result as string);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date || !form.tipoMaterial || !form.quantidade || !form.justificativa) {
      toast({ title: "Campos obrigatórios", description: "Preencha todos os campos antes de enviar.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/material-withdrawals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, foto: fotoBase64, unidade: unitFromUrl }),
      });
      if (!res.ok) throw new Error("Erro ao registrar");
      setSubmitted(true);
    } catch {
      toast({ title: "Erro", description: "Não foi possível registrar. Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
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
                  <Button onClick={() => { setSubmitted(false); setForm({ date: new Date().toISOString().slice(0, 10), tipoMaterial: "", quantidade: "", justificativa: "", tipo: "retirada" }); setFotoBase64(null); }} variant="outline" className="flex-1">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                    <div className="space-y-2">
                      <Label htmlFor="date">Data <span className="text-destructive">*</span></Label>
                      <Input id="date" type="date" value={form.date} onChange={e => handleField("date", e.target.value)} required />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tipo">Tipo de Operação <span className="text-destructive">*</span></Label>
                      <div className="flex gap-4 pt-2">
                        {[
                          { value: "retirada", label: "Retirada" },
                          { value: "entrega", label: "Entrega" },
                        ].map(opt => (
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

                    <div className="space-y-2">
                      <Label htmlFor="tipoMaterial">Tipo de Material/Ferramenta <span className="text-destructive">*</span></Label>
                      <Input id="tipoMaterial" placeholder="Ex: Furadeira, Parafusos, Tinta..." value={form.tipoMaterial} onChange={e => handleField("tipoMaterial", e.target.value)} required />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="quantidade">Quantidade <span className="text-destructive">*</span></Label>
                      <Input id="quantidade" placeholder="Ex: 2 unidades, 1 caixa..." value={form.quantidade} onChange={e => handleField("quantidade", e.target.value)} required />
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="justificativa">Justificativa <span className="text-destructive">*</span></Label>
                      <Textarea id="justificativa" placeholder="Descreva o motivo da retirada ou entrega..." className="min-h-[100px]" value={form.justificativa} onChange={e => handleField("justificativa", e.target.value)} required />
                    </div>

                    <div className="md:col-span-2 space-y-3">
                      <Label>Foto (opcional)</Label>
                      <div className="flex items-center gap-4">
                        <Button variant="outline" type="button" onClick={() => document.getElementById("foto-mat")?.click()}>
                          <ImageIcon className="w-4 h-4 mr-2" />
                          Anexar Foto
                        </Button>
                        <input id="foto-mat" type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                        {fotoBase64 && (
                          <button type="button" onClick={() => setFotoBase64(null)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      {fotoBase64 && (
                        <div className="relative w-32 h-24 rounded-md overflow-hidden border border-border">
                          <img src={fotoBase64} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
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
