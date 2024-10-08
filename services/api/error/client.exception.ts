import { StatusCodes } from "http-status-codes";

export class ClientError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class ItemNotFoundException extends ClientError {
  constructor(message: string) {
    super(message, StatusCodes.NOT_FOUND);
  }
}

export class BadRequestException extends ClientError {
  constructor(message: string) {
    super(message, StatusCodes.BAD_REQUEST);
  }
}
