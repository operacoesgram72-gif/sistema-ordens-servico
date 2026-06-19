import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, ArrowLeft, Save, X, Image as ImageIcon, TrendingUp } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useCreateServiceOrder, getListServiceOrdersQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { CATEGORY_LABELS, PRIORITY_LABELS, TIPO_LABELS, FORMATO_SERVICO_LABELS } from "@/lib/constants";

const MARKET_RATES: Record<string, number> = {
  civil: 280,
  refrigeracao: 350,
  hidraulica: 250,
  mecanica: 320,
  eletrica: 290,
  outros: 180,
};

const formSchema = z.object({
  location: z.string().min(2, "Local obrigatório"),
  department: z.string().optional(),
  description: z.string().optional(),
  category: z.enum(["manutencao", "conservacao", "limpeza", "preventiva", "construcao"]),
  priority: z.enum(["baixa", "media", "alta", "urgente"]),
  scheduledAt: z.date().optional(),
  tipo: z.enum(["reforma", "revitalizacao", "preventiva", "corretiva", "outros"]).optional(),
  formatoServico: z.enum(["civil", "refrigeracao", "hidraulica", "mecanica", "eletrica", "outros"]).optional(),
  technicianName: z.string().optional(),
  photos: z.string().optional(),
});

export default function NovaOS() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createOrder = useCreateServiceOrder();
  const [photosBase64, setPhotosBase64] = useState<string[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      location: "",
      department: "",
      description: "",
      category: "manutencao",
      priority: "media",
      technicianName: "",
      photos: "",
    },
  });

  const formatoServico = form.watch("formatoServico");
  const estimativaAuto = formatoServico ? MARKET_RATES[formatoServico] : null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const base64Promises = files.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
        })
    );
    try {
      const base64Files = await Promise.all(base64Promises);
      const newPhotos = [...photosBase64, ...base64Files];
      setPhotosBase64(newPhotos);
      form.setValue("photos", JSON.stringify(newPhotos));
    } catch {
      toast({ title: "Erro", description: "Falha ao processar imagens", variant: "destructive" });
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = photosBase64.filter((_, i) => i !== index);
    setPhotosBase64(newPhotos);
    form.setValue("photos", JSON.stringify(newPhotos));
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const tipoLabel = values.tipo ? TIPO_LABELS[values.tipo] : "";
    const formatoLabel = values.formatoServico ? FORMATO_SERVICO_LABELS[values.formatoServico] : "";
    const autoTitle = [formatoLabel, tipoLabel, values.location]
      .filter(Boolean)
      .join(" — ") || `Serviço em ${values.location}`;

    createOrder.mutate(
      {
        data: {
          title: autoTitle,
          location: values.location,
          department: values.department || undefined,
          description: values.description || undefined,
          category: values.category,
          priority: values.priority,
          scheduledAt: values.scheduledAt ? values.scheduledAt.toISOString() : undefined,
          tipo: values.tipo,
          formatoServico: values.formatoServico,
          technicianName: values.technicianName || undefined,
          photos: values.photos || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "OS criada com sucesso", description: "A ordem de serviço foi registrada." });
          queryClient.invalidateQueries({ queryKey: getListServiceOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          setLocation("/ordens");
        },
        onError: () => {
          toast({ title: "Erro", description: "Não foi possível criar a OS.", variant: "destructive" });
        },
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
          <p className="text-muted-foreground mt-1">O ID é gerado automaticamente ao salvar.</p>
        </div>
      </div>

      <Card className="bg-card border-border/50">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Data do Serviço */}
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
                              variant="outline"
                              className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                              {field.value ? format(field.value, "dd/MM/yyyy") : <span>Escolha uma data...</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Local / Departamento */}
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Local</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Andar 3, Bloco B, Corredor Principal" {...field} />
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
                        <Input placeholder="Ex: RH, Financeiro, Manutenção" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Tipo de Serviço */}
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

                {/* Formato do Serviço + estimativa automática */}
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
                      {estimativaAuto !== null && (
                        <div className="flex items-center gap-2 mt-1.5 text-sm text-amber-500">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>Estimativa de mercado: <strong>R$ {estimativaAuto.toLocaleString("pt-BR")}</strong></span>
                        </div>
                      )}
                    </FormItem>
                  )}
                />

                {/* Categoria */}
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

                {/* Prioridade */}
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

                {/* Técnico Responsável — texto livre */}
                <FormField
                  control={form.control}
                  name="technicianName"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Técnico Responsável</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do técnico responsável" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Descrição */}
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

                {/* Fotos */}
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
