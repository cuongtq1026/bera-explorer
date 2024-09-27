import type { Client } from "viem";

import type { TraceTransactionFunction } from "./types.ts";

export function extendDebugClient(client: Client): {
  traceTransaction: TraceTransactionFunction;
} {
  return {
    async traceTransaction(
      transactionHash: string,
      options?: {
        tracer?: "callTracer" | "prestateTracer";
        timeout?: string;
        tracerConfig?: {
          onlyTopCall?: boolean;
        };
      },
    ) {
      return client.request({
        // @ts-expect-error
        method: "debug_traceTransaction",
        // @ts-expect-error
        params: [transactionHash, options],
      });
    },
  };
}
