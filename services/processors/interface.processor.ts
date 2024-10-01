export interface InterfaceProcessor<
  IdType,
  GetReturn,
  InputType,
  ResultReturn = void,
  DeletedResult = void,
  CreatedResult = void,
> {
  get(id: IdType): Promise<GetReturn>;
  toInput(input: GetReturn): InputType | null;
  deleteFromDb(id: IdType): Promise<DeletedResult>;
  createInDb(input: InputType): Promise<CreatedResult>;

  process(id: IdType): Promise<ResultReturn>;
}
