import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, ArrowLeft, Save, X, Image as ImageIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useCreateServiceOrder, useListTechnicians, getListServiceOrdersQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { CATEGORY_LABELS, PRIORITY_LABELS, TIPO_LABELS, FORMATO_SERVICO_LABELS } from "@/lib/constants";

const formSchema = z.object({
  title: z.string().min(3, "Título deve ter pelo menos 3 caracteres"),
  description: z.string().optional(),
  category: z.enum(["manutencao", "conservacao", "limpeza", "preventiva", "construcao"]),
  priority: z.enum(["baixa", "media", "alta", "urgente"]),
  location: z.string().min(3, "Local obrigatório"),
  technicianId: z.coerce.number().optional().or(z.literal("")),
  scheduledAt: z.date().optional(),
  department: z.string().optional(),
  tipo: z.enum(["reforma", "revitalizacao", "preventiva", "corretiva", "outros"]).optional(),
  formatoServico: z.enum(["civil", "refrigeracao", "hidraulica", "mecanica", "eletrica", "outros"]).optional(),
  estimatedValue: z.coerce.number().optional(),
  photos: z.string().optional()
});

export default function NovaOS() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: technicians } = useListTechnicians();
  const createOrder = useCreateServiceOrder();

  const [photosBase64, setPhotosBase64] = useState<string[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      location: "",
      category: "manutencao",
      priority: "media",
      department: "",
      estimatedValue: undefined,
      photos: ""
    }
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    const base64Promises = files.map((file) => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
      });
    });

    try {
      const base64Files = await Promise.all(base64Promises);
      const newPhotos = [...photosBase64, ...base64Files];
      setPhotosBase64(newPhotos);
      form.setValue("photos", JSON.stringify(newPhotos));
    } catch (err) {
      toast({ title: "Erro", description: "Falha ao processar imagens", variant: "destructive" });
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = photosBase64.filter((_, i) => i !== index);
    setPhotosBase64(newPhotos);
    form.setValue("photos", JSON.stringify(newPhotos));
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createOrder.mutate(
      { 
        data: {
          ...values,
          technicianId: values.technicianId ? Number(values.technicianId) : undefined,
          scheduledAt: values.scheduledAt ? values.scheduledAt.toISOString() : undefined,
        } 
      },
      {
        onSuccess: () => {
          toast({ title: "OS Criada com sucesso", description: "A ordem de serviço foi registrada." });
          queryClient.invalidateQueries({ queryKey: getListServiceOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          setLocation("/ordens");
        },
        onError: () => {
          toast({ title: "Erro", description: "Não foi possível criar a OS.", variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/ordens")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nova Ordem de Serviço</h1>
          <p className="text-muted-foreground mt-1">Cadastrar novo serviço ou chamado.</p>
        </div>
      </div>

      <Card className="bg-card border-border/50">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <FormField
                  control={form.control}
                  name="scheduledAt"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2 md:w-1/2 flex flex-col justify-end">
                      <FormLabel>Data do Serviço</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "dd/MM/yyyy")
                              ) : (
                                <span>Escolha uma data...</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Título da OS</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Conserto do ar condicionado sala 2" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Local / Endereço</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Andar 3, Bloco B" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Departamento</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: RH, Financeiro" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Serviço</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(TIPO_LABELS).map(([val, label]) => (
                            <SelectItem key={val} value={val}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="formatoServico"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Formato do Serviço</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(FORMATO_SERVICO_LABELS).map(([val, label]) => (
                            <SelectItem key={val} value={val}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                            <SelectItem key={val} value={val}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prioridade</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                            <SelectItem key={val} value={val}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="estimatedValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Estimado (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="technicianId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Técnico Responsável</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value?.toString() || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Atribuir depois..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Não atribuir agora</SelectItem>
                          {technicians?.filter(t => t.active).map((tech) => (
                            <SelectItem key={tech.id} value={tech.id.toString()}>{tech.name} ({tech.specialty})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Descrição Detalhada</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Detalhes sobre o problema ou serviço a ser realizado..." 
                          className="min-h-[120px]" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="md:col-span-2 space-y-3">
                  <Label>Fotos do Serviço</Label>
                  <div className="flex items-center gap-4">
                    <Button variant="outline" type="button" onClick={() => document.getElementById("photo-upload")?.click()}>
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Anexar Imagens
                    </Button>
                    <input 
                      id="photo-upload" 
                      type="file" 
                      accept="image/*" 
                      multiple 
                      className="hidden" 
                      onChange={handleFileChange}
                    />
                  </div>
                  {photosBase64.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-4">
                      {photosBase64.map((src, idx) => (
                        <div key={idx} className="relative group rounded-md overflow-hidden border border-border">
                          <img src={src} alt="Preview" className="w-full h-24 object-cover" />
                          <button
                            type="button"
                            onClick={() => removePhoto(idx)}
                            className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              <div className="flex justify-end pt-4 border-t border-border/50">
                <Button type="submit" disabled={createOrder.isPending} size="lg" className="w-full md:w-auto">
                  {createOrder.isPending ? "Salvando..." : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Criar Ordem de Serviço
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
