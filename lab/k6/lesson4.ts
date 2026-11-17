import http from "k6/http";
import { Counter, Trend } from "k6/metrics";

const MECHANISMS = ["conditional", "optimistic", "pessimistic"] as const;
type Mechanism = (typeof MECHANISMS)[number];

interface DecrementBody {
  success: boolean;
  waitedMs: number | undefined;
}

const success = new Counter("lab_success");
const conflict = new Counter("lab_conflict");
const retries = new Counter("lab_retries");
const lockWait = new Trend("lock_wait_ms");

const base = __ENV.BASE_URL || "http://order:3001";
const mechanism = selectedMechanism(__ENV.MECHANISM);
const sku = __ENV.SKU || "bulk-sku";

export const options = {
  vus: 100,
  iterations: 100,
};

export function setup(): void {
  http.post(
    `${base}/admin/inventory/reset`,
    JSON.stringify({ productId: sku, quantity: 100 }),
    { headers: { "Content-Type": "application/json" } },
  );
}

export default function (): void {
  const response = http.post(`${base}/inventory/${sku}/decrement?mechanism=${mechanism}`);
  retries.add(0);
  const body = readDecrement(response.json());
  if (body.success) success.add(1);
  else conflict.add(1);
  if (body.waitedMs !== undefined) lockWait.add(body.waitedMs);
}

function selectedMechanism(value: string | undefined): Mechanism {
  switch (value) {
    case "optimistic":
    case "pessimistic":
      return value;
    default:
      return "conditional";
  }
}

function readDecrement(value: unknown): DecrementBody {
  if (!isRecord(value)) return { success: false, waitedMs: undefined };
  const waitedMs = value.waitedMs;
  return {
    success: value.success === true,
    waitedMs: typeof waitedMs === "number" ? waitedMs : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
