import { pool, waitForPostgres } from "../shared/db.js";
import { createKafka, waitForKafka } from "../shared/kafka.js";
import { log } from "../shared/log.js";

process.env.SERVICE_NAME = "outbox-relay";

const kafka = createKafka();
const producer = kafka.producer();
let crashAfterPublish = process.env.CRASH_AFTER_PUBLISH === "1";

await waitForPostgres();
await waitForKafka(kafka);
await producer.connect();
log("relay.started", { crashAfterPublish });

setInterval(async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const batch = await client.query(
      "SELECT id, event_id, topic, payload FROM outbox WHERE published_at IS NULL ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 10",
    );
    for (const row of batch.rows) {
      await producer.send({
        topic: row.topic,
        messages: [{ key: row.event_id, value: JSON.stringify({ ...row.payload, eventId: row.event_id }) }],
      });
      log("relay.published", { eventId: row.event_id });
      if (crashAfterPublish) {
        crashAfterPublish = false;
        log("relay.crash", { eventId: row.event_id, note: "published but not marked" });
        process.exit(1);
      }
      await client.query("UPDATE outbox SET published_at = now() WHERE id = $1", [row.id]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    log("relay.error", { error: error.message });
  } finally {
    client.release();
  }
}, 500);
