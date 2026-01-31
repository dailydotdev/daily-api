import { DataSource } from 'typeorm';
import { recruiterExternalPaymentNotification as worker } from '../../../src/workers/notifications/recruiterExternalPaymentNotification';
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
import type { NotificationRecruiterExternalPaymentContext } from '../../../src/notifications';

let con: DataSource;

describe('recruiterExternalPaymentNotification worker', () => {
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

  it('should send notification to all recruiters when external payment is made', async () => {
    const organization = await con.getRepository(Organization).save({
      id: 'org-ext-pay-1',
      name: 'Test Organization',
    });

    const opportunity = await con.getRepository(OpportunityJob).save({
      id: '123e4567-e89b-12d3-a456-426614174010',
      type: OpportunityType.JOB,
      state: OpportunityState.DRAFT,
      title: 'Senior Software Engineer',
      tldr: 'Great opportunity',
      content: {},
      meta: {},
      organizationId: organization.id,
      location: [],
    });

    const recruiter1 = await con.getRepository(User).save({
      id: 'ext-recruiter1',
      name: 'John Recruiter',
      email: 'john-ext@test.com',
    });

    const recruiter2 = await con.getRepository(User).save({
      id: 'ext-recruiter2',
      name: 'Jane Recruiter',
      email: 'jane-ext@test.com',
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
      await invokeTypedNotificationWorker<'api.v1.opportunity-external-payment'>(
        worker,
        {
          opportunityId: opportunity.id,
          title: 'Senior Software Engineer',
        },
      );

    expect(result).toHaveLength(1);
    expect(result![0].type).toEqual(NotificationType.RecruiterExternalPayment);

    const context = result![0]
      .ctx as NotificationRecruiterExternalPaymentContext;

    expect(context.userIds).toHaveLength(2);
    expect(context.userIds).toContain('ext-recruiter1');
    expect(context.userIds).toContain('ext-recruiter2');
    expect(context.opportunityTitle).toEqual('Senior Software Engineer');
  });

  it('should return empty array when no recruiters found', async () => {
    const organization = await con.getRepository(Organization).save({
      id: 'org-ext-pay-2',
      name: 'Another Organization',
    });

    await con.getRepository(OpportunityJob).save({
      id: '123e4567-e89b-12d3-a456-426614174011',
      type: OpportunityType.JOB,
      state: OpportunityState.DRAFT,
      title: 'Backend Developer',
      tldr: 'Backend role',
      content: {},
      meta: {},
      organizationId: organization.id,
      location: [],
    });

    const result =
      await invokeTypedNotificationWorker<'api.v1.opportunity-external-payment'>(
        worker,
        {
          opportunityId: '123e4567-e89b-12d3-a456-426614174011',
          title: 'Backend Developer',
        },
      );

    expect(result).toEqual([]);
  });
});
