import { DataSource } from 'typeorm';
import { candidateOpportunityMatchNotification as worker } from '../../../src/workers/notifications/candidateOpportunityMatchNotification';
import createOrGetConnection from '../../../src/db';
import { User } from '../../../src/entity';
import { usersFixture } from '../../fixture';
import { workers } from '../../../src/workers';
import { invokeTypedNotificationWorker, saveFixtures } from '../../helpers';
import { NotificationType } from '../../../src/notifications/common';
import type { NotificationOpportunityMatchContext } from '../../../src/notifications';
import { MatchedCandidate } from '@dailydotdev/schema';

let con: DataSource;

describe('candidateOpportunityMatchNotification worker', () => {
  beforeAll(async () => {
    con = await createOrGetConnection();
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, User, usersFixture);
  });

  it('should be registered', () => {
    const registeredWorker = workers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should send notification with all required fields', async () => {
    const result =
      await invokeTypedNotificationWorker<'gondul.v1.candidate-opportunity-match'>(
        worker,
        new MatchedCandidate({
          userId: '1',
          opportunityId: 'opp123',
          matchScore: 85,
          reasoning: 'Based on your React and TypeScript skills and experience',
          reasoningShort: 'Based on your React and TypeScript skills',
        }),
      );

    expect(result!.length).toEqual(1);
    expect(result![0].type).toEqual(NotificationType.NewOpportunityMatch);

    const context = result![0].ctx as NotificationOpportunityMatchContext;

    expect(context.userIds).toEqual(['1']);
    expect(context.opportunityId).toEqual('opp123');
    expect(context.reasoningShort).toEqual(
      'Based on your React and TypeScript skills',
    );
  });

  it('should send notification without optional fields', async () => {
    const result =
      await invokeTypedNotificationWorker<'gondul.v1.candidate-opportunity-match'>(
        worker,
        new MatchedCandidate({
          userId: '1',
          opportunityId: 'opp456',
        }),
      );

    expect(result!.length).toEqual(1);
    expect(result![0].type).toEqual(NotificationType.NewOpportunityMatch);

    const context = result![0].ctx as NotificationOpportunityMatchContext;

    expect(context.userIds).toEqual(['1']);
    expect(context.opportunityId).toEqual('opp456');
    expect(context.reasoningShort).toEqual('');
  });

  it('should not send notification when userId is missing', async () => {
    const result =
      await invokeTypedNotificationWorker<'gondul.v1.candidate-opportunity-match'>(
        worker,
        new MatchedCandidate({
          opportunityId: 'opp123',
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
