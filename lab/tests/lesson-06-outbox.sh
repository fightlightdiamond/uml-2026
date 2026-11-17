# Lesson 6. Outbox ghi đơn và event trong cùng một transaction.
# Direct publish xảy ra sau commit, nên Kafka chết thì event có thể mất còn đơn thì còn.

lesson_06_outbox() {
  echo
  echo "== Lesson 6 — outbox and direct publish =="
  lesson_06_outbox_event_is_published_and_consumed_once
  lesson_06_direct_publish_has_no_outbox_row
  lesson_06_relay_crash_republishes_without_a_second_effect
}

lesson_06_outbox_event_is_published_and_consumed_once() {
  post "$ORDER/orders" \
    "{\"checkoutSessionId\":\"lesson6-outbox-$RUN\",\"productId\":\"catalog-sku\",\"amount\":1000,\"publishMode\":\"outbox\"}" \
    "$RUN_DIR/outbox.json"
  check "lesson 6 outbox order" "$HTTP_CODE" "201"
  local linked=0
  local attempt
  for attempt in $(seq 1 20); do
    linked=$(sql "SELECT count(*) FROM outbox o
      JOIN processed_messages p ON p.message_id = o.event_id
      WHERE o.payload->>'checkoutSessionId' = 'lesson6-outbox-$RUN'
        AND o.published_at IS NOT NULL;")
    if [[ "$linked" == "1" ]]; then
      break
    fi
    sleep 0.5
  done
  check "lesson 6 outbox event published and consumed once" "$linked" "1"
}

lesson_06_direct_publish_has_no_outbox_row() {
  post "$ORDER/orders" \
    "{\"checkoutSessionId\":\"lesson6-direct-$RUN\",\"productId\":\"catalog-sku\",\"amount\":1000,\"publishMode\":\"direct\"}" \
    "$RUN_DIR/direct.json"
  check "lesson 6 direct order" "$HTTP_CODE" "201"
  local order_id processed rows
  order_id=$(json_field "$RUN_DIR/direct.json" orderId)
  if [[ -z "$order_id" ]]; then
    fail "lesson 6 direct order returned no id"
    return
  fi
  processed=0
  local attempt
  for attempt in $(seq 1 20); do
    processed=$(sql "SELECT count(*) FROM processed_messages WHERE message_id = '$order_id';")
    if [[ "$processed" == "1" ]]; then
      break
    fi
    sleep 0.5
  done
  rows=$(sql "SELECT count(*) FROM outbox WHERE payload->>'orderId' = '$order_id';")
  check "lesson 6 direct event consumed once" "$processed" "1"
  check "lesson 6 direct publish writes no outbox row" "$rows" "0"
}

lesson_06_restore_relay() {
  CRASH_AFTER_PUBLISH=0 compose up -d --no-deps --force-recreate outbox-relay >/dev/null
}

lesson_06_wait_relay() {
  local crashing="$1"
  local needle='"crashAfterPublish":false'
  if [[ "$crashing" == "true" ]]; then
    needle='"crashAfterPublish":true'
  fi
  local attempt id
  for attempt in $(seq 1 30); do
    id=$(compose ps -q outbox-relay)
    if [[ -n "$id" ]] && docker logs "$id" 2>&1 | grep -q "$needle"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

lesson_06_relay_crash_republishes_without_a_second_effect() {
  local product="relay-$RUN"
  local session="lesson6-relay-$RUN"
  sql "INSERT INTO inventory (product_id, quantity) VALUES ('$product', 5)
       ON CONFLICT (product_id) DO UPDATE SET quantity = 5, version = 0;" >/dev/null
  CRASH_AFTER_PUBLISH=1 compose up -d --no-deps --force-recreate outbox-relay >/dev/null
  if ! lesson_06_wait_relay true; then
    fail "lesson 6 crashing relay did not start"
    lesson_06_restore_relay
    return
  fi
  post "$ORDER/orders" \
    "{\"checkoutSessionId\":\"$session\",\"productId\":\"$product\",\"amount\":1000,\"publishMode\":\"outbox\"}" \
    "$RUN_DIR/relay-crash.json"
  check "lesson 6 relay crash order" "$HTTP_CODE" "201"
  local event_id processed attempt
  event_id=$(sql "SELECT event_id FROM outbox WHERE payload->>'checkoutSessionId' = '$session';")
  if [[ -z "$event_id" ]]; then
    fail "lesson 6 relay crash order has no outbox row"
    lesson_06_restore_relay
    return
  fi
  processed=0
  for attempt in $(seq 1 30); do
    processed=$(sql "SELECT count(*) FROM processed_messages WHERE message_id = '$event_id';")
    if [[ "$processed" == "1" ]]; then
      break
    fi
    sleep 0.5
  done
  compose stop outbox-relay >/dev/null
  check "lesson 6 relay crash delivers the event once before the mark" "$processed" "1"
  check "lesson 6 relay crash leaves the outbox unpublished" \
    "$(sql "SELECT count(*) FROM outbox WHERE event_id = '$event_id' AND published_at IS NULL;")" "1"
  check "lesson 6 relay crash reserves inventory once" \
    "$(sql "SELECT quantity FROM inventory WHERE product_id = '$product';")" "4"
  lesson_06_restore_relay
  if ! lesson_06_wait_relay false; then
    fail "lesson 6 relay did not return after the crash"
    return
  fi
  local published=0
  for attempt in $(seq 1 30); do
    published=$(sql "SELECT count(*) FROM outbox WHERE event_id = '$event_id' AND published_at IS NOT NULL;")
    if [[ "$published" == "1" ]]; then
      break
    fi
    sleep 0.5
  done
  sleep 2
  check "lesson 6 relay marks the row after it publishes again" "$published" "1"
  check "lesson 6 the second publish does not reserve inventory again" \
    "$(sql "SELECT quantity FROM inventory WHERE product_id = '$product';")" "4"
  check "lesson 6 the second publish is still one inbox row" \
    "$(sql "SELECT count(*) FROM processed_messages WHERE message_id = '$event_id';")" "1"
}

lesson_06_direct_publish_can_lose_the_event() {
  echo
  echo "== Lesson 6 — direct publish while Kafka is down =="
  # Một lần thử. Producer bỏ cuộc trước khi Kafka trở lại, nên event không được ghi.
  KAFKA_RETRIES=0 compose up -d --no-deps --force-recreate order >/dev/null
  if ! wait_for_order; then
    fail "lesson 6 order did not listen before the Kafka outage"
    KAFKA_RETRIES=8 compose up -d --no-deps --force-recreate order >/dev/null || true
    return
  fi
  compose stop kafka >/dev/null
  post "$ORDER/orders" \
    "{\"checkoutSessionId\":\"lesson6-lost-$RUN\",\"productId\":\"catalog-sku\",\"amount\":1000,\"publishMode\":\"direct\"}" \
    "$RUN_DIR/lost.json"
  local order_id failed_log
  order_id=$(json_field "$RUN_DIR/lost.json" orderId)
  failed_log=$(compose logs order 2>&1 | grep "$order_id" | grep "order.direct_publish_failed" || true)
  compose start kafka >/dev/null
  KAFKA_RETRIES=8 compose up -d --no-deps --force-recreate order >/dev/null
  wait_for_kafka_port || true
  wait_for_order || true
  sleep 3
  if [[ -z "$order_id" ]]; then
    fail "lesson 6 direct publish during the outage returned no order"
    return
  fi
  check "lesson 6 the order row survives a failed direct publish" \
    "$(sql "SELECT count(*) FROM orders WHERE id = '$order_id';")" "1"
  check "lesson 6 the direct event was not consumed" \
    "$(sql "SELECT count(*) FROM processed_messages WHERE message_id = '$order_id';")" "0"
  if [[ -n "$failed_log" ]]; then
    pass "lesson 6 order logged direct_publish_failed"
  else
    fail "lesson 6 did not log direct_publish_failed"
  fi
}
