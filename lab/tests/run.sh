#!/usr/bin/env bash
# Chạy một bài: bash tests/run.sh lesson_01_timeout
# Chạy mọi bài có process: bash tests/run.sh
set -u
cd "$(dirname "$0")/.."
ROOT=$(pwd)
source tests/lib.sh
source tests/lesson-01-timeout.sh
source tests/lesson-02-retry.sh
source tests/lesson-03-idempotency.sh
source tests/lesson-04-concurrency.sh
source tests/lesson-05-kafka-crash.sh
source tests/lesson-06-outbox.sh
source tests/lesson-12-fencing.sh
source tests/lesson-13-deadline.sh
source tests/lesson-14-fraud.sh
source tests/lesson-15-trace.sh

cleanup_lab() {
  curl -sS -m 5 -X POST "$FRAUD/admin/delay" -H 'content-type: application/json' -d '{"ms":50}' >/dev/null 2>&1 || true
  curl -sS -m 5 -X POST "$ORDER/admin/overload" -H 'content-type: application/json' -d '{"enabled":false}' >/dev/null 2>&1 || true
  compose start kafka >/dev/null 2>&1 || true
}
trap cleanup_lab EXIT

prepare_lab

if [[ $# -eq 0 ]]; then
  lesson_12_fencing
  lesson_03_idempotency
  lesson_13_deadline
  lesson_01_timeout
  lesson_06_outbox
  lesson_05_kafka_crash
  lesson_04_concurrency
  lesson_02_retry
  lesson_14_fraud
  lesson_15_trace
  lesson_06_direct_publish_can_lose_the_event
else
  for lab_fn in "$@"; do
    "$lab_fn"
  done
fi

echo
echo "PASS $PASSES  FAIL $FAILS"
[[ "$FAILS" -eq 0 ]]
