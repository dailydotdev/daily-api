import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { NotificationV2 } from '../../src/entity/notifications/NotificationV2';
import {
  cleanupRecruiterNewCandidateNotification,
  NotificationType,
} from '../../src/notifications/common';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(() => {
  jest.resetAllMocks();
});

describe('cleanupRecruiterNewCandidateNotification', () => {
  it('should delete notification matching opportunityId and candidateUserId', async () => {
    const opportunityId = '123e4567-e89b-12d3-a456-426614174000';
    const candidateUserId = 'candidate123';

    // Create a notification to be deleted
    await con.getRepository(NotificationV2).save({
      type: NotificationType.RecruiterNewCandidate,
      icon: 'opportunity',
      title: 'New candidate',
      targetUrl: `http://localhost:5002/opportunity/${opportunityId}/matches`,
      referenceId: opportunityId,
      referenceType: 'opportunity',
      uniqueKey: candidateUserId,
      public: true,
      attachments: [],
      avatars: [],
    });

    // Verify notification exists
    const beforeCount = await con.getRepository(NotificationV2).count({
      where: {
        type: NotificationType.RecruiterNewCandidate,
        referenceId: opportunityId,
        uniqueKey: candidateUserId,
      },
    });
    expect(beforeCount).toBe(1);

    // Call cleanup
    await cleanupRecruiterNewCandidateNotification(
      con,
      opportunityId,
      candidateUserId,
    );

    // Verify notification is deleted
    const afterCount = await con.getRepository(NotificationV2).count({
      where: {
        type: NotificationType.RecruiterNewCandidate,
        referenceId: opportunityId,
        uniqueKey: candidateUserId,
      },
    });
    expect(afterCount).toBe(0);
  });

  it('should not delete notifications for different candidates', async () => {
    const opportunityId = '123e4567-e89b-12d3-a456-426614174000';
    const candidateUserId1 = 'candidate123';
    const candidateUserId2 = 'candidate456';

    // Create notifications for two different candidates
    await con.getRepository(NotificationV2).save([
      {
        type: NotificationType.RecruiterNewCandidate,
        icon: 'opportunity',
        title: 'New candidate 1',
        targetUrl: `http://localhost:5002/opportunity/${opportunityId}/matches`,
        referenceId: opportunityId,
        referenceType: 'opportunity',
        uniqueKey: candidateUserId1,
        public: true,
        attachments: [],
        avatars: [],
      },
      {
        type: NotificationType.RecruiterNewCandidate,
        icon: 'opportunity',
        title: 'New candidate 2',
        targetUrl: `http://localhost:5002/opportunity/${opportunityId}/matches`,
        referenceId: opportunityId,
        referenceType: 'opportunity',
        uniqueKey: candidateUserId2,
        public: true,
        attachments: [],
        avatars: [],
      },
    ]);

    // Call cleanup for candidate 1 only
    await cleanupRecruiterNewCandidateNotification(
      con,
      opportunityId,
      candidateUserId1,
    );

    // Verify only candidate 1's notification is deleted
    const candidate1Count = await con.getRepository(NotificationV2).count({
      where: {
        type: NotificationType.RecruiterNewCandidate,
        referenceId: opportunityId,
        uniqueKey: candidateUserId1,
      },
    });
    expect(candidate1Count).toBe(0);

    const candidate2Count = await con.getRepository(NotificationV2).count({
      where: {
        type: NotificationType.RecruiterNewCandidate,
        referenceId: opportunityId,
        uniqueKey: candidateUserId2,
      },
    });
    expect(candidate2Count).toBe(1);
  });

  it('should not delete notifications for different opportunities', async () => {
    const opportunityId1 = '123e4567-e89b-12d3-a456-426614174000';
    const opportunityId2 = '123e4567-e89b-12d3-a456-426614174001';
    const candidateUserId = 'candidate123';

    // Create notifications for two different opportunities
    await con.getRepository(NotificationV2).save([
      {
        type: NotificationType.RecruiterNewCandidate,
        icon: 'opportunity',
        title: 'New candidate opp 1',
        targetUrl: `http://localhost:5002/opportunity/${opportunityId1}/matches`,
        referenceId: opportunityId1,
        referenceType: 'opportunity',
        uniqueKey: candidateUserId,
        public: true,
        attachments: [],
        avatars: [],
      },
      {
        type: NotificationType.RecruiterNewCandidate,
        icon: 'opportunity',
        title: 'New candidate opp 2',
        targetUrl: `http://localhost:5002/opportunity/${opportunityId2}/matches`,
        referenceId: opportunityId2,
        referenceType: 'opportunity',
        uniqueKey: candidateUserId,
        public: true,
        attachments: [],
        avatars: [],
      },
    ]);

    // Call cleanup for opportunity 1 only
    await cleanupRecruiterNewCandidateNotification(
      con,
      opportunityId1,
      candidateUserId,
    );

    // Verify only opportunity 1's notification is deleted
    const opp1Count = await con.getRepository(NotificationV2).count({
      where: {
        type: NotificationType.RecruiterNewCandidate,
        referenceId: opportunityId1,
        uniqueKey: candidateUserId,
      },
    });
    expect(opp1Count).toBe(0);

    const opp2Count = await con.getRepository(NotificationV2).count({
      where: {
        type: NotificationType.RecruiterNewCandidate,
        referenceId: opportunityId2,
        uniqueKey: candidateUserId,
      },
    });
    expect(opp2Count).toBe(1);
  });

  it('should not throw error when notification does not exist', async () => {
    const opportunityId = '123e4567-e89b-12d3-a456-426614174000';
    const candidateUserId = 'candidate123';

    // Call cleanup when no notification exists - should not throw
    await expect(
      cleanupRecruiterNewCandidateNotification(
        con,
        opportunityId,
        candidateUserId,
      ),
    ).resolves.not.toThrow();
  });

  it('should return early when opportunityId is empty', async () => {
    const candidateUserId = 'candidate123';

    // Create a notification
    await con.getRepository(NotificationV2).save({
      type: NotificationType.RecruiterNewCandidate,
      icon: 'opportunity',
      title: 'New candidate',
      targetUrl: 'http://localhost:5002/opportunity/test/matches',
      referenceId: 'test-opportunity',
      referenceType: 'opportunity',
      uniqueKey: candidateUserId,
      public: true,
      attachments: [],
      avatars: [],
    });

    // Call cleanup with empty opportunityId
    await cleanupRecruiterNewCandidateNotification(con, '', candidateUserId);

    // Verify notification still exists
    const count = await con.getRepository(NotificationV2).count({
      where: {
        type: NotificationType.RecruiterNewCandidate,
        uniqueKey: candidateUserId,
      },
    });
    expect(count).toBe(1);
  });

  it('should return early when candidateUserId is empty', async () => {
    const opportunityId = '123e4567-e89b-12d3-a456-426614174000';

    // Create a notification
    await con.getRepository(NotificationV2).save({
      type: NotificationType.RecruiterNewCandidate,
      icon: 'opportunity',
      title: 'New candidate',
      targetUrl: `http://localhost:5002/opportunity/${opportunityId}/matches`,
      referenceId: opportunityId,
      referenceType: 'opportunity',
      uniqueKey: 'test-candidate',
      public: true,
      attachments: [],
      avatars: [],
    });

    // Call cleanup with empty candidateUserId
    await cleanupRecruiterNewCandidateNotification(con, opportunityId, '');

    // Verify notification still exists
    const count = await con.getRepository(NotificationV2).count({
      where: {
        type: NotificationType.RecruiterNewCandidate,
        referenceId: opportunityId,
      },
    });
    expect(count).toBe(1);
  });

  it('should not delete notifications of different types', async () => {
    const opportunityId = '123e4567-e89b-12d3-a456-426614174000';
    const candidateUserId = 'candidate123';

    // Create a RecruiterNewCandidate notification and a different type
    await con.getRepository(NotificationV2).save([
      {
        type: NotificationType.RecruiterNewCandidate,
        icon: 'opportunity',
        title: 'New candidate',
        targetUrl: `http://localhost:5002/opportunity/${opportunityId}/matches`,
        referenceId: opportunityId,
        referenceType: 'opportunity',
        uniqueKey: candidateUserId,
        public: true,
        attachments: [],
        avatars: [],
      },
      {
        type: NotificationType.RecruiterOpportunityLive,
        icon: 'opportunity',
        title: 'Opportunity is live',
        targetUrl: `http://localhost:5002/opportunity/${opportunityId}`,
        referenceId: opportunityId,
        referenceType: 'opportunity',
        uniqueKey: candidateUserId,
        public: true,
        attachments: [],
        avatars: [],
      },
    ]);

    // Call cleanup
    await cleanupRecruiterNewCandidateNotification(
      con,
      opportunityId,
      candidateUserId,
    );

    // Verify only RecruiterNewCandidate is deleted
    const recruiterNewCandidateCount = await con
      .getRepository(NotificationV2)
      .count({
        where: {
          type: NotificationType.RecruiterNewCandidate,
          referenceId: opportunityId,
        },
      });
    expect(recruiterNewCandidateCount).toBe(0);

    const otherCount = await con.getRepository(NotificationV2).count({
      where: {
        type: NotificationType.RecruiterOpportunityLive,
        referenceId: opportunityId,
      },
    });
    expect(otherCount).toBe(1);
  });
});
