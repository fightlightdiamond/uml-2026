import express from "express";
import { pool, waitForPostgres } from "../shared/db.js";
import { log } from "../shared/log.js";
import { readTrace, traceparent, withSpan } from "../shared/trace.js";

process.env.SERVICE_NAME = "payment";

const fraudUrl = process.env.FRAUD_URL || "http://fraud:3003";
const poolSize = Number(process.env.FRAUD_POOL || 2);
let poolInUse = 0;
let consecutiveFailures = 0;
let circuit = "closed";
let openedAt = 0;
const OPEN_MS = 5000;

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, circuit, poolInUse, poolSize });
});

app.get("/payments/:intentId", async (req, res) => {
  const found = await pool.query("SELECT * FROM payments WHERE intent_id = $1", [req.params.intentId]);
  if (found.rowCount === 0) {
    res.status(404).json({ status: "NOT_FOUND" });
    return;
  }
  res.json(found.rows[0]);
});

app.post("/payments", async (req, res) => {
  const parent = readTrace(req);
  const { intentId, orderId, amount } = req.body || {};
  if (!intentId || !Number.isInteger(amount)) {
    res.status(400).json({ error: "intentId and integer amount are required" });
    return;
  }
  const deadline = Number(req.headers["x-deadline-ms"] || Date.now() + 2000);
  await withSpan("payment.charge", parent, { intentId }, async (ctx) => {
    res.set("traceparent", traceparent(ctx));
    const existing = await pool.query("SELECT * FROM payments WHERE intent_id = $1", [intentId]);
    if (existing.rowCount === 1) {
      log("payment.replay", { intentId, traceId: ctx.traceId });
      res.json({ ...existing.rows[0], replayed: true });
      return;
    }
    const remaining = deadline - Date.now();
    if (remaining < 150) {
      res.status(504).json({ error: "deadline_exceeded", remaining });
      return;
    }
    const fraud = await callFraud(ctx, remaining - 100);
    if (!fraud.ok) {
      res.status(fraud.status).json({ error: fraud.error, circuit });
      return;
    }
    await pool.query(
      "INSERT INTO payments (intent_id, order_id, amount, status) VALUES ($1, $2, $3, 'SUCCEEDED')",
      [intentId, orderId || null, amount],
    );
    log("payment.committed", { intentId, traceId: ctx.traceId });
    const hold = Number(req.headers["x-hold-response-ms"] || 0);
    if (hold > 0) await new Promise((resolve) => setTimeout(resolve, hold));
    res.json({ intentId, status: "SUCCEEDED", replayed: false });
  });
});

async function callFraud(ctx, timeoutMs) {
  if (circuit === "open" && Date.now() - openedAt < OPEN_MS) {
    return { ok: false, status: 503, error: "circuit_open" };
  }
  if (circuit === "open") circuit = "half_open";
  if (poolInUse >= poolSize) {
    return { ok: false, status: 503, error: "fraud_pool_exhausted" };
  }
  poolInUse += 1;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${fraudUrl}/check`, {
      method: "POST",
      headers: { "content-type": "application/json", traceparent: traceparent(ctx) },
      body: "{}",
      signal: controller.signal,
    });
    if (!response.ok) {
      noteFailure();
      return { ok: false, status: response.status, error: "fraud_rejected" };
    }
    consecutiveFailures = 0;
    circuit = "closed";
    return { ok: true };
  } catch {
    noteFailure();
    return { ok: false, status: 504, error: "fraud_timeout" };
  } finally {
    clearTimeout(timer);
    poolInUse -= 1;
  }
}

function noteFailure() {
  consecutiveFailures += 1;
  if (consecutiveFailures >= 3) {
    circuit = "open";
    openedAt = Date.now();
    log("payment.circuit.open", { consecutiveFailures });
  }
}

await waitForPostgres();
app.listen(3002, () => log("listening", { port: 3002, poolSize }));
