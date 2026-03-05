import { env } from 'node:process';
import { createClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import { Pipelines } from '@dailydotdev/schema';
import { GarmrService } from '../garmr';
import type { ServiceClient } from '../../types';
import { logger } from '../../logger';

const garmrBragiService = new GarmrService({
  service: 'bragi',
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.1,
    duration: 10 * 1000,
  },
  retryOpts: {
    maxAttempts: 3,
    backoff: 2 * 1000,
  },
});

const getBragiTransport = () =>
  env.BRAGI_ORIGIN
    ? createGrpcTransport({
        baseUrl: env.BRAGI_ORIGIN,
        httpVersion: '2',
      })
    : undefined;

let didLogBragiClientMode = false;

const logBragiClientMode = ({
  hasClientTransport,
}: {
  hasClientTransport: boolean;
}): void => {
  if (didLogBragiClientMode) {
    return;
  }
  didLogBragiClientMode = true;

  logger.info(
    {
      hasClientTransport,
      hasBragiOrigin: Boolean(env.BRAGI_ORIGIN),
      schemaHasOnboardingProfileTagsMethod: Boolean(
        Pipelines.methods.onboardingProfileTags,
      ),
      schemaOnboardingMethods: Object.keys(Pipelines.methods).filter((method) =>
        method.toLowerCase().includes('onboarding'),
      ),
    },
    '******** Bragi client initialized in remote mode ********',
  );
};

export const getBragiClient = (
  clientTransport = getBragiTransport(),
): ServiceClient<typeof Pipelines> => {
  if (!clientTransport) {
    throw new Error(
      'BRAGI_ORIGIN is not configured; cannot initialize Bragi client',
    );
  }

  logBragiClientMode({
    hasClientTransport: Boolean(clientTransport),
  });
  return {
    instance: createClient<typeof Pipelines>(Pipelines, clientTransport),
    garmr: garmrBragiService,
  };
};
