import type { Client, PublicClient } from "viem";

export type RpcClient = {
  instance: PublicClient;
  url: string;
  key: string;
};
export type TraceTransactionFunction = <
  T extends TraceTransactionOption = TraceTransactionOption,
>(
  transactionHash: string,
  options: T,
) => Promise<TraceCall<T["tracer"]>>;
export type RpcDebugClient = {
  instance: Client & {
    traceTransaction: TraceTransactionFunction;
  };
  url: string;
  key: string;
};
export type TracerType = "callTracer" | "prestateTracer" | undefined;
export type TraceTransactionOption = {
  tracer?: TracerType;
  timeout?: string;
  tracerConfig?: {
    onlyTopCall?: boolean;
  };
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
export type TraceCallNested = RawTraceCall & {
  calls: RawTraceCall[];
};
export type TraceCall<callTracer extends TracerType = undefined> =
  callTracer extends "callTracer" ? TraceCallNested : RawTraceCall;
