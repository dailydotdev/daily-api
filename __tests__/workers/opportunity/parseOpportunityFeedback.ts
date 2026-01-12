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

jest.mock('../../../src/integrations/bragi', () => ({
  getBragiClient: () => ({
    garmr: {
      execute: (fn: () => Promise<unknown>) => fn(),
    },
    instance: {
      parseFeedback: (...args: unknown[]) => mockParseFeedback(...args),
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
        summary: 'User had a great experience',
        actionableItems: ['Keep up the good work'],
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
      summary: 'User had a great experience',
      actionableItems: ['Keep up the good work'],
    });
  });
});
