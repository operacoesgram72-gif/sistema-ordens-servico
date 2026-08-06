import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import {
  CalendarIcon, Save, X, Image as ImageIcon, CheckCircle2, TrendingUp,
  CalendarDays, ArrowLeft, Camera, Video, WifiOff, Clock, UserPlus, Plus,
} from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";

import { useCreateServiceOrder, getListServiceOrdersQueryKey } from "@workspace/api-client-react";
import { useSystemStatus } from "@/hooks/use-system-status";
import { isImageFile, isVideoFile, getVideoContentType, compressImage, MAX_COMPRESS_BYTES } from "@/lib/media-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { CATEGORY_LABELS, PRIORITY_LABELS, TIPO_LABELS, FORMATO_SERVICO_LABELS, STATUS_LABELS } from "@/lib/constants";

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
  photos: z.string().optional(),
  temPte: z.enum(["sim", "nao"]).optional(),
  status: z.enum(["aberta", "em_andamento", "concluida", "cancelada", "impedimento"]).optional(),
});

export default function RegistrarOS() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createOrder = useCreateServiceOrder();
  const [, setLocation] = useLocation();
  const [photosBase64, setPhotosBase64] = useState<string[]>([]);
  const [technicians, setTechnicians] = useState<string[]>([""]);

  type VideoEntry = {
    id: string; name: string; localUrl: string;
    objectPath: string | null; uploading: boolean; progress: number; error: string | null;
  };
  const [videoFiles, setVideoFiles] = useState<VideoEntry[]>([]);
  const videoUrlsRef = useRef<string[]>([]);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [submittedOffline, setSubmittedOffline] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const unitFromUrl = searchParams.get("u") || "AM";
  const isDirectLink = searchParams.get("direto") === "1";
  const { isOnline, pendingCount, enqueue } = useOfflineQueue();
  const { systemActive } = useSystemStatus();

  const goBack = () => {
    setCalendarOpen(false);
    setLocation(`/registrar?u=${unitFromUrl}`);
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      location: "",
      department: "",
      description: "",
      category: "manutencao",
      priority: "media",
      photos: "",
      temPte: undefined,
    },
  });

  const formatoServico = form.watch("formatoServico");
  const tipoOS = form.watch("tipo");
  const TIPO_MULT: Record<string, number> = { reforma: 1.5, revitalizacao: 1.2, preventiva: 0.8, corretiva: 1.0, outros: 1.0 };
  const estimativaAuto = formatoServico
    ? Math.round(MARKET_RATES[formatoServico] * (TIPO_MULT[tipoOS ?? "corretiva"] ?? 1.0) * 4 * 1.046)
    : null;

  // Revoke object URLs when component unmounts to avoid memory leaks
  useEffect(() => {
    return () => { videoUrlsRef.current.forEach(URL.revokeObjectURL); };
  }, []);

  // Tracks the number of in-flight FileReader operations.
  // Used in onSubmit to prevent submitting before base64 encoding completes.
  // A race condition is possible on slow Android devices: the user can tap
  // "Registrar" within the ~200-500ms window while FileReader is still running,
  // causing photosBase64 = [] in the onSubmit closure even though a photo was selected.
  const processingPhotosRef = useRef(0);

  const uploadVideoToStorage = async (file: File, entryId: string) => {
    try {
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
      // Use extension-based fallback when the browser omits the MIME type
      // (common on Android Chrome, Samsung Internet, some iOS pickers).
      // The server rejects empty/non-video content types, so we must supply a valid one.
      const effectiveMimeType = getVideoContentType(file);
      const resp = await fetch(`${BASE}/api/storage/uploads/video-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: effectiveMimeType }),
      });
      if (!resp.ok) {
        // Log the full server response for diagnostics — helps identify the
        // exact failure reason without needing to reproduce on device.
        let errBody: unknown;
        try { errBody = await resp.json(); } catch { errBody = await resp.text().catch(() => "(unreadable)"); }
        console.error("[video-url] server error", { status: resp.status, body: errBody, contentType: effectiveMimeType, fileName: file.name, fileType: file.type, fileSize: file.size });
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
            setVideoFiles(prev => prev.map(v => v.id === entryId ? { ...v, progress: pct } : v));
          }
        };
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
        xhr.onerror = () => reject(new Error("Falha de rede ao enviar vídeo"));
        xhr.send(file);
      });

      setVideoFiles(prev => prev.map(v => v.id === entryId ? { ...v, uploading: false, progress: 100, objectPath } : v));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setVideoFiles(prev => prev.map(v => v.id === entryId ? { ...v, uploading: false, error: msg } : v));
      toast({ title: "Falha ao enviar vídeo", description: msg, variant: "destructive" });
    }
  };

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
    const fromCamera = e.target.id === "photo-camera-pub";
    const imageFiles = fromCamera ? files : files.filter(isImageFile);
    const videoList  = files.filter(isVideoFile);

    // ── Handle videos: upload to storage immediately (no base64 → no crash) ─
    for (const file of videoList) {
      if (file.size > MAX_VIDEO_BYTES) {
        toast({
          title: "Vídeo muito grande",
          description: `"${file.name}" ultrapassa 300 MB.`,
          variant: "destructive",
        });
        continue;
      }
      const entryId = crypto.randomUUID();
      const localUrl = URL.createObjectURL(file);
      videoUrlsRef.current.push(localUrl);
      setVideoFiles(prev => [...prev, { id: entryId, name: file.name, localUrl, objectPath: null, uploading: true, progress: 0, error: null }]);
      uploadVideoToStorage(file, entryId);
    }

    // ── Handle images: compress then base64 ──────────────────────────────
    // Camera photos use MAX_COMPRESS_BYTES (50 MB) — compressImage will shrink
    // a 12 MP raw photo (~8 MB) to ~250 KB. The 50 MB cap prevents Canvas OOM
    // on very large files before the resize even starts.
    // Gallery photos keep the original 8 MB guard since they're already
    // pre-compressed by the gallery app.
    const sizeLimit = fromCamera ? MAX_COMPRESS_BYTES : MAX_IMAGE_BYTES;
    const oversized = imageFiles.filter(f => f.size > sizeLimit);
    if (oversized.length > 0) {
      toast({
        title: "Imagem muito grande",
        description: `${oversized.length} arquivo(s) ignorado(s) — máximo ${fromCamera ? "50" : "8"} MB por imagem.`,
        variant: "destructive",
      });
    }
    const validImages = imageFiles.filter(f => f.size <= sizeLimit);
    if (validImages.length > 0) {
      // Increment BEFORE starting compression so onSubmit sees the in-flight
      // operation even if the user taps submit in the same micro-task.
      processingPhotosRef.current++;
      try {
        // compressImage resizes to 1920 px max and re-encodes as JPEG 0.82.
        // On camera failure path it falls back to plain FileReader so no photo
        // is ever silently dropped due to a Canvas context unavailability.
        const base64Files = await Promise.all(validImages.map(f => compressImage(f)));
        // Use functional update so this never clobbers photos added by a
        // concurrent handler call (e.g. gallery + camera selected in quick succession).
        setPhotosBase64(prev => [...prev, ...base64Files]);
      } catch {
        toast({ title: "Erro", description: "Falha ao processar imagens", variant: "destructive" });
      } finally {
        processingPhotosRef.current--;
      }
    }

    // Reset input so the same file can be selected again
    e.target.value = "";
  };

  const removePhoto = (index: number) => {
    setPhotosBase64(prev => prev.filter((_, i) => i !== index));
  };

  const removeVideo = (id: string) => {
    setVideoFiles(prev => {
      const item = prev.find(v => v.id === id);
      if (item) {
        URL.revokeObjectURL(item.localUrl);
        videoUrlsRef.current = videoUrlsRef.current.filter(u => u !== item.localUrl);
      }
      return prev.filter(v => v.id !== id);
    });
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    // Block while FileReader is still base64-encoding a photo.
    // Race condition on slow Android: camera delivers the file, the user taps
    // "Registrar" before readAsDataURL finishes → photosBase64 is still [] in the
    // closure → photo silently excluded. processingPhotosRef prevents that.
    if (processingPhotosRef.current > 0) {
      toast({
        title: "Aguarde",
        description: "Processando imagem(ns), tente novamente em instantes.",
      });
      return;
    }

    // Block submission while any video is still uploading
    const pendingVideos = videoFiles.filter(v => v.uploading);
    if (pendingVideos.length > 0) {
      toast({
        title: "Aguarde o envio dos vídeos",
        description: `${pendingVideos.length} vídeo(s) ainda sendo enviado(s). Aguarde antes de registrar.`,
        variant: "destructive",
      });
      return;
    }

    // Warn about failed video uploads — they will be excluded from the payload automatically
    // (filtered by v.objectPath && !v.error below). Do NOT return/block: the user must
    // still be able to save the OS with their photos even if a video upload failed.
    const failedVideos = videoFiles.filter(v => v.error);
    if (failedVideos.length > 0) {
      toast({
        title: `${failedVideos.length} vídeo(s) com erro não serão salvos`,
        description: "A OS será registrada sem esses vídeos. Remova-os e grave novamente se necessário.",
        variant: "destructive",
      });
      // intentionally no return — submission continues without the failed videos
    }

    const tipoLabel = values.tipo ? TIPO_LABELS[values.tipo] : "";
    const formatoLabel = values.formatoServico ? FORMATO_SERVICO_LABELS[values.formatoServico] : "";
    const autoTitle = [formatoLabel, tipoLabel, values.location]
      .filter(Boolean)
      .join(" — ") || `Serviço em ${values.location}`;

    const pteNote = values.temPte ? `[PTE: ${values.temPte === "sim" ? "Sim" : "Não"}]` : "";
    const description = [pteNote, values.description].filter(Boolean).join(" — ") || undefined;

    // Merge base64 photos and successfully uploaded video storage paths into one array.
    // Videos from storage are referenced as absolute API paths so the detail page can
    // stream them on demand without bloating the payload with base64 data.
    const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
    // objectPath is already normalized as "/objects/UUID" by the server, so just
    // append it to "/api/storage" — do NOT add "/objects/" again.
    const videoUrls = videoFiles
      .filter(v => v.objectPath && !v.error)
      .map(v => `${BASE}/api/storage${v.objectPath}`);
    const allMedia = [...photosBase64, ...videoUrls];
    const photosField = allMedia.length > 0 ? JSON.stringify(allMedia) : undefined;

    const payload = {
      title: autoTitle,
      location: values.location,
      department: values.department || undefined,
      description,
      category: values.category,
      priority: values.priority,
      scheduledAt: values.scheduledAt ? values.scheduledAt.toISOString() : undefined,
      tipo: values.tipo,
      formatoServico: values.formatoServico,
      technicianName: technicians.filter(t => t.trim()).join(" / ") || undefined,
      photos: photosField,
      unidade: unitFromUrl,
      origem: "manual",
      estimatedValue: estimativaAuto || undefined,
      status: values.status || undefined,
    };

    // Offline: queue submission and show deferred success
    if (!isOnline) {
      const persisted = enqueue({
        type: "create-os",
        endpoint: "/api/service-orders",
        method: "POST",
        body: payload as Record<string, unknown>,
        unit: unitFromUrl,
        label: `OS — ${autoTitle}`,
      });
      if (!persisted) {
        toast({
          title: "Não foi possível salvar offline",
          description: "Memória local insuficiente (fotos podem estar muito grandes). Conecte-se à internet e tente novamente.",
          variant: "destructive",
        });
        return;
      }
      setSubmittedOffline(true);
      setSubmitted("Em fila — aguardando conexão");
      form.reset();
      setPhotosBase64([]);
      return;
    }

    // Online: submit immediately
    createOrder.mutate(
      { data: payload as any },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getListServiceOrdersQueryKey() });
          setSubmittedOffline(false);
          setSubmitted((data as any).number || "OS registrada");
          form.reset();
          setPhotosBase64([]);
        },
        onError: (error) => {
          // navigator.onLine can report "online" while the server is actually
          // unreachable (weak signal, captive portal, etc.).  When the mutation
          // fails with a network-level TypeError, fall back to the offline queue
          // so the submission is not silently lost.
          const isNetErr =
            error instanceof TypeError &&
            /fetch|network|failed|load/i.test(error.message);
          if (isNetErr) {
            const persisted = enqueue({
              type: "create-os",
              endpoint: "/api/service-orders",
              method: "POST",
              body: payload as Record<string, unknown>,
              unit: unitFromUrl,
              label: `OS — ${autoTitle}`,
            });
            if (persisted) {
              setSubmittedOffline(true);
              setSubmitted("Em fila — aguardando conexão");
              form.reset();
              setPhotosBase64([]);
              return;
            }
          }
          toast({
            title: "Erro ao registrar OS",
            description: "Verifique sua conexão e tente novamente.",
            variant: "destructive",
          });
        },
      }
    );
  };

  // System inactive gate — show before rendering the full form
  if (!systemActive) {
    return (
      <div className="min-h-screen bg-background text-foreground dark flex flex-col">
        <header className="border-b border-border bg-card px-6 py-3 flex items-center gap-4 shrink-0">
          <img src="/logo-amazonica.png" alt="Logo Rede Amazônica" className="h-10 w-10 object-contain" />
          <div className="border-l border-border pl-4">
            <div className="font-bold text-sm leading-tight">Grupo Rede Amazônica</div>
            <div className="text-xs text-muted-foreground">Departamento: Operações</div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
              <WifiOff className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold">Sistema Temporariamente Indisponível</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              O acesso ao sistema foi suspenso temporariamente por decisão administrativa.
              Por favor, aguarde a reativação ou entre em contato com o responsável.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground dark flex flex-col">
      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-amber-500/90 text-black text-xs font-semibold px-4 py-2 flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          Sem conexão — OS será salva localmente e enviada ao reconectar
          {pendingCount > 0 && ` (${pendingCount} em fila)`}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-3 flex items-center gap-4 shrink-0">
        <img
          src="/logo-amazonica.png"
          alt="Logo Rede Amazônica"
          className="h-10 w-10 object-contain"
        />
        <div className="border-l border-border pl-4">
          <div className="font-bold text-sm leading-tight">Grupo Rede Amazônica</div>
          <div className="text-xs text-muted-foreground">Departamento: Operações</div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs font-semibold text-primary uppercase tracking-widest hidden sm:inline">
            Painel de Serviços
          </span>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">
            {unitFromUrl}
          </span>
          {!isDirectLink && (
            <button
              type="button"
              onClick={goBack}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Menu
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto min-h-0 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-2xl space-y-6">

          {submitted ? (
            <Card className="bg-card border-border/50">
              <CardContent className="p-10 flex flex-col items-center text-center gap-4">
                {submittedOffline
                  ? <Clock className="w-16 h-16 text-amber-500" />
                  : <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                }
                <div>
                  <h2 className="text-2xl font-bold">
                    {submittedOffline ? "Chamado Salvo Localmente!" : "Chamado Registrado!"}
                  </h2>
                  <p className="text-muted-foreground mt-1">
                    {submittedOffline
                      ? "Sem conexão no momento. O chamado será enviado automaticamente ao reconectar."
                      : "Sua ordem de serviço foi enviada com sucesso."
                    }
                  </p>
                </div>
                {!submittedOffline && (
                  <div className="bg-muted rounded-lg px-6 py-3 font-mono text-primary text-xl font-bold">
                    {submitted}
                  </div>
                )}
                {!submittedOffline && (
                  <p className="text-sm text-muted-foreground">
                    Guarde o número acima para acompanhar seu chamado com o gestor.
                  </p>
                )}
                {submittedOffline && (
                  <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
                    <WifiOff className="w-3.5 h-3.5 shrink-0" />
                    {pendingCount} registro{pendingCount !== 1 ? "s" : ""} aguardando sincronização
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full">
                  <Button onClick={() => { setSubmitted(null); setSubmittedOffline(false); }} variant="outline" className="flex-1">
                    Registrar Novo Chamado
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 gap-2"
                    onClick={goBack}
                  >
                    <CalendarDays className="w-4 h-4" />
                    Voltar ao Menu
                  </Button>
                </div>
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
                              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
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

                        {/* Status inicial */}
                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value || "aberta"}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Aberta" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {Object.entries(STATUS_LABELS).map(([val, label]) => (
                                    <SelectItem key={val} value={val}>{label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Técnicos Responsáveis — lista dinâmica */}
                        <div className="md:col-span-2 space-y-2">
                          <Label>Técnicos Responsáveis</Label>
                          <div className="space-y-2">
                            {technicians.map((name, idx) => (
                              <div key={idx} className="flex gap-2 items-center">
                                <Input
                                  placeholder={idx === 0 ? "Nome do técnico responsável (opcional)" : `Técnico ${idx + 1}`}
                                  value={name}
                                  onChange={e => setTechnicians(prev => prev.map((t, i) => i === idx ? e.target.value : t))}
                                />
                                {technicians.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => setTechnicians(prev => prev.filter((_, i) => i !== idx))}
                                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => setTechnicians(prev => [...prev, ""])}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mt-1"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Adicionar Técnico
                          </button>
                        </div>

                        {/* Tem PTE */}
                        <FormField
                          control={form.control}
                          name="temPte"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>Tem PTE?</FormLabel>
                              <div className="flex items-center gap-4 mt-1">
                                {["sim", "nao"].map((v) => (
                                  <label
                                    key={v}
                                    className={cn(
                                      "flex items-center gap-2 px-4 py-2 rounded-md border cursor-pointer transition-colors select-none",
                                      field.value === v
                                        ? "border-primary bg-primary/10 text-primary font-semibold"
                                        : "border-border text-muted-foreground hover:border-primary/50"
                                    )}
                                  >
                                    <input
                                      type="radio"
                                      name="temPte"
                                      value={v}
                                      checked={field.value === v}
                                      onChange={() => field.onChange(v)}
                                      className="sr-only"
                                    />
                                    {v === "sim" ? "Sim" : "Não"}
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
                          <Label>Fotos / Vídeos do Local</Label>
                          <div className="flex flex-wrap items-center gap-3">
                            <Button variant="outline" type="button" onClick={() => document.getElementById("photo-upload-pub")?.click()}>
                              <ImageIcon className="w-4 h-4 mr-2" />
                              Galeria
                            </Button>
                            <Button variant="outline" type="button" onClick={() => document.getElementById("photo-camera-pub")?.click()}>
                              <Camera className="w-4 h-4 mr-2" />
                              Tirar Foto
                            </Button>
                            {/*
                              Gallery: accept images AND videos — handleFileChange
                              routes videos to storage upload automatically.
                              Video camera recording removed for stability; users
                              select videos from the gallery input above.
                            */}
                            <input id="photo-upload-pub" type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileChange} />
                            <input id="photo-camera-pub" type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                          </div>
                          {(photosBase64.length > 0 || videoFiles.length > 0) && (
                            <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mt-3">
                              {photosBase64.map((src, idx) => (
                                <div key={`photo-${idx}`} className="relative group rounded-md overflow-hidden border border-border">
                                  <img src={src} alt="Preview" className="w-full h-20 object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => removePhoto(idx)}
                                    className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-100 transition-opacity"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                              {videoFiles.map((v) => (
                                <div key={v.id} className="relative group rounded-md overflow-hidden border border-primary/40 bg-black">
                                  <video src={v.localUrl} className="w-full h-20 object-cover" muted playsInline preload="metadata" />
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <Video className="w-6 h-6 text-white/80 drop-shadow" />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeVideo(v.id)}
                                    className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-100 transition-opacity"
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
                          {createOrder.isPending ? "Registrando..." : !isOnline ? (
                            <>
                              <Clock className="w-4 h-4 mr-2" />
                              Salvar para Envio Posterior
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-2" />
                              Registrar Chamado
                            </>
                          )}
                        </Button>
                        {!isOnline && (
                          <p className="text-xs text-amber-500 text-center mt-2">
                            Offline — o chamado será enviado automaticamente ao reconectar.
                          </p>
                        )}
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
