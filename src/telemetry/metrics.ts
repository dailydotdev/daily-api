import type { FastifyInstance } from 'fastify';

import dc from 'node:diagnostics_channel';

import { metrics, type Counter, ValueType } from '@opentelemetry/api';
import {
  PeriodicExportingMetricReader,
  type IMetricReader,
} from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_HTTP_ROUTE,
  METRIC_HTTP_SERVER_REQUEST_DURATION,
} from '@opentelemetry/semantic-conventions';

import { logger } from '../logger';
import {
  type AppVersionRequest,
  type CounterOptions,
  channelName,
  getAppVersion,
  SEMATTRS_DAILY_APPS_VERSION,
} from './common';

const counterMap = {
  api: {
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
    vordr: {
      name: 'vordr',
      description:
        'How many posts or comments were prevented from being posted',
    },
    deletedUserCollision: {
      name: 'deleted_user_collision',
      description: 'How many times a deleted user collision happened',
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
    cdcTrigger: {
      name: 'cdc_trigger',
      description: 'How many times the cdc trigger was called',
    },
    postSentSlack: {
      name: 'post_sent_slack',
      description: 'How many posts were sent to slack workspaces',
    },
    notificationUserPostAdded: {
      name: 'notification_user_post_added',
      description: 'How many user post added notifications were sent',
    },
  },
  cron: {
    streakUpdate: {
      name: 'streak_update',
      description: 'How many streaks get updated',
    },
  },
  'personalized-digest': {
    garmrBreak: {
      name: 'garmr_break',
      description: 'How many times breaker has been triggered',
    },
    garmrHalfOpen: {
      name: 'garm_half_open',
      description: 'How many times breaker has been half opened',
    },
    garmrReset: {
      name: 'garmr_reset',
      description: 'How many times breaker has been reset',
    },
    garmrRetry: {
      name: 'garmr_retry',
      description: 'How many times a request has been retried',
    },
  },
  temporal: {},
};

export type ServiceName = keyof typeof counterMap;

export const counters: Partial<{
  [meterKey in keyof typeof counterMap]: Partial<{
    [counterKey in keyof (typeof counterMap)[meterKey]]?: Counter;
  }>;
}> = {};

export const createMetricReader = (): IMetricReader => {
  const exporterType = process.env.OTEL_METRICS_EXPORTER ?? 'otlp';

  if (exporterType === 'prometheus') {
    logger.info('Using Prometheus metrics exporter on port 9464');
    return new PrometheusExporter({ port: 9464 });
  }

  logger.info('Using OTLP metrics exporter');
  return new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    }),
  });
};

export const initCounters = (serviceName: ServiceName): void => {
  const currentCounter = counterMap[serviceName];

  if (currentCounter) {
    const meter = metrics.getMeter(serviceName);
    if (!counters[serviceName]) {
      counters[serviceName] = {};
    }

    for (const [counterKey, counterOptions] of Object.entries<CounterOptions>(
      currentCounter,
    )) {
      const counter: Counter = meter.createCounter(
        counterOptions.name,
        counterOptions,
      );
      // @ts-expect-error - property keys are statically defined above
      counters[serviceName][counterKey] = counter;

      if (process.env.OTEL_METRICS_EXPORTER === 'prometheus') {
        counter.add(0);
      }
    }
  }
};

const requestDurationIncludePaths = ['/boot'];

export const subscribeMetricsHooks = (serviceName: string): void => {
  const requestDuration = metrics
    .getMeter(serviceName)
    .createHistogram(METRIC_HTTP_SERVER_REQUEST_DURATION, {
      description: 'The duration of HTTP request',
      unit: 'ms',
      valueType: ValueType.DOUBLE,
      advice: {
        explicitBucketBoundaries: [
          10, 50, 75, 100, 150, 200, 400, 600, 800, 1000, 2000, 4000, 6000,
        ],
      },
    });

  dc.subscribe(channelName, (message) => {
    const { fastify } = message as { fastify: FastifyInstance };
    fastify.addHook('onResponse', async (req, res) => {
      if (req.routeOptions.url === '/graphql') {
        return;
      }

      counters?.api?.requests?.add(1, {
        [ATTR_HTTP_ROUTE]: req.routeOptions.url,
        [SEMATTRS_DAILY_APPS_VERSION]: getAppVersion(req as AppVersionRequest),
      });

      if (
        requestDurationIncludePaths.includes(req.routeOptions.url as string)
      ) {
        requestDuration.record(res.elapsedTime, {
          [ATTR_HTTP_REQUEST_METHOD]: req.method,
          [ATTR_HTTP_RESPONSE_STATUS_CODE]: res.statusCode,
          [ATTR_HTTP_ROUTE]: req.routeOptions.url,
        });
      }
    });
  });
};
