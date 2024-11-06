import { AbstractInjectLogger } from "../queues/kafka/inject-logger.abstract.ts";

export abstract class AbstractProcessor<
  IdType,
  GetReturn,
  InputType,
  ResultReturn = void,
  DeleteArg = IdType,
  CreateArg = InputType,
  DeletedResult = void,
  CreatedResult = ResultReturn,
> extends AbstractInjectLogger {
  abstract get(id: IdType): Promise<GetReturn>;

  abstract toInput(input: GetReturn): InputType;

  abstract deleteFromDb(id: DeleteArg): Promise<DeletedResult>;

  abstract createInDb(input: CreateArg): Promise<CreatedResult>;

  abstract process(id: IdType): Promise<ResultReturn>;
}
