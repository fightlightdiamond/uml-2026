import { createHash, randomUUID } from "node:crypto";
import express from "express";
import { pool, waitForPostgres } from "../shared/db.js";
import { createKafka, waitForKafka } from "../shared/kafka.js";
import { log } from "../shared/log.js";
import { readTrace, traceparent, withSpan } from "../shared/trace.js";

process.env.SERVICE_NAME = "order";

const paymentUrl = process.env.PAYMENT_URL || "http://payment:3002";
const kafka = createKafka();
const producer = kafka.producer();
let overload = false;

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/admin/overload", (req, res) => {
  overload = Boolean(req.body.enabled);
  res.json({ overload });
});

app.get("/products", async (_req, res) => {
  if (overload) {
    res.status(503).json({ error: "overloaded" });
    return;
  }
  const rows = await pool.query("SELECT sku, name FROM products ORDER BY sku");
  res.json(rows.rows);
});

app.get("/orders/:id", async (req, res) => {
  try {
    const found = await pool.query(
      "SELECT * FROM orders WHERE id::text = $1 OR checkout_session_id = $1",
      [req.params.id],
    );
    if (found.rowCount === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(found.rows[0]);
  } catch (error) {
    log("order.lookup_failed", { id: req.params.id, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.post("/orders", async (req, res) => {
  const parent = readTrace(req);
  const { checkoutSessionId, productId = "catalog-sku", amount = 1000, publishMode = "outbox" } = req.body || {};
  if (!checkoutSessionId) {
    res.status(400).json({ error: "checkoutSessionId is required" });
    return;
  }
  const lab = req.headers["x-lab"];
  const delayMs = lab === "lesson1" ? Math.floor(Math.random() * 4000) : Number(req.headers["x-response-delay-ms"] || 0);
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
      if (error.code === "23505") {
        const prior = await pool.query("SELECT * FROM orders WHERE checkout_session_id = $1", [checkoutSessionId]);
        const body = { order: prior.rows[0], replayed: true };
        await finishIdempotency(req, body);
        res.status(200).json(body);
        return;
      }
      const status = error.status || 500;
      res.status(status).json({ error: error.message });
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
        log("order.direct_publish_failed", { orderId, error: error.message });
      }
    }

    const deadline = Date.now() + Number(req.headers["x-budget-ms"] || 2000);
    const payment = await fetch(`${paymentUrl}/payments`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        traceparent: traceparent(ctx),
        "x-deadline-ms": String(deadline),
        "x-hold-response-ms": String(req.headers["x-payment-hold-ms"] || 0),
      },
      body: JSON.stringify({ intentId, orderId, amount }),
    });
    const paymentBody = await payment.json();
    if (payment.ok) {
      await pool.query("UPDATE orders SET status = 'CONFIRMED' WHERE id = $1", [orderId]);
    }
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    log("order.before_response", { orderId, delayMs, traceId: ctx.traceId });
    const body = { orderId, status: payment.ok ? "CONFIRMED" : "PENDING_PAYMENT", payment: paymentBody, replayed: false };
    await finishIdempotency(req, body);
    res.status(payment.ok ? 201 : 202).json(body);
  });
});

app.post("/admin/inventory/reset", async (req, res) => {
  const quantity = Number(req.body.quantity);
  if (!req.body.productId || !Number.isInteger(quantity) || quantity < 0) {
    res.status(400).json({ error: "productId and quantity >= 0 are required" });
    return;
  }
  await pool.query(
    "UPDATE inventory SET quantity = $2, version = 0 WHERE product_id = $1",
    [req.body.productId, quantity],
  );
  res.json({ productId: req.body.productId, quantity });
});

app.post("/inventory/:productId/decrement", async (req, res) => {
  const mechanism = req.query.mechanism || "conditional";
  const productId = req.params.productId;
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
    const current = await pool.query("SELECT quantity, version FROM inventory WHERE product_id = $1", [productId]);
    const expected = Number(req.query.version ?? current.rows[0]?.version);
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
    const holdMs = Number(req.query.holdMs || 0);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT quantity FROM inventory WHERE product_id = $1 FOR UPDATE", [productId]);
      if (holdMs > 0) await new Promise((resolve) => setTimeout(resolve, holdMs));
      const updated = await client.query(
        "UPDATE inventory SET quantity = quantity - 1 WHERE product_id = $1 AND quantity >= 1 RETURNING quantity, version",
        [productId],
      );
      await client.query("COMMIT");
      res.json({ mechanism, success: updated.rowCount === 1, row: updated.rows[0] || null, waitedMs: Date.now() - started });
    } catch (error) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
    return;
  }
  res.status(400).json({ error: "mechanism must be conditional, optimistic, or pessimistic" });
});

app.post("/locks/:name/acquire", async (req, res) => {
  const owner = req.body.owner || "worker";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query("SELECT fencing_token, lease_until FROM leases WHERE lock_name = $1 FOR UPDATE", [req.params.name]);
    const previous = current.rows[0];
    if (previous && new Date(previous.lease_until) > new Date()) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "lease_held", leaseUntil: previous.lease_until });
      return;
    }
    const token = (previous?.fencing_token || 0) + 1;
    await client.query(
      `INSERT INTO leases (lock_name, owner, fencing_token, lease_until)
       VALUES ($1, $2, $3, now() + interval '10 seconds')
       ON CONFLICT (lock_name) DO UPDATE
       SET owner = EXCLUDED.owner, fencing_token = EXCLUDED.fencing_token, lease_until = EXCLUDED.lease_until`,
      [req.params.name, owner, token],
    );
    await client.query("COMMIT");
    res.json({ lock: req.params.name, owner, token, leaseSeconds: 10 });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.post("/balances/:accountId/apply", async (req, res) => {
  const token = Number(req.body.token);
  const amount = Number(req.body.amount);
  const updated = await pool.query(
    `UPDATE balances SET amount = amount + $1, accepted_token = $2
     WHERE account_id = $3 AND accepted_token < $2
     RETURNING amount, accepted_token`,
    [amount, token, req.params.accountId],
  );
  if (updated.rowCount === 0) {
    const current = await pool.query("SELECT amount, accepted_token FROM balances WHERE account_id = $1", [req.params.accountId]);
    res.status(409).json({ error: "stale_token", current: current.rows[0] || null });
    return;
  }
  res.json({ accountId: req.params.accountId, ...updated.rows[0] });
});

function requestHash(body) {
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

async function beginIdempotency(req, body) {
  const key = req.headers["idempotency-key"];
  if (!key) return { action: "execute" };
  const principal = req.headers["x-principal"] || "demo";
  const hash = requestHash(body);
  const inserted = await pool.query(
    `INSERT INTO idempotency_keys (principal_id, idempotency_key, request_hash, status, lease_until, fencing_token)
     VALUES ($1, $2, $3, 'PROCESSING', now() + interval '30 seconds', 1)
     ON CONFLICT DO NOTHING
     RETURNING status, response, request_hash`,
    [principal, key, hash],
  );
  if (inserted.rowCount === 1) return { action: "execute" };
  const existing = await pool.query(
    "SELECT status, response, request_hash, lease_until FROM idempotency_keys WHERE principal_id = $1 AND idempotency_key = $2",
    [principal, key],
  );
  const row = existing.rows[0];
  if (row.request_hash !== hash) return { action: "conflict" };
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

async function finishIdempotency(req, response) {
  const key = req.headers["idempotency-key"];
  if (!key) return;
  const principal = req.headers["x-principal"] || "demo";
  await pool.query(
    `UPDATE idempotency_keys SET status = 'SUCCEEDED', response = $3
     WHERE principal_id = $1 AND idempotency_key = $2`,
    [principal, key, response],
  );
}

await waitForPostgres();
await waitForKafka(kafka);
await producer.connect();
app.listen(3001, () => log("listening", { port: 3001 }));
