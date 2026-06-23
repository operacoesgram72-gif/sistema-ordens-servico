import { useState, useEffect } from "react";
import { Save, Bell, Share2, Copy, CheckCircle2, Mail, Server, Info, Send, XCircle, Loader2, ExternalLink } from "lucide-react";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type TestResult = { ok: true } | { ok: false; error: string } | null;

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
  });

  useEffect(() => {
    if (settings) {
      setForm({
        notificationEmail: (settings as any).notificationEmail ?? "",
        smtpHost: (settings as any).smtpHost ?? "",
        smtpPort: (settings as any).smtpPort ?? "",
        smtpUser: (settings as any).smtpUser ?? "",
        smtpPass: (settings as any).smtpPass ?? "",
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

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const smtpComplete = form.smtpHost && form.smtpPort && form.smtpUser && form.smtpPass && form.notificationEmail;

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground mt-1">Ajustes do sistema, notificações e compartilhamento.</p>
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
          {/* SMTP guidance */}
          <div className="rounded-md bg-amber-950/30 border border-amber-700/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
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
                className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2 mt-1">
                <ExternalLink className="w-3 h-3" />Documentação SMTP do Zoho
              </a>
            </div>

            <div className="border-t border-amber-700/30 pt-2 space-y-1">
              <p className="text-xs font-semibold text-foreground">Gmail (smtp.gmail.com)</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
                <li>Ative a <strong className="text-foreground">Verificação em duas etapas</strong> na sua conta Google</li>
                <li>Acesse <span className="font-mono bg-muted px-1 rounded">myaccount.google.com/apppasswords</span> e crie uma <strong className="text-foreground">Senha de App</strong></li>
                <li>Use essa senha de 16 caracteres — <strong className="text-amber-400">nunca a senha normal da conta</strong></li>
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

          {/* Test email result feedback */}
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

          {/* Test button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={handleTestEmail}
              disabled={!smtpComplete || testing}
              className="gap-2"
            >
              {testing
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />}
              {testing ? "Enviando..." : "Testar Envio"}
            </Button>
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
