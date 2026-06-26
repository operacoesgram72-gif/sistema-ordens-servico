import { useState, useEffect } from "react";
import {
  Save, Bell, Share2, Copy, CheckCircle2, Mail, Server, Info,
  Send, XCircle, Loader2, ExternalLink, Plug, Plus, Trash2, Eye, EyeOff,
} from "lucide-react";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
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
];

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function Configuracoes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const [copied, setCopied] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>(null);
  const [testing, setTesting] = useState(false);

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

  const [connections, setConnections] = useState<SavedConnection[]>([]);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [connForm, setConnForm] = useState({ label: "", apiKey: "", endpointUrl: "" });
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

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

  const shareUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/registrar`;

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast({ title: "Link copiado!", description: "Compartilhe com os funcionários." });
    });
  };

  const handleSave = async () => {
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
    try {
      const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${baseUrl}/api/settings/test-email`, { method: "POST" });
      const data = await res.json();
      setTestResult(data);
      if (data.ok) {
        toast({ title: "E-mail enviado!", description: "Verifique sua caixa de entrada." });
      } else {
        toast({ title: "Falha no envio", description: data.error, variant: "destructive" });
      }
    } catch {
      setTestResult({ ok: false, error: "Erro de rede ao testar envio." });
    } finally {
      setTesting(false);
    }
  };

  const saveConnection = (integrationId: string) => {
    if (!connForm.label.trim()) return;
    setConnections((prev) => [
      ...prev,
      { id: genId(), integrationId, ...connForm },
    ]);
    setConnForm({ label: "", apiKey: "", endpointUrl: "" });
    setAddingFor(null);
    toast({ title: "Conexão salva!", description: "Integração configurada com sucesso." });
  };

  const removeConnection = (id: string) => setConnections((prev) => prev.filter((c) => c.id !== id));

  const toggleShowKey = (id: string) => setShowKey((prev) => ({ ...prev, [id]: !prev[id] }));

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const smtpComplete = form.smtpHost && form.smtpPort && form.smtpUser && form.smtpPass && form.notificationEmail;

  const categories = [...new Set(AVAILABLE_INTEGRATIONS.map((i) => i.category))];

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground mt-1">Ajustes do sistema, notificações e integrações.</p>
      </div>

      {/* Notificações por E-mail */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="w-5 h-5 text-primary" />
            Notificações por E-mail
          </CardTitle>
          <CardDescription>
            Receba um e-mail automático sempre que uma nova OS for registrada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              E-mail de Destino das Notificações
            </Label>
            <Input
              type="email"
              placeholder="gestor@empresa.com.br"
              value={form.notificationEmail}
              onChange={(e) => setForm(f => ({ ...f, notificationEmail: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Cada vez que um funcionário registrar uma OS, esse e-mail receberá um aviso com os detalhes.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Configuração SMTP */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="w-5 h-5 text-primary" />
            Configuração de Envio (SMTP)
          </CardTitle>
          <CardDescription>
            Dados do servidor de e-mail para envio das notificações.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <a href="https://www.zoho.com/mail/help/zoho-smtp.html" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 underline underline-offset-2 mt-1">
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
              <Input placeholder="smtp.gmail.com" value={form.smtpHost} onChange={(e) => setForm(f => ({ ...f, smtpHost: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Porta</Label>
              <Input placeholder="587" value={form.smtpPort} onChange={(e) => setForm(f => ({ ...f, smtpPort: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Usuário (e-mail remetente)</Label>
              <Input type="email" placeholder="remetente@gmail.com" value={form.smtpUser} onChange={(e) => setForm(f => ({ ...f, smtpUser: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Senha de App</Label>
              <Input type="password" placeholder="Senha de 16 dígitos gerada pelo Google" value={form.smtpPass} onChange={(e) => setForm(f => ({ ...f, smtpPass: e.target.value }))} />
            </div>
          </div>

          {testResult && (
            <div className={`rounded-md border p-3 flex items-start gap-2 text-sm ${
              testResult.ok
                ? "bg-emerald-950/30 border-emerald-700/50 text-emerald-400"
                : "bg-red-950/30 border-red-700/50 text-red-400"
            }`}>
              {testResult.ok
                ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>
                {testResult.ok
                  ? `E-mail de teste enviado com sucesso para ${form.notificationEmail}!`
                  : `Falha: ${testResult.error}`}
              </span>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={handleTestEmail}
              disabled={!smtpComplete || testing}
              className="gap-2"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {testing ? "Enviando..." : "Testar Envio"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notificações WhatsApp / n8n */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Send className="w-5 h-5 text-primary" />
            Notificações por WhatsApp / n8n
          </CardTitle>
          <CardDescription>
            Configure webhooks para disparar mensagens automáticas no WhatsApp ou fluxos de automação via n8n quando uma OS for registrada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <span>💬</span> URL do Webhook — WhatsApp
            </Label>
            <Input
              placeholder="https://api.z-api.io/instances/INSTANCE/token/TOKEN/send-text"
              value={form.webhookUrlWhatsapp}
              onChange={(e) => setForm(f => ({ ...f, webhookUrlWhatsapp: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Use Z-API, Evolution API ou outro gateway. A OS será enviada como JSON no body do POST.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <span>🔄</span> URL do Webhook — n8n / Zapier
            </Label>
            <Input
              placeholder="https://n8n.suaempresa.com/webhook/os-civil"
              value={form.webhookUrlN8n}
              onChange={(e) => setForm(f => ({ ...f, webhookUrlN8n: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Toda nova OS criada enviará um POST com os dados completos para este endpoint.
            </p>
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
      </Card>

      {/* Monitoramento de E-mail */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="w-5 h-5 text-primary" />
            Monitoramento de E-mail (Entrada)
          </CardTitle>
          <CardDescription>
            Monitore uma caixa de entrada e converta e-mails recebidos automaticamente em ordens de serviço.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-md border border-border/60 bg-muted/30">
            <div>
              <p className="text-sm font-medium">Monitoramento Ativo</p>
              <p className="text-xs text-muted-foreground mt-0.5">Liga/desliga a criação automática de OS por e-mail</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, emailMonitoringEnabled: f.emailMonitoringEnabled === "true" ? "false" : "true" }))}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${form.emailMonitoringEnabled === "true" ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow ${form.emailMonitoringEnabled === "true" ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Endereço de E-mail Monitorado
            </Label>
            <Input
              type="email"
              placeholder="chamados@redeamazonica.com.br"
              value={form.emailMonitoringAddress}
              onChange={(e) => setForm(f => ({ ...f, emailMonitoringAddress: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              E-mails recebidos neste endereço serão parseados e transformados em novas OS com origem "E-mail".
              Configure seu servidor de e-mail para fazer forward para esta caixa.
            </p>
          </div>
          <div className="rounded-md bg-amber-950/20 border border-amber-700/30 p-3 text-xs text-amber-400/90 flex gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
            <span>
              A integração de e-mail requer configuração de IMAP ou webhook de e-mail no seu servidor.
              Salve as configurações e entre em contato com o administrador do sistema para ativação completa.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Compartilhamento */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Share2 className="w-5 h-5 text-primary" />
            Link de Registro para Funcionários
          </CardTitle>
          <CardDescription>
            Envie este link para os funcionários abrirem chamados sem acesso ao painel de gestão.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input value={shareUrl} readOnly className="font-mono text-sm bg-muted/50" />
            <Button variant="outline" onClick={copyLink} className="shrink-0">
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            O funcionário preenche o formulário e recebe um número de protocolo. Nenhuma informação de gestão é visível nessa página.
          </p>
        </CardContent>
      </Card>

      {/* Integrações */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plug className="w-5 h-5 text-primary" />
            Integrações e Conexões
          </CardTitle>
          <CardDescription>
            Conecte o sistema a outras plataformas para compartilhamento, análise e automação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Conexões ativas */}
          {connections.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Conexões Ativas</p>
              {connections.map((conn) => {
                const integration = AVAILABLE_INTEGRATIONS.find((i) => i.id === conn.integrationId);
                return (
                  <div key={conn.id} className="flex items-center gap-3 p-3 rounded-md border border-border/70 bg-muted/20 group">
                    <span className="text-lg">{integration?.logo}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{conn.label}</span>
                        <Badge variant="outline" className="text-[10px] py-0 text-emerald-400 border-emerald-700/50">Configurado</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{integration?.name}</p>
                      {conn.endpointUrl && (
                        <p className="text-xs text-muted-foreground truncate">{conn.endpointUrl}</p>
                      )}
                      {conn.apiKey && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-xs font-mono text-muted-foreground">
                            {showKey[conn.id] ? conn.apiKey : "••••••••••••••••"}
                          </span>
                          <button onClick={() => toggleShowKey(conn.id)} className="text-muted-foreground hover:text-foreground">
                            {showKey[conn.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeConnection(conn.id)}
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Integrações disponíveis por categoria */}
          {categories.map((category) => (
            <div key={category} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">{category}</p>
              <div className="grid grid-cols-1 gap-2">
                {AVAILABLE_INTEGRATIONS.filter((i) => i.category === category).map((integration) => {
                  const isAdding = addingFor === integration.id;
                  const connCount = connections.filter((c) => c.integrationId === integration.id).length;

                  return (
                    <div key={integration.id} className="rounded-md border border-border/70 bg-muted/20 overflow-hidden">
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
                          <a
                            href={integration.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary transition-colors"
                            title="Ver documentação"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <Button
                            size="sm"
                            variant={isAdding ? "default" : "outline"}
                            className="gap-1.5 h-7 text-xs"
                            onClick={() => {
                              setAddingFor(isAdding ? null : integration.id);
                              setConnForm({ label: "", apiKey: "", endpointUrl: "" });
                            }}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {isAdding ? "Cancelar" : "Conectar"}
                          </Button>
                        </div>
                      </div>

                      {isAdding && (
                        <div className="px-4 pb-4 pt-1 border-t border-border/50 space-y-3 bg-card/40">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Nome da Conexão *</Label>
                            <Input
                              placeholder="Ex: Planilha OS 2025"
                              value={connForm.label}
                              onChange={(e) => setConnForm(f => ({ ...f, label: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">URL / Endpoint</Label>
                            <Input
                              placeholder="https://..."
                              value={connForm.endpointUrl}
                              onChange={(e) => setConnForm(f => ({ ...f, endpointUrl: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Chave de API / Token</Label>
                            <Input
                              type="password"
                              placeholder="Cole sua chave aqui"
                              value={connForm.apiKey}
                              onChange={(e) => setConnForm(f => ({ ...f, apiKey: e.target.value }))}
                            />
                          </div>
                          <div className="flex justify-end">
                            <Button size="sm" className="gap-1.5" onClick={() => saveConnection(integration.id)}>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Salvar Conexão
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
      </Card>

      {/* Save button */}
      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={updateSettings.isPending} size="lg" className="w-full md:w-auto">
          {updateSettings.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
          ) : (
            <><Save className="w-4 h-4 mr-2" />Salvar Configurações</>
          )}
        </Button>
      </div>
    </div>
  );
}
