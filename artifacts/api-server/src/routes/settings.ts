import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";
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

/**
 * Middleware: restrict settings access to AM unit only.
 * Blocks requests from share sessions of non-AM units.
 * Regular admin sessions (no share token) are always allowed.
 */
function requireAMUnit(req: any, res: any, next: any) {
  const shareUnit: string | null = req.shareUnit ?? null;
  if (shareUnit && shareUnit !== "AM") {
    return res.status(403).json({ error: "Acesso restrito à unidade AM." });
  }
  next();
}

// ── System Control ────────────────────────────────────────────────────────────

// GET /system-status — public; returns active flag and whether a password has been set
router.get("/system-status", async (req, res) => {
  try {
    const settings = await getAllSettings();
    const active = settings.systemActive !== "false"; // default true
    const passwordSet = Boolean(settings.systemControlPasswordHash);
    const modulePasswordSet = Boolean(settings.systemModulePasswordHash);
    res.json({ active, passwordSet, modulePasswordSet });
  } catch (err) {
    req.log.error(err);
    // Fail open — never let a DB error lock out the system
    res.json({ active: true, passwordSet: false });
  }
});

// POST /settings/system-password (AM-only) — set or change the control password
// Body: { password: string, currentPassword?: string }
// When a password is already configured, `currentPassword` must be provided and correct.
router.post("/settings/system-password", requireAMUnit, async (req, res) => {
  try {
    const { password, currentPassword } = req.body as {
      password?: string;
      currentPassword?: string;
    };
    if (!password || typeof password !== "string" || password.trim().length < 6) {
      res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });
      return;
    }
    const settings = await getAllSettings();
    const existingHash = settings.systemControlPasswordHash;

    // If a password is already configured, the caller must prove knowledge of it
    if (existingHash) {
      if (!currentPassword || typeof currentPassword !== "string") {
        res.status(403).json({ error: "Informe a senha atual para alterá-la." });
        return;
      }
      const valid = await bcrypt.compare(currentPassword, existingHash);
      if (!valid) {
        res.status(403).json({ error: "Senha atual incorreta." });
        return;
      }
    }

    const hash = await bcrypt.hash(password.trim(), 12);
    await upsertSetting("systemControlPasswordHash", hash);
    // Initialise systemActive = true the first time a password is set
    if (!settings.systemActive) {
      await upsertSetting("systemActive", "true");
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno ao salvar senha." });
  }
});

// POST /settings/system-toggle (AM-only) — toggle active/inactive after password check
// Body: { password: string }
router.post("/settings/system-toggle", requireAMUnit, async (req, res) => {
  try {
    const { password } = req.body as { password?: string };
    if (!password || typeof password !== "string") {
      res.status(400).json({ error: "Senha obrigatória." });
      return;
    }
    const settings = await getAllSettings();
    const hash = settings.systemControlPasswordHash;
    if (!hash) {
      res.status(400).json({ error: "Senha de controle ainda não configurada." });
      return;
    }
    const valid = await bcrypt.compare(password, hash);
    if (!valid) {
      res.status(403).json({ error: "Senha incorreta." });
      return;
    }
    const current = settings.systemActive !== "false";
    const next = !current;
    await upsertSetting("systemActive", next ? "true" : "false");
    req.log.info({ active: next }, "System active state toggled");
    res.json({ active: next });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno ao alterar estado do sistema." });
  }
});

// POST /settings/system-module-password (AM-only) — set/change the module *access* password
// Body: { password: string, currentPassword?: string }
router.post("/settings/system-module-password", requireAMUnit, async (req, res) => {
  try {
    const { password, currentPassword } = req.body as {
      password?: string;
      currentPassword?: string;
    };
    if (!password || typeof password !== "string" || password.trim().length < 6) {
      res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });
      return;
    }
    const settings = await getAllSettings();
    const existingHash = settings.systemModulePasswordHash;

    if (existingHash) {
      if (!currentPassword || typeof currentPassword !== "string") {
        res.status(403).json({ error: "Informe a senha atual para alterá-la." });
        return;
      }
      const valid = await bcrypt.compare(currentPassword, existingHash);
      if (!valid) {
        res.status(403).json({ error: "Senha atual incorreta." });
        return;
      }
    }

    const hash = await bcrypt.hash(password.trim(), 12);
    await upsertSetting("systemModulePasswordHash", hash);
    req.log.info("System module access password updated");
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno ao salvar senha." });
  }
});

// POST /settings/system-module-verify (AM-only) — verify the module access password
// Body: { password: string } — returns { ok: true } on success, 403 on wrong password
//
// Priority chain:
//   1. systemModulePasswordHash — dedicated module-access password (set via /system-module-password)
//   2. systemControlPasswordHash — action password used as fallback when no module password is set
//   3. Neither configured — grant access immediately; frontend will prompt admin to configure one
router.post("/settings/system-module-verify", requireAMUnit, async (req, res) => {
  try {
    const { password } = req.body as { password?: string };
    if (!password || typeof password !== "string") {
      res.status(400).json({ error: "Senha obrigatória." });
      return;
    }
    const settings = await getAllSettings();
    const moduleHash = settings.systemModulePasswordHash;
    const actionHash = settings.systemControlPasswordHash;

    // No protection configured at all — grant access and signal frontend
    if (!moduleHash && !actionHash) {
      res.json({ ok: true, noPasswordConfigured: true });
      return;
    }

    // Verify against the most specific password available
    const hashToCheck = moduleHash ?? actionHash!;
    const valid = await bcrypt.compare(password, hashToCheck);
    if (!valid) {
      res.status(403).json({ error: "Senha incorreta." });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

// GET /share-urls — returns management area share URLs for all units (AM only)
router.get("/share-urls", requireAMUnit, async (req, res) => {
  const UNITS = ["AM", "AC", "AP", "RO", "RR", "PA"];
  const base = (process.env.PUBLIC_URL ?? "").replace(/\/$/, "");
  const result = UNITS.map((unit) => ({
    unit,
    token: generateShareToken(unit),
    url: `${base}?share=${unit}&t=${generateShareToken(unit)}`,
  }));
  res.json(result);
});

/**
 * Keys that must never be returned to the client, even to AM admins.
 * These hold credential material (hashes, raw passwords) that has no
 * business being in the browser.
 */
const SENSITIVE_KEYS = new Set([
  "systemControlPasswordHash",
  "systemModulePasswordHash",
]);

// GET /settings (AM-only)
router.get("/settings", requireAMUnit, async (req, res) => {
  try {
    const settings = await getAllSettings();
    // Strip credential/hash keys before sending to the client
    const safe = Object.fromEntries(
      Object.entries(settings).filter(([key]) => !SENSITIVE_KEYS.has(key))
    );
    res.json(safe);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// PUT /settings (AM-only)
router.put("/settings", requireAMUnit, async (req, res) => {
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

// POST /settings/test-email (AM-only)
router.post("/settings/test-email", requireAMUnit, async (req, res) => {
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

  type SMTPErr = Error & { code?: string; responseCode?: number; response?: string };

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const fetchWithTimeout = async (url: string, opts: RequestInit, ms = 25_000): Promise<Response> => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
    finally { clearTimeout(t); }
  };

  const hostNorm = host.trim().toLowerCase();

  // ── Resend API ─────────────────────────────────────────────────────────────
  // Host = "api.resend.com" → smtpUser = remetente, smtpPass = API key (re_…)
  if (hostNorm === "api.resend.com") {
    try {
      logger.info({ to: recipients, from: user }, "Resend API: sending email");
      const res = await fetchWithTimeout("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${pass}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `Painel de Serviços <${user}>`, to: recipients, subject: mail.subject, html: mail.html }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const msg = res.status === 401 || res.status === 403
          ? "Resend: API Key inválida ou sem permissão — verifique em resend.com/api-keys"
          : `Resend API erro ${res.status}: ${body}`;
        logger.error({ status: res.status, body }, "Resend send failed");
        return { ok: false, error: msg };
      }
      logger.info({ to: recipients }, "Email sent via Resend");
      return { ok: true };
    } catch (err) {
      const msg = (err as Error).message || "Erro de rede ao chamar Resend";
      logger.error({ message: msg }, "Resend fetch error");
      return { ok: false, error: msg };
    }
  }

  // ── SendGrid API ───────────────────────────────────────────────────────────
  // Host = "api.sendgrid.com" → smtpUser = remetente, smtpPass = API key (SG.…)
  if (hostNorm === "api.sendgrid.com") {
    try {
      logger.info({ to: recipients, from: user }, "SendGrid API: sending email");
      const res = await fetchWithTimeout("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${pass}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: recipients.map(e => ({ email: e })) }],
          from: { email: user, name: "Painel de Serviços" },
          subject: mail.subject,
          content: [{ type: "text/html", value: mail.html }],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const msg = res.status === 401 || res.status === 403
          ? "SendGrid: API Key inválida — verifique em app.sendgrid.com/settings/api_keys"
          : `SendGrid API erro ${res.status}: ${body}`;
        logger.error({ status: res.status, body }, "SendGrid send failed");
        return { ok: false, error: msg };
      }
      logger.info({ to: recipients }, "Email sent via SendGrid");
      return { ok: true };
    } catch (err) {
      const msg = (err as Error).message || "Erro de rede ao chamar SendGrid";
      logger.error({ message: msg }, "SendGrid fetch error");
      return { ok: false, error: msg };
    }
  }

  // ── SMTP (Gmail, Outlook, etc.) ────────────────────────────────────────────
  // Nota: o Render bloqueia portas SMTP saintes (465/587). Use Resend ou
  // SendGrid acima se estiver hospedado no Render.
  const SMTP_TIMEOUTS = {
    connectionTimeout: 90_000,
    greetingTimeout:   90_000,
    socketTimeout:     90_000,
    maxConnections:    5,
    maxMessages:       100,
  } as const;

  const trySMTPPort = async (tryPort: number): Promise<null | SMTPErr> => {
    try {
      const transporter = nodemailer.createTransport({
        host, port: tryPort, secure: tryPort === 465,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
        ...SMTP_TIMEOUTS,
      });
      await transporter.sendMail({
        from: `"Painel de Serviços" <${user}>`,
        to: recipients.join(", "),
        subject: mail.subject,
        html: mail.html,
        attachments: mail.attachments,
      });
      return null;
    } catch (err) { return err as SMTPErr; }
  };

  const isConnectivityError = (e: SMTPErr) =>
    e.code === "ECONNREFUSED" || e.code === "ETIMEDOUT" ||
    e.code === "ESOCKET"      || e.code === "ECONNECTION" ||
    /timeout|timed out|connect|socket close/i.test(e.message);

  const sendWithRetry = async (tryPort: number): Promise<null | SMTPErr> => {
    let lastErr: SMTPErr | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      logger.info({ host, port: tryPort, attempt }, "SMTP send attempt");
      const err = await trySMTPPort(tryPort);
      if (err === null) return null;
      lastErr = err;
      logger.warn({ host, port: tryPort, attempt, code: err.code, message: err.message }, "SMTP attempt failed");
      if (!isConnectivityError(err)) break;
      if (attempt < 3) await sleep(Math.pow(2, attempt) * 1_000);
    }
    return lastErr;
  };

  let err = await sendWithRetry(port);
  if (err === null) { logger.info({ to: recipients, host, port }, "Email sent via SMTP"); return { ok: true }; }

  if (port === 465 && isConnectivityError(err)) {
    logger.warn({ host, fallbackPort: 587, code: err.code }, "Port 465 unreachable — retrying on 587");
    const fb = await sendWithRetry(587);
    if (fb === null) { logger.info({ to: recipients, host, port: 587 }, "Email sent via SMTP port 587"); return { ok: true }; }
    err = fb;
  }

  // Detecta bloqueio de porta do Render e sugere alternativa
  const renderBlocked = isConnectivityError(err);
  const friendlyMsg = renderBlocked
    ? `Falha de conexão SMTP (${err.message}). O Render bloqueia portas SMTP — configure Host como "api.resend.com" ou "api.sendgrid.com" com a respectiva API Key no campo Senha.`
    : (err.message || "Erro desconhecido ao enviar e-mail.");

  logger.error(
    { smtp: { host, port, user }, to: recipients, errorCode: err.code, message: err.message },
    "Email send failed (all attempts exhausted)"
  );
  return { ok: false, error: friendlyMsg };
}

function parsePhotoAttachments(photos?: string | null): { filename: string; content: Buffer; contentType: string }[] {
  if (!photos) return [];
  try {
    const list = JSON.parse(photos);
    if (!Array.isArray(list)) return [];
    const attachments: { filename: string; content: Buffer; contentType: string }[] = [];
    list.forEach((entry, idx) => {
      if (typeof entry !== "string") return;
      // Skip object-storage paths (videos) — they're handled as links, not attachments
      if (entry.startsWith("/objects/")) return;
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

/** Extract /objects/... video paths stored alongside base64 photos. */
function parseVideoPaths(photos?: string | null): string[] {
  if (!photos) return [];
  try {
    const list: unknown[] = JSON.parse(photos);
    return list.filter((e): e is string => typeof e === "string" && e.startsWith("/objects/"));
  } catch { return []; }
}

/** Construct the full public URL for a stored video, or null if the domain is unknown. */
function buildVideoUrl(objectPath: string): string | null {
  const devDomain = process.env["REPLIT_DEV_DOMAIN"];
  if (!devDomain) return null;
  // objectPath is like /objects/videos/uuid; serving endpoint strips leading /objects
  const servePath = objectPath.replace(/^\/objects\//, "");
  const base = (process.env["BASE_PATH"] || "").replace(/\/$/, "");
  return `https://${devDomain}${base}/api/storage/objects/${servePath}`;
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

  // Build clickable download buttons for any videos stored in object storage
  const videoPaths = parseVideoPaths(os.photos);
  const videoButtons = videoPaths
    .map((p, i) => {
      const url = buildVideoUrl(p);
      return url
        ? `<a href="${url}" style="display:inline-block;background:#f59e0b;color:#fff;padding:7px 16px;border-radius:5px;text-decoration:none;font-size:13px;font-weight:600;margin-right:6px;margin-bottom:4px">▶ Baixar Vídeo ${videoPaths.length > 1 ? i + 1 : ""}</a>`
        : `<span style="color:#666;font-size:13px">Vídeo ${i + 1} disponível no sistema.</span>`;
    })
    .join(" ");
  const videosRow = videoButtons
    ? `<tr><td style="padding:8px 0;color:#666;vertical-align:top">Vídeos</td><td style="padding:8px 0">${videoButtons}</td></tr>`
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
            ${videosRow}
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
