import { DataSource } from 'typeorm';
import { reMatchedOpportunityNotification as worker } from '../../../src/workers/notifications/reMatchedOpportunityNotification';
import createOrGetConnection from '../../../src/db';
import { User, Organization } from '../../../src/entity';
import { usersFixture } from '../../fixture';
import { workers } from '../../../src/workers';
import { invokeTypedNotificationWorker, saveFixtures } from '../../helpers';
import { NotificationType } from '../../../src/notifications/common';
import type { NotificationOpportunityMatchContext } from '../../../src/notifications';
import { MatchedCandidate } from '@dailydotdev/schema';
import { OpportunityMatch } from '../../../src/entity/OpportunityMatch';
import { Opportunity } from '../../../src/entity/opportunities/Opportunity';
import { OpportunityMatchStatus } from '../../../src/entity/opportunities/types';
import {
  datasetLocationsFixture,
  opportunitiesFixture,
  organizationsFixture,
} from '../../fixture/opportunity';
import { DatasetLocation } from '../../../src/entity/dataset/DatasetLocation';

let con: DataSource;

describe('reMatchedOpportunityNotification worker', () => {
  beforeAll(async () => {
    con = await createOrGetConnection();
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, DatasetLocation, datasetLocationsFixture);
    await saveFixtures(con, Organization, organizationsFixture);
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, Opportunity, opportunitiesFixture);
  });

  it('should be registered', () => {
    const registeredWorker = workers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should send notification for re-match (candidate_rejected status)', async () => {
    await con.getRepository(OpportunityMatch).save({
      userId: '1',
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      status: OpportunityMatchStatus.CandidateRejected,
      description: {
        matchScore: 75,
        reasoning: 'Initial',
        reasoningShort: 'Initial',
      },
      feedback: [{ screening: 'test', answer: 'rejected' }],
      history: [],
    });

    const result =
      await invokeTypedNotificationWorker<'gondul.v1.candidate-opportunity-match'>(
        worker,
        new MatchedCandidate({
          userId: '1',
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
          matchScore: 90,
          reasoning: 'Re-match reasoning',
          reasoningShort: 'Re-match short',
        }),
      );

    expect(result!.length).toEqual(1);
    expect(result![0].type).toEqual(NotificationType.ReMatchedOpportunity);

    const context = result![0].ctx as NotificationOpportunityMatchContext;

    expect(context.userIds).toEqual(['1']);
    expect(context.opportunityId).toEqual(
      '550e8400-e29b-41d4-a716-446655440001',
    );
    expect(context.reasoningShort).toEqual('Re-match short');
  });

  it('should not send notification when no existing match', async () => {
    const result =
      await invokeTypedNotificationWorker<'gondul.v1.candidate-opportunity-match'>(
        worker,
        new MatchedCandidate({
          userId: '1',
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
          matchScore: 85,
          reasoning: 'New match',
          reasoningShort: 'New match',
        }),
      );

    // Should skip - new matches are handled by candidateOpportunityMatchNotification
    expect(result).toBeUndefined();
  });

  it('should not send notification when existing match is not candidate_rejected', async () => {
    await con.getRepository(OpportunityMatch).save({
      userId: '1',
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      status: OpportunityMatchStatus.Pending,
      description: {
        matchScore: 75,
        reasoning: 'Initial',
        reasoningShort: 'Initial',
      },
      feedback: [],
      history: [],
    });

    const result =
      await invokeTypedNotificationWorker<'gondul.v1.candidate-opportunity-match'>(
        worker,
        new MatchedCandidate({
          userId: '1',
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
          matchScore: 85,
          reasoning: 'Updated',
          reasoningShort: 'Updated',
        }),
      );

    // Should skip - not a re-match (status is not candidate_rejected)
    expect(result).toBeUndefined();
  });

  it('should not send notification when userId is missing', async () => {
    const result =
      await invokeTypedNotificationWorker<'gondul.v1.candidate-opportunity-match'>(
        worker,
        new MatchedCandidate({
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
          reasoning: 'Test reasoning',
        }),
      );

    expect(result).toBeUndefined();
  });

  it('should not send notification when opportunityId is missing', async () => {
    const result =
      await invokeTypedNotificationWorker<'gondul.v1.candidate-opportunity-match'>(
        worker,
        new MatchedCandidate({
          userId: '1',
          reasoning: 'Test reasoning',
        }),
      );

    expect(result).toBeUndefined();
  });
});
