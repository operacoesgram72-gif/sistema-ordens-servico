import { execFile } from "node:child_process";
import { resolve } from "node:path";
import app from "./app";
import { logger } from "./lib/logger";

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

// Run migrations before accepting traffic so schema is always up-to-date.
async function runMigrations(): Promise<void> {
  const scriptPath = resolve(process.cwd(), "../../scripts/migrate.mjs");
  return new Promise((resolve_, reject) => {
    execFile(process.execPath, [scriptPath], (err, stdout, stderr) => {
      if (stdout) logger.info({ msg: "migrate", out: stdout.trim() });
      if (stderr) logger.warn({ msg: "migrate stderr", out: stderr.trim() });
      if (err) {
        logger.error({ err }, "Migration failed — continuing anyway");
      }
      resolve_();
    });
  });
}

await runMigrations();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
