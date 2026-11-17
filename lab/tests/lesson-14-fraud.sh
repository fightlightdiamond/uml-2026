# Lesson 14. Payment chỉ giữ 2 slot tới Fraud. Quá slot thì từ chối ngay.
# Timeout gọi Fraud mặc định là 500ms. Ba lần timeout mở circuit.
# Half-open chỉ cho một probe. Timeout không confirm đơn: đơn thành PENDING_FRAUD_REVIEW.

lesson_14_fraud() {
  echo
  echo "== Lesson 14 — fraud pool, 500ms timeout, and one half-open probe =="
  lesson_14_pool_rejects_work_beyond_two_slots
  lesson_14_three_timeouts_open_the_circuit
  lesson_14_half_open_allows_one_probe
  lesson_14_timeout_leaves_the_order_for_fraud_review
  set_fraud_delay 50
}

lesson_14_one_payment() {
  local name="$1"
  local budget_ms="$2"
  shift 2
  local deadline
  deadline=$(deadline_ms "$budget_ms")
  CURL_MAX=15 post "$PAYMENT/payments" \
    "{\"intentId\":\"$name-$RUN\",\"amount\":1000}" \
    "$RUN_DIR/$name.json" \
    "x-deadline-ms: $deadline" \
    "$@"
  printf '%s\n' "$HTTP_CODE" > "$RUN_DIR/$name.status"
}

lesson_14_pool_rejects_work_beyond_two_slots() {
  set_fraud_delay 2000
  local name
  for name in pool-1 pool-2 pool-3 pool-4; do
    lesson_14_one_payment "$name" 8000 "x-fraud-timeout-ms: 8000" &
  done
  wait
  local exhausted=0 succeeded=0 error
  for name in pool-1 pool-2 pool-3 pool-4; do
    error=$(json_field "$RUN_DIR/$name.json" error)
    echo "  stat  $name http=$(cat "$RUN_DIR/$name.status") error=${error:-ok}"
    if [[ "$error" == "fraud_pool_exhausted" ]]; then
      exhausted=$((exhausted + 1))
    fi
    if [[ "$(json_field "$RUN_DIR/$name.json" status)" == "SUCCEEDED" ]]; then
      succeeded=$((succeeded + 1))
    fi
  done
  check "lesson 14 payments that occupied a fraud slot" "$succeeded" "2"
  check "lesson 14 payments rejected by the fraud pool" "$exhausted" "2"
}

lesson_14_three_timeouts_open_the_circuit() {
  set_fraud_delay 3000
  local name started elapsed
  for name in circuit-1 circuit-2 circuit-3; do
    started=$(python3 -c 'import time; print(int(time.time() * 1000))')
    lesson_14_one_payment "$name" 2000
    elapsed=$(( $(python3 -c 'import time; print(int(time.time() * 1000))') - started ))
    check "lesson 14 $name times out" "$(json_field "$RUN_DIR/$name.json" error)" "fraud_timeout"
    if [[ "$name" == "circuit-1" ]]; then
      if (( elapsed > 350 && elapsed < 1500 )); then
        pass "lesson 14 fraud timeout is the 500ms cap (${elapsed}ms)"
      else
        fail "lesson 14 fraud timeout was ${elapsed}ms, expected the 500ms cap"
      fi
    fi
  done
  lesson_14_one_payment circuit-open 2000
  check "lesson 14 the next call finds the circuit open" \
    "$(json_field "$RUN_DIR/circuit-open.json" error)" "circuit_open"
}

lesson_14_half_open_allows_one_probe() {
  set_fraud_delay 1200
  sleep 6
  lesson_14_one_payment probe-a 8000 "x-fraud-timeout-ms: 4000" &
  lesson_14_one_payment probe-b 8000 "x-fraud-timeout-ms: 4000" &
  wait
  local open_count=0 success_count=0 name error
  for name in probe-a probe-b; do
    error=$(json_field "$RUN_DIR/$name.json" error)
    echo "  stat  $name http=$(cat "$RUN_DIR/$name.status") error=${error:-ok}"
    if [[ "$error" == "circuit_open" ]]; then
      open_count=$((open_count + 1))
    fi
    if [[ "$(json_field "$RUN_DIR/$name.json" status)" == "SUCCEEDED" ]]; then
      success_count=$((success_count + 1))
    fi
  done
  check "lesson 14 half-open allows one probe" "$success_count" "1"
  check "lesson 14 a second call stays on the open circuit" "$open_count" "1"
  get_to "$PAYMENT/health" "$RUN_DIR/payment-health.json"
  check "lesson 14 circuit is closed after the probe" "$(json_field "$RUN_DIR/payment-health.json" circuit)" "closed"
}

lesson_14_timeout_leaves_the_order_for_fraud_review() {
  set_fraud_delay 3000
  local session="lesson14-review-$RUN"
  local started elapsed
  started=$(python3 -c 'import time; print(int(time.time() * 1000))')
  post "$ORDER/orders" \
    "{\"checkoutSessionId\":\"$session\",\"productId\":\"catalog-sku\",\"amount\":1000}" \
    "$RUN_DIR/review.json" \
    "x-budget-ms: 2000"
  elapsed=$(( $(python3 -c 'import time; print(int(time.time() * 1000))') - started ))
  check "lesson 14 review response" "$HTTP_CODE" "202"
  check "lesson 14 review status" "$(json_field "$RUN_DIR/review.json" status)" "PENDING_FRAUD_REVIEW"
  check "lesson 14 review payment error" "$(json_field "$RUN_DIR/review.json" payment.error)" "fraud_timeout"
  check "lesson 14 review does not confirm the order" \
    "$(sql "SELECT status FROM orders WHERE checkout_session_id = '$session';")" \
    "PENDING_FRAUD_REVIEW"
  check "lesson 14 review does not store a successful payment" \
    "$(sql "SELECT count(*) FROM payments WHERE intent_id = 'pay_$session';")" \
    "0"
  if (( elapsed > 350 && elapsed < 1500 )); then
    pass "lesson 14 order sees the 500ms fraud cap (${elapsed}ms)"
  else
    fail "lesson 14 order fraud cap was ${elapsed}ms"
  fi
}
