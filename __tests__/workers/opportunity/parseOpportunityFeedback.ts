import { expectSuccessfulTypedBackground, saveFixtures } from '../../helpers';
import { parseOpportunityFeedbackWorker as worker } from '../../../src/workers/opportunity/parseOpportunityFeedback';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { OpportunityMatch } from '../../../src/entity/OpportunityMatch';
import { User } from '../../../src/entity';
import { usersFixture } from '../../fixture';
import { OpportunityMatchStatus } from '../../../src/entity/opportunities/types';
import {
  FeedbackCategory,
  FeedbackPlatform,
  FeedbackSentiment,
  FeedbackUrgency,
  OpportunityState,
  OpportunityType,
} from '@dailydotdev/schema';

const mockParseFeedback = jest.fn();
const mockClassifyRejectionFeedback = jest.fn();

jest.mock('../../../src/integrations/bragi', () => ({
  getBragiClient: () => ({
    garmr: {
      execute: (fn: () => Promise<unknown>) => fn(),
    },
    instance: {
      parseFeedback: (...args: unknown[]) => mockParseFeedback(...args),
      classifyRejectionFeedback: (...args: unknown[]) =>
        mockClassifyRejectionFeedback(...args),
    },
  }),
}));

let con: DataSource;
const testOpportunityId = '550e8400-e29b-41d4-a716-446655440099';

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, User, usersFixture);

  // Create a minimal opportunity record
  await con.query(
    `INSERT INTO opportunity (id, type, state, title, tldr, content, meta)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    [
      testOpportunityId,
      OpportunityType.JOB,
      OpportunityState.LIVE,
      'Test Opportunity',
      'Test TLDR',
      JSON.stringify({}),
      JSON.stringify({}),
    ],
  );
});

afterEach(async () => {
  await con
    .getRepository(OpportunityMatch)
    .delete({ opportunityId: testOpportunityId });
});

afterAll(async () => {
  await con.query('DELETE FROM opportunity WHERE id = $1', [testOpportunityId]);
});

describe('parseOpportunityFeedback worker', () => {
  it('should skip when no match is found', async () => {
    await expectSuccessfulTypedBackground<'api.v1.opportunity-feedback-submitted'>(
      worker,
      {
        opportunityId: testOpportunityId,
        userId: 'nonexistent-user',
      },
    );

    expect(mockParseFeedback).not.toHaveBeenCalled();
  });

  it('should skip when match has no feedback', async () => {
    await con.getRepository(OpportunityMatch).save({
      opportunityId: testOpportunityId,
      userId: '1',
      status: OpportunityMatchStatus.Pending,
      description: { reasoning: 'Test match' },
      feedback: [],
    });

    await expectSuccessfulTypedBackground<'api.v1.opportunity-feedback-submitted'>(
      worker,
      {
        opportunityId: testOpportunityId,
        userId: '1',
      },
    );

    expect(mockParseFeedback).not.toHaveBeenCalled();
  });

  it('should parse feedback and store classification in database', async () => {
    await con.getRepository(OpportunityMatch).save({
      opportunityId: testOpportunityId,
      userId: '2',
      status: OpportunityMatchStatus.Pending,
      description: { reasoning: 'Test match' },
      feedback: [{ question: 'How was it?', answer: 'Great experience!' }],
    });

    mockParseFeedback.mockResolvedValue({
      classification: {
        platform: FeedbackPlatform.RECRUITER,
        category: FeedbackCategory.FEATURE_REQUEST,
        sentiment: FeedbackSentiment.POSITIVE,
        urgency: FeedbackUrgency.LOW,
      },
    });

    await expectSuccessfulTypedBackground<'api.v1.opportunity-feedback-submitted'>(
      worker,
      {
        opportunityId: testOpportunityId,
        userId: '2',
      },
    );

    expect(mockParseFeedback).toHaveBeenCalledWith({
      feedback: 'Great experience!',
    });

    // Verify the classification was stored correctly in the database
    const updatedMatch = await con.getRepository(OpportunityMatch).findOne({
      where: {
        opportunityId: testOpportunityId,
        userId: '2',
      },
    });

    expect(updatedMatch?.feedback?.[0]?.classification).toEqual({
      platform: FeedbackPlatform.RECRUITER,
      category: FeedbackCategory.FEATURE_REQUEST,
      sentiment: FeedbackSentiment.POSITIVE,
      urgency: FeedbackUrgency.LOW,
    });
  });

  it('should call classifyRejectionFeedback with combined Q&A and store result', async () => {
    await con.getRepository(OpportunityMatch).save({
      opportunityId: testOpportunityId,
      userId: '1',
      status: OpportunityMatchStatus.Pending,
      description: { reasoning: 'Test match' },
      feedback: [
        { screening: 'Why decline?', answer: 'Salary too low' },
        { screening: 'Anything else?', answer: 'Location is bad' },
      ],
    });

    mockParseFeedback.mockResolvedValue({
      classification: {
        platform: FeedbackPlatform.RECRUITER,
        category: FeedbackCategory.FEATURE_REQUEST,
        sentiment: FeedbackSentiment.NEGATIVE,
        urgency: FeedbackUrgency.MEDIUM,
      },
    });

    mockClassifyRejectionFeedback.mockResolvedValue({
      id: 'test-id',
      classification: {
        reasons: [
          {
            reason: 3,
            confidence: 0.95,
            explanation: 'Salary expectations not met',
            preference: { case: 'freeTextPreference', value: 'Too low' },
          },
          {
            reason: 1,
            confidence: 0.7,
            explanation: 'Location mismatch',
          },
        ],
        summary: 'Candidate declined due to salary and location',
      },
    });

    await expectSuccessfulTypedBackground<'api.v1.opportunity-feedback-submitted'>(
      worker,
      {
        opportunityId: testOpportunityId,
        userId: '1',
      },
    );

    expect(mockClassifyRejectionFeedback).toHaveBeenCalledWith({
      feedback:
        'Q: Why decline?\nA: Salary too low\n\nQ: Anything else?\nA: Location is bad',
      jobContext: 'Test Opportunity\nTest TLDR',
    });

    const updatedMatch = await con.getRepository(OpportunityMatch).findOne({
      where: { opportunityId: testOpportunityId, userId: '1' },
    });

    expect(updatedMatch?.rejectionClassification).toEqual({
      reasons: [
        {
          reason: 3,
          confidence: 0.95,
          explanation: 'Salary expectations not met',
          freeTextPreference: 'Too low',
        },
        {
          reason: 1,
          confidence: 0.7,
          explanation: 'Location mismatch',
        },
      ],
      summary: 'Candidate declined due to salary and location',
    });
  });

  it('should classify feedback for candidate rejected matches from submitted events', async () => {
    await con.getRepository(OpportunityMatch).save({
      opportunityId: testOpportunityId,
      userId: '1',
      status: OpportunityMatchStatus.CandidateRejected,
      description: { reasoning: 'Test match' },
      feedback: [{ screening: 'Why decline?', answer: 'Offer too low' }],
    });

    mockParseFeedback.mockResolvedValue({
      classification: {
        platform: FeedbackPlatform.RECRUITER,
        category: FeedbackCategory.FEATURE_REQUEST,
        sentiment: FeedbackSentiment.NEGATIVE,
        urgency: FeedbackUrgency.MEDIUM,
      },
    });

    mockClassifyRejectionFeedback.mockResolvedValue({
      id: 'test-id',
      classification: {
        reasons: [
          {
            reason: 3,
            confidence: 0.95,
            explanation: 'Salary expectations not met',
            preference: { case: 'freeTextPreference', value: 'Offer too low' },
          },
        ],
        summary: 'Candidate declined due to compensation',
      },
    });

    await expectSuccessfulTypedBackground<'api.v1.opportunity-feedback-submitted'>(
      worker,
      {
        opportunityId: testOpportunityId,
        userId: '1',
      },
    );

    expect(mockClassifyRejectionFeedback).toHaveBeenCalled();

    const updatedMatch = await con.getRepository(OpportunityMatch).findOne({
      where: { opportunityId: testOpportunityId, userId: '1' },
    });

    expect(updatedMatch?.rejectionClassification).toMatchObject({
      summary: 'Candidate declined due to compensation',
    });
  });

  it('should skip classifyRejectionFeedback when already classified', async () => {
    await con.getRepository(OpportunityMatch).save({
      opportunityId: testOpportunityId,
      userId: '1',
      status: OpportunityMatchStatus.Pending,
      description: { reasoning: 'Test match' },
      feedback: [{ screening: 'Why?', answer: 'Not interested' }],
      rejectionClassification: {
        reasons: [{ reason: 10, confidence: 0.8, explanation: 'Other' }],
        summary: 'Already classified',
      },
    });

    mockParseFeedback.mockResolvedValue({
      classification: {
        platform: FeedbackPlatform.RECRUITER,
        category: FeedbackCategory.FEATURE_REQUEST,
        sentiment: FeedbackSentiment.NEGATIVE,
        urgency: FeedbackUrgency.LOW,
      },
    });

    await expectSuccessfulTypedBackground<'api.v1.opportunity-feedback-submitted'>(
      worker,
      {
        opportunityId: testOpportunityId,
        userId: '1',
      },
    );

    expect(mockClassifyRejectionFeedback).not.toHaveBeenCalled();
  });

  it('should handle ConnectError from classifyRejectionFeedback gracefully', async () => {
    await con.getRepository(OpportunityMatch).save({
      opportunityId: testOpportunityId,
      userId: '1',
      status: OpportunityMatchStatus.Pending,
      description: { reasoning: 'Test match' },
      feedback: [{ screening: 'Why?', answer: 'Salary' }],
    });

    mockParseFeedback.mockResolvedValue({
      classification: {
        platform: FeedbackPlatform.RECRUITER,
        category: FeedbackCategory.FEATURE_REQUEST,
        sentiment: FeedbackSentiment.NEGATIVE,
        urgency: FeedbackUrgency.LOW,
      },
    });

    const { ConnectError: CE } = jest.requireActual('@connectrpc/connect');
    mockClassifyRejectionFeedback.mockRejectedValue(
      new CE('Service unavailable'),
    );

    await expectSuccessfulTypedBackground<'api.v1.opportunity-feedback-submitted'>(
      worker,
      {
        opportunityId: testOpportunityId,
        userId: '1',
      },
    );

    // parseFeedback should still have been called and stored
    expect(mockParseFeedback).toHaveBeenCalled();

    const updatedMatch = await con.getRepository(OpportunityMatch).findOne({
      where: { opportunityId: testOpportunityId, userId: '1' },
    });

    // Rejection classification should remain empty JSON (error was handled gracefully)
    expect(updatedMatch?.rejectionClassification).toEqual({});
    // But per-item feedback classification should still be stored
    expect(updatedMatch?.feedback?.[0]?.classification).toBeDefined();
  });
});
