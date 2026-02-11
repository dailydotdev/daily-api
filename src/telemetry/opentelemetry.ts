import { env } from 'node:process';

import { NodeSDK, logs, api, resources } from '@opentelemetry/sdk-node';
import { GcpDetectorSync } from '@google-cloud/opentelemetry-resource-util';
import { containerDetector } from '@opentelemetry/resource-detector-container';
import { gcpDetector } from '@opentelemetry/resource-detector-gcp';
import closeWithGrace from 'close-with-grace';

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
import { logger } from '../logger';

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

export const startTelemetry = (): void => {
  if (!enableOpenTelemetry) {
    return;
  }

  const serviceName = env.OTEL_SERVICE_NAME;

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

  initCounters(serviceName as ServiceName);
  subscribeTracingHooks(serviceName);
  subscribeMetricsHooks(serviceName);

  closeWithGrace(async ({ signal, err }) => {
    if (err) {
      logger.error({ err, signal }, 'Tracing shutting down with error');
    } else {
      logger.info({ signal }, 'Tracing shutting down gracefully');
    }

    await sdk.shutdown();
  });
};

export { api as opentelemetry };
