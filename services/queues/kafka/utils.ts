import { KafkaJS } from "@confluentinc/kafka-javascript";

export function getKafkaMessageId(
  eachMessagePayload: KafkaJS.EachMessagePayload,
  consumerName: string,
) {
  return `${consumerName}-${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;
}
