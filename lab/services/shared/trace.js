import { randomBytes } from "node:crypto";

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

function hex(bytes) {
  return randomBytes(bytes).toString("hex");
}

export function readTrace(req) {
  const header = req?.headers?.traceparent;
  if (typeof header === "string") {
    const parts = header.split("-");
    if (parts.length === 4 && parts[1].length === 32 && parts[2].length === 16) {
      return { traceId: parts[1], parentSpanId: parts[2] };
    }
  }
  return { traceId: hex(16), parentSpanId: undefined };
}

export function childContext(parent) {
  return {
    traceId: parent.traceId,
    parentSpanId: parent.parentSpanId,
    spanId: hex(8),
  };
}

export function traceparent(ctx) {
  return `00-${ctx.traceId}-${ctx.spanId}-01`;
}

function unixNano() {
  return BigInt(Date.now()) * 1_000_000n;
}

export async function withSpan(name, parent, attributes, fn) {
  const ctx = childContext(parent);
  const start = unixNano();
  try {
    return await fn(ctx);
  } finally {
    exportSpan(name, ctx, start, unixNano(), attributes).catch(() => {});
  }
}

async function exportSpan(name, ctx, start, end, attributes = {}) {
  if (!endpoint) return;
  const body = {
    resourceSpans: [
      {
        resource: {
          attributes: [{ key: "service.name", value: { stringValue: process.env.SERVICE_NAME } }],
        },
        scopeSpans: [
          {
            spans: [
              {
                traceId: ctx.traceId,
                spanId: ctx.spanId,
                parentSpanId: ctx.parentSpanId,
                name,
                kind: 2,
                startTimeUnixNano: start.toString(),
                endTimeUnixNano: end.toString(),
                attributes: Object.entries(attributes).map(([key, value]) => ({
                  key,
                  value: { stringValue: String(value) },
                })),
              },
            ],
          },
        ],
      },
    ],
  };
  await fetch(`${endpoint}/v1/traces`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
