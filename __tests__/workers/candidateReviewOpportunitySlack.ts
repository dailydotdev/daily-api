import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/candidateReviewOpportunitySlack';
import { AUTO_REJECT_SCORE_THRESHOLD } from '../../src/workers/candidateReviewOpportunitySlack';
import { OpportunityMatch } from '../../src/entity/OpportunityMatch';
import { User } from '../../src/entity/user/User';
import createOrGetConnection from '../../src/db';
import { webhooks } from '../../src/common/slack';
import { OpportunityMatchStatus } from '../../src/entity/opportunities/types';
import { OpportunityJob } from '../../src/entity/opportunities/OpportunityJob';
import { Organization } from '../../src/entity/Organization';
import {
  organizationsFixture,
  opportunitiesFixture,
  datasetLocationsFixture,
} from '../fixture/opportunity';
import { usersFixture } from '../fixture/user';
import { DatasetLocation } from '../../src/entity/dataset/DatasetLocation';
import { ApplicationScored } from '@dailydotdev/schema';

jest.mock('../../src/common/slack', () => {
  const actual = jest.requireActual('../../src/common/slack');
  return {
    ...actual,
    webhooks: {
      ...actual.webhooks,
      recruiterReview: { send: jest.fn().mockResolvedValue(undefined) },
      recruiterAutoReject: { send: jest.fn().mockResolvedValue(undefined) },
    },
  };
});

beforeEach(async () => {
  jest.clearAllMocks();
  const con = await createOrGetConnection();
  await saveFixtures(con, DatasetLocation, datasetLocationsFixture);
  await saveFixtures(con, Organization, organizationsFixture);
  await saveFixtures(con, OpportunityJob, opportunitiesFixture);
  await saveFixtures(con, User, usersFixture);
});

describe('candidateReviewOpportunitySlack worker', () => {
  it('should send slack notification with accept/reject buttons', async () => {
    const con = await createOrGetConnection();
    await saveFixtures(con, OpportunityMatch, [
      {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        userId: '1',
        status: OpportunityMatchStatus.CandidateReview,
        screening: [{ screening: 'Favorite language?', answer: 'TypeScript' }],
        applicationRank: { score: 85 },
      },
    ]);

    const data = new ApplicationScored({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '1',
      score: 85,
      description: 'Strong candidate',
    });

    await expectSuccessfulTypedBackground<'gondul.v1.candidate-application-scored'>(
      worker,
      data,
    );

    expect(webhooks.recruiterReview.send).toHaveBeenCalledTimes(1);
    expect(webhooks.recruiterAutoReject.send).not.toHaveBeenCalled();
    const blocks = (webhooks.recruiterReview.send as jest.Mock).mock.calls[0][0]
      .blocks;
    const actions = blocks.find((b: { type: string }) => b.type === 'actions');
    expect(actions.elements).toHaveLength(2);
    expect(actions.elements[0].action_id).toBe('candidate_review_accept');
    expect(actions.elements[1].action_id).toBe('candidate_review_reject');
  });

  it('should auto-reject and send notification to auto-reject channel when score is below threshold', async () => {
    const con = await createOrGetConnection();
    await saveFixtures(con, OpportunityMatch, [
      {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        userId: '1',
        status: OpportunityMatchStatus.CandidateReview,
        screening: [{ screening: 'Favorite language?', answer: 'TypeScript' }],
        applicationRank: { score: 2 },
      },
    ]);

    const data = new ApplicationScored({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '1',
      score: 2.0,
      description: 'Weak candidate',
    });

    await expectSuccessfulTypedBackground<'gondul.v1.candidate-application-scored'>(
      worker,
      data,
    );

    expect(webhooks.recruiterAutoReject.send).toHaveBeenCalledTimes(1);
    expect(webhooks.recruiterReview.send).not.toHaveBeenCalled();

    const blocks = (webhooks.recruiterAutoReject.send as jest.Mock).mock
      .calls[0][0].blocks;
    const header = blocks.find((b: { type: string }) => b.type === 'header');
    expect(header.text.text).toBe('Candidate Auto-Rejected (Low Score)');

    const actions = blocks.find((b: { type: string }) => b.type === 'actions');
    expect(actions).toBeUndefined();

    const match = await con.getRepository(OpportunityMatch).findOneBy({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '1',
    });
    expect(match?.status).toBe(OpportunityMatchStatus.AutoRejected);
  });

  it('should send to review channel when score is exactly the threshold', async () => {
    const con = await createOrGetConnection();
    await saveFixtures(con, OpportunityMatch, [
      {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        userId: '1',
        status: OpportunityMatchStatus.CandidateReview,
        applicationRank: { score: AUTO_REJECT_SCORE_THRESHOLD },
      },
    ]);

    const data = new ApplicationScored({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '1',
      score: AUTO_REJECT_SCORE_THRESHOLD,
      description: 'Borderline candidate',
    });

    await expectSuccessfulTypedBackground<'gondul.v1.candidate-application-scored'>(
      worker,
      data,
    );

    expect(webhooks.recruiterReview.send).toHaveBeenCalledTimes(1);
    expect(webhooks.recruiterAutoReject.send).not.toHaveBeenCalled();

    const match = await con.getRepository(OpportunityMatch).findOneBy({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '1',
    });
    expect(match?.status).toBe(OpportunityMatchStatus.CandidateReview);
  });

  it('should include mention in auto-reject slack message when SLACK_AUTO_REJECT_MENTION_IDS is set', async () => {
    process.env.SLACK_AUTO_REJECT_MENTION_IDS = 'U123ABC,U456DEF';

    const con = await createOrGetConnection();
    await saveFixtures(con, OpportunityMatch, [
      {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        userId: '1',
        status: OpportunityMatchStatus.CandidateReview,
        applicationRank: { score: 1 },
      },
    ]);

    const data = new ApplicationScored({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '1',
      score: 1.0,
      description: 'Low score candidate',
    });

    await expectSuccessfulTypedBackground<'gondul.v1.candidate-application-scored'>(
      worker,
      data,
    );

    expect(webhooks.recruiterAutoReject.send).toHaveBeenCalledTimes(1);
    const blocks = (webhooks.recruiterAutoReject.send as jest.Mock).mock
      .calls[0][0].blocks;
    const statusBlock = blocks.find(
      (b: { type: string; text?: { text?: string } }) =>
        b.type === 'section' && b.text?.text?.includes('Auto-rejected'),
    );
    expect(statusBlock.text.text).toMatch(/cc <@U(123ABC|456DEF)>/);

    delete process.env.SLACK_AUTO_REJECT_MENTION_IDS;
  });

  it('should throw when opportunityId is not a valid UUID', async () => {
    const data = new ApplicationScored({
      opportunityId: 'not-a-uuid',
      userId: '1',
      score: 85,
      description: 'Strong candidate',
    });

    await expect(
      expectSuccessfulTypedBackground<'gondul.v1.candidate-application-scored'>(
        worker,
        data,
      ),
    ).rejects.toThrow(
      'candidateReviewOpportunitySlack: invalid message payload',
    );

    expect(webhooks.recruiterReview.send).not.toHaveBeenCalled();
  });

  it('should throw when opportunity match is missing', async () => {
    const data = new ApplicationScored({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '999999',
      score: 85,
      description: 'Strong candidate',
    });

    await expect(
      expectSuccessfulTypedBackground<'gondul.v1.candidate-application-scored'>(
        worker,
        data,
      ),
    ).rejects.toThrow('candidateReviewOpportunitySlack: match not found');

    expect(webhooks.recruiterReview.send).not.toHaveBeenCalled();
  });

  it('should parse binary message correctly', () => {
    const testData = new ApplicationScored({
      userId: '1',
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      score: 85,
      description: 'Strong candidate',
    });

    const binaryData = testData.toBinary();
    const mockMessage = { data: Buffer.from(binaryData) };

    const parsedData = worker.parseMessage!(mockMessage);

    expect(parsedData.userId).toBe('1');
    expect(parsedData.opportunityId).toBe(
      '550e8400-e29b-41d4-a716-446655440001',
    );
    expect(parsedData.score).toBe(85);
  });

  it('should have correct subscription name', () => {
    expect(worker.subscription).toBe('api.candidate-review-opportunity-slack');
  });
});
