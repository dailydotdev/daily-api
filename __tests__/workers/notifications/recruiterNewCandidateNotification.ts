import { DataSource } from 'typeorm';
import { recruiterNewCandidateNotification as worker } from '../../../src/workers/notifications/recruiterNewCandidateNotification';
import createOrGetConnection from '../../../src/db';
import { Organization, User } from '../../../src/entity';
import { OpportunityJob } from '../../../src/entity/opportunities/OpportunityJob';
import { OpportunityUser } from '../../../src/entity/opportunities/user';
import { OpportunityUserType } from '../../../src/entity/opportunities/types';
import { OpportunityType, OpportunityState } from '@dailydotdev/schema';
import { usersFixture } from '../../fixture';
import { workers } from '../../../src/workers';
import { invokeTypedNotificationWorker, saveFixtures } from '../../helpers';
import { NotificationType } from '../../../src/notifications/common';
import type { NotificationRecruiterNewCandidateContext } from '../../../src/notifications';
import { CandidateAcceptedOpportunityMessage } from '@dailydotdev/schema';

let con: DataSource;

describe('recruiterNewCandidateNotification worker', () => {
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

  it('should send notification to all recruiters when candidate accepts', async () => {
    const organization = await con.getRepository(Organization).save({
      id: 'org123',
      name: 'Test Organization',
    });

    const opportunity = await con.getRepository(OpportunityJob).save({
      id: '123e4567-e89b-12d3-a456-426614174000',
      type: OpportunityType.JOB,
      state: OpportunityState.LIVE,
      title: 'Senior Software Engineer',
      tldr: 'Great opportunity',
      content: {},
      meta: {},
      organizationId: organization.id,
      location: [],
    });

    const recruiter1 = await con.getRepository(User).save({
      id: 'recruiter1',
      name: 'John Recruiter',
      email: 'john@test.com',
    });

    const recruiter2 = await con.getRepository(User).save({
      id: 'recruiter2',
      name: 'Jane Recruiter',
      email: 'jane@test.com',
    });

    await con.getRepository(OpportunityUser).save([
      {
        opportunityId: opportunity.id,
        userId: recruiter1.id,
        type: OpportunityUserType.Recruiter,
      },
      {
        opportunityId: opportunity.id,
        userId: recruiter2.id,
        type: OpportunityUserType.Recruiter,
      },
    ]);

    const result =
      await invokeTypedNotificationWorker<'api.v1.candidate-accepted-opportunity'>(
        worker,
        new CandidateAcceptedOpportunityMessage({
          userId: '1',
          opportunityId: '123e4567-e89b-12d3-a456-426614174000',
          createdAt: Math.floor(Date.now() / 1000),
          updatedAt: Math.floor(Date.now() / 1000),
        }),
      );

    expect(result!.length).toEqual(1);
    expect(result![0].type).toEqual(NotificationType.RecruiterNewCandidate);

    const context = result![0].ctx as NotificationRecruiterNewCandidateContext;

    expect(context.userIds).toHaveLength(2);
    expect(context.userIds).toContain('recruiter1');
    expect(context.userIds).toContain('recruiter2');
    expect(context.opportunityId).toEqual(
      '123e4567-e89b-12d3-a456-426614174000',
    );
    expect(context.candidate).toBeDefined();
    expect(context.candidate.id).toEqual('1');
  });

  it('should return empty array when no recruiters found', async () => {
    const organization = await con.getRepository(Organization).save({
      id: 'org456',
      name: 'Another Organization',
    });

    await con.getRepository(OpportunityJob).save({
      id: '123e4567-e89b-12d3-a456-426614174001',
      type: OpportunityType.JOB,
      state: OpportunityState.LIVE,
      title: 'Backend Developer',
      tldr: 'Backend role',
      content: {},
      meta: {},
      organizationId: organization.id,
      location: [],
    });

    const result =
      await invokeTypedNotificationWorker<'api.v1.candidate-accepted-opportunity'>(
        worker,
        new CandidateAcceptedOpportunityMessage({
          userId: '1',
          opportunityId: '123e4567-e89b-12d3-a456-426614174001',
          createdAt: Math.floor(Date.now() / 1000),
          updatedAt: Math.floor(Date.now() / 1000),
        }),
      );

    expect(result).toEqual([]);
  });
});
