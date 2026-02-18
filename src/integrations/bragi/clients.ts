import { env } from 'node:process';
import { createClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import {
  ClassifyRejectionFeedbackResponse,
  ClassifyUserFeedbackResponse,
  FeedbackCategory,
  FeedbackClassification,
  FeedbackPlatform,
  FeedbackSentiment,
  FeedbackUrgency,
  FindCompanyNewsResponse,
  FindContactActivityResponse,
  FindJobVacanciesResponse,
  GenerateRecruiterEmailResponse,
  ParseFeedbackResponse,
  Pipelines,
  RejectionFeedbackClassification,
  RejectionReason,
  RejectionReasonDetail,
  UserFeedbackClassification,
  UserFeedbackSentiment,
  UserFeedbackTeam,
  UserFeedbackUrgency,
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
  retryOpts: {
    maxAttempts: 3,
    backoff: 2 * 1000,
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
        parseFeedback: async () =>
          new ParseFeedbackResponse({
            classification: new FeedbackClassification({
              platform: FeedbackPlatform.RECRUITER,
              category: FeedbackCategory.FEATURE_REQUEST,
              sentiment: FeedbackSentiment.POSITIVE,
              urgency: FeedbackUrgency.LOW,
            }),
          }),
        classifyUserFeedback: async () =>
          new ClassifyUserFeedbackResponse({
            id: 'mock-id',
            classification: new UserFeedbackClassification({
              sentiment: UserFeedbackSentiment.POSITIVE,
              urgency: UserFeedbackUrgency.LOW,
              tags: ['feedback'],
              summary: 'Mock feedback summary',
              hasPromptInjection: false,
              suggestedTeam: UserFeedbackTeam.PRODUCT,
            }),
          }),
        findJobVacancies: async () =>
          new FindJobVacanciesResponse({
            id: 'mock-id',
            vacancies: [],
          }),
        findCompanyNews: async () =>
          new FindCompanyNewsResponse({
            id: 'mock-id',
            newsItems: [],
          }),
        findContactActivity: async () =>
          new FindContactActivityResponse({
            id: 'mock-id',
            activities: [],
          }),
        generateRecruiterEmail: async () =>
          new GenerateRecruiterEmailResponse({
            id: 'mock-id',
            emailBody: '',
          }),
        classifyRejectionFeedback: async () =>
          new ClassifyRejectionFeedbackResponse({
            id: 'mock-id',
            classification: new RejectionFeedbackClassification({
              reasons: [
                new RejectionReasonDetail({
                  reason: RejectionReason.SALARY,
                  confidence: 0.9,
                  explanation: 'Mock rejection reason',
                  preference: {
                    case: 'freeTextPreference',
                    value: 'Too low',
                  },
                }),
              ],
              summary: 'Mock rejection summary',
            }),
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
