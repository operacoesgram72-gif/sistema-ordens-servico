import { useState, useEffect } from "react";
import {
  Save, Bell, Share2, Copy, CheckCircle2, Mail, Server, Info,
  Send, XCircle, Loader2, ExternalLink, Plug, Plus, Trash2, Eye, EyeOff,
  ChevronDown, ChevronUp, Shield, Power, Lock, KeyRound, Settings2,
} from "lucide-react";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUnit } from "@/contexts/unit-context";
import { useSystemStatus } from "@/hooks/use-system-status";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type TestResult = { ok: true } | { ok: false; error: string } | null;

type Integration = {
  id: string;
  name: string;
  description: string;
  logo: string;
  category: string;
  docsUrl: string;
};

type SavedConnection = {
  id: string;
  integrationId: string;
  label: string;
  apiKey: string;
  endpointUrl: string;
};

const AVAILABLE_INTEGRATIONS: Integration[] = [
  {
    id: "power-bi",
    name: "Power BI",
    description: "Visualize dados do sistema em dashboards do Power BI via API REST.",
    logo: "📊",
    category: "Business Intelligence",
    docsUrl: "https://learn.microsoft.com/pt-br/power-bi/developer/embedded/",
  },
  {
    id: "power-apps",
    name: "Power Apps",
    description: "Conecte formulários e fluxos do Power Apps ao sistema via conector personalizado.",
    logo: "⚡",
    category: "Low-Code",
    docsUrl: "https://learn.microsoft.com/pt-br/power-apps/",
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    description: "Exporte ordens de serviço automaticamente para uma planilha do Google.",
    logo: "📋",
    category: "Planilhas",
    docsUrl: "https://developers.google.com/sheets/api",
  },
  {
    id: "supabase",
    name: "Supabase",
    description: "Sincronize dados com um banco Supabase para backup ou análise externa.",
    logo: "🔗",
    category: "Banco de Dados",
    docsUrl: "https://supabase.com/docs",
  },
  {
    id: "google-forms",
    name: "Google Forms",
    description: "Importe respostas de formulários do Google como novas ordens de serviço.",
    logo: "📝",
    category: "Formulários",
    docsUrl: "https://developers.google.com/forms/api",
  },
  {
    id: "power-automate",
    name: "Power Automate",
    description: "Crie fluxos automáticos no Power Automate acionados por eventos do sistema.",
    logo: "🔄",
    category: "Automação",
    docsUrl: "https://learn.microsoft.com/pt-br/power-automate/",
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Conecte o sistema a mais de 6.000 aplicativos via webhooks do Zapier.",
    logo: "⚡",
    category: "Automação",
    docsUrl: "https://zapier.com/help/create/code-webhooks",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Envie notificações de novas OS ou alertas para canais do Slack.",
    logo: "💬",
    category: "Comunicação",
    docsUrl: "https://api.slack.com/messaging/webhooks",
  },
  {
    id: "aws-s3",
    name: "AWS S3 — Armazenamento",
    description: "Armazene fotos, documentos e arquivos no Amazon S3 com URLs públicas ou privadas.",
    logo: "🪣",
    category: "Cloud",
    docsUrl: "https://docs.aws.amazon.com/s3/",
  },
  {
    id: "aws-lambda",
    name: "AWS Lambda — Funções",
    description: "Dispare funções serverless da AWS ao registrar ou atualizar ordens de serviço.",
    logo: "λ",
    category: "Cloud",
    docsUrl: "https://docs.aws.amazon.com/lambda/",
  },
  {
    id: "aws-ses",
    name: "AWS SES — E-mail",
    description: "Envie notificações de OS via Amazon Simple Email Service (SES) em escala.",
    logo: "✉️",
    category: "Cloud",
    docsUrl: "https://docs.aws.amazon.com/ses/",
  },
];

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

// ── Shared section header component ────────────────────────────────────────
function SectHeader({
  icon: Icon,
  title,
  description,
  open,
  iconClassName = "text-primary",
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  open: boolean;
  iconClassName?: string;
}) {
  return (
    <>
      <CardTitle className="flex items-center justify-between text-base font-semibold">
        <span className="flex items-center gap-2.5">
          <Icon className={`w-4.5 h-4.5 shrink-0 ${iconClassName}`} />
          {title}
        </span>
        {open
          ? <ChevronUp className="w-4 h-4 text-muted-foreground/60 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground/60 shrink-0" />}
      </CardTitle>
      {description && (
        <CardDescription className="mt-0.5 leading-snug">{description}</CardDescription>
      )}
    </>
  );
}

export default function Configuracoes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { unit } = useUnit();
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();

  const BASE_URL_CONF = import.meta.env.BASE_URL.replace(/\/$/, "");

  // ── Form state (shared between AM and non-AM views) ─────────────────────
  const [form, setForm] = useState({
    notificationEmail: "",
    smtpHost: "",
    smtpPort: "",
    smtpUser: "",
    smtpPass: "",
    webhookUrlWhatsapp: "",
    webhookUrlN8n: "",
    emailMonitoringAddress: "",
    emailMonitoringEnabled: "false",
  });

  const emailList = form.notificationEmail
    ? form.notificationEmail.split(",").map(e => e.trim()).filter(Boolean)
    : [];
  const [newEmail, setNewEmail] = useState("");

  const addEmail = () => {
    const trimmed = newEmail.trim();
    if (!trimmed || emailList.includes(trimmed)) return;
    setForm(f => ({ ...f, notificationEmail: [...emailList, trimmed].join(",") }));
    setNewEmail("");
  };
  const removeEmail = (idx: number) => {
    setForm(f => ({ ...f, notificationEmail: emailList.filter((_, i) => i !== idx).join(",") }));
  };

  // ── Integrations state ──────────────────────────────────────────────────
  const [connections, setConnections] = useState<SavedConnection[]>([]);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [connForm, setConnForm] = useState({ label: "", apiKey: "", endpointUrl: "" });
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  // ── PostgreSQL connection config (stored locally for security) ───────────
  const PG_LS_KEY = "gram-pg-connection";
  const [pgForm, setPgForm] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PG_LS_KEY) || "null") ?? { host: "", port: "5432", database: "", user: "", password: "" }; }
    catch { return { host: "", port: "5432", database: "", user: "", password: "" }; }
  });
  const [pgSaved, setPgSaved] = useState(false);
  const [showPgPass, setShowPgPass] = useState(false);

  const savePgConn = () => {
    try { localStorage.setItem(PG_LS_KEY, JSON.stringify(pgForm)); } catch {}
    setPgSaved(true);
    setTimeout(() => setPgSaved(false), 2500);
    toast({ title: "Conexão PostgreSQL salva localmente." });
  };

  const pgConnectionString = pgForm.host && pgForm.database && pgForm.user
    ? `postgresql://${pgForm.user}:***@${pgForm.host}:${pgForm.port || 5432}/${pgForm.database}`
    : "";

  // ── Misc UI state ───────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);
  const [copiedCal, setCopiedCal] = useState(false);
  const [copiedUnit, setCopiedUnit] = useState<string | null>(null);
  const [copiedOsDireto, setCopiedOsDireto] = useState<string | null>(null);
  const [copiedMgmt, setCopiedMgmt] = useState<string | null>(null);
  const [shareUrls, setShareUrls] = useState<{ unit: string; token: string; url: string }[]>([]);
  const [testResult, setTestResult] = useState<TestResult>(null);
  const [testing, setTesting] = useState(false);

  const isCreatorMode = typeof window !== "undefined" && window.location.search.includes("modo=criador");

  // ── System Control state ────────────────────────────────────────────────
  const { systemActive, passwordSet, modulePasswordSet, isLoading: systemStatusLoading } = useSystemStatus();

  // Module access — resets on page load (intentional: must re-authenticate each session)
  const [moduleAccessGranted, setModuleAccessGranted] = useState(false);
  const [showModuleVerifyDialog, setShowModuleVerifyDialog] = useState(false);
  const [showSetModulePasswordDialog, setShowSetModulePasswordDialog] = useState(false);
  const [moduleAccessPassword, setModuleAccessPassword] = useState("");
  const [moduleCurrentPassword, setModuleCurrentPassword] = useState("");
  const [modulePasswordLoading, setModulePasswordLoading] = useState(false);

  // Toggle action passwords
  const [showSetPasswordDialog, setShowSetPasswordDialog] = useState(false);
  const [showToggleDialog, setShowToggleDialog] = useState(false);
  const [systemControlPassword, setSystemControlPassword] = useState("");
  const [systemControlCurrentPassword, setSystemControlCurrentPassword] = useState("");
  const [systemControlLoading, setSystemControlLoading] = useState(false);

  // ── Section open/close ──────────────────────────────────────────────────
  const [sectOpen, setSectOpen] = useState<Record<string, boolean>>({
    notif: true, smtp: false, webhook: false, monitoring: false,
    sharing: true, integrations: false, creator: true, systemControl: false,
  });
  const toggleSect = (key: string) => setSectOpen(p => ({ ...p, [key]: !p[key] }));

  // System Control section: gate behind module password if configured
  const handleSystemControlSectClick = () => {
    if (moduleAccessGranted) {
      toggleSect("systemControl");
      return;
    }
    // If neither password is configured, grant access immediately without a dialog.
    // This happens after an admin resets both hashes (e.g. via DB) so they can
    // define a new password from within the UI.
    if (!modulePasswordSet && !passwordSet) {
      setModuleAccessGranted(true);
      setSectOpen(p => ({ ...p, systemControl: true }));
      toast({
        title: "Nenhuma senha configurada",
        description: "Defina uma senha de acesso ao módulo para protegê-lo adequadamente.",
        variant: "destructive",
      });
      return;
    }
    setShowModuleVerifyDialog(true);
    setModuleAccessPassword("");
  };

  // ── Share URLs ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${BASE_URL_CONF}/api/share-urls`)
      .then(r => r.ok ? r.json() : [])
      .then((data: { unit: string; token: string }[]) => {
        if (!Array.isArray(data)) return;
        const origin = window.location.origin;
        setShareUrls(data.map(d => ({
          unit: d.unit,
          token: d.token,
          url: `${origin}${BASE_URL_CONF}?share=${d.unit}&t=${d.token}`,
        })));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Settings load ───────────────────────────────────────────────────────
  useEffect(() => {
    if (settings) {
      setForm({
        notificationEmail: (settings as any).notificationEmail ?? "",
        smtpHost: (settings as any).smtpHost ?? "",
        smtpPort: (settings as any).smtpPort ?? "",
        smtpUser: (settings as any).smtpUser ?? "",
        smtpPass: (settings as any).smtpPass ?? "",
        webhookUrlWhatsapp: (settings as any).webhookUrlWhatsapp ?? "",
        webhookUrlN8n: (settings as any).webhookUrlN8n ?? "",
        emailMonitoringAddress: (settings as any).emailMonitoringAddress ?? "",
        emailMonitoringEnabled: (settings as any).emailMonitoringEnabled ?? "false",
      });
    }
  }, [settings]);

  // ── Link helpers ────────────────────────────────────────────────────────
  const shareUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/registrar`;
  const REGIONAL_UNITS_LIST = ["AM", "AC", "AP", "RO", "RR", "PA"];
  const unitLink = (u: string) =>
    `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/registrar?u=${u}`;
  const calShareUrl = `${window.location.origin}${BASE_URL_CONF}/calendario?view=1`;

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast({ title: "Link copiado!", description: "Compartilhe com os funcionários." });
    });
  };
  const copyCal = () => {
    navigator.clipboard.writeText(calShareUrl).then(() => {
      setCopiedCal(true);
      setTimeout(() => setCopiedCal(false), 2500);
      toast({ title: "Link do calendário copiado!" });
    });
  };
  const copyUnitLink = (u: string) => {
    navigator.clipboard.writeText(unitLink(u)).then(() => {
      setCopiedUnit(u);
      setTimeout(() => setCopiedUnit(null), 2000);
      toast({ title: `Link da unidade ${u} copiado!` });
    });
  };
  const osDirectLink = (u: string) =>
    `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/registrar/os?u=${u}&direto=1`;
  const copyOsDireto = (u: string) => {
    navigator.clipboard.writeText(osDirectLink(u)).then(() => {
      setCopiedOsDireto(u);
      setTimeout(() => setCopiedOsDireto(null), 2000);
      toast({ title: `Link de Nova OS — ${u} copiado!` });
    });
  };
  const copyMgmtLink = (u: string, url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedMgmt(u);
      setTimeout(() => setCopiedMgmt(null), 2000);
      toast({ title: `Link de gestão ${u} copiado!` });
    });
  };

  // ── Save / test ──────────────────────────────────────────────────────────
  const handleSave = () => {
    updateSettings.mutate(
      { data: form as any },
      {
        onSuccess: () => {
          toast({ title: "Configurações salvas!", description: "As alterações foram aplicadas." });
          queryClient.invalidateQueries({ queryKey: ["settings"] });
          setTestResult(null);
        },
        onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
      }
    );
  };

  const handleTestEmail = async () => {
    setTesting(true);
    setTestResult(null);
    const controller = new AbortController();
    // 28 s client-side cap — backend worst-case is ~23 s (fits Render's 30 s
    // HTTP limit), so 28 s here gives it room while always unblocking the button.
    const timer = setTimeout(() => controller.abort(), 28_000);
    try {
      const res = await fetch(`${BASE_URL_CONF}/api/settings/test-email`, {
        method: "POST",
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      setTestResult(data);
      if (data.ok) {
        toast({ title: "E-mail enviado!", description: "Verifique sua caixa de entrada." });
      } else {
        toast({ title: "Falha no envio", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      clearTimeout(timer);
      const msg = err?.name === "AbortError"
        ? "Tempo esgotado — verifique host/porta SMTP e tente novamente."
        : "Erro de rede ao testar envio.";
      setTestResult({ ok: false, error: msg });
      toast({ title: "Falha no envio", description: msg, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  // ── Integrations ─────────────────────────────────────────────────────────
  const saveConnection = (integrationId: string) => {
    if (!connForm.label.trim()) return;
    setConnections(prev => [...prev, { id: genId(), integrationId, ...connForm }]);
    setConnForm({ label: "", apiKey: "", endpointUrl: "" });
    setAddingFor(null);
    toast({ title: "Conexão salva!", description: "Integração configurada com sucesso." });
  };
  const removeConnection = (id: string) => setConnections(prev => prev.filter(c => c.id !== id));
  const toggleShowKey = (id: string) => setShowKey(prev => ({ ...prev, [id]: !prev[id] }));

  // ── System Control — toggle action password ──────────────────────────────
  const handleSetPassword = async () => {
    if (systemControlPassword.trim().length < 6) {
      toast({ title: "Senha muito curta", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    if (passwordSet && systemControlCurrentPassword.trim().length < 1) {
      toast({ title: "Senha atual obrigatória", description: "Informe a senha atual para alterá-la.", variant: "destructive" });
      return;
    }
    setSystemControlLoading(true);
    try {
      const body: Record<string, string> = { password: systemControlPassword.trim() };
      if (passwordSet) body.currentPassword = systemControlCurrentPassword;
      const res = await fetch(`${BASE_URL_CONF}/api/settings/system-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao definir senha");
      toast({ title: "Senha de ação definida!", description: "Senha para ativar/desativar o sistema configurada." });
      setShowSetPasswordDialog(false);
      setSystemControlPassword("");
      setSystemControlCurrentPassword("");
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSystemControlLoading(false);
    }
  };

  const handleSystemControlToggle = async () => {
    setSystemControlLoading(true);
    try {
      const res = await fetch(`${BASE_URL_CONF}/api/settings/system-toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: systemControlPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao alterar estado do sistema");
      toast({
        title: data.active ? "Sistema ativado ✓" : "Sistema desativado",
        description: data.active
          ? "O sistema está ativo e acessível normalmente."
          : "O sistema foi desativado. Novos registros estão bloqueados para colaboradores.",
      });
      setShowToggleDialog(false);
      setSystemControlPassword("");
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSystemControlLoading(false);
    }
  };

  // ── System Control — module access password ──────────────────────────────
  const handleModuleVerify = async () => {
    setModulePasswordLoading(true);
    try {
      const res = await fetch(`${BASE_URL_CONF}/api/settings/system-module-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: moduleAccessPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Senha incorreta.");
      setModuleAccessGranted(true);
      setShowModuleVerifyDialog(false);
      setModuleAccessPassword("");
      // Auto-open the section after successful authentication
      setSectOpen(p => ({ ...p, systemControl: true }));
      // Warn admin if no password is configured yet so they know to set one
      if (data.noPasswordConfigured) {
        toast({
          title: "Nenhuma senha configurada",
          description: "Defina uma senha de acesso ao módulo para protegê-lo adequadamente.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({ title: "Acesso negado", description: e.message, variant: "destructive" });
    } finally {
      setModulePasswordLoading(false);
    }
  };

  const handleSetModulePassword = async () => {
    if (moduleAccessPassword.trim().length < 6) {
      toast({ title: "Senha muito curta", description: "Mínimo 6 caracteres.", variant: "destructive" });
      return;
    }
    if (modulePasswordSet && moduleCurrentPassword.trim().length < 1) {
      toast({ title: "Senha atual obrigatória", description: "Informe a senha atual para alterá-la.", variant: "destructive" });
      return;
    }
    setModulePasswordLoading(true);
    try {
      const body: Record<string, string> = { password: moduleAccessPassword.trim() };
      if (modulePasswordSet) body.currentPassword = moduleCurrentPassword;
      const res = await fetch(`${BASE_URL_CONF}/api/settings/system-module-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao definir senha.");
      toast({
        title: "Senha de acesso definida!",
        description: "O módulo agora exige autenticação antes de abrir.",
      });
      setShowSetModulePasswordDialog(false);
      setModuleAccessPassword("");
      setModuleCurrentPassword("");
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setModulePasswordLoading(false);
    }
  };

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const smtpComplete = form.smtpHost && form.smtpPort && form.smtpUser && form.smtpPass && form.notificationEmail;
  const categories = [...new Set(AVAILABLE_INTEGRATIONS.map(i => i.category))];

  // ══════════════════════════════════════════════════════════════════════════
  // ── NON-AM VIEW — simplified SMTP-only settings ──────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  if (unit !== "AM") {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="bg-background border-b border-border/30 shrink-0 px-6 md:px-8 pt-6 pb-4">
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Configurações de e-mail para a unidade <span className="font-semibold text-foreground">{unit}</span>.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-6 md:p-8 max-w-2xl space-y-5">

        {/* Info banner */}
        <div className="rounded-lg border border-border/60 bg-muted/30 p-4 flex gap-3 items-start">
          <Settings2 className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            As configurações avançadas do sistema (integrações, controle geral, compartilhamento de links e automações)
            são gerenciadas exclusivamente pela unidade <strong className="text-foreground">AM — Amazonas</strong>,
            responsável pela administração central.
          </div>
        </div>

        {/* SMTP Card */}
        <Card className="bg-card border-border/50 card-interactive">
          <CardHeader
            className="cursor-pointer select-none hover:bg-muted/20 transition-colors rounded-t-lg"
            onClick={() => toggleSect("smtp")}
          >
            <SectHeader
              icon={Server}
              title="Configuração de Envio (SMTP)"
              description="Dados do servidor de e-mail para envio das notificações desta unidade."
              open={sectOpen.smtp}
            />
          </CardHeader>
          {sectOpen.smtp && (
            <CardContent className="space-y-4 sect-content">
              <div className="rounded-md bg-primary/5 border border-primary/20 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Info className="w-4 h-4 shrink-0" />
                  Erro 535 Authentication Failed? Veja como corrigir:
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">Zoho Mail (smtppro.zoho.com)</p>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
                    <li>Acesse <span className="font-mono bg-muted px-1 rounded">mail.zoho.com → Configurações → Segurança</span></li>
                    <li>Ative <strong className="text-foreground">Autenticação de Dois Fatores</strong></li>
                    <li>Crie uma <strong className="text-foreground">Senha de Aplicativo</strong> e use-a abaixo</li>
                    <li>Confirme que SMTP está habilitado em <span className="font-mono bg-muted px-1 rounded">Configurações → E-mail → IMAP/POP/SMTP</span></li>
                  </ol>
                </div>
                <div className="border-t border-primary/20 pt-2 space-y-1">
                  <p className="text-xs font-semibold text-foreground">Gmail (smtp.gmail.com)</p>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
                    <li>Ative a <strong className="text-foreground">Verificação em duas etapas</strong> na sua conta Google</li>
                    <li>Crie uma <strong className="text-foreground">Senha de App</strong> em myaccount.google.com/apppasswords</li>
                    <li>Use essa senha de 16 caracteres — <strong className="text-primary">nunca a senha normal</strong></li>
                  </ol>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Host SMTP</Label>
                  <Input placeholder="smtp.gmail.com" value={form.smtpHost} onChange={e => setForm(f => ({ ...f, smtpHost: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Porta</Label>
                  <Input placeholder="587" value={form.smtpPort} onChange={e => setForm(f => ({ ...f, smtpPort: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Usuário (e-mail remetente)</Label>
                  <Input type="email" placeholder="remetente@gmail.com" value={form.smtpUser} onChange={e => setForm(f => ({ ...f, smtpUser: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Senha de App</Label>
                  <Input type="password" placeholder="Senha de 16 dígitos gerada pelo Google" value={form.smtpPass} onChange={e => setForm(f => ({ ...f, smtpPass: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2"><Mail className="w-4 h-4" /> E-mail de destino das notificações</Label>
                {emailList.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {emailList.map((email, idx) => (
                      <span key={idx} className="flex items-center gap-1.5 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full font-medium">
                        <Mail className="w-3 h-3 shrink-0" />
                        {email}
                        <button type="button" onClick={() => removeEmail(idx)} className="text-primary/60 hover:text-destructive ml-0.5 transition-colors">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input type="email" placeholder="gestor@empresa.com.br" value={newEmail} onChange={e => setNewEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addEmail())} className="flex-1" />
                  <Button type="button" variant="outline" onClick={addEmail} className="shrink-0 gap-1.5" size="sm"><Plus className="w-3.5 h-3.5" />Adicionar</Button>
                </div>
              </div>
              {testResult && (
                <div className={`rounded-md border p-3 flex items-start gap-2 text-sm ${
                  testResult.ok ? "bg-emerald-950/30 border-emerald-700/50 text-emerald-400" : "bg-red-950/30 border-red-700/50 text-red-400"
                }`}>
                  {testResult.ok
                    ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <span>{testResult.ok ? `E-mail de teste enviado para ${form.notificationEmail}!` : `Falha: ${testResult.error}`}</span>
                </div>
              )}
              <div className="flex justify-end">
                <Button variant="outline" onClick={handleTestEmail} disabled={!smtpComplete || testing} className="gap-2">
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {testing ? "Enviando…" : "Testar Envio"}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Save */}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={updateSettings.isPending} size="lg" className="w-full md:w-auto">
            {updateSettings.isPending
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando…</>
              : <><Save className="w-4 h-4 mr-2" />Salvar Configurações</>}
          </Button>
        </div>

        <div className="pt-4 border-t border-border/30 text-center">
          <p className="text-xs text-muted-foreground/50">Desenvolvido por <strong>Aristoteles Melo</strong> — GRAM Operações.</p>
        </div>
      </div>
      </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── AM FULL VIEW ─────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="bg-background border-b border-border/30 shrink-0 px-6 md:px-8 pt-6 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground mt-1 text-sm">Ajustes do sistema, notificações e integrações.</p>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
      <div className="px-6 md:px-8 pb-8 pt-4 max-w-3xl space-y-5">

      {/* ── Notificações por E-mail ─────────────────────────────────────── */}
      <Card className="bg-card border-border/50 card-interactive">
        <CardHeader className="cursor-pointer select-none hover:bg-muted/20 transition-colors rounded-t-lg" onClick={() => toggleSect("notif")}>
          <SectHeader icon={Bell} title="Notificações por E-mail" description="Receba um e-mail automático sempre que uma nova OS for registrada." open={sectOpen.notif} />
        </CardHeader>
        {sectOpen.notif && (
          <CardContent className="space-y-4 sect-content">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                E-mails de Destino das Notificações
              </Label>
              {emailList.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {emailList.map((email, idx) => (
                    <span key={idx} className="flex items-center gap-1.5 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full font-medium">
                      <Mail className="w-3 h-3 shrink-0" />
                      {email}
                      <button type="button" onClick={() => removeEmail(idx)} className="text-primary/60 hover:text-destructive ml-0.5 transition-colors">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input type="email" placeholder="gestor@empresa.com.br" value={newEmail} onChange={e => setNewEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addEmail())} className="flex-1" />
                <Button type="button" variant="outline" onClick={addEmail} className="shrink-0 gap-1.5" size="sm">
                  <Plus className="w-3.5 h-3.5" />Adicionar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Adicione todos os e-mails que devem receber notificações. Todos receberão automaticamente.</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── SMTP ───────────────────────────────────────────────────────── */}
      <Card className="bg-card border-border/50 card-interactive">
        <CardHeader className="cursor-pointer select-none hover:bg-muted/20 transition-colors rounded-t-lg" onClick={() => toggleSect("smtp")}>
          <SectHeader icon={Server} title="Configuração de Envio (SMTP)" description="Dados do servidor de e-mail para envio das notificações." open={sectOpen.smtp} />
        </CardHeader>
        {sectOpen.smtp && (
          <CardContent className="space-y-4 sect-content">
            <div className="rounded-md bg-primary/5 border border-primary/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Info className="w-4 h-4 shrink-0" />
                Erro 535 Authentication Failed? Veja como corrigir:
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">Zoho Mail (smtppro.zoho.com)</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
                  <li>Acesse <span className="font-mono bg-muted px-1 rounded">mail.zoho.com → Configurações → Segurança</span></li>
                  <li>Ative <strong className="text-foreground">Autenticação de Dois Fatores</strong></li>
                  <li>Em seguida, crie uma <strong className="text-foreground">Senha de Aplicativo</strong> e use-a no campo abaixo</li>
                  <li>Confirme que SMTP está habilitado em <span className="font-mono bg-muted px-1 rounded">Configurações → E-mail → IMAP/POP/SMTP</span></li>
                </ol>
                <a href="https://www.zoho.com/mail/help/zoho-smtp.html" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 underline underline-offset-2 mt-1">
                  <ExternalLink className="w-3 h-3" />Documentação SMTP do Zoho
                </a>
              </div>
              <div className="border-t border-primary/20 pt-2 space-y-1">
                <p className="text-xs font-semibold text-foreground">Gmail (smtp.gmail.com)</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
                  <li>Ative a <strong className="text-foreground">Verificação em duas etapas</strong> na sua conta Google</li>
                  <li>Acesse <span className="font-mono bg-muted px-1 rounded">myaccount.google.com/apppasswords</span> e crie uma <strong className="text-foreground">Senha de App</strong></li>
                  <li>Use essa senha de 16 caracteres — <strong className="text-primary">nunca a senha normal da conta</strong></li>
                </ol>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Host SMTP</Label>
                <Input placeholder="smtp.gmail.com" value={form.smtpHost} onChange={e => setForm(f => ({ ...f, smtpHost: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Porta</Label>
                <Input placeholder="587" value={form.smtpPort} onChange={e => setForm(f => ({ ...f, smtpPort: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Usuário (e-mail remetente)</Label>
                <Input type="email" placeholder="remetente@gmail.com" value={form.smtpUser} onChange={e => setForm(f => ({ ...f, smtpUser: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Senha de App</Label>
                <Input type="password" placeholder="Senha de 16 dígitos gerada pelo Google" value={form.smtpPass} onChange={e => setForm(f => ({ ...f, smtpPass: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2"><Mail className="w-4 h-4" /> E-mails Destinatários</Label>
              {emailList.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {emailList.map((email, idx) => (
                    <span key={idx} className="flex items-center gap-1.5 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full font-medium">
                      <Mail className="w-3 h-3 shrink-0" />
                      {email}
                      <button type="button" onClick={() => removeEmail(idx)} className="text-primary/60 hover:text-destructive ml-0.5 transition-colors">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input type="email" placeholder="gestor@empresa.com.br" value={newEmail} onChange={e => setNewEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addEmail())} className="flex-1" />
                <Button type="button" variant="outline" onClick={addEmail} className="shrink-0 gap-1.5" size="sm">
                  <Plus className="w-3.5 h-3.5" />Adicionar e-mail
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Adicione um ou mais e-mails que devem receber os envios feitos por este servidor SMTP.</p>
            </div>
            {testResult && (
              <div className={`rounded-md border p-3 flex items-start gap-2 text-sm ${
                testResult.ok ? "bg-emerald-950/30 border-emerald-700/50 text-emerald-400" : "bg-red-950/30 border-red-700/50 text-red-400"
              }`}>
                {testResult.ok
                  ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                <span>{testResult.ok ? `E-mail de teste enviado com sucesso para ${form.notificationEmail}!` : `Falha: ${testResult.error}`}</span>
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="outline" onClick={handleTestEmail} disabled={!smtpComplete || testing} className="gap-2">
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {testing ? "Enviando…" : "Testar Envio"}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── WhatsApp / n8n ──────────────────────────────────────────────── */}
      <Card className="bg-card border-border/50 card-interactive">
        <CardHeader className="cursor-pointer select-none hover:bg-muted/20 transition-colors rounded-t-lg" onClick={() => toggleSect("webhook")}>
          <SectHeader icon={Send} title="Notificações por WhatsApp / n8n" description="Configure webhooks para disparar mensagens automáticas no WhatsApp ou fluxos de automação via n8n quando uma OS for registrada." open={sectOpen.webhook} />
        </CardHeader>
        {sectOpen.webhook && (
          <CardContent className="space-y-4 sect-content">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2"><span>💬</span> URL do Webhook — WhatsApp</Label>
              <Input placeholder="https://api.z-api.io/instances/INSTANCE/token/TOKEN/send-text" value={form.webhookUrlWhatsapp} onChange={e => setForm(f => ({ ...f, webhookUrlWhatsapp: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Use Z-API, Evolution API ou outro gateway. A OS será enviada como JSON no body do POST.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2"><span>🔄</span> URL do Webhook — n8n / Zapier</Label>
              <Input placeholder="https://n8n.suaempresa.com/webhook/os-civil" value={form.webhookUrlN8n} onChange={e => setForm(f => ({ ...f, webhookUrlN8n: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Toda nova OS criada enviará um POST com os dados completos para este endpoint.</p>
            </div>
            <div className="rounded-md bg-muted/50 border border-border/60 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Payload enviado (exemplo):</p>
              <pre className="font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap">{`{
  "event": "nova_os",
  "numero": "OS-00042",
  "local": "Andar 3, Bloco B",
  "unidade": "AM",
  "prioridade": "urgente",
  "criado_em": "2026-06-26T14:00:00Z"
}`}</pre>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Monitoramento de E-mail ──────────────────────────────────────── */}
      <Card className="bg-card border-border/50 card-interactive">
        <CardHeader className="cursor-pointer select-none hover:bg-muted/20 transition-colors rounded-t-lg" onClick={() => toggleSect("monitoring")}>
          <SectHeader icon={Mail} title="Monitoramento de E-mail (Entrada)" description="Monitore uma caixa de entrada e converta e-mails recebidos automaticamente em ordens de serviço." open={sectOpen.monitoring} />
        </CardHeader>
        {sectOpen.monitoring && (
          <CardContent className="space-y-4 sect-content">
            <div className="flex items-center justify-between p-3 rounded-md border border-border/60 bg-muted/30">
              <div>
                <p className="text-sm font-medium">Monitoramento Ativo</p>
                <p className="text-xs text-muted-foreground mt-0.5">Liga/desliga a criação automática de OS por e-mail</p>
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, emailMonitoringEnabled: f.emailMonitoringEnabled === "true" ? "false" : "true" }))}
                className={`toggle-switch w-11 h-6 rounded-full relative shrink-0 ${form.emailMonitoringEnabled === "true" ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`toggle-thumb absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow ${form.emailMonitoringEnabled === "true" ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2"><Mail className="w-4 h-4" /> Endereço de E-mail Monitorado</Label>
              <Input type="email" placeholder="chamados@redeamazonica.com.br" value={form.emailMonitoringAddress} onChange={e => setForm(f => ({ ...f, emailMonitoringAddress: e.target.value }))} />
              <p className="text-xs text-muted-foreground">E-mails recebidos neste endereço serão parseados e transformados em novas OS com origem "E-mail". Configure seu servidor de e-mail para fazer forward para esta caixa.</p>
            </div>
            <div className="rounded-md bg-amber-950/20 border border-amber-700/30 p-3 text-xs text-amber-400/90 flex gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <span>A integração de e-mail requer configuração de IMAP ou webhook de e-mail no seu servidor. Salve as configurações e entre em contato com o administrador do sistema para ativação completa.</span>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Compartilhamento ─────────────────────────────────────────────── */}
      <Card className="bg-card border-border/50 card-interactive">
        <CardHeader className="cursor-pointer select-none hover:bg-muted/20 transition-colors rounded-t-lg" onClick={() => toggleSect("sharing")}>
          <SectHeader icon={Share2} title="Link de Registro para Funcionários" description="Envie este link para os funcionários abrirem chamados sem acesso ao painel de gestão." open={sectOpen.sharing} />
        </CardHeader>
        {sectOpen.sharing && (
          <CardContent className="space-y-6 sect-content">
            <div className="space-y-2">
              <p className="text-sm font-semibold">Link Geral de Registro</p>
              <div className="flex items-center gap-2">
                <Input value={shareUrl} readOnly className="font-mono text-sm bg-muted/50" />
                <Button variant="outline" onClick={copyLink} className="shrink-0">
                  {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">O funcionário preenche o formulário e recebe um número de protocolo. Nenhuma informação de gestão é visível nessa página.</p>
            </div>

            <div className="space-y-2 border-t border-border/40 pt-4">
              <p className="text-sm font-semibold">Links por Unidade (UF)</p>
              <p className="text-xs text-muted-foreground">Cada link isola automaticamente os registros e chamados da respectiva unidade.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {REGIONAL_UNITS_LIST.map(u => (
                  <div key={u} className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                    <span className="text-xs font-mono font-bold text-primary w-8 shrink-0">{u}</span>
                    <Input value={unitLink(u)} readOnly className="font-mono text-xs bg-transparent border-0 p-0 h-auto focus-visible:ring-0 text-muted-foreground" />
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyUnitLink(u)}>
                      {copiedUnit === u ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 border-t border-border/40 pt-4">
              <p className="text-sm font-semibold">Link Direto — Nova Ordem de Serviço</p>
              <p className="text-xs text-muted-foreground">Abre diretamente o formulário de registro de OS sem menu de navegação. Ideal para fixar em murais ou enviar a um técnico específico.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {REGIONAL_UNITS_LIST.map(u => (
                  <div key={u} className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                    <span className="text-xs font-mono font-bold text-primary w-8 shrink-0">{u}</span>
                    <Input value={osDirectLink(u)} readOnly className="font-mono text-xs bg-transparent border-0 p-0 h-auto focus-visible:ring-0 text-muted-foreground" />
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyOsDireto(u)}>
                      {copiedOsDireto === u ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 border-t border-border/40 pt-4">
              <p className="text-sm font-semibold">Compartilhar Calendário (Somente Leitura)</p>
              <div className="flex items-center gap-2">
                <Input value={calShareUrl} readOnly className="font-mono text-sm bg-muted/50" />
                <Button variant="outline" onClick={copyCal} className="shrink-0">
                  {copiedCal ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
                <a href={calShareUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="icon" className="shrink-0"><ExternalLink className="w-4 h-4" /></Button>
                </a>
              </div>
              <p className="text-xs text-muted-foreground">Qualquer pessoa com este link pode visualizar o calendário de OS sem acesso ao painel de gestão.</p>
            </div>

            <div className="space-y-2 border-t border-border/40 pt-4">
              <p className="text-sm font-semibold">Compartilhamento da Área de Gestão por Unidade</p>
              <p className="text-xs text-muted-foreground">
                Cada link permite acesso somente leitura à área de gestão de uma unidade específica.
                O acesso é validado no servidor — não é possível visualizar outra unidade alterando a URL.
                O link da unidade <strong>AM</strong> permite navegar entre todas as unidades.
              </p>
              {shareUrls.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 italic">Carregando links…</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {shareUrls.map(({ unit: u, url }) => (
                    <div key={u} className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                      <span className="text-xs font-mono font-bold text-primary w-8 shrink-0">{u}</span>
                      <Input value={url} readOnly className="font-mono text-xs bg-transparent border-0 p-0 h-auto focus-visible:ring-0 text-muted-foreground" />
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyMgmtLink(u, url)}>
                        {copiedMgmt === u ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"><ExternalLink className="w-3.5 h-3.5" /></Button>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Integrações ──────────────────────────────────────────────────── */}
      <Card className="bg-card border-border/50 card-interactive">
        <CardHeader className="cursor-pointer select-none hover:bg-muted/20 transition-colors rounded-t-lg" onClick={() => toggleSect("integrations")}>
          <SectHeader icon={Plug} title="Integrações e Conexões" description="Conecte o sistema a outras plataformas para compartilhamento, análise e automação." open={sectOpen.integrations} />
        </CardHeader>
        {sectOpen.integrations && (
          <CardContent className="space-y-6 sect-content">

            {/* ── PostgreSQL connection ──────────────────────────────────── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">Banco de Dados</p>
              <div className="rounded-md border border-border/70 bg-muted/20 p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl shrink-0">🐘</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Conexão PostgreSQL</span>
                      {pgForm.host && pgForm.database && pgForm.user && (
                        <Badge variant="outline" className="text-[10px] py-0 text-emerald-400 border-emerald-700/50">Configurado</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                      Parâmetros de conexão com um banco de dados PostgreSQL externo. Armazenados localmente neste dispositivo.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Host *</Label>
                    <Input
                      placeholder="db.exemplo.com ou 192.168.1.100"
                      value={pgForm.host}
                      onChange={e => setPgForm((f: typeof pgForm) => ({ ...f, host: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Porta</Label>
                    <Input
                      placeholder="5432"
                      value={pgForm.port}
                      onChange={e => setPgForm((f: typeof pgForm) => ({ ...f, port: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Banco de Dados *</Label>
                    <Input
                      placeholder="nome_do_banco"
                      value={pgForm.database}
                      onChange={e => setPgForm((f: typeof pgForm) => ({ ...f, database: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Usuário *</Label>
                    <Input
                      placeholder="postgres"
                      value={pgForm.user}
                      onChange={e => setPgForm((f: typeof pgForm) => ({ ...f, user: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs">Senha</Label>
                    <div className="flex gap-2">
                      <Input
                        type={showPgPass ? "text" : "password"}
                        placeholder="Senha de acesso ao banco"
                        value={pgForm.password}
                        onChange={e => setPgForm((f: typeof pgForm) => ({ ...f, password: e.target.value }))}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => setShowPgPass(v => !v)}
                      >
                        {showPgPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                {pgConnectionString && (
                  <div className="bg-muted/40 rounded px-3 py-2 font-mono text-xs text-muted-foreground break-all">
                    {pgConnectionString}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={savePgConn}
                    disabled={!pgForm.host || !pgForm.database || !pgForm.user}
                  >
                    {pgSaved
                      ? <><CheckCircle2 className="w-3.5 h-3.5" />Salvo!</>
                      : <><Save className="w-3.5 h-3.5" />Salvar Conexão</>}
                  </Button>
                </div>
              </div>
            </div>

            {connections.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Conexões Ativas</p>
                {connections.map(conn => {
                  const integration = AVAILABLE_INTEGRATIONS.find(i => i.id === conn.integrationId);
                  return (
                    <div key={conn.id} className="flex items-center gap-3 p-3 rounded-md border border-border/70 bg-muted/20 group">
                      <span className="text-lg">{integration?.logo}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{conn.label}</span>
                          <Badge variant="outline" className="text-[10px] py-0 text-emerald-400 border-emerald-700/50">Configurado</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{integration?.name}</p>
                        {conn.endpointUrl && <p className="text-xs text-muted-foreground truncate">{conn.endpointUrl}</p>}
                        {conn.apiKey && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-xs font-mono text-muted-foreground">{showKey[conn.id] ? conn.apiKey : "••••••••••••••••"}</span>
                            <button onClick={() => toggleShowKey(conn.id)} className="text-muted-foreground hover:text-foreground">
                              {showKey[conn.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          </div>
                        )}
                      </div>
                      <button onClick={() => removeConnection(conn.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {categories.map(category => (
              <div key={category} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">{category}</p>
                <div className="grid grid-cols-1 gap-2">
                  {AVAILABLE_INTEGRATIONS.filter(i => i.category === category).map(integration => {
                    const isAdding = addingFor === integration.id;
                    const connCount = connections.filter(c => c.integrationId === integration.id).length;
                    return (
                      <div key={integration.id} className="rounded-md border border-border/70 bg-muted/20 overflow-hidden transition-colors hover:border-border/50">
                        <div className="flex items-center gap-3 p-3">
                          <span className="text-xl shrink-0">{integration.logo}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{integration.name}</span>
                              {connCount > 0 && (
                                <Badge variant="outline" className="text-[10px] py-0 text-emerald-400 border-emerald-700/50">
                                  {connCount} conexão{connCount > 1 ? "ões" : ""}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground leading-snug">{integration.description}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <a href={integration.docsUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" title="Ver documentação">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            <Button size="sm" variant={isAdding ? "default" : "outline"} className="gap-1.5 h-7 text-xs"
                              onClick={() => { setAddingFor(isAdding ? null : integration.id); setConnForm({ label: "", apiKey: "", endpointUrl: "" }); }}>
                              <Plus className="w-3.5 h-3.5" />
                              {isAdding ? "Cancelar" : "Conectar"}
                            </Button>
                          </div>
                        </div>
                        {isAdding && (
                          <div className="px-4 pb-4 pt-1 border-t border-border/50 space-y-3 bg-card/40 sect-content">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Nome da Conexão *</Label>
                              <Input placeholder="Ex: Planilha OS 2025" value={connForm.label} onChange={e => setConnForm(f => ({ ...f, label: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">URL / Endpoint</Label>
                              <Input placeholder="https://..." value={connForm.endpointUrl} onChange={e => setConnForm(f => ({ ...f, endpointUrl: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Chave de API / Token</Label>
                              <Input type="password" placeholder="Cole sua chave aqui" value={connForm.apiKey} onChange={e => setConnForm(f => ({ ...f, apiKey: e.target.value }))} />
                            </div>
                            <div className="flex justify-end">
                              <Button size="sm" className="gap-1.5" onClick={() => saveConnection(integration.id)}>
                                <CheckCircle2 className="w-3.5 h-3.5" />Salvar Conexão
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* ── Controle Geral do Sistema ─────────────────────────────────────── */}
      <Card className="bg-card border-red-900/30 card-interactive">
        <CardHeader
          className="cursor-pointer select-none hover:bg-muted/20 transition-colors rounded-t-lg"
          onClick={handleSystemControlSectClick}
        >
          <CardTitle className="flex items-center justify-between text-base font-semibold">
            <span className="flex items-center gap-2.5">
              <Power className="w-4.5 h-4.5 shrink-0 text-red-500" />
              Controle Geral do Sistema
              {!moduleAccessGranted && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/60 border border-border/60 px-1.5 py-0.5 rounded-full">
                  <Lock className="w-2.5 h-2.5" />Protegido
                </span>
              )}
              {moduleAccessGranted && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 px-1.5 py-0.5 rounded-full">
                  <KeyRound className="w-2.5 h-2.5" />Desbloqueado
                </span>
              )}
            </span>
            {sectOpen.systemControl
              ? <ChevronUp className="w-4 h-4 text-muted-foreground/60 shrink-0" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground/60 shrink-0" />}
          </CardTitle>
          <CardDescription className="mt-0.5 leading-snug">
            Ative ou desative o acesso ao sistema para todos os colaboradores. Requer senha de controle.
          </CardDescription>
        </CardHeader>

        {sectOpen.systemControl && (
          <CardContent className="space-y-4 sect-content">
            {/* Estado atual */}
            {systemStatusLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando estado…
              </div>
            ) : (
              <div className={`flex items-center justify-between p-4 rounded-lg border ${
                systemActive ? "border-emerald-700/40 bg-emerald-950/20" : "border-red-700/40 bg-red-950/20"
              }`}>
                <div className="flex items-center gap-3">
                  <Power className={`w-5 h-5 shrink-0 ${systemActive ? "text-emerald-500" : "text-red-500"}`} />
                  <div>
                    <p className="text-sm font-semibold">{systemActive ? "Sistema Ativo" : "Sistema Inativo"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {systemActive
                        ? "Todas as funcionalidades estão disponíveis normalmente."
                        : "Registros de OS e materiais estão bloqueados para colaboradores."}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className={`shrink-0 ${
                  systemActive ? "text-emerald-400 border-emerald-700/50" : "text-red-400 border-red-700/50"
                }`}>
                  {systemActive ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            )}

            {/* Ações de toggle */}
            {!passwordSet ? (
              <div className="rounded-lg bg-amber-950/20 border border-amber-700/30 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
                  <Lock className="w-4 h-4 shrink-0" />Senha de ação não configurada
                </div>
                <p className="text-xs text-muted-foreground">
                  Para ativar ou desativar o sistema, defina primeiro uma senha de ação.
                  Ela será solicitada toda vez que você tentar alterar o estado.
                </p>
                <Button variant="outline" size="sm" className="gap-2"
                  onClick={() => { setShowSetPasswordDialog(true); setSystemControlPassword(""); setSystemControlCurrentPassword(""); }}>
                  <Lock className="w-3.5 h-3.5" />Definir Senha de Ação
                </Button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant={systemActive ? "destructive" : "default"} className="flex-1 gap-2"
                  onClick={() => { setShowToggleDialog(true); setSystemControlPassword(""); }}>
                  <Power className="w-4 h-4" />
                  {systemActive ? "Desativar Sistema" : "Ativar Sistema"}
                </Button>
                <Button variant="outline" size="sm" className="gap-2 shrink-0"
                  onClick={() => { setShowSetPasswordDialog(true); setSystemControlPassword(""); setSystemControlCurrentPassword(""); }}>
                  <Lock className="w-3.5 h-3.5" />Alterar Senha de Ação
                </Button>
              </div>
            )}

            {/* Proteção de acesso ao módulo */}
            <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <KeyRound className={`w-4 h-4 shrink-0 ${modulePasswordSet ? "text-primary" : "text-muted-foreground"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Senha de Acesso ao Módulo</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {modulePasswordSet
                      ? "Este módulo exige autenticação antes de ser exibido. Nível adicional de segurança ativo."
                      : "Sem proteção de acesso configurada. Qualquer administrador AM pode abrir este módulo."}
                  </p>
                </div>
                {modulePasswordSet && (
                  <Badge variant="outline" className="text-primary border-primary/40 shrink-0 text-[10px]">Ativo</Badge>
                )}
              </div>
              <Button variant="outline" size="sm" className="gap-2"
                onClick={() => { setShowSetModulePasswordDialog(true); setModuleAccessPassword(""); setModuleCurrentPassword(""); }}>
                <KeyRound className="w-3.5 h-3.5" />
                {modulePasswordSet ? "Alterar Senha de Acesso" : "Definir Senha de Acesso"}
              </Button>
            </div>

            <div className="rounded-lg bg-muted/30 border border-border/50 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Quando o sistema estiver inativo:</p>
              <ul className="list-disc list-inside space-y-0.5 leading-relaxed">
                <li>Não será possível registrar novas Ordens de Serviço</li>
                <li>Não será possível registrar retirada de materiais</li>
                <li>A consulta e gestão de OS existentes permanece disponível</li>
              </ul>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Painel do Criador (modo=criador) ────────────────────────────── */}
      {isCreatorMode && (
        <Card className="bg-card border-violet-600/30 card-interactive">
          <CardHeader className="cursor-pointer select-none hover:bg-muted/20 transition-colors rounded-t-lg" onClick={() => toggleSect("creator")}>
            <SectHeader icon={Shield} title="Painel do Criador" description="Controles exclusivos do administrador raiz do sistema." open={sectOpen.creator} iconClassName="text-violet-500" />
          </CardHeader>
          {sectOpen.creator && (
            <CardContent className="space-y-4 sect-content">
              <div className={`flex items-center justify-between p-4 rounded-lg border ${systemActive ? "border-emerald-700/40 bg-emerald-950/20" : "border-red-700/40 bg-red-950/20"}`}>
                <div className="flex items-center gap-3">
                  <Power className={`w-5 h-5 ${systemActive ? "text-emerald-500" : "text-red-500"}`} />
                  <div>
                    <p className="text-sm font-semibold">{systemActive ? "Sistema Ativo" : "Sistema Inativo"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {systemActive ? "O sistema está ativo e acessível normalmente." : "O sistema está desativado. Novos registros estão bloqueados."}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (modulePasswordSet && !moduleAccessGranted) {
                      setShowModuleVerifyDialog(true);
                      setModuleAccessPassword("");
                    } else {
                      setShowToggleDialog(true);
                      setSystemControlPassword("");
                    }
                  }}
                  className={`toggle-switch w-12 h-6 rounded-full relative shrink-0 ${systemActive ? "bg-emerald-500" : "bg-red-500"}`}
                >
                  <span className={`toggle-thumb absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow ${systemActive ? "translate-x-6" : "translate-x-0"}`} />
                </button>
              </div>
              <p className="text-xs text-muted-foreground/60">
                URL de acesso ao painel do criador: <span className="font-mono">{shareUrl.replace("/registrar", "/configuracoes")}?modo=criador</span>
              </p>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── Save button ───────────────────────────────────────────────────── */}
      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={updateSettings.isPending} size="lg" className="w-full md:w-auto">
          {updateSettings.isPending
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando…</>
            : <><Save className="w-4 h-4 mr-2" />Salvar Configurações</>}
        </Button>
      </div>

      <div className="pt-4 border-t border-border/30 text-center">
        <p className="text-xs text-muted-foreground/50">Desenvolvido por <strong>Aristoteles Melo</strong> — GRAM Operações.</p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          DIALOGS
          ═══════════════════════════════════════════════════════════════ */}

      {/* ── Dialog: Verificar senha de acesso ao módulo ──────────────────── */}
      <Dialog open={showModuleVerifyDialog} onOpenChange={open => { setShowModuleVerifyDialog(open); if (!open) setModuleAccessPassword(""); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Autenticação Necessária
            </DialogTitle>
            <DialogDescription>
              O módulo <strong>Controle Geral do Sistema</strong> está protegido. Informe a senha de acesso para continuar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Senha de Acesso ao Módulo</Label>
              <Input
                type="password"
                placeholder="Digite a senha de acesso"
                value={moduleAccessPassword}
                onChange={e => setModuleAccessPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !modulePasswordLoading && moduleAccessPassword && handleModuleVerify()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModuleVerifyDialog(false)} disabled={modulePasswordLoading}>Cancelar</Button>
            <Button onClick={handleModuleVerify} disabled={modulePasswordLoading || !moduleAccessPassword}>
              {modulePasswordLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verificando…</> : "Entrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Definir / Alterar senha de acesso ao módulo ─────────── */}
      <Dialog open={showSetModulePasswordDialog} onOpenChange={open => { setShowSetModulePasswordDialog(open); if (!open) { setModuleAccessPassword(""); setModuleCurrentPassword(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              {modulePasswordSet ? "Alterar Senha de Acesso ao Módulo" : "Definir Senha de Acesso ao Módulo"}
            </DialogTitle>
            <DialogDescription>
              Esta senha será solicitada toda vez que alguém tentar abrir o módulo <strong>Controle Geral do Sistema</strong>.
              É independente da senha de ação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {modulePasswordSet && (
              <div className="space-y-1.5">
                <Label>Senha Atual</Label>
                <Input type="password" placeholder="Digite a senha atual" value={moduleCurrentPassword} onChange={e => setModuleCurrentPassword(e.target.value)} autoFocus />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Nova Senha</Label>
              <Input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={moduleAccessPassword}
                onChange={e => setModuleAccessPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !modulePasswordLoading && handleSetModulePassword()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetModulePasswordDialog(false)} disabled={modulePasswordLoading}>Cancelar</Button>
            <Button onClick={handleSetModulePassword} disabled={modulePasswordLoading || moduleAccessPassword.trim().length < 6}>
              {modulePasswordLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando…</> : "Definir Senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Definir / Alterar senha de ação ─────────────────────── */}
      <Dialog open={showSetPasswordDialog} onOpenChange={open => { setShowSetPasswordDialog(open); if (!open) { setSystemControlPassword(""); setSystemControlCurrentPassword(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              {passwordSet ? "Alterar Senha de Ação" : "Definir Senha de Ação"}
            </DialogTitle>
            <DialogDescription>
              Esta senha será solicitada para confirmar a ativação ou desativação do sistema.
              É independente da senha de acesso ao módulo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {passwordSet && (
              <div className="space-y-1.5">
                <Label>Senha Atual</Label>
                <Input type="password" placeholder="Digite a senha atual" value={systemControlCurrentPassword} onChange={e => setSystemControlCurrentPassword(e.target.value)} autoFocus />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Nova Senha</Label>
              <Input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={systemControlPassword}
                onChange={e => setSystemControlPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !systemControlLoading && handleSetPassword()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetPasswordDialog(false)} disabled={systemControlLoading}>Cancelar</Button>
            <Button onClick={handleSetPassword} disabled={systemControlLoading || systemControlPassword.trim().length < 6}>
              {systemControlLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando…</> : "Definir Senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Confirmar Ativação / Desativação ─────────────────────── */}
      <Dialog open={showToggleDialog} onOpenChange={setShowToggleDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Power className={`w-5 h-5 ${systemActive ? "text-red-500" : "text-emerald-500"}`} />
              {systemActive ? "Desativar Sistema" : "Ativar Sistema"}
            </DialogTitle>
            <DialogDescription>
              {systemActive
                ? "Após desativar, os colaboradores não poderão registrar novas OS ou materiais. Informe a senha de ação para confirmar."
                : "O sistema voltará a operar normalmente para todos os colaboradores. Informe a senha de ação para confirmar."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Senha de Ação</Label>
              <Input
                type="password"
                placeholder="Digite a senha de ação"
                value={systemControlPassword}
                onChange={e => setSystemControlPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !systemControlLoading && systemControlPassword && handleSystemControlToggle()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowToggleDialog(false)} disabled={systemControlLoading}>Cancelar</Button>
            <Button
              variant={systemActive ? "destructive" : "default"}
              onClick={handleSystemControlToggle}
              disabled={systemControlLoading || !systemControlPassword}
            >
              {systemControlLoading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processando…</>
                : systemActive ? "Confirmar Desativação" : "Confirmar Ativação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </div>
    </div>
  );
}
