# Lab runtime

Một file Compose chạy toàn bộ lab. Từ thư mục này:

```bash
docker compose up --build
```

Mỗi bài lab là một file trong `tests/`. Mỗi kiểm tra là một function. `tests/run.sh` chỉ gọi các function đó.

```bash
bash tests/run.sh
bash tests/run.sh lesson_01_timeout
```

Lesson 7–11 không có process. Quorum, Raft, 2PC và Saga vẫn làm trên giấy.

| Thành phần | Địa chỉ | Dùng cho |
|---|---|---|
| Order API | http://localhost:3001 | Lesson 1–4, 6, 12 |
| Payment API | http://localhost:3002 | Deadline, idempotent charge, circuit breaker |
| Fraud API | http://localhost:3003 | Latency injection, concurrency limit |
| PostgreSQL | localhost:5433, db `lab` / user `lab` / password `lab` | Invariant, inbox, outbox, fencing. Host port 5433 avoids a Postgres already bound to 5432. Inside Compose the host name is still `postgres:5432`. |
| Kafka | `kafka:29092` trong mạng Compose, `localhost:9092` từ máy | Offset, DLQ |
| Kafka UI | http://localhost:8080 | Xem topic, offset, DLQ |
| Jaeger | http://localhost:16686 | Lesson 15 |

Kafka là một broker KRaft. Bài quorum và Raft vẫn làm trên giấy. Redis không có: fencing token được PostgreSQL từ chối.

## Bài có process để chạy

Lesson 1. Timeout 2 giây, server trì hoãn ngẫu nhiên 0–4 giây:

```bash
curl -m 2 -X POST http://localhost:3001/orders \
  -H 'content-type: application/json' -H 'x-lab: lesson1' \
  -d '{"checkoutSessionId":"s1","productId":"catalog-sku","amount":1000}'
curl http://localhost:3001/orders/s1
```

Lesson 2. Order nhận tối đa 2 request `GET /products` cùng lúc, mỗi request giữ slot 200ms. Hàng đợi tối đa 20. k6 so sánh retry trong budget 3000ms:

```bash
bash tests/run.sh lesson_02_retry
```

Lesson 4. 100 request đồng thời. Đổi `MECHANISM` thành `conditional`, `optimistic`, hoặc `pessimistic`:

```bash
docker compose --profile load run --rm -e MECHANISM=conditional k6 run /scripts/lesson4.ts
```

Lesson 5. Thêm `crashPoint` vào payload outbox nếu bạn publish tay. Giá trị: `before_commit`, `split_writes`, `after_db_commit`, `after_offset`. Consumer có `restart: unless-stopped`, nên process chết sẽ được Compose dựng lại và message được giao lại khi offset chưa commit.

Lesson 6. `publishMode` là `outbox` hoặc `direct`.

Lesson 12:

```bash
curl -X POST http://localhost:3001/locks/acct-1/acquire -H 'content-type: application/json' -d '{"owner":"A"}'
curl -X POST http://localhost:3001/balances/acct-1/apply -H 'content-type: application/json' -d '{"token":1,"amount":10}'
curl -X POST http://localhost:3001/balances/acct-1/apply -H 'content-type: application/json' -d '{"token":1,"amount":10}'
```

Lần ghi token 1 thứ hai bị `409 stale_token`.

Lesson 14. Fraud chậm thì Payment chỉ giữ 2 slot. Timeout gọi Fraud mặc định là 500 ms, trừ khi request gửi `x-fraud-timeout-ms` lớn hơn. Circuit mở sau 3 lần timeout và half-open chỉ cho một probe. Đơn không qua được Fraud thì thành `PENDING_FRAUD_REVIEW`, không `CONFIRMED`.

```bash
curl -X POST http://localhost:3003/admin/delay -H 'content-type: application/json' -d '{"ms":2500}'
```

Dừng lab: `docker compose down`. Xóa dữ liệu Postgres: `docker compose down -v`.
