/**
 * sse-broadcast — lightweight in-process SSE fan-out.
 *
 * Maintains a registry of active SSE response streams and provides
 * a single `broadcast()` function that pushes a typed event to every
 * connected client.  No external dependencies required.
 */
import type { Response } from "express";

export interface StatusChangedEvent {
  type: "status-changed";
  id: number;
  number: string;
  title: string;
  status: string;
  unidade: string;
  updatedAt: string;
}

export type SseEvent = StatusChangedEvent;

/** All currently open SSE client connections. */
const clients = new Set<Response>();

/**
 * Register a new SSE client (call once per GET /api/events request).
 * The client is automatically removed when its socket closes.
 */
export function addSseClient(res: Response): void {
  clients.add(res);
  res.on("close", () => clients.delete(res));
}

/**
 * Push an event to every connected SSE client.
 * Clients that have already disconnected are cleaned up silently.
 */
export function broadcast(event: SseEvent): void {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
}

/** Number of currently connected SSE clients (for health/debug). */
export function clientCount(): number {
  return clients.size;
}
