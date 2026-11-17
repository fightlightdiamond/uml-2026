import express from "express";
import { pool, waitForPostgres } from "../shared/db.js";
import { log } from "../shared/log.js";
import { asInteger, asString, isRecord } from "../shared/parse.js";
import { readTrace, traceparent, withSpan, type SpanContext } from "../shared/trace.js";

process.env.SERVICE_NAME = "payment";

const fraudUrl = process.env.FRAUD_URL || "http://fraud:3003";
const poolSize = Number(process.env.FRAUD_POOL || 2);
const fraudTimeoutMs = Number(process.env.FRAUD_TIMEOUT_MS || 500);
let poolInUse = 0;
let consecutiveFailures = 0;
let circuit: "closed" | "open" | "half_open" = "closed";
let openedAt = 0;
let halfOpenProbe = false;
const OPEN_MS = 5000;

interface Charge {
  intentId: string;
  orderId: string | null;
  amount: number;
}

type FraudCall =
  | { ok: true }
  | { ok: false; status: number; error: string };

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
  const charge = parseCharge(req.body);
  if (charge === undefined) {
    res.status(400).json({ error: "intentId and integer amount are required" });
    return;
  }
  const { intentId, orderId, amount } = charge;
  const deadline = Number(req.get("x-deadline-ms") || Date.now() + 2000);
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
    const caller = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) caller.abort();
    });
    const fraud = await callFraud(ctx, fraudCallTimeout(req.get("x-fraud-timeout-ms"), remaining), caller.signal);
    if (!fraud.ok) {
      if (!res.writableEnded) res.status(fraud.status).json({ error: fraud.error, circuit });
      return;
    }
    await pool.query(
      "INSERT INTO payments (intent_id, order_id, amount, status) VALUES ($1, $2, $3, 'SUCCEEDED')",
      [intentId, orderId || null, amount],
    );
    log("payment.committed", { intentId, traceId: ctx.traceId });
    const hold = Number(req.get("x-hold-response-ms") || 0);
    if (hold > 0) await new Promise((resolve) => setTimeout(resolve, hold));
    if (!res.writableEnded && !res.destroyed) {
      res.json({ intentId, status: "SUCCEEDED", replayed: false });
    }
  });
});

function parseCharge(body: unknown): Charge | undefined {
  if (!isRecord(body)) return undefined;
  const intentId = asString(body.intentId);
  const amount = asInteger(body.amount);
  if (intentId === undefined || amount === undefined) return undefined;
  return { intentId, orderId: asString(body.orderId) ?? null, amount };
}

function fraudCallTimeout(header: string | undefined, remaining: number): number {
  const override = header === undefined ? Number.NaN : Number(header);
  const cap = Number.isFinite(override) && override > 0 ? override : fraudTimeoutMs;
  return Math.min(Math.max(remaining - 100, 0), cap);
}

type FraudAdmission =
  | { ok: true; probe: boolean }
  | { ok: false; status: number; error: string };

function admitFraudCall(): FraudAdmission {
  if (circuit === "closed") return { ok: true, probe: false };
  if (halfOpenProbe || (circuit === "open" && Date.now() - openedAt < OPEN_MS)) {
    return { ok: false, status: 503, error: "circuit_open" };
  }
  circuit = "half_open";
  halfOpenProbe = true;
  return { ok: true, probe: true };
}

async function callFraud(ctx: SpanContext, timeoutMs: number, caller: AbortSignal): Promise<FraudCall> {
  const admission = admitFraudCall();
  if (!admission.ok) return admission;
  if (poolInUse >= poolSize) {
    if (admission.probe) {
      halfOpenProbe = false;
      circuit = "open";
      openedAt = Date.now();
    }
    return { ok: false, status: 503, error: "fraud_pool_exhausted" };
  }
  poolInUse += 1;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onCallerAbort = () => controller.abort();
  if (caller.aborted) controller.abort();
  else caller.addEventListener("abort", onCallerAbort, { once: true });
  try {
    const response = await fetch(`${fraudUrl}/check`, {
      method: "POST",
      headers: { "content-type": "application/json", traceparent: traceparent(ctx) },
      body: "{}",
      signal: controller.signal,
    });
    if (response.status === 499 || caller.aborted) {
      return { ok: false, status: 499, error: "caller_cancelled" };
    }
    if (!response.ok) {
      noteFailure();
      return { ok: false, status: response.status, error: "fraud_rejected" };
    }
    consecutiveFailures = 0;
    circuit = "closed";
    return { ok: true };
  } catch {
    if (caller.aborted) return { ok: false, status: 499, error: "caller_cancelled" };
    noteFailure();
    return { ok: false, status: 504, error: "fraud_timeout" };
  } finally {
    clearTimeout(timer);
    caller.removeEventListener("abort", onCallerAbort);
    poolInUse -= 1;
    if (admission.probe) halfOpenProbe = false;
  }
}

function noteFailure(): void {
  consecutiveFailures += 1;
  if (consecutiveFailures >= 3) {
    circuit = "open";
    openedAt = Date.now();
    log("payment.circuit.open", { consecutiveFailures });
  }
}

await waitForPostgres();
app.listen(3002, () => log("listening", { port: 3002, poolSize }));
