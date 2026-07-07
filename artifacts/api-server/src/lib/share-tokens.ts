import { createHmac, timingSafeEqual } from "crypto";

const UNITS = ["AM", "AC", "AP", "RO", "RR", "PA"] as const;

function getSecret(): string {
  return process.env.SESSION_SECRET ?? "gram-share-fallback-secret";
}

/**
 * Generate a deterministic share token for a given unit.
 * Token is HMAC-SHA256(SESSION_SECRET, "share:<UNIT>"), hex-encoded, first 48 chars.
 * Deterministic — no DB storage required.
 */
export function generateShareToken(unit: string): string {
  return createHmac("sha256", getSecret())
    .update(`share:${unit}`)
    .digest("hex")
    .slice(0, 48);
}

/**
 * Validate a share token and return the associated unit, or null if invalid.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function validateShareToken(token: string): string | null {
  if (!token || token.length !== 48) return null;
  for (const unit of UNITS) {
    const expected = generateShareToken(unit);
    try {
      const a = Buffer.from(expected, "utf8");
      const b = Buffer.from(token.slice(0, expected.length), "utf8");
      if (a.length === b.length && timingSafeEqual(a, b)) return unit;
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Express middleware: reads X-Share-Token header, validates it, and attaches
 * shareUnit to req (or null if not a share request / invalid token).
 *
 * For AM tokens: shareUnit = "AM" (no restriction — AM admin can see all units)
 * For other tokens: shareUnit = the specific unit (data is restricted to that unit)
 */
export function shareTokenMiddleware(
  req: any,
  _res: any,
  next: () => void
): void {
  const token = (req.headers["x-share-token"] as string | undefined) ?? "";
  req.shareUnit = token ? validateShareToken(token) : null;
  next();
}

/**
 * Resolve the effective unit for a request.
 *
 * Rules:
 *  - No share token → use whatever unit was passed in the request (admin mode, unrestricted)
 *  - Share token for AM → user may pass any unidade query param (AM sees all)
 *  - Share token for other unit → always override with shareUnit (no bypass possible)
 */
export function resolveUnit(req: any, requestedUnit?: string): string | undefined {
  const shareUnit: string | null = req.shareUnit ?? null;
  if (!shareUnit) {
    // Not a share request — admin, unrestricted
    return requestedUnit;
  }
  if (shareUnit === "AM") {
    // AM share: allow any sub-unit filter
    return requestedUnit;
  }
  // Non-AM share: always restrict to shareUnit regardless of query params
  return shareUnit;
}
