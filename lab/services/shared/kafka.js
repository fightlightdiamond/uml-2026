import { Kafka } from "kafkajs";

export const TOPICS = ["order.created", "order.retry", "order.dlq"];

export function createKafka() {
  return new Kafka({
    clientId: process.env.SERVICE_NAME || "lab",
    brokers: [process.env.KAFKA_BROKER || "kafka:9092"],
    retry: { retries: Number(process.env.KAFKA_RETRIES ?? 8) },
  });
}

export async function ensureTopics(kafka) {
  const admin = kafka.admin();
  await admin.connect();
  await admin.createTopics({
    topics: TOPICS.map((topic) => ({ topic, numPartitions: 3, replicationFactor: 1 })),
    waitForLeaders: true,
  });
  await admin.disconnect();
}

export async function waitForKafka(kafka) {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      await ensureTopics(kafka);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error("kafka did not become ready");
}
