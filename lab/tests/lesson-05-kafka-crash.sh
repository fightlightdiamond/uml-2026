# Lesson 5. Offset và hiệu ứng nghiệp vụ là hai việc khác nhau.
# split_writes là cửa sổ xấu: kho đã đổi trước khi inbox được ghi.
# Consumer chết thì Docker chờ rồi mới dựng lại. Test gọi start để bỏ qua khoảng chờ đó.

lesson_05_kafka_crash() {
  echo
  echo "== Lesson 5 — consumer crash points =="
  sql "INSERT INTO inventory (product_id, quantity) VALUES ('lab-crash', 40)
       ON CONFLICT (product_id) DO UPDATE SET quantity = 40, version = 0;" >/dev/null
  lesson_05_before_commit_is_redelivered_once
  lesson_05_split_writes_applies_the_effect_twice
  lesson_05_after_db_commit_does_not_apply_twice
  lesson_05_after_offset_is_not_redelivered
  lesson_05_unsupported_schema_goes_to_the_dlq
}

lesson_05_publish() {
  sql "INSERT INTO outbox (event_id, topic, payload)
    VALUES (gen_random_uuid(), 'order.created', jsonb_build_object(
      'productId', 'lab-crash',
      'schemaVersion', $1,
      'crashPoint', '$2',
      'orderId', gen_random_uuid()::text
    )) RETURNING event_id;" | tr -d '[:space:]'
}

lesson_05_quantity() {
  sql "SELECT quantity FROM inventory WHERE product_id = 'lab-crash';"
}

lesson_05_require_event() {
  local id="$1"
  local event="$2"
  if wait_for_consumer_event "$id" "$event"; then
    return 0
  fi
  fail "lesson 5 $id did not log $event"
  return 1
}

lesson_05_before_commit_is_redelivered_once() {
  local before id after
  before=$(lesson_05_quantity)
  id=$(lesson_05_publish 2 before_commit)
  echo "  send  before_commit id=$id quantity=$before"
  lesson_05_require_event "$id" consumer.crash || return
  wake_consumer
  lesson_05_require_event "$id" consumer.db_committed || return
  after=$(lesson_05_quantity)
  check "lesson 5 before_commit inventory delta" "$((before - after))" "1"
  check_gt "lesson 5 before_commit is polled again" "$(consumer_events "$id" consumer.polled)" 1
}

lesson_05_split_writes_applies_the_effect_twice() {
  local before id after
  before=$(lesson_05_quantity)
  id=$(lesson_05_publish 2 split_writes)
  echo "  send  split_writes id=$id quantity=$before"
  lesson_05_require_event "$id" consumer.crash || return
  wake_consumer
  lesson_05_require_event "$id" consumer.db_committed || return
  after=$(lesson_05_quantity)
  check "lesson 5 split_writes inventory delta" "$((before - after))" "2"
  check "lesson 5 split_writes still has one inbox row" \
    "$(sql "SELECT count(*) FROM processed_messages WHERE message_id = '$id';")" "1"
}

lesson_05_after_db_commit_does_not_apply_twice() {
  local before id after duplicates
  before=$(lesson_05_quantity)
  id=$(lesson_05_publish 2 after_db_commit)
  echo "  send  after_db_commit id=$id quantity=$before"
  lesson_05_require_event "$id" consumer.db_committed || return
  lesson_05_require_event "$id" consumer.crash || return
  wake_consumer
  local attempt
  duplicates=0
  for attempt in $(seq 1 40); do
    duplicates=$(compose logs inventory-consumer 2>&1 | grep "$id" | grep -c '"duplicate":true' || true)
    if [[ "$duplicates" -ge 1 ]]; then
      break
    fi
    sleep 1
  done
  after=$(lesson_05_quantity)
  check "lesson 5 after_db_commit inventory delta" "$((before - after))" "1"
  check_gt "lesson 5 after_db_commit redelivery is marked duplicate" "$duplicates" 0
}

lesson_05_after_offset_is_not_redelivered() {
  local before id after polls
  before=$(lesson_05_quantity)
  id=$(lesson_05_publish 2 after_offset)
  echo "  send  after_offset id=$id quantity=$before"
  lesson_05_require_event "$id" consumer.offset_committed || return
  lesson_05_require_event "$id" consumer.crash || return
  polls=$(consumer_events "$id" consumer.polled)
  wake_consumer
  sleep 5
  after=$(lesson_05_quantity)
  check "lesson 5 after_offset inventory delta" "$((before - after))" "1"
  check "lesson 5 after_offset is polled once" "$(consumer_events "$id" consumer.polled)" "$polls"
}

lesson_05_unsupported_schema_goes_to_the_dlq() {
  local before id
  before=$(lesson_05_quantity)
  id=$(sql "INSERT INTO outbox (event_id, topic, payload)
    VALUES (gen_random_uuid(), 'order.created', jsonb_build_object(
      'productId', 'lab-crash',
      'schemaVersion', 99,
      'orderId', gen_random_uuid()::text
    )) RETURNING event_id;" | tr -d '[:space:]')
  echo "  send  unsupported_schema id=$id"
  lesson_05_require_event "$id" consumer.dlq || return
  check "lesson 5 bad schema does not change inventory" "$(lesson_05_quantity)" "$before"
  check "lesson 5 bad schema is not an inbox row" \
    "$(sql "SELECT count(*) FROM processed_messages WHERE message_id = '$id';")" "0"
  if dlq_contains "$id" | grep -q found; then
    pass "lesson 5 bad schema is on order.dlq"
  else
    fail "lesson 5 bad schema was not found on order.dlq"
  fi
}
