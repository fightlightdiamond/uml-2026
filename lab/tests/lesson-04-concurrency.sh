# Lesson 4. 100 request đồng thời. Conditional và pessimistic giữ đúng 100 lần thành công.
# Optimistic không khoá dòng, nên một phần request xung đột và không được retry.

lesson_04_concurrency() {
  echo
  echo "== Lesson 4 — one hundred concurrent decrements =="
  lesson_04_measure conditional
  lesson_04_measure optimistic
  lesson_04_measure pessimistic
  lesson_04_compare_lock_wait
}

lesson_04_measure() {
  local mechanism="$1"
  local out="$RUN_DIR/lesson4-$mechanism.txt"
  echo "  run   mechanism=$mechanism"
  run_k6 lesson4.ts "$out" -e "MECHANISM=$mechanism"
  local success conflict wait_avg quantity
  success=$(k6_field "$out" lab_success count)
  conflict=$(k6_field "$out" lab_conflict count)
  wait_avg=$(k6_field "$out" lock_wait_ms avg)
  local retries throughput
  retries=$(k6_field "$out" lab_retries count)
  throughput=$(k6_field "$out" http_reqs per_s)
  conflict=${conflict:-0}
  wait_avg=${wait_avg:-0}
  retries=${retries:-0}
  throughput=${throughput:-0}
  quantity=$(sql "SELECT quantity FROM inventory WHERE product_id = 'bulk-sku';")
  printf '%s\n' "$wait_avg" > "$RUN_DIR/lesson4-$mechanism.wait"
  echo "  stat  $mechanism success=$success conflict=$conflict lock_wait_avg_ms=$wait_avg quantity_left=$quantity retries=$retries throughput_rps=$throughput"
  check "lesson 4 $mechanism measured retries" "$retries" "0"
  check_gt "lesson 4 $mechanism throughput" "$throughput" 0
  if [[ "$mechanism" == "optimistic" ]]; then
    check_gt "lesson 4 optimistic conflicts" "$conflict" 0
    check_gt "lesson 4 optimistic leaves some stock" "$quantity" 0
    check "lesson 4 optimistic stock matches successes" "$quantity" "$((100 - success))"
    return
  fi
  check "lesson 4 $mechanism successes" "$success" "100"
  check "lesson 4 $mechanism conflicts" "$conflict" "0"
  check "lesson 4 $mechanism remaining stock" "$quantity" "0"
}

lesson_04_compare_lock_wait() {
  local conditional pessimistic
  conditional=$(cat "$RUN_DIR/lesson4-conditional.wait")
  pessimistic=$(cat "$RUN_DIR/lesson4-pessimistic.wait")
  check_gt "lesson 4 pessimistic lock wait exceeds conditional wait" "$pessimistic" "$conditional"
}
