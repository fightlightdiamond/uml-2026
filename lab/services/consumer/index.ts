import { existsSync, writeFileSync } from "node:fs";
import type { EachMessagePayload } from "kafkajs";
import { pool, waitForPostgres } from "../shared/db.js";
import { createKafka, waitForKafka } from "../shared/kafka.js";
import { log } from "../shared/log.js";
import { asInteger, asString, isRecord, oneOf } from "../shared/parse.js";

process.env.SERVICE_NAME = "inventory-consumer";

const CRASH_POINTS = ["before_commit", "split_writes", "after_db_commit", "after_offset"] as const;
type CrashPoint = (typeof CRASH_POINTS)[number];

interface OrderMessage {
  messageId: string;
  productId: string | undefined;
  schemaVersion: number | undefined;
  crashPoint: CrashPoint | undefined;
}

const kafka = createKafka();
const consumer = kafka.consumer({ groupId: "inventory" });
const producer = kafka.producer();

await waitForPostgres();
await waitForKafka(kafka);
await producer.connect();
await consumer.connect();
await consumer.subscribe({ topic: "order.created", fromBeginning: true });
log("consumer.started", { groupId: "inventory" });

await consumer.run({
  autoCommit: false,
  eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
    const payload = parseOrderMessage(message.value?.toString(), message.offset);
    const messageId = payload.messageId;
    const crashPoint = crashOnceAlready(messageId) ? undefined : payload.crashPoint;
    log("consumer.polled", { messageId, offset: message.offset, crashPoint: crashPoint ?? null });

    if (!isSupportedSchema(payload.schemaVersion)) {
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

function parseOrderMessage(raw: string | undefined, fallbackId: string): OrderMessage {
  let value: unknown;
  try {
    value = raw === undefined ? undefined : JSON.parse(raw);
  } catch {
    value = undefined;
  }
  if (!isRecord(value)) {
    return { messageId: fallbackId, productId: undefined, schemaVersion: undefined, crashPoint: undefined };
  }
  return {
    messageId: asString(value.eventId) ?? asString(value.orderId) ?? fallbackId,
    productId: asString(value.productId),
    schemaVersion: asInteger(value.schemaVersion),
    crashPoint: oneOf(value.crashPoint, CRASH_POINTS),
  };
}

function isSupportedSchema(schemaVersion: number | undefined): schemaVersion is 1 | 2 {
  return schemaVersion === 1 || schemaVersion === 2;
}

function commit(topic: string, partition: number, offset: string): Promise<void> {
  return consumer.commitOffsets([{ topic, partition, offset: (Number(offset) + 1).toString() }]);
}

function crashMark(messageId: string): string {
  return `/tmp/crash-${messageId}`;
}

function crashOnceAlready(messageId: string): boolean {
  return existsSync(crashMark(messageId));
}

function crashOnce(messageId: string, crashPoint: string): never {
  writeFileSync(crashMark(messageId), crashPoint);
  log("consumer.crash", { messageId, crashPoint });
  process.exit(1);
}
