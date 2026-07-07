import { useLocation } from "wouter";
import { salvarNovaOS } from "@/lib/supabase";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import {
  CalendarIcon, ArrowLeft, Save, X, Paperclip, TrendingUp, Film,
  MapPin, Camera, LocateFixed, Loader2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  useCreateServiceOrder,
  getListServiceOrdersQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
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
import { useUnit } from "@/contexts/unit-context";
import { useCamera, useGps, useVibration } from "@/hooks/use-native";

const MARKET_RATES: Record<string, number> = {
  civil: 280,
  refrigeracao: 350,
  hidraulica: 250,
  mecanica: 320,
  eletrica: 290,
  outros: 180,
};

// Multiplier per service type (normalized to a single visit)
const TIPO_MULTIPLIER: Record<string, number> = {
  reforma: 1.5,
  revitalizacao: 1.2,
  preventiva: 0.8,
  corretiva: 1.0,
  outros: 1.0,
};

// IPCA accumulated correction factor (~4.6% per year, 2025 reference)
const IPCA_FACTOR = 1.046;
const STANDARD_HOURS = 4;

const ORIGEM_LABELS: Record<string, string> = {
  manual: "Manual",
  email: "E-mail",
  whatsapp: "WhatsApp",
  n8n: "n8n / Automação",
  api: "API",
  outro: "Outro",
};

const formSchema = z.object({
  location: z.string().min(2, "Local obrigatório"),
  description: z.string().optional(),
  category: z.enum(["manutencao", "conservacao", "limpeza", "preventiva", "construcao"]),
  priority: z.enum(["baixa", "media", "alta", "urgente"]),
  scheduledAt: z.date().optional(),
  tipo: z.enum(["reforma", "revitalizacao", "preventiva", "corretiva", "outros"]).optional(),
  formatoServico: z.enum(["civil", "refrigeracao", "hidraulica", "mecanica", "eletrica", "outros"]).optional(),
  technicianName: z.string().optional(),
  photos: z.string().optional(),
  origem: z.string().optional(),
  temPte: z.enum(["sim", "nao"]).optional(),
});

type MediaFile = { src: string; type: "image" | "video"; name: string };

export default function NovaOS() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createOrder = useCreateServiceOrder();
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const { unit } = useUnit();
  const { capture } = useCamera();
  const { getLocation } = useGps();
  const { vibrate } = useVibration();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      location: "",
      description: "",
      category: "manutencao",
      priority: "media",
      technicianName: "",
      photos: "",
      origem: "manual",
    },
  });

  const formatoServico = form.watch("formatoServico");
  const tipoOS = form.watch("tipo");
  const estimativaAuto = formatoServico
    ? Math.round(
        MARKET_RATES[formatoServico] *
        (TIPO_MULTIPLIER[tipoOS ?? "corretiva"] ?? 1.0) *
        STANDARD_HOURS *
        IPCA_FACTOR
      )
    : null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const processed = await Promise.all(
      files.map(
        (file) =>
          new Promise<MediaFile>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () =>
              resolve({
                src: reader.result as string,
                type: file.type.startsWith("video/") ? "video" : "image",
                name: file.name,
              });
            reader.onerror = reject;
          })
      )
    );
    try {
      const updated = [...mediaFiles, ...processed];
      setMediaFiles(updated);
      form.setValue("photos", JSON.stringify(updated.map((f) => f.src)));
    } catch {
      toast({ title: "Erro", description: "Falha ao processar arquivo", variant: "destructive" });
    }
  };

  const handleCameraCapture = () => {
    capture((dataUrl, mimeType) => {
      const newFile: MediaFile = {
        src: dataUrl,
        type: mimeType.startsWith("video/") ? "video" : "image",
        name: `foto-${Date.now()}.${mimeType.split("/")[1] || "jpg"}`,
      };
      const updated = [...mediaFiles, newFile];
      setMediaFiles(updated);
      form.setValue("photos", JSON.stringify(updated.map((f) => f.src)));
    });
  };

  const handleGpsCapture = async () => {
    setGpsLoading(true);
    try {
      const coords = await getLocation();
      const currentLocation = form.getValues("location");
      const gpsText = `GPS: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)} (±${coords.accuracy}m)`;
      const newLocation = currentLocation
        ? `${currentLocation} — ${gpsText}`
        : gpsText;
      form.setValue("location", newLocation, { shouldValidate: true });
      toast({ title: "Localização capturada", description: `Precisão: ±${coords.accuracy} metros` });
      vibrate(150);
    } catch (err: any) {
      toast({
        title: "Erro de GPS",
        description: err?.message ?? "Não foi possível obter a localização.",
        variant: "destructive",
      });
    } finally {
      setGpsLoading(false);
    }
  };

  const removeMedia = (index: number) => {
    const updated = mediaFiles.filter((_, i) => i !== index);
    setMediaFiles(updated);
    form.setValue("photos", JSON.stringify(updated.map((f) => f.src)));
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const tipoLabel = values.tipo ? TIPO_LABELS[values.tipo] : "";
    const formatoLabel = values.formatoServico ? FORMATO_SERVICO_LABELS[values.formatoServico] : "";
    const autoTitle =
      [formatoLabel, tipoLabel, values.location].filter(Boolean).join(" — ") ||
      `Serviço em ${values.location}`;

    const pteNote = values.temPte ? `[PTE: ${values.temPte === "sim" ? "Sim" : "Não"}]` : "";
    const description = [pteNote, values.description].filter(Boolean).join(" — ") || undefined;

    createOrder.mutate(
      {
        data: {
          title: autoTitle,
          location: values.location,
          description,
          category: values.category,
          priority: values.priority,
          scheduledAt: values.scheduledAt ? values.scheduledAt.toISOString() : undefined,
          tipo: values.tipo,
          formatoServico: values.formatoServico,
          technicianName: values.technicianName || undefined,
          photos: values.photos || undefined,
          unidade: unit,
          origem: values.origem || "manual",
          estimatedValue: estimativaAuto || undefined,
        } as any,
      },
      {
        onSuccess: (data: any) => {
          salvarNovaOS(data ?? {});
          toast({ title: "OS criada com sucesso", description: "A ordem de serviço foi registrada." });
          queryClient.invalidateQueries({ queryKey: getListServiceOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          vibrate([100, 100, 300]);
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
          <p className="text-muted-foreground mt-1">
            Unidade: <strong>{unit}</strong> · ID gerado automaticamente ao salvar.
          </p>
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
                    <FormItem className="md:col-span-2 md:w-1/2 flex flex-col">
                      <FormLabel className="text-sm font-semibold">Data do Serviço</FormLabel>
                      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-4 pr-3 py-5 text-left font-medium border-2 transition-colors",
                                field.value
                                  ? "border-primary text-foreground bg-primary/10"
                                  : "border-border hover:border-primary/60 text-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-3 h-4 w-4 text-primary shrink-0" />
                              {field.value ? (
                                <span className="text-primary font-semibold">
                                  {format(field.value, "dd/MM/yyyy")}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Escolha uma data...</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                              field.onChange(date);
                              setCalendarOpen(false);
                            }}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            initialFocus
                            className="[--cell-size:2.75rem] text-base"
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Local + GPS Button */}
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Local</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input placeholder="Ex: Andar 3, Bloco B, Corredor Principal" {...field} />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={handleGpsCapture}
                          disabled={gpsLoading}
                          title="Capturar localização GPS"
                          className="shrink-0"
                        >
                          {gpsLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <LocateFixed className="w-4 h-4 text-primary" />
                          )}
                        </Button>
                      </div>
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
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
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

                {/* Formato do Serviço */}
                <FormField
                  control={form.control}
                  name="formatoServico"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Formato do Serviço</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(FORMATO_SERVICO_LABELS).map(([val, label]) => (
                            <SelectItem key={val} value={val}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      {estimativaAuto !== null && (
                        <div className="flex items-center gap-2 mt-1.5 text-sm text-primary">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>
                            Estimativa de mercado:{" "}
                            <strong>R$ {estimativaAuto.toLocaleString("pt-BR")}</strong>
                          </span>
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
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
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
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
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

                {/* Técnico Responsável */}
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

                {/* Tem PTE */}
                <FormField
                  control={form.control}
                  name="temPte"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Tem PTE?</FormLabel>
                      <div className="flex items-center gap-4 mt-1">
                        {[
                          { value: "sim", label: "Sim" },
                          { value: "nao", label: "Não" },
                        ].map((opt) => (
                          <label
                            key={opt.value}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2 rounded-md border cursor-pointer transition-colors select-none",
                              field.value === opt.value
                                ? "border-primary bg-primary/10 text-primary font-semibold"
                                : "border-border text-muted-foreground hover:border-primary/50"
                            )}
                          >
                            <input
                              type="radio"
                              name="temPte"
                              value={opt.value}
                              checked={field.value === opt.value}
                              onChange={() => field.onChange(opt.value)}
                              className="sr-only"
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
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

                {/* Anexos */}
                <div className="md:col-span-2 space-y-3">
                  <Label>Anexos (Imagens e Vídeos)</Label>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => document.getElementById("media-upload")?.click()}
                      className="gap-2"
                    >
                      <Paperclip className="w-4 h-4" />
                      Arquivo
                    </Button>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={handleCameraCapture}
                      className="gap-2 md:hidden"
                      title="Tirar foto com câmera"
                    >
                      <Camera className="w-4 h-4" />
                      Câmera
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Imagens e vídeos suportados
                    </span>
                    <input
                      id="media-upload"
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                  {mediaFiles.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-4">
                      {mediaFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="relative group rounded-md overflow-hidden border border-border bg-muted/20"
                        >
                          {file.type === "image" ? (
                            <img src={file.src} alt="Preview" className="w-full h-24 object-cover" />
                          ) : (
                            <div className="w-full h-24 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                              <Film className="w-6 h-6 text-primary" />
                              <span className="text-[10px] text-center px-1 truncate w-full leading-tight">
                                {file.name}
                              </span>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeMedia(idx)}
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-border/50">
                <Button
                  type="submit"
                  disabled={createOrder.isPending}
                  size="lg"
                  className="w-full md:w-auto"
                >
                  {createOrder.isPending ? (
                    "Salvando..."
                  ) : (
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
