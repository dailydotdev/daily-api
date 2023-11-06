import { api, resources, metrics } from '@opentelemetry/sdk-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { MetricExporter } from '@google-cloud/opentelemetry-cloud-monitoring-exporter';

import { containerDetector } from '@opentelemetry/resource-detector-container';
import { gcpDetector } from '@opentelemetry/resource-detector-gcp';
import { GcpDetectorSync } from '@google-cloud/opentelemetry-resource-util';

import { isProd } from '../common';

export const startMetrics = (serviceName: string): void => {
  const metricReader = isProd
    ? new metrics.PeriodicExportingMetricReader({
        exportIntervalMillis: 10_000,
        exporter: new MetricExporter(),
      })
    : new PrometheusExporter({}, () => {
        const { endpoint, port } = PrometheusExporter.DEFAULT_OPTIONS;
        console.log(`metrics endpoint: http://localhost:${port}${endpoint}`);
      });

  const meterProvider = new metrics.MeterProvider({
    resource: new resources.Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    }).merge(
      resources.detectResourcesSync({
        detectors: [containerDetector, gcpDetector, new GcpDetectorSync()],
      }),
    ),
  });

  meterProvider.addMetricReader(metricReader);
  api.metrics.setGlobalMeterProvider(meterProvider);
};
