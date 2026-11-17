# Lesson 12. Storage từ chối token cũ hơn token đã chấp nhận.
# Lease còn hạn thì process khác không lấy được lock.

lesson_12_fencing() {
  echo
  echo "== Lesson 12 — fencing token =="
  lesson_12_a_held_lease_rejects_the_next_owner
  lesson_12_an_older_token_is_rejected_after_a_newer_write
}

lesson_12_a_held_lease_rejects_the_next_owner() {
  local name="fence-$RUN"
  post "$ORDER/locks/$name/acquire" '{"owner":"A"}' "$RUN_DIR/lease-a.json"
  check "lesson 12 owner A acquires the lock" "$HTTP_CODE" "200"
  post "$ORDER/locks/$name/acquire" '{"owner":"B"}' "$RUN_DIR/lease-b.json"
  check "lesson 12 owner B is rejected while the lease is held" "$HTTP_CODE" "409"
  check "lesson 12 held-lease error" "$(json_field "$RUN_DIR/lease-b.json" error)" "lease_held"
}

lesson_12_an_older_token_is_rejected_after_a_newer_write() {
  local current newer older amount_before amount_after
  current=$(sql "SELECT accepted_token FROM balances WHERE account_id = 'acct-1';")
  newer=$((current + 2))
  older=$((current + 1))
  amount_before=$(sql "SELECT amount FROM balances WHERE account_id = 'acct-1';")
  post "$ORDER/balances/acct-1/apply" "{\"token\":$newer,\"amount\":10}" "$RUN_DIR/token-new.json"
  check "lesson 12 newer token is stored" "$HTTP_CODE" "200"
  check "lesson 12 stored token" \
    "$(sql "SELECT accepted_token FROM balances WHERE account_id = 'acct-1';")" \
    "$newer"
  post "$ORDER/balances/acct-1/apply" "{\"token\":$older,\"amount\":10}" "$RUN_DIR/token-old.json"
  check "lesson 12 older token is rejected" "$HTTP_CODE" "409"
  check "lesson 12 stale token error" "$(json_field "$RUN_DIR/token-old.json" error)" "stale_token"
  amount_after=$(sql "SELECT amount FROM balances WHERE account_id = 'acct-1';")
  check "lesson 12 the rejected write does not change the balance" "$amount_after" "$((amount_before + 10))"
}
