import http from "http";
import client from "prom-client";

import { appLogger } from "./app.logger.ts";

const serviceLogger = appLogger.namespace("Prometheus");
export const prometheusRegistry = new client.Registry();

export const rpcRequestCounter = new client.Counter({
  name: "rpc_request_total",
  help: "Total rpc requests called",
  labelNames: ["rpc"],
});
export const rpcBlacklistCounter = new client.Counter({
  name: "rpc_blacklist_total",
  help: "Total rpc urls blacklisted",
  labelNames: ["rpc"],
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

export function setupPrometheus() {
  if (process.env.PROMETHEUS_ENABLED !== "true") {
    return;
  }
  const server = http.createServer(async (req, res) => {
    if (!req.url) {
      res.end();
      return;
    }

    const route = req.url;
    if (route === "/metrics") {
      res.setHeader("Content-Type", prometheusRegistry.contentType);
      res.end(await prometheusRegistry.metrics());
    }
  });

  const exporterPort = process.env.EXPORTER_PORT
    ? +process.env.EXPORTER_PORT
    : 4000;
  server.listen(exporterPort);
  serviceLogger.info(`✅  Server is running on port ${exporterPort}`);
}

export default client;
