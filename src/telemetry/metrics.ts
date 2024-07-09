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
import {
  channel,
  CounterOptions,
  getAppVersion,
  TelemetrySemanticAttributes,
} from './common';

const counterMap = {
  api: {
    forceRefresh: {
      name: 'force_refresh',
      description: 'How many times a feed force refresh has been triggered',
    },
    requests: {
      name: 'requests',
      description: 'How many requests have been processed',
    },
    graphqlOperations: {
      name: 'graphql_operations',
      description:
        'How many graphql operations have been performed, their operation type and name',
    },
    rateLimit: {
      name: 'rate_limit',
      description: 'How many times a rate limit has been hit',
    },
    generateTrackingId: {
      name: 'generate_tracking_id',
      description: 'How many times a tracking id was generated',
    },
    clearAuthentication: {
      name: 'clear_authentication',
      description: 'How many times the authentication has been cleared',
    },
    userIdConflict: {
      name: 'user_id_conflict',
      description: 'How many times a user id conflict happened on registration',
    },
    automations: {
      name: 'automations',
      description: 'How many automations were triggered',
    },
    sendgridEvents: {
      name: 'sendgrid_events',
      description: 'How many sendgrid events were to analytics',
    },
    cioEvents: {
      name: 'cio_events',
      description: 'How many customerio events were sent to analytics',
    },
  },
  background: {
    postError: {
      name: 'post_error',
      description: 'How many times a post error has occurred',
    },
    notificationFailed: {
      name: 'notification_failed',
      description:
        'Number of notifications failed to be sent via different channels',
    },
  },
  cron: {
    streakUpdate: {
      name: 'streak_update',
      description: 'How many streaks get updated',
    },
  },
};

export const counters: Partial<{
  [meterKey in keyof typeof counterMap]: Partial<{
    [counterKey in keyof (typeof counterMap)[meterKey]]?: api.Counter;
  }>;
}> = {};

export const startMetrics = (serviceName: string): void => {
  const readers: metrics.MetricReader[] = [];

  if (process.env.METRICS_ENABLED === 'true') {
    readers.push(
      new PrometheusExporter({}, (err) => {
        if (err) {
          logger.error({ err }, `Failed to start metrics server`);
        }
      }),
    );

    if (isProd) {
      readers.push(
        new metrics.PeriodicExportingMetricReader({
          exportIntervalMillis: 10_000,
          exporter: new MetricExporter(),
        }),
      );
    }
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

      counters?.api?.requests?.add(1, {
        [TelemetrySemanticAttributes.HTTP_ROUTE]: req.routeOptions.url,
        [TelemetrySemanticAttributes.DAILY_APPS_VERSION]: getAppVersion(req),
      });
    });
  });

  // We need to create and default all the counters to ensure that prometheus has scraped them
  // This is a known "limitation" of prometheus and distributed system like kubernetes
  if (counterMap[serviceName]) {
    const meter = api.metrics.getMeter(serviceName);
    if (!counters[serviceName]) {
      counters[serviceName] = {};
    }

    for (const [counterKey, counterOptions] of Object.entries<CounterOptions>(
      counterMap[serviceName],
    )) {
      const counter: api.Counter = meter.createCounter(
        counterOptions.name,
        counterOptions,
      );
      counters[serviceName][counterKey] = counter;
      counter.add(0);
    }
  }
};
