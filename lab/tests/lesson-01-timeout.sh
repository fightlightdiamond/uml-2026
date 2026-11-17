# Lesson 1. Timeout chỉ chứng minh client không nhận được response.

lesson_01_timeout() {
  echo
  echo "== Lesson 1 — timeout does not prove the order is missing =="
  lesson_01_send_fifty_requests
  lesson_01_timeout_still_has_a_committed_order
}

lesson_01_one_request() {
  local n="$1"
  local session="lesson1-$RUN-$n"
  CURL_MAX=2 CURL_QUIET=1 post "$ORDER/orders" \
    "{\"checkoutSessionId\":\"$session\",\"productId\":\"catalog-sku\",\"amount\":1000}" \
    "$RUN_DIR/l1-$n.json" \
    "x-lab: lesson1"
  printf '%s %s\n' "$session" "$HTTP_CODE" > "$RUN_DIR/l1-$n.code"
}

lesson_01_send_fifty_requests() {
  local batch n
  for batch in 0 1 2 3 4 5 6; do
    for n in $(seq $((batch * 8 + 1)) $((batch * 8 + 8))); do
      if (( n > 50 )); then
        break
      fi
      lesson_01_one_request "$(printf '%02d' "$n")" &
    done
    wait
  done
  sleep 4
}

lesson_01_timeout_still_has_a_committed_order() {
  python3 - "$RUN_DIR" <<'PY'
import os, sys
run_dir = sys.argv[1]
timeouts = []
codes = {}
for name in os.listdir(run_dir):
    if not name.startswith("l1-") or not name.endswith(".code"):
        continue
    session, code = open(os.path.join(run_dir, name)).read().split()
    codes[code] = codes.get(code, 0) + 1
    if code == "000":
        timeouts.append(session)
open(os.path.join(run_dir, "l1-timeouts.txt"), "w").write("\n".join(timeouts))
print("http", dict(sorted(codes.items())), "timeouts", len(timeouts))
PY
  local timeout_count row_count confirmed_count sample
  timeout_count=$(grep -c . "$RUN_DIR/l1-timeouts.txt" || true)
  if [[ "$timeout_count" -lt 1 ]]; then
    fail "lesson 1 produced no client timeouts"
    return
  fi
  pass "lesson 1 client timeouts = $timeout_count"
  local id_list
  id_list=$(python3 -c 'ids=[l.strip() for l in open("'"$RUN_DIR"'/l1-timeouts.txt") if l.strip()]; print(",".join(chr(39)+i+chr(39) for i in ids))')
  row_count=$(sql "SELECT count(*) FROM orders WHERE checkout_session_id IN ($id_list);")
  confirmed_count=$(sql "SELECT count(*) FROM orders WHERE status = 'CONFIRMED' AND checkout_session_id IN ($id_list);")
  check "lesson 1 timed-out requests that have an order row" "$row_count" "$timeout_count"
  check_gt "lesson 1 timed-out requests that are already CONFIRMED" "$confirmed_count" 0
  sample=$(sql "SELECT checkout_session_id FROM orders WHERE status = 'CONFIRMED' AND checkout_session_id IN ($id_list) LIMIT 1;")
  lesson_01_logs_span_commit "$sample"
  get_to "$ORDER/orders/$sample" "$RUN_DIR/l1-sample.json"
  check "lesson 1 read-after-timeout" "$HTTP_CODE" "200"
}

lesson_01_logs_span_commit() {
  local session="$1"
  local order_id result
  order_id=$(sql "SELECT id FROM orders WHERE checkout_session_id = '$session';")
  result=$(compose logs order 2>&1 | python3 -c '
import json, sys
order_id = sys.argv[1]
want = ["order.before_insert", "order.after_commit", "order.before_response"]
found = set()
for line in sys.stdin:
    raw = line.split("|", 1)[-1].strip()
    try:
        obj = json.loads(raw)
    except Exception:
        continue
    if obj.get("orderId") == order_id and obj.get("event") in want:
        found.add(obj["event"])
        print(obj["event"], "delayMs=" + str(obj.get("delayMs")))
missing = [name for name in want if name not in found]
print("MISSING " + ",".join(missing) if missing else "COMPLETE")
' "$order_id")
  printf '%s\n' "$result"
  if [[ "$result" == *"COMPLETE" ]]; then
    pass "lesson 1 logs show insert, commit, then response for $session"
  else
    fail "lesson 1 logs for $session are incomplete"
  fi
}
