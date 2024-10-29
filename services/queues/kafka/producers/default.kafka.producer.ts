import { topics } from "../index.ts";
import kafkaConnection, {
  type TransactionOptions,
} from "../kafka.connection.ts";

export async function sendKafkaMessageByTopic<T extends keyof typeof topics>(
  topic: T,
  messages: Awaited<ReturnType<typeof kafkaConnection.decode<T>>>[],
  options?: TransactionOptions,
): Promise<void> {
  return kafkaConnection.send(
    topics[topic].name,
    await Promise.all(
      messages.map(async (message) => ({
        value: await kafkaConnection.encode(topic, message),
      })),
    ),
    options,
  );
}
