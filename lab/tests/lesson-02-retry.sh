# Lesson 2. k6 tạo nhiều request hơn sức chứa của Order.
# Order giữ mỗi request đã nhận trong workMs. Hàng đợi đầy thì trả 503.
# Timeout của lần gọi không phải khoảng chờ trước lần retry.
# Lần retry tiếp theo chỉ được gửi khi còn nằm trong budget.

lesson_02_retry() {
  echo
  echo "== Lesson 2 — retry under a real capacity limit =="
  local policy
  for policy in none immediate fixed exponential jitter; do
    lesson_02_run_policy "$policy" 80 10 300 3000
  done
  lesson_02_compare_policies
  lesson_02_deadline_blocks_the_backoff
  lesson_02_fast_shed_still_retries
}

lesson_02_run_policy() {
  local policy="$1"
  local iterations="$2"
  local vus="$3"
  local timeout_ms="$4"
  local budget_ms="$5"
  local out="$RUN_DIR/lesson2-$policy.txt"
  echo "  run   policy=$policy iterations=$iterations timeout=${timeout_ms}ms budget=${budget_ms}ms"
  run_k6 lesson2.ts "$out" \
    -e "POLICY=$policy" \
    -e "ITERATIONS=$iterations" \
    -e "VUS=$vus" \
    -e "TIMEOUT_MS=$timeout_ms" \
    -e "BUDGET_MS=$budget_ms" \
    -e "CAPACITY=2" \
    -e "WORK_MS=200" \
    -e "QUEUE_LIMIT=20"
  local attempts p95 p99 failed recovery_ms recovery accepted timeouts sheds actions
  attempts=$(k6_field "$out" http_attempts count)
  p95=$(k6_field "$out" policy_latency_ms p95)
  p99=$(k6_field "$out" policy_latency_ms p99)
  failed=$(k6_field "$out" policy_failed rate)
  accepted=$(k6_field "$out" accepted_ms avg)
  timeouts=${timeouts:-0}
  timeouts=$(k6_field "$out" client_timeouts count)
  sheds=$(k6_field "$out" shed_responses count)
  actions=$(k6_field "$out" user_actions count)
  recovery_ms=$(k6_recovery "$out" "recovery_ms")
  recovery=$(k6_recovery_status "$out")
  timeouts=${timeouts:-0}
  sheds=${sheds:-0}
  printf '%s\n' "$attempts" > "$RUN_DIR/lesson2-$policy.attempts"
  printf '%s\n' "$p95" > "$RUN_DIR/lesson2-$policy.p95"
  printf '%s\n' "$failed" > "$RUN_DIR/lesson2-$policy.failed"
  printf '%s\n' "$actions" > "$RUN_DIR/lesson2-$policy.actions"
  echo "  stat  $policy actions=$actions attempts=$attempts p95_ms=$p95 p99_ms=$p99 failed_pct=${failed:-0} accepted_avg_ms=${accepted:-0} timeouts=$timeouts shed=$sheds recovery_ms=$recovery_ms recovery_http=$recovery"
  check "lesson 2 $policy recovery status" "$recovery" "200"
}

lesson_02_compare_policies() {
  local none_attempts immediate_attempts none_p95 exponential_p95 none_failed immediate_failed
  local none_accepted none_timeouts none_sheds none_actions exponential_actions
  none_attempts=$(cat "$RUN_DIR/lesson2-none.attempts")
  immediate_attempts=$(cat "$RUN_DIR/lesson2-immediate.attempts")
  none_p95=$(cat "$RUN_DIR/lesson2-none.p95")
  exponential_p95=$(cat "$RUN_DIR/lesson2-exponential.p95")
  none_failed=$(cat "$RUN_DIR/lesson2-none.failed")
  immediate_failed=$(cat "$RUN_DIR/lesson2-immediate.failed")
  none_accepted=$(k6_field "$RUN_DIR/lesson2-none.txt" accepted_ms avg)
  none_timeouts=$(k6_field "$RUN_DIR/lesson2-none.txt" client_timeouts count)
  none_sheds=$(k6_field "$RUN_DIR/lesson2-none.txt" shed_responses count)
  none_actions=$(cat "$RUN_DIR/lesson2-none.actions")
  exponential_actions=$(cat "$RUN_DIR/lesson2-exponential.actions")
  none_timeouts=${none_timeouts:-0}
  none_sheds=${none_sheds:-0}
  check "lesson 2 none user actions" "$none_actions" "80"
  check "lesson 2 exponential user actions" "$exponential_actions" "80"
  check "lesson 2 none sends one attempt per action" "$none_attempts" "$none_actions"
  check_gt "lesson 2 none still completes some requests" "$((100 - none_failed))" 0
  check_gt "lesson 2 none also loses some requests" "$none_failed" 0
  check_gt "lesson 2 an accepted request did the configured work" "$none_accepted" 150
  check_gt "lesson 2 none saw a timeout or a shed" "$((none_timeouts + none_sheds))" 0
  check_gt "lesson 2 immediate retry sends more HTTP attempts than no retry" "$immediate_attempts" "$none_attempts"
  check_gt "lesson 2 immediate retry still leaves most user actions failed" "$immediate_failed" 50
  check_gt "lesson 2 exponential backoff p95 is slower than no retry" "$exponential_p95" "$none_p95"
}

lesson_02_deadline_blocks_the_backoff() {
  echo "  run   deadline keeps exponential from using the 300ms timeout as a retry delay"
  run_k6 lesson2.ts "$RUN_DIR/lesson2-deadline-exponential.txt" \
    -e "POLICY=exponential" -e "ITERATIONS=30" -e "VUS=10" \
    -e "TIMEOUT_MS=300" -e "BUDGET_MS=400" \
    -e "CAPACITY=2" -e "WORK_MS=200" -e "QUEUE_LIMIT=20"
  run_k6 lesson2.ts "$RUN_DIR/lesson2-deadline-immediate.txt" \
    -e "POLICY=immediate" -e "ITERATIONS=30" -e "VUS=10" \
    -e "TIMEOUT_MS=300" -e "BUDGET_MS=400" \
    -e "CAPACITY=2" -e "WORK_MS=200" -e "QUEUE_LIMIT=20"
  local exponential_after immediate_after
  exponential_after=$(k6_field "$RUN_DIR/lesson2-deadline-exponential.txt" retries_after_timeout count)
  immediate_after=$(k6_field "$RUN_DIR/lesson2-deadline-immediate.txt" retries_after_timeout count)
  exponential_after=${exponential_after:-0}
  immediate_after=${immediate_after:-0}
  echo "  stat  budget=400ms timeout=300ms retries_after_timeout exponential=$exponential_after immediate=$immediate_after"
  check "lesson 2 a 300ms timeout leaves no room for the 100ms backoff" "$exponential_after" "0"
  check_gt "lesson 2 immediate still retries after that timeout because its delay is 0" "$immediate_after" 0
}

lesson_02_fast_shed_still_retries() {
  echo "  run   a fast 503 still leaves room for another attempt inside 400ms"
  local policy sheds
  for policy in exponential immediate; do
    run_k6 lesson2.ts "$RUN_DIR/lesson2-shed-$policy.txt" \
      -e "POLICY=$policy" -e "ITERATIONS=30" -e "VUS=10" \
      -e "TIMEOUT_MS=300" -e "BUDGET_MS=400" \
      -e "CAPACITY=2" -e "WORK_MS=200" -e "QUEUE_LIMIT=1"
    sheds=$(k6_field "$RUN_DIR/lesson2-shed-$policy.txt" retries_after_shed count)
    sheds=${sheds:-0}
    echo "  stat  budget=400ms queue=1 policy=$policy retries_after_shed=$sheds"
    check_gt "lesson 2 $policy retries after a fast 503" "$sheds" 0
  done
}
