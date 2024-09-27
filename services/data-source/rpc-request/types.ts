import type { Client, Hash, PublicClient } from "viem";

export type RpcClient = {
  instance: PublicClient;
  url: string;
  key: string;
};
export type TraceTransactionReturnType<
  T extends TraceTransactionOption = TraceTransactionOption,
> = T["tracerConfig"] extends TracerConfigType
  ? T["tracerConfig"]["onlyTopCall"] extends true
    ? TraceCall<T["tracer"]> | undefined
    : TraceCall<T["tracer"]>
  : TraceCall<T["tracer"]>;
export type TraceTransactionFunction = <
  T extends TraceTransactionOption = TraceTransactionOption,
>(
  transactionHash: string,
  options: T,
) => Promise<TraceTransactionReturnType<T>>;

export type RpcDebugClient = {
  instance: Client & {
    traceTransaction: TraceTransactionFunction;
  };
  url: string;
  key: string;
};
export type TracerType = "callTracer" | "prestateTracer" | undefined;
export type TracerConfigType = {
  onlyTopCall?: boolean;
};
export type TraceTransactionOption = {
  tracer?: TracerType;
  timeout?: string;
  tracerConfig?: TracerConfigType;
};
export interface RawTraceCall {
  from: string;
  gas: string;
  gasUsed: string;
  to: string;
  input: string;
  value: string;
  type: string;
}
export interface PrestateTracer {
  [address: Hash]: {
    // balance in wei
    balance: Hash;
    // nonce
    nonce: number;
    // hex-encoded bytecode
    code: Hash;
    // storage slots of the contract
    storage: {
      [key: Hash]: Hash;
    };
  };
}
export type TraceCallNested = RawTraceCall & {
  calls: TraceCallNested[];
};
export type TraceCall<callTracer extends TracerType = undefined> =
  callTracer extends "callTracer"
    ? TraceCallNested
    : callTracer extends "prestateTracer"
      ? PrestateTracer
      : RawTraceCall;
