import { AbstractInjectLogger } from "../queues/kafka/inject-logger.abstract.ts";

export abstract class AbstractConnectable extends AbstractInjectLogger {
  protected connected!: boolean;
  private promise: Promise<void> | null = null;

  protected abstract connect(): Promise<void>;

  public async checkConnection(): Promise<void> {
    if (!this.promise) {
      this.promise = this.checkConnectionOnce();
    }
    return this.promise;
  }

  private async checkConnectionOnce(): Promise<void> {
    if (this.connected) {
      return;
    }

    await this.connect();
  }
}
