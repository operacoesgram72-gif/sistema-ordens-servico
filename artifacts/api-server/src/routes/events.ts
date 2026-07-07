/**
 * GET /api/events — Server-Sent Events endpoint.
 *
 * Clients connect here to receive real-time push events (e.g. status
 * changes on service orders) without polling.
 */
import { Router } from "express";
import { addSseClient } from "../lib/sse-broadcast";

const router = Router();

router.get("/events", (req, res) => {
  // SSE headers — disable buffering so data is flushed immediately.
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  // Send a comment to keep the connection alive and verify delivery.
  res.write(": connected\n\n");

  // Register for broadcasts; cleanup on disconnect is handled inside addSseClient.
  addSseClient(res);

  // Keep-alive ping every 25 s to prevent proxy/load-balancer timeouts.
  const keepAlive = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(keepAlive);
    }
  }, 25_000);

  req.on("close", () => clearInterval(keepAlive));
});

export default router;
