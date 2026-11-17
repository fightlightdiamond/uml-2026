# Lesson 3. Cùng key trả response đã lưu. Lease PROCESSING còn hạn không bị chiếm.
# Lease hết hạn mới được takeover. Hết hạn không có nghĩa là được gọi payment lần hai.

lesson_03_idempotency() {
  echo
  echo "== Lesson 3 — idempotency =="
  lesson_03_replay_returns_the_stored_order
  lesson_03_different_body_conflicts
  lesson_03_natural_checkout_key_returns_the_existing_order
  lesson_03_live_lease_is_not_taken_over
  lesson_03_expired_processing_lease_can_be_taken_over
  lesson_03_payment_replay_returns_the_stored_charge
}

lesson_03_order_body() {
  printf '{"checkoutSessionId":"%s","productId":"catalog-sku","amount":%s}' "$1" "$2"
}

lesson_03_replay_returns_the_stored_order() {
  local body
  body=$(lesson_03_order_body "lesson3-same-$RUN" 1000)
  post "$ORDER/orders" "$body" "$RUN_DIR/id-first.json" "Idempotency-Key: lesson3-same-$RUN"
  check "lesson 3 first request" "$HTTP_CODE" "201"
  post "$ORDER/orders" "$body" "$RUN_DIR/id-replay.json" "Idempotency-Key: lesson3-same-$RUN"
  check "lesson 3 replay status" "$HTTP_CODE" "200"
  check "lesson 3 replay returns the stored response unchanged" \
    "$(json_field "$RUN_DIR/id-replay.json" replayed)" \
    "$(json_field "$RUN_DIR/id-first.json" replayed)"
  check "lesson 3 replay keeps the same order" \
    "$(json_field "$RUN_DIR/id-replay.json" orderId)" \
    "$(json_field "$RUN_DIR/id-first.json" orderId)"
}

lesson_03_different_body_conflicts() {
  post "$ORDER/orders" "$(lesson_03_order_body "lesson3-same-$RUN" 1001)" \
    "$RUN_DIR/id-conflict.json" "Idempotency-Key: lesson3-same-$RUN"
  check "lesson 3 same key with a different body" "$HTTP_CODE" "409"
}

lesson_03_natural_checkout_key_returns_the_existing_order() {
  local body
  body=$(lesson_03_order_body "lesson3-natural-$RUN" 1000)
  post "$ORDER/orders" "$body" "$RUN_DIR/natural-first.json"
  check "lesson 3 natural key first request" "$HTTP_CODE" "201"
  post "$ORDER/orders" "$body" "$RUN_DIR/natural-second.json"
  check "lesson 3 natural key second request" "$HTTP_CODE" "200"
  check "lesson 3 natural key replay flag" "$(json_field "$RUN_DIR/natural-second.json" replayed)" "true"
  check "lesson 3 natural key returns the stored order" \
    "$(json_field "$RUN_DIR/natural-second.json" order.id)" \
    "$(json_field "$RUN_DIR/natural-first.json" orderId)"
}

lesson_03_live_lease_is_not_taken_over() {
  local body
  body=$(lesson_03_order_body "lesson3-live-$RUN" 1000)
  CURL_MAX=10 post "$ORDER/orders" "$body" "$RUN_DIR/live-first.json" \
    "Idempotency-Key: lesson3-live-$RUN" "x-response-delay-ms: 4000" &
  sleep 0.6
  post "$ORDER/orders" "$body" "$RUN_DIR/live-second.json" "Idempotency-Key: lesson3-live-$RUN"
  check "lesson 3 live PROCESSING lease" "$HTTP_CODE" "409"
  check "lesson 3 live lease error" "$(json_field "$RUN_DIR/live-second.json" error)" "operation_in_progress"
  wait
  post "$ORDER/orders" "$body" "$RUN_DIR/live-third.json" "Idempotency-Key: lesson3-live-$RUN"
  check "lesson 3 replay after the lease owner finishes" "$HTTP_CODE" "200"
  check "lesson 3 finished lease returns the stored response" \
    "$(json_field "$RUN_DIR/live-third.json" orderId)" \
    "$(json_field "$RUN_DIR/live-first.json" orderId)"
}

lesson_03_request_hash() {
  python3 -c '
import hashlib, json, sys
body = {
    "checkoutSessionId": sys.argv[1],
    "productId": "catalog-sku",
    "amount": 1000,
    "publishMode": "outbox",
}
print(hashlib.sha256(json.dumps(body, separators=(",", ":")).encode()).hexdigest())
' "$1"
}

lesson_03_expired_processing_lease_can_be_taken_over() {
  local session hash token
  session="lesson3-takeover-$RUN"
  hash=$(lesson_03_request_hash "$session")
  sql "INSERT INTO idempotency_keys
        (principal_id, idempotency_key, request_hash, status, lease_until, fencing_token)
       VALUES ('demo', 'lesson3-takeover-$RUN', '$hash', 'PROCESSING', now() - interval '1 second', 1);" >/dev/null
  post "$ORDER/orders" "$(lesson_03_order_body "$session" 1000)" \
    "$RUN_DIR/takeover.json" "Idempotency-Key: lesson3-takeover-$RUN"
  check "lesson 3 expired PROCESSING lease is taken over" "$HTTP_CODE" "201"
  token=$(sql "SELECT fencing_token FROM idempotency_keys WHERE idempotency_key = 'lesson3-takeover-$RUN';")
  check "lesson 3 takeover bumps the fencing token" "$token" "2"
  check "lesson 3 takeover stores SUCCEEDED" \
    "$(sql "SELECT status FROM idempotency_keys WHERE idempotency_key = 'lesson3-takeover-$RUN';")" \
    "SUCCEEDED"
}

lesson_03_payment_replay_returns_the_stored_charge() {
  local deadline body
  deadline=$(deadline_ms 2000)
  body='{"intentId":"pay_lesson3_'"$RUN"'","amount":1000}'
  post "$PAYMENT/payments" "$body" "$RUN_DIR/pay-first.json" "x-deadline-ms: $deadline"
  check "lesson 3 payment first charge" "$HTTP_CODE" "200"
  check "lesson 3 payment stored status" "$(json_field "$RUN_DIR/pay-first.json" status)" "SUCCEEDED"
  deadline=$(deadline_ms 2000)
  post "$PAYMENT/payments" "$body" "$RUN_DIR/pay-replay.json" "x-deadline-ms: $deadline"
  check "lesson 3 payment replay flag" "$(json_field "$RUN_DIR/pay-replay.json" replayed)" "true"
  get_to "$PAYMENT/payments/pay_lesson3_$RUN" "$RUN_DIR/pay-query.json"
  check "lesson 3 payment query" "$HTTP_CODE" "200"
  check "lesson 3 queried charge is the stored one" "$(json_field "$RUN_DIR/pay-query.json" status)" "SUCCEEDED"
}
