import { useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Search, Truck, MapPin, Share2, FileText, RefreshCw } from "lucide-react";
import {
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useUnit } from "@/contexts/unit-context";
import { generatePDF } from "@/lib/pdf-utils";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

type Supplier = {
  id: number;
  razaoSocial?: string | null;
  cnpjCpf?: string | null;
  endereco?: string | null;
  uf?: string | null;
  cidade?: string | null;
  contato?: string | null;
  email?: string | null;
  atendente?: string | null;
  localizacaoLink?: string | null;
  unidade?: string | null;
};

type SupplierForm = {
  cnpjCpf: string;
  razaoSocial: string;
  endereco: string;
  uf: string;
  cidade: string;
  contato: string;
  email: string;
  atendente: string;
  localizacaoLink: string;
};

const empty: SupplierForm = {
  cnpjCpf: "",
  razaoSocial: "",
  endereco: "",
  uf: "",
  cidade: "",
  contato: "",
  email: "",
  atendente: "",
  localizacaoLink: "",
};

export default function Fornecedores() {
  const { toast } = useToast();
  const { unit } = useUnit();
  const queryClient = useQueryClient();
  const { data: suppliers, isLoading } = useQuery<Supplier[]>({
    queryKey: ["suppliers", unit],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/suppliers?unidade=${unit}`);
      if (!res.ok) throw new Error("Erro ao carregar fornecedores");
      return res.json();
    },
  });
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SupplierForm>(empty);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const filtered = (suppliers ?? []).filter((s) =>
    (s.razaoSocial ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (s.cnpjCpf ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (s.cidade ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (s.contato ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setForm(empty); setEditingId(null); setDialogOpen(true); };
  const openEdit = (s: any) => {
    setForm({
      cnpjCpf: s.cnpjCpf ?? "",
      razaoSocial: s.razaoSocial ?? "",
      endereco: s.endereco ?? "",
      uf: s.uf ?? "",
      cidade: s.cidade ?? "",
      contato: s.contato ?? "",
      email: s.email ?? "",
      atendente: s.atendente ?? "",
      localizacaoLink: s.localizacaoLink ?? "",
    });
    setEditingId(s.id);
    setDialogOpen(true);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["suppliers", unit] });

  const handleSave = () => {
    const payload: any = {
      cnpjCpf: form.cnpjCpf || undefined,
      razaoSocial: form.razaoSocial || undefined,
      endereco: form.endereco || undefined,
      uf: form.uf || undefined,
      cidade: form.cidade || undefined,
      contato: form.contato || undefined,
      email: form.email || undefined,
      atendente: form.atendente || undefined,
      localizacaoLink: form.localizacaoLink || undefined,
      unidade: unit,
    };
    if (editingId) {
      updateSupplier.mutate({ id: editingId, data: payload }, {
        onSuccess: () => { toast({ title: "Fornecedor atualizado!" }); setDialogOpen(false); invalidate(); },
        onError: () => toast({ title: "Erro", variant: "destructive" }),
      });
    } else {
      createSupplier.mutate({ data: payload }, {
        onSuccess: () => { toast({ title: "Fornecedor cadastrado!" }); setDialogOpen(false); invalidate(); },
        onError: () => toast({ title: "Erro", variant: "destructive" }),
      });
    }
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteSupplier.mutate({ id: deleteId }, {
      onSuccess: () => { toast({ title: "Fornecedor removido." }); setDeleteId(null); invalidate(); },
      onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
    });
  };

  const shareLink = async (url: string, title: string) => {
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado para a área de transferência!" });
    } catch {
      toast({ title: "Não foi possível compartilhar.", variant: "destructive" });
    }
  };

  const handleShare = (s: any) => {
    const url = `${window.location.origin}${BASE_URL}/fornecedores/publico/${s.id}`;
    shareLink(url, `Fornecedor: ${s.razaoSocial || ""}`);
  };

  const handleShareList = () => {
    const url = `${window.location.origin}${BASE_URL}/fornecedores/publico`;
    shareLink(url, "Relação de Fornecedores");
  };

  const handleExportPDF = () => {
    generatePDF({
      title: "Relatório de Fornecedores",
      subtitle: "Cadastro e gestão de fornecedores",
      unit,
      columns: [
        { header: "Razão Social", key: "razaoSocial", width: "22%" },
        { header: "CNPJ/CPF", key: "cnpjCpf", width: "14%" },
        { header: "Cidade/UF", key: "cidadeUf", width: "14%" },
        { header: "Contato", key: "contato", width: "13%" },
        { header: "E-mail", key: "email", width: "18%" },
        { header: "Atendente", key: "atendente", width: "12%" },
      ],
      rows: filtered.map(s => ({
        razaoSocial: s.razaoSocial || "—",
        cnpjCpf: s.cnpjCpf || "—",
        cidadeUf: [s.cidade, s.uf].filter(Boolean).join(" / ") || "—",
        contato: s.contato || "—",
        email: s.email || "—",
        atendente: s.atendente || "—",
      })),
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="bg-background border-b border-border/30 shrink-0">
        <div className="px-6 md:px-8 pt-6 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fornecedores</h1>
          <p className="text-muted-foreground mt-1">Cadastro da unidade <strong>{unit}</strong>.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="icon" onClick={() => invalidate()} title="Atualizar lista">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={handleExportPDF} disabled={!filtered.length}>
            <FileText className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
          <Button variant="outline" onClick={handleShareList}>
            <Share2 className="w-4 h-4 mr-2" />
            Compartilhar Lista
          </Button>
          <Button onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Fornecedor
          </Button>
        </div>
      </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="px-6 md:px-8 pb-8 pt-4 max-w-7xl mx-auto space-y-6">

      <Card className="p-4 bg-card border-border/50">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por razão social, CNPJ/CPF, cidade..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </Card>

      <div className="border border-border/50 rounded-md bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Razão Social</TableHead>
              <TableHead>CNPJ/CPF</TableHead>
              <TableHead>Cidade/UF</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Atendente</TableHead>
              <TableHead className="w-[140px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Truck className="w-8 h-8 opacity-30" />
                    <span>Nenhum fornecedor encontrado para a unidade {unit}.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => (
                <TableRow key={s.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{s.razaoSocial || <span className="text-muted-foreground italic">—</span>}</TableCell>
                  <TableCell className="font-mono text-sm">{s.cnpjCpf || <span className="text-muted-foreground italic">—</span>}</TableCell>
                  <TableCell className="text-sm">
                    {s.cidade || s.uf ? [s.cidade, s.uf].filter(Boolean).join(" / ") : <span className="text-muted-foreground italic">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">{s.contato || <span className="text-muted-foreground italic">—</span>}</TableCell>
                  <TableCell className="text-sm">{s.email || <span className="text-muted-foreground italic">—</span>}</TableCell>
                  <TableCell className="text-sm">{s.atendente || <span className="text-muted-foreground italic">—</span>}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {s.localizacaoLink && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Abrir localização" onClick={() => window.open(s.localizacaoLink!, "_blank", "noopener,noreferrer")}>
                          <MapPin className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Compartilhar" onClick={() => handleShare(s)}>
                        <Share2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => openEdit(s)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Remover" onClick={() => setDeleteId(s.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg dark bg-card text-foreground border-border">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="md:col-span-2 space-y-1.5">
              <Label>Razão Social</Label>
              <Input value={form.razaoSocial} onChange={(e) => setForm(f => ({ ...f, razaoSocial: e.target.value }))} placeholder="Nome da empresa / fornecedor" />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ/CPF</Label>
              <Input value={form.cnpjCpf} onChange={(e) => setForm(f => ({ ...f, cnpjCpf: e.target.value }))} placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-1.5">
              <Label>Contato</Label>
              <Input value={form.contato} onChange={(e) => setForm(f => ({ ...f, contato: e.target.value }))} placeholder="Telefone / WhatsApp" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label>Endereço</Label>
              <Input value={form.endereco} onChange={(e) => setForm(f => ({ ...f, endereco: e.target.value }))} placeholder="Rua, número, bairro" />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input value={form.cidade} onChange={(e) => setForm(f => ({ ...f, cidade: e.target.value }))} placeholder="Cidade" />
            </div>
            <div className="space-y-1.5">
              <Label>UF</Label>
              <Input value={form.uf} onChange={(e) => setForm(f => ({ ...f, uf: e.target.value.toUpperCase() }))} placeholder="UF" maxLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Atendente</Label>
              <Input value={form.atendente} onChange={(e) => setForm(f => ({ ...f, atendente: e.target.value }))} placeholder="Nome do atendente" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label>Localização (link)</Label>
              <Input value={form.localizacaoLink} onChange={(e) => setForm(f => ({ ...f, localizacaoLink: e.target.value }))} placeholder="https://maps.google.com/..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createSupplier.isPending || updateSupplier.isPending}>
              {editingId ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="dark bg-card text-foreground border-border max-w-sm">
          <DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja remover este fornecedor? Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteSupplier.isPending}>Remover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    
        </div>
      </div>
    </div>
  );
}
