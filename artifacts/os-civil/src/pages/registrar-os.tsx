import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Save, X, Image as ImageIcon, CheckCircle2, HardHat, TrendingUp } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useCreateServiceOrder, getListServiceOrdersQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
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

export default function RegistrarOS() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createOrder = useCreateServiceOrder();
  const [photosBase64, setPhotosBase64] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState<string | null>(null);

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
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getListServiceOrdersQueryKey() });
          setSubmitted((data as any).number || "OS registrada");
          form.reset();
          setPhotosBase64([]);
        },
        onError: () => {
          toast({ title: "Erro", description: "Não foi possível registrar a OS. Tente novamente.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground dark flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center gap-3 shrink-0">
        <HardHat className="w-6 h-6 text-primary" />
        <span className="font-bold text-lg tracking-tight uppercase">OS Civil</span>
        <span className="text-muted-foreground text-sm ml-2">— Registro de Chamado</span>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-2xl space-y-6">

          {submitted ? (
            <Card className="bg-card border-border/50">
              <CardContent className="p-10 flex flex-col items-center text-center gap-4">
                <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                <div>
                  <h2 className="text-2xl font-bold">Chamado Registrado!</h2>
                  <p className="text-muted-foreground mt-1">
                    Sua ordem de serviço foi enviada com sucesso.
                  </p>
                </div>
                <div className="bg-muted rounded-lg px-6 py-3 font-mono text-primary text-xl font-bold">
                  {submitted}
                </div>
                <p className="text-sm text-muted-foreground">
                  Guarde o número acima para acompanhar seu chamado com o gestor.
                </p>
                <Button onClick={() => setSubmitted(null)} className="mt-2">
                  Registrar Novo Chamado
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Registrar Ordem de Serviço</h1>
                <p className="text-muted-foreground mt-1">
                  Preencha os dados do chamado. O número de identificação será gerado automaticamente.
                </p>
              </div>

              <Card className="bg-card border-border/50">
                <CardContent className="pt-6">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                        {/* Data do Serviço */}
                        <FormField
                          control={form.control}
                          name="scheduledAt"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2 md:w-1/2 flex flex-col justify-end">
                              <FormLabel>Data Prevista</FormLabel>
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

                        {/* Local */}
                        <FormField
                          control={form.control}
                          name="location"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Local <span className="text-destructive">*</span></FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: Andar 3, Bloco B, Corredor" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Departamento */}
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

                        {/* Tipo */}
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

                        {/* Formato + estimativa */}
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

                        {/* Técnico */}
                        <FormField
                          control={form.control}
                          name="technicianName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Técnico Responsável</FormLabel>
                              <FormControl>
                                <Input placeholder="Nome do técnico (opcional)" {...field} />
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
                              <FormLabel>Descrição do Problema</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Descreva o problema ou serviço a ser realizado..."
                                  className="min-h-[100px]"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Fotos */}
                        <div className="md:col-span-2 space-y-3">
                          <Label>Fotos do Local / Problema</Label>
                          <div className="flex items-center gap-4">
                            <Button variant="outline" type="button" onClick={() => document.getElementById("photo-upload-pub")?.click()}>
                              <ImageIcon className="w-4 h-4 mr-2" />
                              Anexar Fotos
                            </Button>
                            <input
                              id="photo-upload-pub"
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={handleFileChange}
                            />
                          </div>
                          {photosBase64.length > 0 && (
                            <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mt-3">
                              {photosBase64.map((src, idx) => (
                                <div key={idx} className="relative group rounded-md overflow-hidden border border-border">
                                  <img src={src} alt="Preview" className="w-full h-20 object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => removePhoto(idx)}
                                    className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border/50">
                        <Button type="submit" disabled={createOrder.isPending} size="lg" className="w-full">
                          {createOrder.isPending ? "Registrando..." : (
                            <>
                              <Save className="w-4 h-4 mr-2" />
                              Registrar Chamado
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
