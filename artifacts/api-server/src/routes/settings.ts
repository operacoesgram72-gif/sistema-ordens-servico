import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";

const router = Router();

const SETTING_KEYS = [
  "notificationEmail",
  "smtpHost",
  "smtpPort",
  "smtpUser",
  "smtpPass",
  "companyName",
  "department",
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

// Exported utility: send OS notification email
export async function sendOsNotification(os: {
  number: string;
  title: string;
  location: string;
  priority: string;
  technicianName?: string | null;
  formatoServico?: string | null;
  estimatedValue?: number | null;
}) {
  try {
    const settings = await getAllSettings();
    const to = settings.notificationEmail;
    if (!to) return; // not configured

    const host = settings.smtpHost || process.env.SMTP_HOST;
    const port = Number(settings.smtpPort || process.env.SMTP_PORT || 587);
    const user = settings.smtpUser || process.env.SMTP_USER;
    const pass = settings.smtpPass || process.env.SMTP_PASS;

    if (!host || !user || !pass) return; // SMTP not configured

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const valor = os.estimatedValue
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(os.estimatedValue)
      : "Não definido";

    await transporter.sendMail({
      from: `"Painel de Serviços" <${user}>`,
      to,
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
              <tr><td style="padding:6px 0;color:#666">Valor Estimado</td><td style="color:#f59e0b;font-weight:bold">${valor}</td></tr>
            </table>
          </div>
          <div style="background:#f9f9f9;padding:12px 20px;font-size:12px;color:#999">
            Painel de Serviços — Grupo Rede Amazônica
          </div>
        </div>
      `,
    });
  } catch (err) {
    // Non-fatal: email errors should not break OS creation
    console.warn("Email notification failed:", (err as Error).message);
  }
}

export default router;
