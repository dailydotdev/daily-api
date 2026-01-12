import { env } from 'node:process';
import { createClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import {
  FeedbackCategory,
  FeedbackPlatform,
  FeedbackSentiment,
  FeedbackUrgency,
  Pipelines,
} from '@dailydotdev/schema';
import { GarmrService, GarmrNoopService } from '../garmr';
import type { ServiceClient } from '../../types';
import { isMockEnabled } from '../../mocks/opportunity/services';

const garmrBragiService = new GarmrService({
  service: 'bragi',
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.1,
    duration: 10 * 1000,
  },
});

const transport = env.BRAGI_ORIGIN
  ? createGrpcTransport({
      baseUrl: env.BRAGI_ORIGIN,
      httpVersion: '2',
    })
  : undefined;

export const getBragiClient = (
  clientTransport = transport,
): ServiceClient<typeof Pipelines> => {
  if (isMockEnabled() || !clientTransport) {
    return {
      instance: {
        parseFeedback: async () => ({
          classification: {
            platform: FeedbackPlatform.RECRUITER,
            category: FeedbackCategory.FEATURE_REQUEST,
            sentiment: FeedbackSentiment.POSITIVE,
            urgency: FeedbackUrgency.LOW,
          },
        }),
      } as unknown as ReturnType<typeof createClient<typeof Pipelines>>,
      garmr: new GarmrNoopService(),
    };
  }

  return {
    instance: createClient<typeof Pipelines>(Pipelines, clientTransport),
    garmr: garmrBragiService,
  };
};
