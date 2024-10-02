export interface InterfaceProcessor<
  IdType,
  GetReturn,
  InputType,
  ResultReturn = void,
  DeleteArg = IdType,
  CreateArg = InputType,
  DeletedResult = void,
  CreatedResult = void,
> {
  get(id: IdType): Promise<GetReturn>;
  toInput(input: GetReturn): InputType;
  deleteFromDb(id: DeleteArg): Promise<DeletedResult>;
  createInDb(input: CreateArg): Promise<CreatedResult>;

  process(id: IdType): Promise<ResultReturn>;
}
