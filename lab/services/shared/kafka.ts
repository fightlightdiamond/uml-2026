import { Kafka } from "kafkajs";
import { pause } from "./parse.js";

export const TOPICS = ["order.created", "order.retry", "order.dlq"] as const;

export type KafkaClient = InstanceType<typeof Kafka>;

export function createKafka(): KafkaClient {
  return new Kafka({
    clientId: process.env.SERVICE_NAME || "lab",
    brokers: [process.env.KAFKA_BROKER || "kafka:9092"],
    retry: { retries: Number(process.env.KAFKA_RETRIES ?? 8) },
  });
}

export async function ensureTopics(kafka: KafkaClient): Promise<void> {
  const admin = kafka.admin();
  await admin.connect();
  await admin.createTopics({
    topics: TOPICS.map((topic) => ({ topic, numPartitions: 3, replicationFactor: 1 })),
    waitForLeaders: true,
  });
  await admin.disconnect();
}

export async function waitForKafka(kafka: KafkaClient): Promise<void> {
  for (let remaining = 30; remaining > 0; remaining -= 1) {
    try {
      await ensureTopics(kafka);
      return;
    } catch {
      await pause(1000);
    }
  }
  throw new Error("kafka did not become ready");
}
