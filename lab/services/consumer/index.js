import { existsSync, writeFileSync } from "node:fs";
import { pool, waitForPostgres } from "../shared/db.js";
import { createKafka, waitForKafka } from "../shared/kafka.js";
import { log } from "../shared/log.js";

process.env.SERVICE_NAME = "inventory-consumer";

const kafka = createKafka();
const consumer = kafka.consumer({ groupId: "inventory" });
const producer = kafka.producer();
const supportedSchema = new Set([1, 2]);

await waitForPostgres();
await waitForKafka(kafka);
await producer.connect();
await consumer.connect();
await consumer.subscribe({ topic: "order.created", fromBeginning: true });
log("consumer.started", { groupId: "inventory" });

await consumer.run({
  autoCommit: false,
  eachMessage: async ({ topic, partition, message }) => {
    const payload = JSON.parse(message.value.toString());
    const messageId = payload.eventId || payload.orderId;
    const crashPoint = crashOnceAlready(messageId) ? null : payload.crashPoint;
    log("consumer.polled", { messageId, offset: message.offset, crashPoint: crashPoint || null });

    if (!supportedSchema.has(payload.schemaVersion)) {
      await producer.send({
        topic: "order.dlq",
        messages: [{
          key: messageId,
          value: JSON.stringify({
            messageId,
            reason: "unsupported_schema",
            schemaVersion: payload.schemaVersion ?? null,
            originalTopic: topic,
            originalOffset: message.offset,
          }),
        }],
      });
      await commit(topic, partition, message.offset);
      log("consumer.dlq", { messageId, schemaVersion: payload.schemaVersion ?? null });
      return;
    }

    if (crashPoint === "before_commit") {
      crashOnce(messageId, crashPoint);
    }

    if (crashPoint === "split_writes") {
      await pool.query(
        "UPDATE inventory SET quantity = quantity - 1 WHERE product_id = $1 AND quantity >= 1",
        [payload.productId],
      );
      log("consumer.crash", { messageId, crashPoint, note: "inventory changed before processed_messages insert" });
      crashOnce(messageId, crashPoint);
    }

    const client = await pool.connect();
    let committed = false;
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        "INSERT INTO processed_messages (message_id, effect) VALUES ($1, 'reserved') ON CONFLICT DO NOTHING RETURNING message_id",
        [messageId],
      );
      if (inserted.rowCount === 1 && payload.productId) {
        const reserved = await client.query(
          "UPDATE inventory SET quantity = quantity - 1 WHERE product_id = $1 AND quantity >= 1 RETURNING quantity",
          [payload.productId],
        );
        if (reserved.rowCount === 0) {
          await client.query("ROLLBACK");
          await producer.send({
            topic: "order.dlq",
            messages: [{ key: messageId, value: JSON.stringify({ messageId, reason: "insufficient_inventory" }) }],
          });
          await commit(topic, partition, message.offset);
          log("consumer.dlq", { messageId, reason: "insufficient_inventory" });
          return;
        }
      }
      await client.query("COMMIT");
      committed = true;
      log("consumer.db_committed", { messageId, duplicate: inserted.rowCount === 0 });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    if (!committed) return;

    if (crashPoint === "after_db_commit") {
      crashOnce(messageId, crashPoint);
    }

    await commit(topic, partition, message.offset);
    log("consumer.offset_committed", { messageId, offset: message.offset });
    if (crashPoint === "after_offset") {
      crashOnce(messageId, crashPoint);
    }
  },
});

function commit(topic, partition, offset) {
  return consumer.commitOffsets([{ topic, partition, offset: (Number(offset) + 1).toString() }]);
}

function crashMark(messageId) {
  return `/tmp/crash-${messageId}`;
}

function crashOnceAlready(messageId) {
  return existsSync(crashMark(messageId));
}

function crashOnce(messageId, crashPoint) {
  writeFileSync(crashMark(messageId), crashPoint);
  log("consumer.crash", { messageId, crashPoint });
  process.exit(1);
}
