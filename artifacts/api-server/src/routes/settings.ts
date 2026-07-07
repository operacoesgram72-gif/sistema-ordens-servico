import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";
import { logger } from "../lib/logger";
import { generateShareToken } from "../lib/share-tokens";

const router = Router();

const SETTING_KEYS = [
  "notificationEmail",
  "smtpHost",
  "smtpPort",
  "smtpUser",
  "smtpPass",
  "companyName",
  "department",
  "webhookUrlWhatsapp",
  "webhookUrlN8n",
  "emailMonitoringAddress",
  "emailMonitoringEnabled",
  "defaultOrigem",
];

async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(settingsTable);
  const map: Record<string, string> = {};
  rows.forEach((r) => { if (r.key && r.value) map[r.key] = r.value; });
  return map;
}

async function upsertSetting(key: string, value: string) {
  const existing = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  if (existing.length > 0) {
    await db.update(settingsTable).set({ value, updatedAt: new Date() }).where(eq(settingsTable.key, key));
  } else {
    await db.insert(settingsTable).values({ key, value });
  }
}

// GET /share-urls — returns management area share URLs for all units (admin only; no auth required as admin area has none)
router.get("/share-urls", async (req, res) => {
  const UNITS = ["AM", "AC", "AP", "RO", "RR", "PA"];
  const base = (process.env.PUBLIC_URL ?? "").replace(/\/$/, "");
  const result = UNITS.map((unit) => ({
    unit,
    token: generateShareToken(unit),
    url: `${base}?share=${unit}&t=${generateShareToken(unit)}`,
  }));
  res.json(result);
});

// GET /settings
router.get("/settings", async (req, res) => {
  try {
    const settings = await getAllSettings();
    res.json(settings);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// PUT /settings
router.put("/settings", async (req, res) => {
  try {
    const body = req.body as Record<string, string>;
    for (const key of SETTING_KEYS) {
      if (body[key] !== undefined) {
        await upsertSetting(key, body[key]);
      }
    }
    const updated = await getAllSettings();
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /settings/test-email
router.post("/settings/test-email", async (req, res) => {
  try {
    const result = await attemptSendEmail({
      subject: "[Teste] Painel de Serviços — Configuração de E-mail",
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;border:1px solid #ddd;border-radius:8px;overflow:hidden">
          <div style="background:#f59e0b;color:#fff;padding:16px 20px">
            <strong style="font-size:18px">✅ Configuração de E-mail OK</strong>
          </div>
          <div style="padding:20px;color:#333">
            <p>Este é um e-mail de teste enviado pelo <strong>Painel de Serviços</strong>.</p>
            <p>Se você recebeu esta mensagem, o servidor de e-mail está configurado corretamente.</p>
          </div>
          <div style="background:#f9f9f9;padding:12px 20px;font-size:12px;color:#999">
            Painel de Serviços — Grupo Rede Amazônica
          </div>
        </div>
      `,
    });

    if (result.ok) {
      req.log.info("Test email sent successfully");
      res.json({ ok: true, message: "E-mail de teste enviado com sucesso!" });
    } else {
      req.log.warn({ error: result.error }, "Test email failed");
      res.status(400).json({ ok: false, error: result.error });
    }
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

// Internal helper: attempt to send email and return result (never throws).
// notificationEmail may be comma-separated — sends to all recipients.
async function attemptSendEmail(mail: {
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const settings = await getAllSettings();
  const toRaw = settings.notificationEmail || "";
  const host = settings.smtpHost || process.env.SMTP_HOST || "";
  const port = Number(settings.smtpPort || process.env.SMTP_PORT || 587);
  const user = settings.smtpUser || process.env.SMTP_USER || "";
  const pass = settings.smtpPass || process.env.SMTP_PASS || "";

  // Support multiple recipients: comma-separated list
  const recipients = toRaw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  logger.info(
    {
      smtp: { host, port, user: user || "(não configurado)" },
      to: recipients,
    },
    "Email send attempt"
  );

  if (recipients.length === 0) return { ok: false, error: "E-mail de destino não configurado nas Configurações." };
  if (!host) return { ok: false, error: "Host SMTP não configurado." };
  if (!user) return { ok: false, error: "Usuário SMTP não configurado." };
  if (!pass) return { ok: false, error: "Senha SMTP não configurada." };

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });

    await transporter.sendMail({
      from: `"Painel de Serviços" <${user}>`,
      to: recipients.join(", "),
      subject: mail.subject,
      html: mail.html,
      attachments: mail.attachments,
    });

    logger.info({ to: recipients, host, port }, "Email sent successfully");
    return { ok: true };
  } catch (err) {
    const e = err as Error & { code?: string; responseCode?: number; response?: string };
    logger.error(
      {
        smtp: { host, port, user },
        to: recipients,
        errorCode: e.code,
        responseCode: e.responseCode,
        smtpResponse: e.response,
        message: e.message,
        stack: e.stack,
      },
      "Email send failed"
    );
    return { ok: false, error: e.message || "Erro desconhecido ao enviar e-mail." };
  }
}

function parsePhotoAttachments(photos?: string | null): { filename: string; content: Buffer; contentType: string }[] {
  if (!photos) return [];
  try {
    const list = JSON.parse(photos);
    if (!Array.isArray(list)) return [];
    const attachments: { filename: string; content: Buffer; contentType: string }[] = [];
    list.forEach((entry, idx) => {
      if (typeof entry !== "string") return;
      const match = entry.match(/^data:(.+);base64,(.*)$/);
      if (!match) return;
      const [, mime, base64] = match;
      const ext = mime.split("/")[1]?.split("+")[0] || "bin";
      attachments.push({
        filename: `anexo-${idx + 1}.${ext}`,
        content: Buffer.from(base64, "base64"),
        contentType: mime,
      });
    });
    return attachments;
  } catch {
    return [];
  }
}

export async function sendOsNotification(os: {
  number: string;
  title: string;
  location: string;
  priority: string;
  description?: string | null;
  technicianName?: string | null;
  formatoServico?: string | null;
  estimatedValue?: number | null;
  photos?: string | null;
}) {
  const valor = os.estimatedValue
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(os.estimatedValue)
    : "Não definido";

  const descriptionRow = os.description
    ? `<tr><td style="padding:6px 0;color:#666;vertical-align:top">Descrição</td><td style="white-space:pre-wrap">${os.description}</td></tr>`
    : "";

  const attachments = parsePhotoAttachments(os.photos);
  const photosRow = attachments.length
    ? `<tr><td style="padding:6px 0;color:#666">Fotos anexadas</td><td>${attachments.length} arquivo(s) em anexo</td></tr>`
    : "";

  const result = await attemptSendEmail({
    subject: `[Nova OS] ${os.number} — ${os.location}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;border:1px solid #ddd;border-radius:8px;overflow:hidden">
        <div style="background:#f59e0b;color:#fff;padding:16px 20px">
          <strong style="font-size:18px">Nova Ordem de Serviço Registrada</strong>
        </div>
        <div style="padding:20px;color:#333">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#666;width:40%">Número</td><td style="font-weight:bold">${os.number}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Título</td><td>${os.title}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Local</td><td>${os.location}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Prioridade</td><td>${os.priority}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Formato</td><td>${os.formatoServico || "-"}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Técnico</td><td>${os.technicianName || "Não atribuído"}</td></tr>
            ${descriptionRow}
            <tr><td style="padding:6px 0;color:#666">Valor Estimado</td><td style="color:#f59e0b;font-weight:bold">${valor}</td></tr>
            ${photosRow}
          </table>
        </div>
        <div style="background:#f9f9f9;padding:12px 20px;font-size:12px;color:#999">
          Painel de Serviços — Grupo Rede Amazônica
        </div>
      </div>
    `,
    attachments,
  });

  if (!result.ok) {
    logger.warn({ error: result.error, os: { number: os.number } }, "OS notification email not sent");
  }
}

export default router;
