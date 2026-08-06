import { useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import {
  CalendarIcon, ArrowLeft, Save, X, Paperclip, TrendingUp, Film,
  MapPin, Camera, LocateFixed, Loader2, Plus, UserPlus, AlertTriangle,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useMemo } from "react";

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
import { useGps, useVibration } from "@/hooks/use-native";
import { isImageFile, isVideoFile, getVideoContentType, compressImage, MAX_COMPRESS_BYTES } from "@/lib/media-utils";

const MARKET_RATES: Record<string, number> = {
  civil: 280,
  refrigeracao: 350,
  hidraulica: 250,
  mecanica: 320,
  eletrica: 290,
  ronda: 120,
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
  formatoServico: z.enum(["civil", "refrigeracao", "hidraulica", "mecanica", "eletrica", "ronda", "outros"]).optional(),
  technicianName: z.string().optional(),
  photos: z.string().optional(),
  origem: z.string().optional(),
  temPte: z.enum(["sim", "nao"]).optional(),
  statusInicial: z.enum(["aberta", "em_andamento", "concluida", "cancelada", "impedimento"]).optional(),
  motivoImpedimento: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.statusInicial === "impedimento" && !data.motivoImpedimento?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Motivo do Impedimento é obrigatório",
      path: ["motivoImpedimento"],
    });
  }
});

type MediaFile = { src: string; type: "image" | "video"; name: string };

export default function NovaOS() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createOrder = useCreateServiceOrder();
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  // Dynamic technician list — at least one entry; joined with " / " on submit
  const [technicians, setTechnicians] = useState<string[]>([""]);

  type VideoEntry = {
    id: string; name: string; localUrl: string;
    objectPath: string | null; uploading: boolean; progress: number; error: string | null;
  };
  const [videoEntries, setVideoEntries] = useState<VideoEntry[]>([]);
  const videoUrlsRef = useRef<string[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const { unit } = useUnit();
  const { getLocation } = useGps();

  // Tracks in-flight FileReader operations to prevent submitting before
  // base64 encoding completes (race condition on slow Android devices).
  const processingPhotosRef = useRef(0);
  const { vibrate } = useVibration();

  // Optional pre-fill from the calendar's "duplo clique no dia" shortcut
  // (?data=YYYY-MM-DD). Purely a convenience default — absent param behaves
  // exactly as before (no scheduledAt default).
  const prefilledDate = useMemo(() => {
    const raw = new URLSearchParams(search).get("data");
    if (!raw) return undefined;
    const parsed = new Date(`${raw}T00:00:00`);
    return isNaN(parsed.getTime()) ? undefined : parsed;
  }, [search]);

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
      scheduledAt: prefilledDate,
      statusInicial: "aberta",
      motivoImpedimento: "",
    },
  });

  // Revoke video object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => { videoUrlsRef.current.forEach(URL.revokeObjectURL); };
  }, []);

  const uploadVideoToStorage = async (file: File, entryId: string) => {
    try {
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
      // getVideoContentType falls back to "video/mp4" when the browser omits the
      // MIME type (common on Android Chrome, Samsung Internet, Google Drive picker).
      // The server rejects empty/non-video content types with HTTP 400.
      const effectiveMimeType = getVideoContentType(file);
      const resp = await fetch(`${BASE}/api/storage/uploads/video-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: effectiveMimeType }),
      });
      if (!resp.ok) {
        let errBody: unknown;
        try { errBody = await resp.json(); } catch { errBody = await resp.text().catch(() => "(unreadable)"); }
        console.error("[nova-os video-url] server error", { status: resp.status, body: errBody, contentType: effectiveMimeType, fileName: file.name });
        throw new Error("Falha ao obter URL de envio");
      }
      const { uploadURL, objectPath } = await resp.json() as { uploadURL: string; objectPath: string };

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadURL);
        xhr.setRequestHeader("Content-Type", effectiveMimeType);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setVideoEntries(prev => prev.map(v => v.id === entryId ? { ...v, progress: pct } : v));
          }
        };
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
        xhr.onerror = () => reject(new Error("Falha de rede ao enviar vídeo"));
        xhr.send(file);
      });

      setVideoEntries(prev => prev.map(v => v.id === entryId ? { ...v, uploading: false, progress: 100, objectPath } : v));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setVideoEntries(prev => prev.map(v => v.id === entryId ? { ...v, uploading: false, error: msg } : v));
      toast({ title: "Falha ao enviar vídeo", description: msg, variant: "destructive" });
    }
  };

  const formatoServico = form.watch("formatoServico");
  const tipoOS = form.watch("tipo");
  const statusInicial = form.watch("statusInicial");
  const estimativaAuto = formatoServico
    ? Math.round(
        MARKET_RATES[formatoServico] *
        (TIPO_MULTIPLIER[tipoOS ?? "corretiva"] ?? 1.0) *
        STANDARD_HOURS *
        IPCA_FACTOR
      )
    : null;

  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;    // 8 MB per photo
  const MAX_VIDEO_BYTES = 300 * 1024 * 1024;  // 300 MB per video

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    // Camera inputs (capture="environment") may deliver files with file.type=""
    // AND no extension in file.name on some Android / iOS OEM browsers (e.g.
    // Samsung Internet delivers file.name="image" with no .jpg). isImageFile()
    // would return false for those files and silently drop the photo. Since the
    // input has accept="image/*", every file from the camera IS an image — skip
    // the type check for camera files entirely and let compressImage handle them.
    const fromCamera = e.target.id === "nova-os-camera";
    const videoList  = files.filter(isVideoFile);
    const imageList  = fromCamera ? files : files.filter(f => isImageFile(f) && !isVideoFile(f));

    // ── Videos: upload to storage immediately (no base64 → no crash) ────
    for (const file of videoList) {
      if (file.size > MAX_VIDEO_BYTES) {
        toast({ title: "Vídeo muito grande", description: `"${file.name}" ultrapassa 300 MB.`, variant: "destructive" });
        continue;
      }
      const entryId = crypto.randomUUID();
      const localUrl = URL.createObjectURL(file);
      videoUrlsRef.current.push(localUrl);
      setVideoEntries(prev => [...prev, { id: entryId, name: file.name, localUrl, objectPath: null, uploading: true, progress: 0, error: null }]);
      uploadVideoToStorage(file, entryId);
    }

    // ── Images: compress then base64 ─────────────────────────────────────
    // Camera photos use MAX_COMPRESS_BYTES (50 MB) — compressImage will shrink
    // a 12 MP raw photo (~8 MB) to ~250 KB. The 50 MB cap prevents Canvas OOM
    // before the resize starts. Gallery photos keep the 8 MB guard.
    const sizeLimit = fromCamera ? MAX_COMPRESS_BYTES : MAX_IMAGE_BYTES;
    const oversized = imageList.filter(f => f.size > sizeLimit);
    if (oversized.length > 0) {
      toast({ title: "Imagem muito grande", description: `${oversized.length} arquivo(s) ignorado(s) — máx. ${fromCamera ? "50" : "8"} MB por imagem.`, variant: "destructive" });
    }
    const validImages = imageList.filter(f => f.size <= sizeLimit);
    if (validImages.length > 0) {
      // Increment BEFORE starting compression so onSubmit sees the in-flight
      // operation even if the user taps submit in the same micro-task.
      processingPhotosRef.current++;
      try {
        // compressImage resizes to 1920 px max and re-encodes as JPEG 0.82.
        // Falls back to plain FileReader if the Canvas context is unavailable.
        const b64s = await Promise.all(validImages.map(f => compressImage(f)));
        const newImages: MediaFile[] = b64s.map((src, i) => ({ src, type: "image" as const, name: validImages[i].name }));
        // Use functional update to avoid stale closure if multiple handlers run concurrently
        setMediaFiles(prev => [...prev, ...newImages]);
      } catch {
        toast({ title: "Erro", description: "Falha ao processar imagem", variant: "destructive" });
      } finally {
        processingPhotosRef.current--;
      }
    }

    e.target.value = "";
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
    // onSubmit reads mediaFiles state directly — no form.setValue needed
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeVideoEntry = (id: string) => {
    setVideoEntries(prev => {
      const item = prev.find(v => v.id === id);
      if (item) {
        URL.revokeObjectURL(item.localUrl);
        videoUrlsRef.current = videoUrlsRef.current.filter(u => u !== item.localUrl);
      }
      return prev.filter(v => v.id !== id);
    });
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    // Block while FileReader is still encoding a photo — race condition on slow Android
    if (processingPhotosRef.current > 0) {
      toast({ title: "Aguarde", description: "Processando imagem(ns), tente novamente em instantes." });
      return;
    }

    // Block while any video is still uploading
    const pendingVideos = videoEntries.filter(v => v.uploading);
    if (pendingVideos.length > 0) {
      toast({
        title: "Aguarde o envio dos vídeos",
        description: `${pendingVideos.length} vídeo(s) ainda sendo enviado(s). Aguarde antes de salvar.`,
        variant: "destructive",
      });
      return;
    }

    // Warn about failed video uploads (non-blocking — OS is still saved with photos)
    const failedVideos = videoEntries.filter(v => v.error);
    if (failedVideos.length > 0) {
      toast({
        title: `${failedVideos.length} vídeo(s) com erro não serão salvos`,
        description: "A OS será criada sem esses vídeos.",
        variant: "destructive",
      });
    }

    const tipoLabel = values.tipo ? TIPO_LABELS[values.tipo] : "";
    const formatoLabel = values.formatoServico ? FORMATO_SERVICO_LABELS[values.formatoServico] : "";
    const autoTitle =
      [formatoLabel, tipoLabel, values.location].filter(Boolean).join(" — ") ||
      `Serviço em ${values.location}`;

    const pteNote = values.temPte ? `[PTE: ${values.temPte === "sim" ? "Sim" : "Não"}]` : "";
    const description = [pteNote, values.description].filter(Boolean).join(" — ") || undefined;

    // Build notes: prepend impedimento block when status inicial is impedimento
    const impedimentoNote = values.statusInicial === "impedimento" && values.motivoImpedimento?.trim()
      ? `[IMPEDIMENTO] ${values.motivoImpedimento.trim()}`
      : undefined;
    const notesField = impedimentoNote || undefined;

    // Join the dynamic technician list (skip empty entries)
    const technicianName = technicians.filter(t => t.trim()).join(" / ") || undefined;

    // Merge base64 photos (from mediaFiles state) and successfully uploaded video
    // paths (from videoEntries state) into one array — videoEntries was previously
    // ignored here, causing all video uploads to be silently discarded.
    const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
    const base64Photos = mediaFiles.filter(f => f.type === "image").map(f => f.src);
    const videoUrls = videoEntries
      .filter(v => v.objectPath && !v.error)
      .map(v => `${BASE}/api/storage${v.objectPath}`);
    const allMedia = [...base64Photos, ...videoUrls];
    const photosField = allMedia.length > 0 ? JSON.stringify(allMedia) : undefined;

    createOrder.mutate(
      {
        data: {
          title: autoTitle,
          location: values.location,
          description,
          notes: notesField,
          status: values.statusInicial ?? "aberta",
          category: values.category,
          priority: values.priority,
          scheduledAt: values.scheduledAt ? values.scheduledAt.toISOString() : undefined,
          tipo: values.tipo,
          formatoServico: values.formatoServico,
          technicianName,
          photos: photosField,
          unidade: unit,
          origem: values.origem || "manual",
          estimatedValue: estimativaAuto || undefined,
        } as any,
      },
      {
        onSuccess: (_data: any) => {
          toast({ title: "OS criada com sucesso", description: "A ordem de serviço foi registrada." });
          // Invalidate all data that depends on OS records so every view
          // (list, dashboard, indicators, timeline) refreshes automatically.
          queryClient.invalidateQueries({ queryKey: getListServiceOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-indicators"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-timeline"] });
          queryClient.invalidateQueries({ queryKey: ["available-years"] });
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
    <div className="flex flex-col flex-1 min-h-0">
      <div className="bg-background border-b border-border/30 shrink-0">
        <div className="px-6 md:px-8 pt-6 pb-4 flex items-center gap-4">
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
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="px-6 md:px-8 pb-8 pt-4 max-w-4xl mx-auto space-y-6">

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

                {/* Status Inicial — inclui opção Impedimento */}
                <FormField
                  control={form.control}
                  name="statusInicial"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status Inicial</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? "aberta"}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="aberta">Aberta</SelectItem>
                          <SelectItem value="em_andamento">Em Andamento</SelectItem>
                          <SelectItem value="concluida">Concluída</SelectItem>
                          <SelectItem value="cancelada">Cancelada</SelectItem>
                          <SelectItem value="impedimento">
                            <span className="flex items-center gap-2">
                              <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                              Impedimento
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Motivo do Impedimento — só aparece quando status = impedimento */}
                {statusInicial === "impedimento" && (
                  <FormField
                    control={form.control}
                    name="motivoImpedimento"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel className="text-orange-500 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Motivo do Impedimento <span className="text-destructive ml-0.5">*</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Descreva o impedimento externo que bloqueia a execução..."
                            className="min-h-[90px] border-orange-500/40 focus-visible:ring-orange-500/30"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Técnicos Responsáveis — lista dinâmica (mínimo 1) */}
                <div className="md:col-span-2 space-y-2">
                  <Label>Técnicos Responsáveis</Label>
                  <div className="space-y-2">
                    {technicians.map((name, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <Input
                          placeholder={idx === 0 ? "Nome do técnico responsável" : `Técnico ${idx + 1}`}
                          value={name}
                          onChange={e => setTechnicians(prev => prev.map((t, i) => i === idx ? e.target.value : t))}
                        />
                        {technicians.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setTechnicians(prev => prev.filter((_, i) => i !== idx))}
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 mt-1"
                    onClick={() => setTechnicians(prev => [...prev, ""])}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Adicionar Técnico
                  </Button>
                </div>

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
                    {/* Galeria: aceita imagens e vídeos */}
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => document.getElementById("nova-os-gallery")?.click()}
                      className="gap-2"
                    >
                      <Paperclip className="w-4 h-4" />
                      Arquivo
                    </Button>
                    {/* Câmera: apenas fotos — gravação de vídeo removida por instabilidade */}
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => document.getElementById("nova-os-camera")?.click()}
                      className="gap-2 md:hidden"
                      title="Tirar foto com câmera"
                    >
                      <Camera className="w-4 h-4" />
                      Câmera
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Imagens e vídeos suportados
                    </span>
                    <input id="nova-os-gallery" type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileChange} />
                    <input id="nova-os-camera" type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                  </div>
                  {(mediaFiles.length > 0 || videoEntries.length > 0) && (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-4">
                      {/* Fotos (base64) */}
                      {mediaFiles.map((file, idx) => (
                        <div
                          key={`img-${idx}`}
                          className="relative group rounded-md overflow-hidden border border-border bg-muted/20"
                        >
                          <img src={file.src} alt="Preview" className="w-full h-24 object-cover" />
                          <button
                            type="button"
                            onClick={() => removeMedia(idx)}
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {/* Vídeos em upload para storage */}
                      {videoEntries.map((v) => (
                        <div key={v.id} className="relative group rounded-md overflow-hidden border border-primary/40 bg-black">
                          <video src={v.localUrl} className="w-full h-24 object-cover" muted playsInline preload="metadata" />
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-1">
                            <Film className="w-5 h-5 text-white/80 drop-shadow" />
                            {v.uploading && <span className="text-[10px] text-white/80 font-mono">{v.progress}%</span>}
                            {v.error && <span className="text-[10px] text-red-400 font-mono">Falha</span>}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeVideoEntry(v.id)}
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
      </div>
    </div>
  );
}
