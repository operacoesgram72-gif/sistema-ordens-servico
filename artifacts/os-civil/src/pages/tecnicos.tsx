import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Users, Plus, Pencil, Trash2, Shield, Phone, Mail, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { 
  useListTechnicians, 
  useCreateTechnician, 
  useUpdateTechnician, 
  useDeleteTechnician,
  getListTechniciansQueryKey
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const techSchema = z.object({
  name: z.string().min(3, "Nome muito curto"),
  specialty: z.string().min(2, "Especialidade obrigatória"),
  phone: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  active: z.boolean().default(true)
});

export default function Tecnicos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: technicians, isLoading } = useListTechnicians({ query: { queryKey: getListTechniciansQueryKey() } });
  
  const createTech = useCreateTechnician();
  const updateTech = useUpdateTechnician();
  const deleteTech = useDeleteTechnician();

  const form = useForm<z.infer<typeof techSchema>>({
    resolver: zodResolver(techSchema),
    defaultValues: { name: "", specialty: "", phone: "", email: "", active: true }
  });

  const openNewModal = () => {
    setEditingId(null);
    form.reset({ name: "", specialty: "", phone: "", email: "", active: true });
    setIsModalOpen(true);
  };

  const openEditModal = (tech: any) => {
    setEditingId(tech.id);
    form.reset({
      name: tech.name,
      specialty: tech.specialty,
      phone: tech.phone || "",
      email: tech.email || "",
      active: tech.active
    });
    setIsModalOpen(true);
  };

  const onSubmit = (values: z.infer<typeof techSchema>) => {
    const isEditing = editingId !== null;
    const mutation = isEditing ? updateTech : createTech;
    const payload = isEditing ? { id: editingId, data: values } : { data: values };

    (mutation.mutate as any)(payload, {
      onSuccess: () => {
        toast({ title: "Sucesso", description: `Técnico ${isEditing ? 'atualizado' : 'cadastrado'}.` });
        queryClient.invalidateQueries({ queryKey: getListTechniciansQueryKey() });
        setIsModalOpen(false);
      },
      onError: () => {
        toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
      }
    });
  };

  const handleDelete = (id: number) => {
    if(confirm("Excluir este técnico?")) {
      deleteTech.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Excluído", description: "Técnico removido do sistema." });
          queryClient.invalidateQueries({ queryKey: getListTechniciansQueryKey() });
        }
      });
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Equipe Técnica</h1>
          <p className="text-muted-foreground mt-1">Gerencie os profissionais de campo.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: getListTechniciansQueryKey() })} title="Atualizar lista">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={openNewModal}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Técnico
          </Button>
        </div>
      </div>

      <div className="border border-border/50 rounded-md bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Especialidade</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="h-24 text-center">Carregando...</TableCell></TableRow>
            ) : technicians?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Nenhum técnico cadastrado.</TableCell></TableRow>
            ) : (
              technicians?.map(tech => (
                <TableRow key={tech.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                        {tech.name.charAt(0).toUpperCase()}
                      </div>
                      {tech.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">{tech.specialty}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground space-y-1">
                    {tech.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {tech.phone}</div>}
                    {tech.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {tech.email}</div>}
                    {!tech.phone && !tech.email && "-"}
                  </TableCell>
                  <TableCell>
                    {tech.active 
                      ? <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20">Ativo</Badge> 
                      : <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEditModal(tech)}>
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(tech.id)}>
                      <Trash2 className="w-4 h-4 text-destructive opacity-50 hover:opacity-100" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Técnico" : "Novo Técnico"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="specialty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Especialidade</FormLabel>
                    <FormControl><Input placeholder="Ex: Eletricista, Encanador" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {editingId && (
                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3 mt-4">
                      <div className="space-y-0.5">
                        <FormLabel>Status de Atividade</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Técnicos inativos não aparecem na atribuição de OS.
                        </div>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createTech.isPending || updateTech.isPending}>
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
