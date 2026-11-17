import express from "express";
import { log } from "../shared/log.js";
import { readTrace, traceparent, withSpan } from "../shared/trace.js";

process.env.SERVICE_NAME = "fraud";

let delayMs = Number(process.env.FRAUD_DELAY_MS || 50);
const concurrency = Number(process.env.FRAUD_CONCURRENCY || 4);
let active = 0;

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, delayMs, active, concurrency });
});

app.post("/admin/delay", (req, res) => {
  delayMs = Number(req.body.ms);
  if (!Number.isFinite(delayMs) || delayMs < 0) {
    res.status(400).json({ error: "ms must be >= 0" });
    return;
  }
  log("fraud.delay.set", { delayMs });
  res.json({ delayMs });
});

app.post("/check", async (req, res) => {
  const parent = readTrace(req);
  if (active >= concurrency) {
    log("fraud.shed", { active, concurrency, traceId: parent.traceId });
    res.status(503).json({ error: "fraud_concurrency_saturated" });
    return;
  }
  active += 1;
  const started = Date.now();
  try {
    await withSpan("fraud.check", parent, { delayMs }, async (ctx) => {
      res.set("traceparent", traceparent(ctx));
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, delayMs);
        res.on("close", () => {
          if (!res.writableEnded) {
            clearTimeout(timer);
            reject(new Error("client_cancelled"));
          }
        });
      });
      log("fraud.check.done", { waitedMs: Date.now() - started, traceId: ctx.traceId });
      res.json({ decision: "pass", waitedMs: Date.now() - started });
    });
  } catch (error) {
    if (!res.writableEnded) res.status(499).json({ error: error.message });
  } finally {
    active -= 1;
  }
});

app.listen(3003, () => log("listening", { port: 3003 }));
