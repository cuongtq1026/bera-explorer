import type { EachMessagePayload } from "kafkajs";

export function getKafkaMessageId(
  eachMessagePayload: EachMessagePayload,
  consumerName: string,
) {
  return `${consumerName}-${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;
}
