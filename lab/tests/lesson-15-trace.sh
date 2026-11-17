# Lesson 15. Một trace đi Order → Payment → Fraud. Delay nằm ở span fraud.check.

lesson_15_trace() {
  echo
  echo "== Lesson 15 — Order, Payment, and Fraud on one trace =="
  lesson_15_fraud_delay_is_the_slow_span
  set_fraud_delay 50
}

lesson_15_trace_id_from_header() {
  python3 -c '
import sys
for line in open(sys.argv[1]):
    if line.lower().startswith("traceparent:"):
        print(line.split(":", 1)[1].strip().split("-")[1])
        break
' "$1"
}

lesson_15_fraud_delay_is_the_slow_span() {
  set_fraud_delay 1500
  post "$ORDER/orders" \
    "{\"checkoutSessionId\":\"lesson15-$RUN\",\"productId\":\"catalog-sku\",\"amount\":1000}" \
    "$RUN_DIR/trace-order.json" \
    "x-budget-ms: 4000" \
    "x-fraud-timeout-ms: 4000"
  check "lesson 15 order confirms while fraud is slow" "$HTTP_CODE" "201"
  local trace_id attempt
  trace_id=$(lesson_15_trace_id_from_header "$RUN_DIR/trace-order.json.headers")
  echo "  stat  trace=$trace_id"
  for attempt in $(seq 1 15); do
    get_to "$JAEGER/api/traces/$trace_id" "$RUN_DIR/trace.json"
    if [[ "$HTTP_CODE" == "200" ]] && grep -q fraud.check "$RUN_DIR/trace.json"; then
      break
    fi
    sleep 1
  done
  local verdict
  verdict=$(python3 - "$RUN_DIR/trace.json" <<'PY'
import json, sys
spans = json.load(open(sys.argv[1]))["data"][0]["spans"]
for span in spans:
    print(f"  span  {span['operationName']} {span['duration'] / 1000:.0f}ms", file=sys.stderr)
fraud = next(span["duration"] for span in spans if span["operationName"] == "fraud.check")
payment = next(span["duration"] for span in spans if span["operationName"] == "payment.charge")
print("yes" if fraud >= 1_000_000 and payment >= fraud else "no")
PY
)
  if [[ "$verdict" == "yes" ]]; then
    pass "lesson 15 fraud.check is the slow span and payment waited for it"
  else
    fail "lesson 15 could not show fraud.check as the slow span"
  fi
}
