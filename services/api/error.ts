import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import logger from "../monitor/logger.ts";
import { ClientError } from "./error/client.exception.ts";

export function logErrors(
  err: Error,
  _req: Request,
  _res: Response,
  next: NextFunction,
) {
  logger.error("[API]: " + err.stack);
  next(err);
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (err instanceof ClientError) {
    res.status(err.statusCode).send(err.message);
    next();
    return;
  }

  res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("INTERNAL_SERVER_ERROR");
  next(err);
}
