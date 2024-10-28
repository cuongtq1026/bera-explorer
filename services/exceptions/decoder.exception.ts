import { ServerException } from "./server.exception.ts";

export class DecoderException extends ServerException {
  protected decoder: string;

  constructor(decoder: string, message: string) {
    super(message);

    this.decoder = decoder;
  }
}

export class InvalidSwapException extends DecoderException {
  constructor(decoder: string, message: string) {
    super(decoder, message);
  }
}

export class InvalidStepSwapException extends DecoderException {
  constructor(decoder: string, message: string) {
    super(decoder, message);
  }
}
