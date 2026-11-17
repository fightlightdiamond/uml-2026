# Hàm dùng chung. Các bài source file này qua tests/run.sh.

if [[ -z "${ROOT:-}" ]]; then
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

: "${RUN:=$(date +%s)}"
RUN_DIR="/tmp/ds-lab/$RUN"
mkdir -p "$RUN_DIR"

ORDER="${ORDER:-http://localhost:3001}"
PAYMENT="${PAYMENT:-http://localhost:3002}"
FRAUD="${FRAUD:-http://localhost:3003}"
JAEGER="${JAEGER:-http://localhost:16686}"
PASSES="${PASSES:-0}"
FAILS="${FAILS:-0}"

compose() {
  docker compose --project-directory "$ROOT" -f "$ROOT/docker-compose.yml" "$@"
}

sql() {
  compose exec -T postgres psql -U lab -d lab -tA -q -v ON_ERROR_STOP=1 -c "$1"
}

pass() {
  PASSES=$((PASSES + 1))
  echo "  PASS  $1"
}

fail() {
  FAILS=$((FAILS + 1))
  echo "  FAIL  $1"
}

check() {
  local label="$1"
  local actual="$2"
  local expected="$3"
  if [[ "$actual" == "$expected" ]]; then
    pass "$label = $actual"
  else
    fail "$label: expected $expected, got $actual"
  fi
}

check_gt() {
  local label="$1"
  local actual="$2"
  local floor="$3"
  if [[ -n "$actual" && -n "$floor" && "$actual" -gt "$floor" ]]; then
    pass "$label: $actual > $floor"
  else
    fail "$label: expected > $floor, got ${actual:-empty}"
  fi
}

post() {
  local url="$1"
  local body="$2"
  local out="$3"
  shift 3
  local args=(-H "content-type: application/json")
  local header
  for header in "$@"; do
    args+=(-H "$header")
  done
  if [[ "${CURL_QUIET:-}" == "1" ]]; then
    HTTP_CODE=$(curl -sS -m "${CURL_MAX:-20}" -D "$out.headers" -o "$out" -w "%{http_code}" \
      -X POST "$url" "${args[@]}" --data "$body" 2>/dev/null) || HTTP_CODE=000
  else
    HTTP_CODE=$(curl -sS -m "${CURL_MAX:-20}" -D "$out.headers" -o "$out" -w "%{http_code}" \
      -X POST "$url" "${args[@]}" --data "$body") || HTTP_CODE=000
  fi
}

get_to() {
  local url="$1"
  local out="$2"
  HTTP_CODE=$(curl -sS -m "${CURL_MAX:-20}" -o "$out" -w "%{http_code}" "$url") || HTTP_CODE=000
}

json_field() {
  python3 - "$1" "$2" <<'PY'
import json, sys
path, field = sys.argv[1], sys.argv[2]
try:
    value = json.load(open(path))
    for part in field.split("."):
        value = value[part]
except Exception:
    print("")
    sys.exit(0)
print("true" if value is True else "false" if value is False else value)
PY
}

deadline_ms() {
  python3 -c 'import time, sys; print(int(time.time() * 1000) + int(sys.argv[1]))' "$1"
}

wait_until() {
  local tries="$1"
  shift
  local attempt
  for attempt in $(seq 1 "$tries"); do
    if "$@"; then
      return 0
    fi
    sleep 0.5
  done
  return 1
}

inbox_has() {
  [[ "$(sql "SELECT count(*) FROM processed_messages WHERE message_id = '$1'")" == "1" ]]
}

prepare_lab() {
  curl -sS -m 5 -X POST "$FRAUD/admin/delay" -H 'content-type: application/json' -d '{"ms":50}' >/dev/null || true
  curl -sS -m 5 -X POST "$ORDER/admin/overload" -H 'content-type: application/json' -d '{"enabled":false}' >/dev/null || true
  sql "UPDATE inventory SET quantity = 500, version = 0 WHERE product_id = 'catalog-sku';" >/dev/null
}

set_fraud_delay() {
  post "$FRAUD/admin/delay" "{\"ms\":$1}" "$RUN_DIR/fraud-delay.json"
}

k6_field() {
  python3 - "$1" "$2" "$3" <<'PY'
import re, sys
path, metric, stat = sys.argv[1:]
line = ""
for raw in open(path, encoding="utf-8", errors="replace"):
    if re.match(r"\s*" + re.escape(metric) + r"\.+:", raw):
        line = raw
        break
if not line:
    print("")
    sys.exit(0)
if stat == "count":
    match = re.search(r":\s*([0-9]+)", line)
    print(match.group(1) if match else "")
elif stat == "per_s":
    match = re.search(r"([0-9.]+)/s", line)
    print(str(int(round(float(match.group(1))))) if match else "")
elif stat == "rate":
    match = re.search(r":\s*([0-9.]+)%", line)
    print(str(int(round(float(match.group(1))))) if match else "")
else:
    labels = {"avg": "avg", "p95": r"p\(95\)", "p99": r"p\(99\)"}
    label = labels.get(stat, stat)
    match = re.search(label + r"=([0-9.]+)(ns|µs|us|ms|s)?\b", line)
    if not match:
        print("")
    else:
        scale = {"ns": 0.000001, "µs": 0.001, "us": 0.001, "ms": 1, "s": 1000}.get(match.group(2), 1)
        print(int(round(float(match.group(1)) * scale)))
PY
}

k6_recovery() {
  python3 - "$1" "$2" <<'PY'
import re, sys
text = open(sys.argv[1], encoding="utf-8", errors="replace").read()
field = sys.argv[2]
match = re.search(field + r"=([0-9]+)", text)
print(match.group(1) if match else "")
PY
}

k6_recovery_status() {
  k6_recovery "$1" "recovery_status"
}

run_k6() {
  local script="$1"
  local out="$2"
  shift 2
  compose --profile load run --rm "$@" k6 run "/scripts/$script" >"$out" 2>&1 || true
}

consumer_events() {
  local id="$1"
  local event="$2"
  compose logs inventory-consumer 2>&1 | grep "$id" | grep -c "\"event\":\"$event\"" || true
}

wake_consumer() {
  compose start inventory-consumer >/dev/null 2>&1 || true
}

wait_for_consumer_event() {
  local id="$1"
  local event="$2"
  local tries="${3:-45}"
  local attempt
  for attempt in $(seq 1 "$tries"); do
    if [[ "$(consumer_events "$id" "$event")" -ge 1 ]]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

wait_for_order() {
  local attempt
  for attempt in $(seq 1 40); do
    if curl -sf -m 2 "$ORDER/health" >/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

dlq_contains() {
  local id="$1"
  compose exec -T -i -e "DLQ_ID=$id" inventory-consumer node --input-type=module - <<'EOF'
import { Kafka } from "kafkajs";
const id = process.env.DLQ_ID;
const kafka = new Kafka({ clientId: "lab-dlq-read", brokers: ["kafka:29092"] });
const consumer = kafka.consumer({ groupId: `lab-dlq-${Date.now()}` });
const timer = setTimeout(() => process.exit(1), 8000);
await consumer.connect();
await consumer.subscribe({ topic: "order.dlq", fromBeginning: true });
await consumer.run({
  eachMessage: async ({ message }) => {
    if (message.value.toString().includes(id)) {
      clearTimeout(timer);
      console.log("found");
      process.exit(0);
    }
  },
});
EOF
}

wait_for_kafka_port() {
  local attempt
  for attempt in $(seq 1 40); do
    if compose exec -T order node --input-type=module -e 'import net from "node:net"; await new Promise((resolve, reject) => { const socket = net.connect(29092, "kafka", () => { socket.end(); resolve(); }); socket.setTimeout(500, () => reject(new Error("timeout"))); socket.on("error", reject); });'; then
      return 0
    fi
    sleep 1
  done
  return 1
}
