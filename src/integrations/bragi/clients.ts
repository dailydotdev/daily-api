import { env } from 'node:process';
import { createClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import {
  ChatMessage,
  ChatResponse,
  LLMProxy,
  ClassifyGearResponse,
  ClassifyRejectionFeedbackResponse,
  ClassifyUserFeedbackResponse,
  EvaluateChannelHighlightsResponse,
  FeedbackCategory,
  FeedbackClassification,
  FeedbackPlatform,
  FeedbackSentiment,
  FeedbackUrgency,
  FindCompanyNewsResponse,
  FindContactActivityResponse,
  FindJobVacanciesResponse,
  GearCategory as ProtoGearCategory,
  GenerateRecruiterEmailResponse,
  ExtractedProfileTag,
  GitHubProfileTagsResponse,
  OnboardingProfileTagsResponse,
  ParseFeedbackResponse,
  Pipelines,
  SentimentDigestResponse,
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

const garmrBragiProxyService = new GarmrService({
  service: 'bragi-proxy',
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
        generateSentimentDigest: async () =>
          new SentimentDigestResponse({
            id: 'mock-id',
            title: 'Mock sentiment digest',
            content: 'Mock digest content',
          }),
        evaluateChannelHighlights: async () =>
          new EvaluateChannelHighlightsResponse({
            highlights: [],
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
        classifyGear: async ({ name }: { name: string }) =>
          new ClassifyGearResponse({
            id: 'mock-id',
            category: ProtoGearCategory.OTHER,
            normalizedName: name,
          }),
        gitHubProfileTags: async () =>
          new GitHubProfileTagsResponse({
            id: 'mock-id',
            extractedTags: [
              new ExtractedProfileTag({ name: 'javascript', confidence: 0.95 }),
              new ExtractedProfileTag({ name: 'php', confidence: 0.88 }),
              new ExtractedProfileTag({ name: 'typescript', confidence: 0.85 }),
              new ExtractedProfileTag({ name: 'webdev', confidence: 0.82 }),
              new ExtractedProfileTag({ name: 'go', confidence: 0.75 }),
              new ExtractedProfileTag({ name: 'git', confidence: 0.7 }),
            ],
          }),
        onboardingProfileTags: async () =>
          new OnboardingProfileTagsResponse({
            id: 'mock-id',
            extractedTags: [
              new ExtractedProfileTag({ name: 'javascript', confidence: 0.92 }),
              new ExtractedProfileTag({ name: 'php', confidence: 0.87 }),
              new ExtractedProfileTag({ name: 'typescript', confidence: 0.84 }),
              new ExtractedProfileTag({ name: 'webdev', confidence: 0.8 }),
              new ExtractedProfileTag({ name: 'go', confidence: 0.73 }),
              new ExtractedProfileTag({ name: 'ai', confidence: 0.7 }),
            ],
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

type BragiProxyClient = {
  instance: ReturnType<typeof createClient<typeof LLMProxy>>;
  garmr: GarmrService | GarmrNoopService;
};

export const getBragiProxyClient = (
  clientTransport = transport,
): BragiProxyClient => {
  if (isMockEnabled() || !clientTransport) {
    return {
      instance: {
        chat: async () =>
          new ChatResponse({
            id: 'mock-id',
            message: new ChatMessage({
              role: 'assistant',
              content: 'Mock tweet content',
            }),
          }),
      } as unknown as ReturnType<typeof createClient<typeof LLMProxy>>,
      garmr: new GarmrNoopService(),
    };
  }

  return {
    instance: createClient<typeof LLMProxy>(LLMProxy, clientTransport),
    garmr: garmrBragiProxyService,
  };
};
