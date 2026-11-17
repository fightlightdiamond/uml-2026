import http from "k6/http";
import { sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const RETRY_POLICIES = ["none", "immediate", "fixed", "exponential", "jitter"] as const;
type RetryPolicy = (typeof RETRY_POLICIES)[number];

const base = __ENV.BASE_URL || "http://order:3001";
const policy = retryPolicy(__ENV.POLICY);
const timeoutMs = positiveInt(__ENV.TIMEOUT_MS, 300);
const budgetMs = positiveInt(__ENV.BUDGET_MS, 3000);
const capacity = positiveInt(__ENV.CAPACITY, 2);
const workMs = positiveInt(__ENV.WORK_MS, 200);
const queueLimit = positiveInt(__ENV.QUEUE_LIMIT, 20);

const policyLatency = new Trend("policy_latency_ms");
const policyFailed = new Rate("policy_failed");
const httpAttempts = new Counter("http_attempts");
const userActions = new Counter("user_actions");
const clientTimeouts = new Counter("client_timeouts");
const shedResponses = new Counter("shed_responses");
const retriesAfterTimeout = new Counter("retries_after_timeout");
const retriesAfterShed = new Counter("retries_after_shed");
const acceptedMs = new Trend("accepted_ms");
const retryDelayMs = new Trend("retry_delay_ms");

export const options = {
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
  scenarios: {
    users: {
      executor: "shared-iterations",
      vus: positiveInt(__ENV.VUS, 10),
      iterations: positiveInt(__ENV.ITERATIONS, 80),
      maxDuration: "3m",
    },
  },
};

export function setup(): void {
  const armed = http.post(
    `${base}/admin/capacity`,
    JSON.stringify({ capacity, workMs, queueLimit }),
    { headers: { "Content-Type": "application/json" } },
  );
  if (armed.status !== 200) {
    throw new Error(`capacity arm failed: ${armed.status}`);
  }
}

export default function (): void {
  userActions.add(1);
  const started = Date.now();
  const ok = requestWithPolicy(policy, started);
  policyLatency.add(Date.now() - started);
  policyFailed.add(ok ? 0 : 1);
}

export function teardown(): void {
  const started = Date.now();
  let status = 0;
  for (let probe = 0; probe < 40; probe += 1) {
    const recovered = http.get(`${base}/products`, { timeout: "500ms" });
    status = recovered.status;
    if (status === 200) break;
    sleep(0.05);
  }
  console.log(`recovery_ms=${Date.now() - started} recovery_status=${status}`);
  http.post(
    `${base}/admin/capacity`,
    JSON.stringify({ capacity: 0, workMs: 0, queueLimit: 0 }),
    { headers: { "Content-Type": "application/json" } },
  );
}

function retryPolicy(value: string | undefined): RetryPolicy {
  switch (value) {
    case "immediate":
    case "fixed":
    case "exponential":
    case "jitter":
      return value;
    default:
      return "none";
  }
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function requestWithPolicy(selected: RetryPolicy, started: number): boolean {
  const attempts = selected === "none" ? 1 : 4;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const remaining = budgetMs - (Date.now() - started);
    if (remaining < 50) break;
    const callTimeout = Math.min(timeoutMs, remaining);
    const response = http.get(`${base}/products`, { timeout: `${callTimeout}ms` });
    httpAttempts.add(1);
    if (response.status === 0) clientTimeouts.add(1);
    if (response.status === 503) shedResponses.add(1);
    if (response.status === 200) {
      acceptedMs.add(response.timings.duration);
      return true;
    }
    if (attempt === attempts) break;
    const delayMs = retryDelayMsFor(selected, attempt);
    if (Date.now() - started + delayMs >= budgetMs) break;
    if (response.status === 0) retriesAfterTimeout.add(1);
    if (response.status === 503) retriesAfterShed.add(1);
    if (delayMs > 0) {
      retryDelayMs.add(delayMs);
      sleep(delayMs / 1000);
    }
  }
  return false;
}

function retryDelayMsFor(selected: RetryPolicy, attempt: number): number {
  if (selected === "none" || selected === "immediate") return 0;
  if (selected === "fixed") return 200;
  const ceiling = Math.min(2000, 100 * 2 ** (attempt - 1));
  return selected === "jitter" ? Math.floor(Math.random() * ceiling) : ceiling;
}
