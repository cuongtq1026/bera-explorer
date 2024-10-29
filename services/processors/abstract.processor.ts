import { AppLogger } from "../monitor/app.logger.ts";

export abstract class AbstractProcessor<
  IdType,
  GetReturn,
  InputType,
  ResultReturn = void,
  DeleteArg = IdType,
  CreateArg = InputType,
  DeletedResult = void,
  CreatedResult = ResultReturn,
> {
  protected readonly serviceLogger: AppLogger;

  protected constructor(options: { logger: AppLogger }) {
    this.serviceLogger = options.logger;
  }

  abstract get(id: IdType): Promise<GetReturn>;
  abstract toInput(input: GetReturn): InputType;
  abstract deleteFromDb(id: DeleteArg): Promise<DeletedResult>;
  abstract createInDb(input: CreateArg): Promise<CreatedResult>;

  abstract process(id: IdType): Promise<ResultReturn>;
}
