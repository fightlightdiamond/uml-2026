import { randomBytes } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

export interface TraceContext {
  traceId: string;
  parentSpanId?: string;
}

export interface SpanContext extends TraceContext {
  spanId: string;
}

function hex(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

export function readTrace(req?: { headers?: IncomingHttpHeaders }): TraceContext {
  const header = req?.headers?.traceparent;
  if (typeof header === "string") {
    const parts = header.split("-");
    const traceId = parts[1];
    const parentSpanId = parts[2];
    if (
      parts.length === 4 &&
      traceId !== undefined &&
      parentSpanId !== undefined &&
      traceId.length === 32 &&
      parentSpanId.length === 16
    ) {
      return { traceId, parentSpanId };
    }
  }
  return { traceId: hex(16) };
}

export function childContext(parent: TraceContext): SpanContext {
  const spanId = hex(8);
  if (parent.parentSpanId === undefined) return { traceId: parent.traceId, spanId };
  return { traceId: parent.traceId, parentSpanId: parent.parentSpanId, spanId };
}

export function traceparent(ctx: SpanContext): string {
  return `00-${ctx.traceId}-${ctx.spanId}-01`;
}

function unixNano(): bigint {
  return BigInt(Date.now()) * 1_000_000n;
}

export async function withSpan<T>(
  name: string,
  parent: TraceContext,
  attributes: Record<string, unknown>,
  fn: (ctx: SpanContext) => Promise<T>,
): Promise<T> {
  const ctx = childContext(parent);
  const start = unixNano();
  try {
    return await fn(ctx);
  } finally {
    exportSpan(name, ctx, start, unixNano(), attributes).catch(() => {});
  }
}

async function exportSpan(
  name: string,
  ctx: SpanContext,
  start: bigint,
  end: bigint,
  attributes: Record<string, unknown> = {},
): Promise<void> {
  if (!endpoint) return;
  const span = {
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    name,
    kind: 2,
    startTimeUnixNano: start.toString(),
    endTimeUnixNano: end.toString(),
    attributes: Object.entries(attributes).map(([key, value]) => ({
      key,
      value: { stringValue: String(value) },
    })),
    ...(ctx.parentSpanId === undefined ? {} : { parentSpanId: ctx.parentSpanId }),
  };
  const body = {
    resourceSpans: [
      {
        resource: {
          attributes: [{ key: "service.name", value: { stringValue: process.env.SERVICE_NAME ?? "lab" } }],
        },
        scopeSpans: [{ spans: [span] }],
      },
    ],
  };
  await fetch(`${endpoint}/v1/traces`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
