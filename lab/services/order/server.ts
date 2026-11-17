import { createHash, randomUUID } from "node:crypto";
import express, { type Request, type Response as ExpressResponse } from "express";
import { pool, waitForPostgres } from "../shared/db.js";
import { createKafka, waitForKafka } from "../shared/kafka.js";
import { errorText, log } from "../shared/log.js";
import { asInteger, asQueryInteger, asString, isRecord, oneOf, pause } from "../shared/parse.js";
import { readTrace, traceparent, withSpan, type SpanContext } from "../shared/trace.js";

process.env.SERVICE_NAME = "order";

const PUBLISH_MODES = ["outbox", "direct"] as const;
const DECREMENT_MECHANISMS = ["conditional", "optimistic", "pessimistic"] as const;
type PublishMode = (typeof PUBLISH_MODES)[number];

interface CreateOrder {
  checkoutSessionId: string;
  productId: string;
  amount: number;
  publishMode: PublishMode;
}

interface IdempotentRequest {
  checkoutSessionId: string;
  productId: string;
  amount: number;
  publishMode: PublishMode;
}

type IdempotencyResult =
  | { action: "execute" }
  | { action: "replay"; response: unknown }
  | { action: "conflict" }
  | { action: "in_progress" };

interface IdempotencyRow {
  status: string;
  response: unknown;
  request_hash: string;
  lease_until: string | Date;
}

const paymentUrl = process.env.PAYMENT_URL || "http://payment:3002";
const kafka = createKafka();
const producer = kafka.producer();

interface ProductGate {
  capacity: number;
  workMs: number;
  queueLimit: number;
  inUse: number;
  waiting: number;
}

interface SlotWaiter {
  settled: boolean;
  resolve: () => void;
}

const productGate: ProductGate = { capacity: 0, workMs: 0, queueLimit: 0, inUse: 0, waiting: 0 };
const productWaiters: SlotWaiter[] = [];

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, ...productGate }));

app.post("/admin/capacity", (req, res) => {
  if (!isRecord(req.body)) {
    res.status(400).json({ error: "JSON object is required" });
    return;
  }
  const capacity = asInteger(req.body.capacity);
  const workMs = asInteger(req.body.workMs);
  const queueLimit = asInteger(req.body.queueLimit);
  if (
    capacity === undefined || workMs === undefined || queueLimit === undefined
    || capacity < 0 || workMs < 0 || queueLimit < 0
  ) {
    res.status(400).json({ error: "capacity, workMs, and queueLimit must be integers >= 0" });
    return;
  }
  productGate.capacity = capacity;
  productGate.workMs = workMs;
  productGate.queueLimit = queueLimit;
  log("order.capacity", { capacity, workMs, queueLimit });
  res.json({ capacity, workMs, queueLimit, inUse: productGate.inUse, waiting: productGate.waiting });
});

app.post("/admin/overload", (req, res) => {
  const enabled = isRecord(req.body) && req.body.enabled === true;
  if (!enabled) {
    productGate.capacity = 0;
    productGate.workMs = 0;
    productGate.queueLimit = 0;
  }
  res.json({ overload: productGate.capacity > 0, capacity: productGate.capacity });
});

app.get("/products", async (_req, res) => {
  if (productGate.capacity > 0) {
    const acquired = await acquireProductSlot(res);
    if (acquired === "closed") return;
    if (acquired === "shed") {
      res.status(503).json({ error: "overloaded", inUse: productGate.inUse, waiting: productGate.waiting });
      return;
    }
    try {
      if (productGate.workMs > 0) await pause(productGate.workMs);
      if (res.writableEnded || res.destroyed) return;
      const rows = await pool.query("SELECT sku, name FROM products ORDER BY sku");
      if (!res.writableEnded && !res.destroyed) res.json(rows.rows);
    } finally {
      releaseProductSlot();
    }
    return;
  }
  const rows = await pool.query("SELECT sku, name FROM products ORDER BY sku");
  res.json(rows.rows);
});

function takeProductSlot(): boolean {
  if (productGate.inUse >= productGate.capacity) return false;
  productGate.inUse += 1;
  return true;
}

function releaseProductSlot(): void {
  productGate.inUse -= 1;
  while (productWaiters.length > 0) {
    const next = productWaiters.shift();
    if (!next || next.settled) continue;
    next.settled = true;
    productGate.waiting -= 1;
    productGate.inUse += 1;
    next.resolve();
    return;
  }
}

async function acquireProductSlot(res: ExpressResponse): Promise<"ok" | "shed" | "closed"> {
  if (takeProductSlot()) return "ok";
  if (productGate.waiting >= productGate.queueLimit) return "shed";
  productGate.waiting += 1;
  const waiter: SlotWaiter = { settled: false, resolve: () => undefined };
  try {
    await new Promise<void>((resolve, reject) => {
      waiter.resolve = resolve;
      productWaiters.push(waiter);
      res.on("close", () => {
        if (res.writableEnded || waiter.settled) return;
        const index = productWaiters.indexOf(waiter);
        if (index < 0) return;
        productWaiters.splice(index, 1);
        waiter.settled = true;
        productGate.waiting -= 1;
        reject(new Error("client_cancelled"));
      });
    });
    return "ok";
  } catch {
    return "closed";
  }
}

app.get("/orders/:id", async (req, res) => {
  const id = req.params.id;
  if (id === undefined) {
    res.status(400).json({ error: "id is required" });
    return;
  }
  try {
    const found = await pool.query(
      "SELECT * FROM orders WHERE id::text = $1 OR checkout_session_id = $1",
      [id],
    );
    if (found.rowCount === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(found.rows[0]);
  } catch (error) {
    log("order.lookup_failed", { id, error: errorText(error) });
    res.status(500).json({ error: errorText(error) });
  }
});

app.post("/orders", async (req, res) => {
  const parent = readTrace(req);
  const parsed = parseCreateOrder(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { checkoutSessionId, productId, amount, publishMode } = parsed.value;
  const lab = req.get("x-lab");
  const delayMs = lab === "lesson1" ? Math.floor(Math.random() * 4000) : Number(req.get("x-response-delay-ms") || 0);
  await withSpan("order.create", parent, { checkoutSessionId, publishMode }, async (ctx) => {
    res.set("traceparent", traceparent(ctx));
    const idem = await beginIdempotency(req, { checkoutSessionId, productId, amount, publishMode });
    if (idem.action === "replay") {
      res.status(200).json(idem.response);
      return;
    }
    if (idem.action === "conflict") {
      res.status(409).json({ error: "idempotency key reused with a different request" });
      return;
    }
    if (idem.action === "in_progress") {
      res.status(409).json({ error: "operation_in_progress" });
      return;
    }
    const orderId = randomUUID();
    const intentId = `pay_${checkoutSessionId}`;
    log("order.before_insert", { orderId, checkoutSessionId, traceId: ctx.traceId });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO orders (id, checkout_session_id, product_id, amount, status, payment_intent_id)
         VALUES ($1, $2, $3, $4, 'PENDING_PAYMENT', $5)`,
        [orderId, checkoutSessionId, productId, amount, intentId],
      );
      if (publishMode === "outbox") {
        await client.query(
          "INSERT INTO outbox (event_id, topic, payload) VALUES ($1, 'order.created', $2)",
          [randomUUID(), { eventId: orderId, orderId, checkoutSessionId, productId, schemaVersion: 2 }],
        );
      }
      await client.query("COMMIT");
      log("order.after_commit", { orderId, traceId: ctx.traceId });
    } catch (error) {
      await client.query("ROLLBACK");
      if (isUniqueViolation(error)) {
        const prior = await pool.query("SELECT * FROM orders WHERE checkout_session_id = $1", [checkoutSessionId]);
        const stored = { order: prior.rows[0], replayed: true };
        await finishIdempotency(req, stored);
        res.status(200).json(stored);
        return;
      }
      res.status(httpStatus(error)).json({ error: errorText(error) });
      return;
    } finally {
      client.release();
    }

    if (publishMode === "direct") {
      try {
        await producer.send({
          topic: "order.created",
          messages: [{ key: checkoutSessionId, value: JSON.stringify({ orderId, checkoutSessionId, productId, schemaVersion: 2 }) }],
        });
      } catch (error) {
        log("order.direct_publish_failed", { orderId, error: errorText(error) });
      }
    }

    const deadline = Date.now() + Number(req.get("x-budget-ms") || 2000);
    const caller = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) caller.abort();
    });
    let payment: Response;
    try {
      payment = await fetch(`${paymentUrl}/payments`, {
        method: "POST",
        headers: paymentHeaders(req, ctx, deadline),
        body: JSON.stringify({ intentId, orderId, amount }),
        signal: caller.signal,
      });
    } catch (error) {
      log("order.caller_cancelled", { orderId, error: errorText(error) });
      if (!res.writableEnded) {
        res.status(499).json({
          orderId,
          status: "PENDING_PAYMENT",
          payment: { error: "caller_cancelled" },
          replayed: false,
        });
      }
      return;
    }
    const paymentBody: unknown = await payment.json();
    const review = !payment.ok && isFraudReview(paymentBody);
    if (payment.ok) {
      await pool.query("UPDATE orders SET status = 'CONFIRMED' WHERE id = $1", [orderId]);
    } else if (review) {
      await pool.query("UPDATE orders SET status = 'PENDING_FRAUD_REVIEW' WHERE id = $1", [orderId]);
    }
    if (delayMs > 0) await pause(delayMs);
    log("order.before_response", { orderId, delayMs, traceId: ctx.traceId });
    const stored = {
      orderId,
      status: payment.ok ? "CONFIRMED" : review ? "PENDING_FRAUD_REVIEW" : "PENDING_PAYMENT",
      payment: paymentBody,
      replayed: false,
    };
    await finishIdempotency(req, stored);
    res.status(payment.ok ? 201 : 202).json(stored);
  });
});

app.post("/admin/inventory/reset", async (req, res) => {
  const reset = parseInventoryReset(req.body);
  if (reset === undefined) {
    res.status(400).json({ error: "productId and quantity >= 0 are required" });
    return;
  }
  await pool.query(
    "UPDATE inventory SET quantity = $2, version = 0 WHERE product_id = $1",
    [reset.productId, reset.quantity],
  );
  res.json(reset);
});

app.post("/inventory/:productId/decrement", async (req, res) => {
  const mechanism = req.query.mechanism === undefined
    ? "conditional"
    : oneOf(req.query.mechanism, DECREMENT_MECHANISMS);
  if (mechanism === undefined) {
    res.status(400).json({ error: "mechanism must be conditional, optimistic, or pessimistic" });
    return;
  }
  const productId = req.params.productId;
  if (productId === undefined) {
    res.status(400).json({ error: "productId is required" });
    return;
  }
  const started = Date.now();
  if (mechanism === "conditional") {
    const updated = await pool.query(
      "UPDATE inventory SET quantity = quantity - 1 WHERE product_id = $1 AND quantity >= 1 RETURNING quantity, version",
      [productId],
    );
    res.json({ mechanism, success: updated.rowCount === 1, row: updated.rows[0] || null, waitedMs: Date.now() - started });
    return;
  }
  if (mechanism === "optimistic") {
    const current = await pool.query<{ quantity: number; version: number }>(
      "SELECT quantity, version FROM inventory WHERE product_id = $1",
      [productId],
    );
    const versionRow = current.rows[0];
    const expected = req.query.version === undefined ? versionRow?.version : asQueryInteger(req.query.version);
    const updated = await pool.query(
      `UPDATE inventory SET quantity = quantity - 1, version = version + 1
       WHERE product_id = $1 AND quantity >= 1 AND version = $2 RETURNING quantity, version`,
      [productId, expected],
    );
    res.json({
      mechanism,
      success: updated.rowCount === 1,
      conflict: updated.rowCount === 0,
      row: updated.rows[0] || null,
      waitedMs: Date.now() - started,
    });
    return;
  }
  if (mechanism === "pessimistic") {
    const holdMs = req.query.holdMs === undefined ? 0 : asQueryInteger(req.query.holdMs) ?? 0;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT quantity FROM inventory WHERE product_id = $1 FOR UPDATE", [productId]);
      if (holdMs > 0) await pause(holdMs);
      const updated = await client.query(
        "UPDATE inventory SET quantity = quantity - 1 WHERE product_id = $1 AND quantity >= 1 RETURNING quantity, version",
        [productId],
      );
      await client.query("COMMIT");
      res.json({ mechanism, success: updated.rowCount === 1, row: updated.rows[0] || null, waitedMs: Date.now() - started });
    } catch (error) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: errorText(error) });
    } finally {
      client.release();
    }
    return;
  }
  return unhandledMechanism(mechanism);
});

function unhandledMechanism(mechanism: never): never {
  throw new Error(`unhandled mechanism ${String(mechanism)}`);
}

app.post("/locks/:name/acquire", async (req, res) => {
  const name = req.params.name;
  if (name === undefined) {
    res.status(400).json({ error: "lock name is required" });
    return;
  }
  const owner = isRecord(req.body) ? asString(req.body.owner) ?? "worker" : "worker";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ fencing_token: string | number; lease_until: string | Date }>(
      "SELECT fencing_token, lease_until FROM leases WHERE lock_name = $1 FOR UPDATE",
      [name],
    );
    const previous = current.rows[0];
    if (previous && new Date(previous.lease_until) > new Date()) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "lease_held", leaseUntil: previous.lease_until });
      return;
    }
    const token = Number(previous?.fencing_token ?? 0) + 1;
    await client.query(
      `INSERT INTO leases (lock_name, owner, fencing_token, lease_until)
       VALUES ($1, $2, $3, now() + interval '10 seconds')
       ON CONFLICT (lock_name) DO UPDATE
       SET owner = EXCLUDED.owner, fencing_token = EXCLUDED.fencing_token, lease_until = EXCLUDED.lease_until`,
      [name, owner, token],
    );
    await client.query("COMMIT");
    res.json({ lock: name, owner, token, leaseSeconds: 10 });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: errorText(error) });
  } finally {
    client.release();
  }
});

app.post("/balances/:accountId/apply", async (req, res) => {
  const accountId = req.params.accountId;
  const applied = parseBalanceApply(req.body);
  if (accountId === undefined || applied === undefined) {
    res.status(400).json({ error: "accountId, integer token, and integer amount are required" });
    return;
  }
  const { token, amount } = applied;
  const updated = await pool.query(
    `UPDATE balances SET amount = amount + $1, accepted_token = $2
     WHERE account_id = $3 AND accepted_token < $2
     RETURNING amount, accepted_token`,
    [amount, token, accountId],
  );
  if (updated.rowCount === 0) {
    const current = await pool.query("SELECT amount, accepted_token FROM balances WHERE account_id = $1", [accountId]);
    res.status(409).json({ error: "stale_token", current: current.rows[0] ?? null });
    return;
  }
  res.json({ accountId, ...updated.rows[0] });
});

function parseCreateOrder(body: unknown): { ok: true; value: CreateOrder } | { ok: false; error: string } {
  if (!isRecord(body)) return { ok: false, error: "JSON object is required" };
  const checkoutSessionId = asString(body.checkoutSessionId);
  if (checkoutSessionId === undefined) return { ok: false, error: "checkoutSessionId is required" };
  if (body.productId !== undefined && asString(body.productId) === undefined) {
    return { ok: false, error: "productId must be a string" };
  }
  if (body.amount !== undefined && asInteger(body.amount) === undefined) {
    return { ok: false, error: "amount must be an integer" };
  }
  const publishMode = body.publishMode === undefined ? "outbox" : oneOf(body.publishMode, PUBLISH_MODES);
  if (publishMode === undefined) return { ok: false, error: "publishMode must be outbox or direct" };
  return {
    ok: true,
    value: {
      checkoutSessionId,
      productId: asString(body.productId) ?? "catalog-sku",
      amount: asInteger(body.amount) ?? 1000,
      publishMode,
    },
  };
}

function parseInventoryReset(body: unknown): { productId: string; quantity: number } | undefined {
  if (!isRecord(body)) return undefined;
  const productId = asString(body.productId);
  const quantity = asInteger(body.quantity);
  if (productId === undefined || quantity === undefined || quantity < 0) return undefined;
  return { productId, quantity };
}

function parseBalanceApply(body: unknown): { token: number; amount: number } | undefined {
  if (!isRecord(body)) return undefined;
  const token = asInteger(body.token);
  const amount = asInteger(body.amount);
  if (token === undefined || amount === undefined) return undefined;
  return { token, amount };
}

function paymentHeaders(req: Request, ctx: SpanContext, deadline: number): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    traceparent: traceparent(ctx),
    "x-deadline-ms": String(deadline),
    "x-hold-response-ms": String(req.get("x-payment-hold-ms") || 0),
  };
  const fraudTimeout = req.get("x-fraud-timeout-ms");
  if (fraudTimeout !== undefined && fraudTimeout.length > 0) headers["x-fraud-timeout-ms"] = fraudTimeout;
  return headers;
}

function isFraudReview(body: unknown): boolean {
  return isRecord(body) && (body.error === "fraud_timeout" || body.error === "circuit_open");
}

function requestHash(body: IdempotentRequest): string {
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

async function beginIdempotency(req: Request, body: IdempotentRequest): Promise<IdempotencyResult> {
  const key = req.get("idempotency-key");
  if (!key) return { action: "execute" };
  const principal = req.get("x-principal") || "demo";
  const hash = requestHash(body);
  const inserted = await pool.query(
    `INSERT INTO idempotency_keys (principal_id, idempotency_key, request_hash, status, lease_until, fencing_token)
     VALUES ($1, $2, $3, 'PROCESSING', now() + interval '30 seconds', 1)
     ON CONFLICT DO NOTHING
     RETURNING status, response, request_hash`,
    [principal, key, hash],
  );
  if (inserted.rowCount === 1) return { action: "execute" };
  const existing = await pool.query<IdempotencyRow>(
    "SELECT status, response, request_hash, lease_until FROM idempotency_keys WHERE principal_id = $1 AND idempotency_key = $2",
    [principal, key],
  );
  const row = existing.rows[0];
  if (!row || row.request_hash !== hash) return { action: "conflict" };
  if (row.status === "SUCCEEDED") return { action: "replay", response: row.response };
  if (new Date(row.lease_until) > new Date()) return { action: "in_progress" };
  const taken = await pool.query(
    `UPDATE idempotency_keys
     SET fencing_token = fencing_token + 1, lease_until = now() + interval '30 seconds'
     WHERE principal_id = $1 AND idempotency_key = $2 AND status = 'PROCESSING' AND lease_until < now()
     RETURNING fencing_token`,
    [principal, key],
  );
  return taken.rowCount === 1 ? { action: "execute" } : { action: "in_progress" };
}

async function finishIdempotency(req: Request, response: unknown): Promise<void> {
  const key = req.get("idempotency-key");
  if (!key) return;
  const principal = req.get("x-principal") || "demo";
  await pool.query(
    `UPDATE idempotency_keys SET status = 'SUCCEEDED', response = $3
     WHERE principal_id = $1 AND idempotency_key = $2`,
    [principal, key, response],
  );
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function httpStatus(error: unknown): number {
  if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number") {
    return error.status;
  }
  return 500;
}

await waitForPostgres();
await waitForKafka(kafka);
await producer.connect();
app.listen(3001, () => log("listening", { port: 3001 }));
