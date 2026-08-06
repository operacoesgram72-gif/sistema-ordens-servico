import { execFile } from "node:child_process";
import { resolve } from "node:path";
import app from "./app";
import { logger } from "./lib/logger";
import { startAutoLateScheduler } from "./lib/auto-late-job";

// ── Global safety nets — must be registered before any async code ────────────
// These prevent silent crashes from unhandled rejections / exceptions.
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection — server continues");
});
process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — server continues");
});

// Validate SMTP env vars at startup so misconfiguration is caught immediately
// in logs rather than silently failing on the first email send.
function validateEnv() {
  const warnings: string[] = [];
  if (!process.env["DATABASE_URL"]) warnings.push("DATABASE_URL not set — DB will be unavailable");
  if (!process.env["SMTP_HOST"] && !process.env["SMTP_USER"]) {
    logger.info("SMTP env vars not set — SMTP config will be loaded from DB settings at send time");
  }
  for (const w of warnings) logger.warn(w);
}
validateEnv();

// ── Migration runner ─────────────────────────────────────────────────────────
// Resolve the script path relative to __dirname (set by the esbuild banner to
// the directory of the bundled file — e.g. artifacts/api-server/dist/).
// This is correct in both development (after local build) and production
// (Render runs `node artifacts/api-server/dist/index.mjs` from project root).
//
// Do NOT use process.cwd() — in production cwd is the project root, so
// resolve(cwd, "../../scripts/...") would point outside the repository.

async function runMigrations(): Promise<void> {
  // __dirname is injected by the esbuild build banner — it equals the directory
  // containing dist/index.mjs, i.e. artifacts/api-server/dist/.
  // Going ../../ from there reaches the project root where scripts/ lives.
  const distDir: string =
    typeof __dirname !== "undefined"
      ? __dirname
      : resolve(process.cwd(), "artifacts/api-server/dist");

  // dist/ → api-server/ → artifacts/ → project-root/ → scripts/migrate.mjs
  const scriptPath = resolve(distDir, "../../../scripts/migrate.mjs");

  return new Promise((resolve_) => {
    execFile(process.execPath, [scriptPath], { timeout: 60_000 }, (err, stdout, stderr) => {
      if (stdout) logger.info({ msg: "migrate", out: stdout.trim() });
      if (stderr) logger.warn({ msg: "migrate stderr", out: stderr.trim() });
      if (err) {
        logger.error({ err }, "Migration script error — server starts anyway");
      }
      resolve_();
    });
  });
}

await runMigrations();

// ── Start server ─────────────────────────────────────────────────────────────
const rawPort = process.env["PORT"];
const port = rawPort ? Number(rawPort) : 8080; // default to 8080 so Render always binds

if (Number.isNaN(port) || port <= 0) {
  logger.error({ rawPort }, "Invalid PORT value — defaulting to 8080");
}

const boundPort = Number.isNaN(port) || port <= 0 ? 8080 : port;

app.listen(boundPort, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port: boundPort }, "Server listening");

  // ── Auto-late scheduler — marks overdue OS as "atrasada" ─────────────────
  startAutoLateScheduler();

  // ── Self-ping — keeps the Render free-tier instance awake ───────────────
  // Render suspends free services after 15 min of inactivity, causing a
  // ~50 s cold start for the next real user. We ping ourselves every 12 min
  // so the host never sees 15 consecutive minutes without traffic.
  const APP_URL = process.env["APP_URL"];
  if (APP_URL) {
    const PING_INTERVAL_MS = 12 * 60 * 1000; // 12 minutes
    setInterval(async () => {
      try {
        await fetch(`${APP_URL}/health`);
        logger.info("Self-ping executado com sucesso");
      } catch (pingErr) {
        logger.warn({ err: pingErr }, "Self-ping falhou — servidor continuará normalmente");
      }
    }, PING_INTERVAL_MS);
    logger.info({ url: APP_URL, intervalMinutes: 12 }, "Self-ping agendado");
  } else {
    logger.info("APP_URL não definida — self-ping desativado");
  }
});
