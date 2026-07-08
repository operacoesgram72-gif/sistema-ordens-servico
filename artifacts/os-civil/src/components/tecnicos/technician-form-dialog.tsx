import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Upload, User } from "lucide-react";

import type { Technician } from "@workspace/api-client-react";
import { useRequestUploadUrl } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const BASE_FETCH = import.meta.env.BASE_URL.replace(/\/$/, "");

export function photoSrc(photoUrl: string | null | undefined): string | undefined {
  if (!photoUrl) return undefined;
  return `${BASE_FETCH}/api/storage${photoUrl}`;
}

const NONE_MANAGER = "__none__";

const techSchema = z.object({
  name: z.string().min(3, "Nome muito curto"),
  specialty: z.string().min(2, "Especialidade obrigatória"),
  position: z.string().optional(),
  area: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  managerId: z.string().default(NONE_MANAGER),
  photoUrl: z.string().nullable().optional(),
  active: z.boolean().default(true),
});

export type TechFormValues = z.infer<typeof techSchema>;

interface TechnicianFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Technician | null;
  managers: Technician[];
  onSubmit: (values: {
    name: string;
    specialty: string;
    position?: string;
    area?: string | null;
    phone?: string;
    email?: string;
    managerId: number | null;
    photoUrl: string | null;
    active: boolean;
  }) => void;
  isSaving: boolean;
}

export function TechnicianFormDialog({
  open,
  onOpenChange,
  editing,
  managers,
  onSubmit,
  isSaving,
}: TechnicianFormDialogProps) {
  const { toast } = useToast();
  const requestUploadUrl = useRequestUploadUrl();
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<TechFormValues>({
    resolver: zodResolver(techSchema),
    defaultValues: {
      name: "",
      specialty: "",
      position: "",
      area: "",
      phone: "",
      email: "",
      managerId: NONE_MANAGER,
      photoUrl: null,
      active: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        name: editing.name,
        specialty: editing.specialty,
        position: editing.position || "",
        area: editing.area || "",
        phone: editing.phone || "",
        email: editing.email || "",
        managerId: editing.managerId ? String(editing.managerId) : NONE_MANAGER,
        photoUrl: editing.photoUrl ?? null,
        active: editing.active,
      });
    } else {
      form.reset({
        name: "",
        specialty: "",
        position: "",
        area: "",
        phone: "",
        email: "",
        managerId: NONE_MANAGER,
        photoUrl: null,
        active: true,
      });
    }
  }, [open, editing, form]);

  const photoUrl = form.watch("photoUrl");

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
        data: { name: file.name, size: file.size, contentType: file.type || "application/octet-stream" },
      });
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!putRes.ok) throw new Error("Falha ao enviar arquivo");
      form.setValue("photoUrl", objectPath, { shouldDirty: true });
    } catch {
      toast({ title: "Erro", description: "Não foi possível enviar a foto.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleSubmit = (values: TechFormValues) => {
    onSubmit({
      name: values.name,
      specialty: values.specialty,
      position: values.position || undefined,
      area: values.area || null,
      phone: values.phone || undefined,
      email: values.email || undefined,
      managerId: values.managerId === NONE_MANAGER ? null : Number(values.managerId),
      photoUrl: values.photoUrl ?? null,
      active: values.active,
    });
  };

  // Prevent selecting the técnico being edited as its own manager.
  const managerOptions = managers.filter((m) => !editing || m.id !== editing.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Técnico" : "Novo Técnico"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-4">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16 border border-border/50">
                <AvatarImage src={photoSrc(photoUrl)} alt="" />
                <AvatarFallback className="bg-primary/10 text-primary">
                  <User className="w-6 h-6" />
                </AvatarFallback>
              </Avatar>
              <div>
                <label htmlFor="tech-photo-input">
                  <Button type="button" variant="outline" size="sm" disabled={isUploading} asChild>
                    <span className="cursor-pointer inline-flex items-center">
                      {isUploading ? (
                        <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5 mr-2" />
                      )}
                      {photoUrl ? "Trocar foto" : "Enviar foto"}
                    </span>
                  </Button>
                </label>
                <input
                  id="tech-photo-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                  disabled={isUploading}
                />
                <p className="text-xs text-muted-foreground mt-1">Opcional. Exibida no organograma.</p>
              </div>
            </div>

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
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="specialty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Especialidade</FormLabel>
                    <FormControl><Input placeholder="Ex: Eletricista" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo</FormLabel>
                    <FormControl><Input placeholder="Ex: Supervisor de Operações" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="area"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Área</FormLabel>
                  <FormControl><Input placeholder="Ex: Manutenções e Reparos" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="managerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gestão (reporta a)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sem gestor definido" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE_MANAGER}>Sem gestor definido</SelectItem>
                      {managerOptions.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.name}{m.position ? ` — ${m.position}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

            {editing && (
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
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving || isUploading}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
