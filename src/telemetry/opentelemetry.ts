import { NodeSDK, logs, api, resources } from '@opentelemetry/sdk-node';
import { GcpDetectorSync } from '@google-cloud/opentelemetry-resource-util';
import { containerDetector } from '@opentelemetry/resource-detector-container';
import { gcpDetector } from '@opentelemetry/resource-detector-gcp';

import { enableOpenTelemetry } from './common';
import {
  type ServiceName,
  createMetricReader,
  initCounters,
  subscribeMetricsHooks,
} from './metrics';
import {
  createSpanProcessor,
  instrumentations,
  subscribeTracingHooks,
} from './tracing';

const resourceDetectors = [
  resources.envDetector,
  resources.hostDetector,
  resources.osDetector,
  resources.processDetector,
  containerDetector,
  gcpDetector,
  new GcpDetectorSync(),
];

api.diag.setLogger(new api.DiagConsoleLogger(), api.DiagLogLevel.INFO);

export const startTelemetry = (serviceName: ServiceName): void => {
  if (!enableOpenTelemetry) {
    return;
  }

  const spanProcessor = createSpanProcessor();
  const metricReader = createMetricReader();

  const sdk = new NodeSDK({
    serviceName,
    logRecordProcessors: [
      new logs.SimpleLogRecordProcessor(new logs.ConsoleLogRecordExporter()),
    ],
    spanProcessors: [spanProcessor],
    metricReaders: [metricReader],
    instrumentations,
    resourceDetectors,
  });

  sdk.start();

  initCounters(serviceName);
  subscribeTracingHooks(serviceName);
  subscribeMetricsHooks(serviceName);

  ['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.on(signal, () => sdk.shutdown().catch(console.error));
  });
};

export { api as opentelemetry };
