import { ServerException } from "./server.exception.ts";

class ProcessorException extends ServerException {
  protected payload: any;

  constructor(message: string, payload?: any) {
    super(message);

    this.payload = payload;
  }
}

export class NoGetResult extends ProcessorException {
  constructor(id: string) {
    super(`No get result. ID: ${id}`);
  }
}
