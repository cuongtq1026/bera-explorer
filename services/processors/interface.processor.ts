export interface InterfaceProcessor<
  IdType,
  GetReturn,
  InputType,
  ResultReturn,
> {
  get(id: IdType): Promise<GetReturn>;
  toInput(input: GetReturn): InputType | null;
  deleteFromDb(id: IdType): Promise<void>;
  createInDb(input: InputType): Promise<void>;

  process(id: IdType): Promise<ResultReturn>;
}
