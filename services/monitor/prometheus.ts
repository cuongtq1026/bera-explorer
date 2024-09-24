import client from "prom-client";

export const prometheusRegistry = new client.Registry();

export const rpcRequestCounter = new client.Counter({
  name: "rpc_request_total",
  help: "Total rpc requests called",
  labelNames: ["url"],
});
export const rpcBlacklistCounter = new client.Counter({
  name: "rpc_blacklist_total",
  help: "Total rpc urls blacklisted",
  labelNames: ["url"],
});
export const queueMessageProcessedCounter = new client.Counter({
  name: "queue_message_processed_total",
  help: "Total queue message successfully processed",
  labelNames: ["routingKey"],
});

prometheusRegistry.registerMetric(rpcRequestCounter);
prometheusRegistry.registerMetric(rpcBlacklistCounter);
prometheusRegistry.registerMetric(queueMessageProcessedCounter);
client.collectDefaultMetrics({ register: prometheusRegistry });

export default client;
