# Lesson 13. Budget đủ thì payment chạy. Budget ngắn hơn phần việc còn lại thì payment dừng và đơn không được confirmed.

lesson_13_deadline() {
  echo
  echo "== Lesson 13 — deadline propagation =="
  lesson_13_a_two_second_budget_confirms_the_order
  lesson_13_a_fifty_millisecond_budget_stops_payment
  lesson_13_caller_cancel_stops_uncommitted_fraud
  lesson_13_caller_cancel_keeps_a_committed_payment
}

lesson_13_a_two_second_budget_confirms_the_order() {
  post "$ORDER/orders" \
    "{\"checkoutSessionId\":\"lesson13-fit-$RUN\",\"productId\":\"catalog-sku\",\"amount\":1000}" \
    "$RUN_DIR/deadline-fit.json" \
    "x-budget-ms: 2000"
  check "lesson 13 budget 2000 status" "$HTTP_CODE" "201"
  check "lesson 13 budget 2000 order" "$(json_field "$RUN_DIR/deadline-fit.json" status)" "CONFIRMED"
}

lesson_13_a_fifty_millisecond_budget_stops_payment() {
  post "$ORDER/orders" \
    "{\"checkoutSessionId\":\"lesson13-short-$RUN\",\"productId\":\"catalog-sku\",\"amount\":1000}" \
    "$RUN_DIR/deadline-short.json" \
    "x-budget-ms: 50"
  check "lesson 13 budget 50 status" "$HTTP_CODE" "202"
  check "lesson 13 budget 50 payment error" "$(json_field "$RUN_DIR/deadline-short.json" payment.error)" "deadline_exceeded"
  check "lesson 13 budget 50 leaves the order pending" \
    "$(sql "SELECT status FROM orders WHERE checkout_session_id = 'lesson13-short-$RUN';")" \
    "PENDING_PAYMENT"
}

lesson_13_caller_cancel_stops_uncommitted_fraud() {
  set_fraud_delay 2500
  CURL_MAX=1
  CURL_QUIET=1
  post "$ORDER/orders" \
    "{\"checkoutSessionId\":\"lesson13-cancel-$RUN\",\"productId\":\"catalog-sku\",\"amount\":1000}" \
    "$RUN_DIR/deadline-cancel.json" \
    "x-budget-ms: 8000" \
    "x-fraud-timeout-ms: 8000"
  local dropped="$HTTP_CODE"
  CURL_MAX=20
  CURL_QUIET=
  sleep 3
  check "lesson 13 caller drop status" "$dropped" "000"
  check "lesson 13 caller drop leaves the order pending" \
    "$(sql "SELECT status FROM orders WHERE checkout_session_id = 'lesson13-cancel-$RUN';")" \
    "PENDING_PAYMENT"
  check "lesson 13 caller drop does not commit payment" \
    "$(sql "SELECT count(*) FROM payments WHERE intent_id = 'pay_lesson13-cancel-$RUN';")" \
    "0"
  set_fraud_delay 50
}

lesson_13_caller_cancel_keeps_a_committed_payment() {
  CURL_MAX=1
  CURL_QUIET=1
  post "$ORDER/orders" \
    "{\"checkoutSessionId\":\"lesson13-hold-$RUN\",\"productId\":\"catalog-sku\",\"amount\":1000}" \
    "$RUN_DIR/deadline-hold.json" \
    "x-budget-ms: 8000" \
    "x-payment-hold-ms: 2000"
  local dropped="$HTTP_CODE"
  CURL_MAX=20
  CURL_QUIET=
  sleep 2
  check "lesson 13 hold drop status" "$dropped" "000"
  check "lesson 13 hold drop keeps the payment" \
    "$(sql "SELECT status FROM payments WHERE intent_id = 'pay_lesson13-hold-$RUN';")" \
    "SUCCEEDED"
  check "lesson 13 hold drop does not invent a confirmation the caller never received" \
    "$(sql "SELECT status FROM orders WHERE checkout_session_id = 'lesson13-hold-$RUN';")" \
    "PENDING_PAYMENT"
}
