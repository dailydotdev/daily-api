import dc from 'node:diagnostics_channel';
import type { FastifyInstance } from 'fastify';
import { api, resources, metrics } from '@opentelemetry/sdk-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import {
  ATTR_HTTP_ROUTE,
  ATTR_SERVICE_NAME,
} from '@opentelemetry/semantic-conventions';

import { containerDetector } from '@opentelemetry/resource-detector-container';
import { gcpDetector } from '@opentelemetry/resource-detector-gcp';
import { GcpDetectorSync } from '@google-cloud/opentelemetry-resource-util';

import { logger } from '../logger';
import {
  channelName,
  CounterOptions,
  getAppVersion,
  SEMATTRS_DAILY_APPS_VERSION,
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
    vordr: {
      name: 'vordr',
      description:
        'How many posts or comments were prevented from being posted',
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
};

export const counters: Partial<{
  [meterKey in keyof typeof counterMap]: Partial<{
    [counterKey in keyof (typeof counterMap)[meterKey]]?: api.Counter;
  }>;
}> = {};

export const startMetrics = (serviceName: string): void => {
  if (process.env.METRICS_ENABLED !== 'true') {
    return;
  }

  const readers: metrics.MetricReader[] = [
    new PrometheusExporter({}, (err) => {
      if (err) {
        logger.error({ err }, `Failed to start metrics server`);
      }
    }),
  ];

  const resource = new resources.Resource({
    [ATTR_SERVICE_NAME]: serviceName,
  }).merge(
    resources.detectResourcesSync({
      detectors: [containerDetector, gcpDetector, new GcpDetectorSync()],
    }),
  );

  const meterProvider = new metrics.MeterProvider({ resource, readers });
  api.metrics.setGlobalMeterProvider(meterProvider);

  dc.subscribe(channelName, ({ fastify }: { fastify: FastifyInstance }) => {
    // Decorate the main span with some metadata
    fastify.addHook('onResponse', async (req) => {
      if (req.routeOptions.url === '/graphql') {
        return;
      }

      counters?.api?.requests?.add(1, {
        [ATTR_HTTP_ROUTE]: req.routeOptions.url,
        [SEMATTRS_DAILY_APPS_VERSION]: getAppVersion(req),
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
