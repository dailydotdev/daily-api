import type { FastifyInstance } from 'fastify';
import { api, resources, metrics } from '@opentelemetry/sdk-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { MetricExporter } from '@google-cloud/opentelemetry-cloud-monitoring-exporter';

import { containerDetector } from '@opentelemetry/resource-detector-container';
import { gcpDetector } from '@opentelemetry/resource-detector-gcp';
import { GcpDetectorSync } from '@google-cloud/opentelemetry-resource-util';

import { isProd } from '../common';
import { logger } from '../logger';
import { channel, getAppVersion, TelemetrySemanticAttributes } from './common';

export const startMetrics = (serviceName: string): void => {
  const readers: metrics.MetricReader[] = [
    new PrometheusExporter({}, (err) => {
      if (err) {
        logger.error({ err }, `Failed to start metrics server`);
      }
    }),
  ];

  if (isProd) {
    readers.push(
      new metrics.PeriodicExportingMetricReader({
        exportIntervalMillis: 10_000,
        exporter: new MetricExporter(),
      }),
    );
  }

  const resource = new resources.Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
  }).merge(
    resources.detectResourcesSync({
      detectors: [containerDetector, gcpDetector, new GcpDetectorSync()],
    }),
  );

  const meterProvider = new metrics.MeterProvider({ resource, readers });
  api.metrics.setGlobalMeterProvider(meterProvider);

  channel.subscribe(({ fastify }: { fastify: FastifyInstance }) => {
    const meter = api.metrics.getMeter(serviceName);
    const requestCounter = meter.createCounter('requests', {
      description: 'How many requests have been processed',
    });

    fastify.decorate('meter', meter);
    fastify.decorateRequest('meter', null);

    fastify.addHook('onRequest', async (req) => {
      req.meter = meter;
    });

    // Decorate the main span with some metadata
    fastify.addHook('onResponse', async (req) => {
      if (req.routeOptions.url === '/graphql') {
        return;
      }

      requestCounter.add(1, {
        [TelemetrySemanticAttributes.HTTP_ROUTE]: req.routeOptions.url,
        [TelemetrySemanticAttributes.DAILY_APPS_VERSION]: getAppVersion(req),
      });
    });
  });
};
