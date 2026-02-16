import { env } from 'node:process';

import closeWithGrace from 'close-with-grace';
import * as api from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  CompositePropagator,
  W3CTraceContextPropagator,
  W3CBaggagePropagator,
} from '@opentelemetry/core';
import {
  detectResources,
  envDetector,
  hostDetector,
  osDetector,
  processDetector,
  resourceFromAttributes,
} from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { MeterProvider } from '@opentelemetry/sdk-metrics';

import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { containerDetector } from '@opentelemetry/resource-detector-container';

import { enableOpenTelemetry } from './common';
import { instrumentations } from './register';
import {
  type ServiceName,
  createMetricReader,
  initCounters,
  subscribeMetricsHooks,
} from './metrics';
import { createSpanProcessor, subscribeTracingHooks } from './tracing';
import { logger } from '../logger';

const resourceDetectors = [
  envDetector,
  hostDetector,
  osDetector,
  processDetector,
  containerDetector,
];

export const startTelemetry = (): void => {
  if (!enableOpenTelemetry) {
    return;
  }

  const service = {
    name: env.OTEL_SERVICE_NAME,
    version: env.OTEL_SERVICE_VERSION,
  };

  // Detect resources and merge with service name
  const detectedResource = detectResources({ detectors: resourceDetectors });
  const resource = detectedResource.merge(
    resourceFromAttributes({
      [ATTR_SERVICE_NAME]: service.name,
      [ATTR_SERVICE_VERSION]: service.version,
    }),
  );

  // Context manager for async trace propagation
  const contextManager = new AsyncLocalStorageContextManager();
  contextManager.enable();
  api.context.setGlobalContextManager(contextManager);

  // W3C trace context + baggage propagation
  api.propagation.setGlobalPropagator(
    new CompositePropagator({
      propagators: [
        new W3CTraceContextPropagator(),
        new W3CBaggagePropagator(),
      ],
    }),
  );

  // Tracing
  const tracerProvider = new NodeTracerProvider({
    resource,
    spanProcessors: [createSpanProcessor()],
  });
  api.trace.setGlobalTracerProvider(tracerProvider);

  // Metrics
  const meterProvider = new MeterProvider({
    resource,
    readers: [createMetricReader()],
  });
  api.metrics.setGlobalMeterProvider(meterProvider);

  // Register instrumentations
  registerInstrumentations({ instrumentations });

  initCounters(service.name as ServiceName);
  subscribeTracingHooks(service.name);
  subscribeMetricsHooks(service.name);

  closeWithGrace(async ({ signal, err }) => {
    if (err) {
      logger.error({ err, signal }, 'Telemetry shutting down with error');
    } else {
      logger.info({ signal }, 'Telemetry shutting down gracefully');
    }

    await Promise.all([tracerProvider.shutdown(), meterProvider.shutdown()]);
  });
};
