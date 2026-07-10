import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// CORS — allow all origins so the frontend (served from a different domain on
// Render) can reach the API. Credentials are not used so wildcard is safe.
app.use(cors({
  origin: true,          // reflect the request origin
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Share-Token"],
  credentials: false,
}));

// Handle OPTIONS preflight — cors() middleware already responds to OPTIONS
// automatically, but registering it on all paths makes it explicit.
// Express 5 requires "/{*path}" (not bare "*") for wildcard routes.
app.options("/{*path}", cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Share-Token"],
  credentials: false,
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ── Health check endpoints ──────────────────────────────────────────────────
// Exposed at two paths so both Replit and Render probes are satisfied:
//  • /health          — simple liveness check (used by Replit proxy)
//  • /api/healthz     — checked by artifact.toml startup health probe
//
// Both endpoints check actual DB connectivity so health reports reflect
// real service state rather than just "process is alive".
async function healthHandler(_req: express.Request, res: express.Response) {
  try {
    // Lazy import to avoid circular dependency at module load time.
    const { pool } = await import("@workspace/db");
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    res.json({ status: "ok", db: "connected", timestamp: new Date().toISOString() });
  } catch (err) {
    logger.warn({ err }, "Health check: DB unavailable");
    // Return 200 (not 503) so Render doesn't cycle the process — the DB may be
    // temporarily unreachable while still serving cached reads.  Set db:"degraded"
    // so monitoring tools can distinguish liveness from full readiness.
    res.json({ status: "ok", db: "degraded", timestamp: new Date().toISOString() });
  }
}

app.get("/health", healthHandler);
app.get("/api/healthz", healthHandler);

app.use("/api", router);

// ── Global Express error handler ────────────────────────────────────────────
// Catches any error thrown (or passed to next()) by a route handler.
// Without this, Express 5 converts unhandled route errors into unhandled
// promise rejections which crash the process.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const status = (err as any)?.status ?? (err as any)?.statusCode ?? 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : (err as Error)?.message ?? "Unknown error";

  logger.error({ err, url: req.url, method: req.method }, "Unhandled route error");
  res.status(status).json({ error: message });
});

export default app;
