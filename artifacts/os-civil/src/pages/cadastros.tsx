import { useState } from "react";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, Search, User, FileText, RefreshCw } from "lucide-react";
import { useCreateContact, useUpdateContact, useDeleteContact } from "@workspace/api-client-react";
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

type ContactForm = {
  name: string;
  cpf: string;
  phone: string;
  email: string;
  address: string;
  birthDate: string;
  notes: string;
};

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const empty: ContactForm = { name: "", cpf: "", phone: "", email: "", address: "", birthDate: "", notes: "" };

function formatCPF(val: string) {
  return val.replace(/\D/g, "").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2").slice(0, 14);
}
function formatPhone(val: string) {
  return val.replace(/\D/g, "").replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").slice(0, 15);
}

export default function Cadastros() {
  const { toast } = useToast();
  const { unit } = useUnit();
  const queryClient = useQueryClient();
  const { data: contacts, isLoading } = useQuery<any[]>({
    queryKey: ["contacts", unit],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/contacts?unidade=${unit}`);
      if (!res.ok) throw new Error("Erro ao carregar contatos");
      return res.json();
    },
  });
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ContactForm>(empty);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const filtered = (contacts ?? []).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.cpf ?? "").includes(search) ||
    (c.phone ?? "").includes(search)
  );

  const openNew = () => { setForm(empty); setEditingId(null); setDialogOpen(true); };
  const openEdit = (c: any) => {
    setForm({
      name: c.name ?? "",
      cpf: c.cpf ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      address: c.address ?? "",
      birthDate: c.birthDate ?? "",
      notes: c.notes ?? "",
    });
    setEditingId(c.id);
    setDialogOpen(true);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["contacts", unit] });

  const handleSave = () => {
    const payload: any = {
      name: form.name,
      cpf: form.cpf || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      birthDate: form.birthDate || undefined,
      notes: form.notes || undefined,
      unidade: unit,
    };
    if (editingId) {
      updateContact.mutate({ id: editingId, data: payload }, {
        onSuccess: () => { toast({ title: "Contato atualizado!" }); setDialogOpen(false); invalidate(); },
        onError: () => toast({ title: "Erro", variant: "destructive" }),
      });
    } else {
      createContact.mutate({ data: payload }, {
        onSuccess: () => { toast({ title: "Contato cadastrado!" }); setDialogOpen(false); invalidate(); },
        onError: () => toast({ title: "Erro", variant: "destructive" }),
      });
    }
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteContact.mutate({ id: deleteId }, {
      onSuccess: () => { toast({ title: "Contato removido." }); setDeleteId(null); invalidate(); },
      onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
    });
  };

  const handleExportPDF = () => {
    generatePDF({
      title: "Dados Cadastrais",
      subtitle: "Funcionários, contatos e colaboradores",
      unit,
      columns: [
        { header: "Nome", key: "name", width: "20%" },
        { header: "CPF", key: "cpf", width: "13%" },
        { header: "Telefone", key: "phone", width: "13%" },
        { header: "E-mail", key: "email", width: "20%" },
        { header: "Nascimento", key: "birthDate", width: "11%" },
        { header: "Endereço", key: "address", width: "23%" },
      ],
      rows: filtered.map(c => ({
        name: c.name,
        cpf: c.cpf || "—",
        phone: c.phone || "—",
        email: c.email || "—",
        birthDate: c.birthDate ? format(new Date(c.birthDate + "T12:00:00"), "dd/MM/yyyy") : "—",
        address: c.address || "—",
      })),
    });
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sticky top-0 z-20 bg-background -mx-6 px-6 md:-mx-8 md:px-8 -mt-6 md:-mt-8 pt-6 md:pt-8 pb-3 border-b border-border/30">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dados Cadastrais</h1>
          <p className="text-muted-foreground mt-1">Funcionários e contatos — unidade <strong>{unit}</strong>.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => invalidate()} title="Atualizar lista">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={handleExportPDF} disabled={!filtered.length}>
            <FileText className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
          <Button onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Cadastro
          </Button>
        </div>
      </div>

      <Card className="p-4 bg-card border-border/50">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, CPF, telefone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </Card>

      <div className="border border-border/50 rounded-md bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Nome</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Nascimento</TableHead>
              <TableHead>Endereço</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <User className="w-8 h-8 opacity-30" />
                    <span>Nenhum cadastro encontrado para a unidade {unit}.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono text-sm">{c.cpf || <span className="text-muted-foreground italic">—</span>}</TableCell>
                  <TableCell className="text-sm">{c.phone || <span className="text-muted-foreground italic">—</span>}</TableCell>
                  <TableCell className="text-sm">{c.email || <span className="text-muted-foreground italic">—</span>}</TableCell>
                  <TableCell className="text-sm">
                    {c.birthDate ? format(new Date(c.birthDate + "T12:00:00"), "dd/MM/yyyy") : <span className="text-muted-foreground italic">—</span>}
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{c.address || <span className="text-muted-foreground italic">—</span>}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}>
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
            <DialogTitle>{editingId ? "Editar Cadastro" : "Novo Cadastro"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="md:col-span-2 space-y-1.5">
              <Label>Nome completo <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do funcionário" />
            </div>
            <div className="space-y-1.5">
              <Label>CPF</Label>
              <Input value={form.cpf} onChange={(e) => setForm(f => ({ ...f, cpf: formatCPF(e.target.value) }))} placeholder="000.000.000-00" maxLength={14} />
            </div>
            <div className="space-y-1.5">
              <Label>Data de Nascimento</Label>
              <Input type="date" value={form.birthDate} onChange={(e) => setForm(f => ({ ...f, birthDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone / WhatsApp</Label>
              <Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))} placeholder="(00) 00000-0000" maxLength={15} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label>Endereço</Label>
              <Input value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Rua, número, bairro, cidade" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label>Observações</Label>
              <Input value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Cargo, setor, observações..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || createContact.isPending || updateContact.isPending}>
              {editingId ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="dark bg-card text-foreground border-border max-w-sm">
          <DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja remover este cadastro? Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteContact.isPending}>Remover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
