import { BalanceMessagePayload, topics } from "./index.ts";
import kafkaConnection from "./kafka.connection.ts";

export async function sendToBalanceTopic(transferHash: string) {
  return kafkaConnection.send(topics.BALANCE.name, [
    {
      value: JSON.stringify({
        transferHash,
      } as BalanceMessagePayload),
    },
  ]);
}
