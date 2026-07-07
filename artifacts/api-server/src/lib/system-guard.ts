import type { Request, Response, NextFunction } from "express";
import { isSystemActive } from "./system-status";

/**
 * Express middleware: rejects write requests (POST/PUT/PATCH) with 503 when
 * the administrator has deactivated the system via the Control Panel.
 *
 * GET requests are always allowed so read-only views keep working.
 */
export async function requireSystemActive(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const active = await isSystemActive();
  if (!active) {
    res.status(503).json({
      error: "Sistema temporariamente indisponível por decisão administrativa.",
      systemInactive: true,
    });
    return;
  }
  next();
}
