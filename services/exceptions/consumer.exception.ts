import { ServerException } from "./server.exception.ts";

class ConsumerException extends ServerException {
  protected payload: any;

  constructor(message: string, payload?: any) {
    super(message);

    this.payload = payload;
  }
}

export class PayloadNotFoundException extends ConsumerException {
  constructor(messageId: string) {
    super(`Payload not found. MessageId: ${messageId}`);
  }
}

export class InvalidPayloadException extends ConsumerException {
  constructor(messageId: string) {
    super(`Payload invalid. MessageId: ${messageId}`);
  }
}

// Throw to temporary stop the consuming job
// and keep retrying until transaction receipt got indexed into the db
export class KafkaReachedEndIndexedOffset extends ConsumerException {
  constructor(topic: string, consumerName: string, id: string) {
    super(
      `No indexed data found. Topic: ${topic} | Consumer: ${consumerName} | ID: ${id}`,
    );
  }
}
