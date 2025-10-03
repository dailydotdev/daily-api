import { DataSource } from 'typeorm';
import { warmIntroNotification as worker } from '../../../src/workers/notifications/warmIntroNotification';
import createOrGetConnection from '../../../src/db';

import { Feature, FeatureType, Organization, User } from '../../../src/entity';
import { OpportunityJob } from '../../../src/entity/opportunities/OpportunityJob';
import { OpportunityUser } from '../../../src/entity/opportunities/user';
import { OpportunityUserType } from '../../../src/entity/opportunities/types';
import { OpportunityType, OpportunityState } from '@dailydotdev/schema';
import { usersFixture } from '../../fixture';
import { workers } from '../../../src/workers';
import { invokeTypedNotificationWorker, saveFixtures } from '../../helpers';
import { NotificationType } from '../../../src/notifications/common';
import type { NotificationWarmIntroContext } from '../../../src/notifications';
import { WarmIntro } from '@dailydotdev/schema';

let con: DataSource;

describe('warmIntroNotification worker', () => {
  beforeAll(async () => {
    con = await createOrGetConnection();
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, User, usersFixture);
    await con.getRepository(Feature).insert({
      userId: '1',
      feature: FeatureType.Team,
      value: 1,
    });
  });

  it('should be registered', () => {
    const registeredWorker = workers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should send notification with all required fields', async () => {
    const organization = await con.getRepository(Organization).save({
      id: 'org123',
      name: 'Test Organization',
      image: 'https://example.com/org.png',
    });

    const opportunity = await con.getRepository(OpportunityJob).save({
      id: '123e4567-e89b-12d3-a456-426614174000',
      type: OpportunityType.JOB,
      state: OpportunityState.LIVE,
      title: 'Software Engineer',
      tldr: 'Great opportunity',
      content: {},
      meta: {},
      organizationId: organization.id,
      location: [],
    });

    const recruiterUser = await con.getRepository(User).save({
      id: 'recruiter123',
      name: 'John Recruiter',
      email: 'recruiter@test.com',
    });

    await con.getRepository(OpportunityUser).save({
      opportunityId: opportunity.id,
      userId: recruiterUser.id,
      type: OpportunityUserType.Recruiter,
    });

    const result =
      await invokeTypedNotificationWorker<'gondul.v1.warm-intro-generated'>(
        worker,
        new WarmIntro({
          userId: '1',
          opportunityId: '123e4567-e89b-12d3-a456-426614174000',
          description: 'This is a warm introduction based on your profile',
        }),
      );

    expect(result!.length).toEqual(1);
    expect(result![0].type).toEqual(NotificationType.WarmIntro);

    const context = result![0].ctx as NotificationWarmIntroContext;

    expect(context.userIds).toEqual(['1']);
    expect(context.opportunityId).toEqual(
      '123e4567-e89b-12d3-a456-426614174000',
    );
    expect(context.description).toEqual(
      'This is a warm introduction based on your profile',
    );
    expect(context.recruiter).toEqual(
      expect.objectContaining({
        id: 'recruiter123',
        name: 'John Recruiter',
        email: 'recruiter@test.com',
      }),
    );
    expect(context.organization).toEqual(
      expect.objectContaining({
        id: 'org123',
        name: 'Test Organization',
        image: 'https://example.com/org.png',
      }),
    );
  });

  it('should handle missing recruiter gracefully', async () => {
    const organization = await con.getRepository(Organization).save({
      id: 'org456',
      name: 'Another Organization',
      image: 'https://example.com/another-org.png',
    });

    await con.getRepository(OpportunityJob).save({
      id: '123e4567-e89b-12d3-a456-426614174001',
      type: OpportunityType.JOB,
      state: OpportunityState.LIVE,
      title: 'Backend Developer',
      tldr: 'Great backend role',
      content: {},
      meta: {},
      organizationId: organization.id,
      location: [],
    });

    const result =
      await invokeTypedNotificationWorker<'gondul.v1.warm-intro-generated'>(
        worker,
        new WarmIntro({
          userId: '1',
          opportunityId: '123e4567-e89b-12d3-a456-426614174001',
          description: 'Introduction without recruiter',
        }),
      );

    expect(result!.length).toEqual(1);
    expect(result![0].type).toEqual(NotificationType.WarmIntro);

    const context = result![0].ctx as NotificationWarmIntroContext;

    expect(context.userIds).toEqual(['1']);
    expect(context.opportunityId).toEqual(
      '123e4567-e89b-12d3-a456-426614174001',
    );
    expect(context.description).toEqual('Introduction without recruiter');
    expect(context.recruiter).toBeUndefined();
    expect(context.organization).toEqual(
      expect.objectContaining({
        id: 'org456',
        name: 'Another Organization',
      }),
    );
  });

  it('should return undefined when opportunity not found', async () => {
    const result =
      await invokeTypedNotificationWorker<'gondul.v1.warm-intro-generated'>(
        worker,
        new WarmIntro({
          userId: '1',
          opportunityId: '123e4567-e89b-12d3-a456-426614174005',
          description: 'This should fail',
        }),
      );

    expect(result).toBeUndefined();
  });

  it('should handle missing optional description', async () => {
    const organization = await con.getRepository(Organization).save({
      id: 'org789',
      name: 'Test Org',
    });

    await con.getRepository(OpportunityJob).save({
      id: '123e4567-e89b-12d3-a456-426614174006',
      type: OpportunityType.JOB,
      state: OpportunityState.LIVE,
      title: 'Frontend Developer',
      tldr: 'Frontend role',
      content: {},
      meta: {},
      organizationId: organization.id,
      location: [],
    });

    const result =
      await invokeTypedNotificationWorker<'gondul.v1.warm-intro-generated'>(
        worker,
        new WarmIntro({
          userId: '1',
          opportunityId: '123e4567-e89b-12d3-a456-426614174006',
        }),
      );

    expect(result!.length).toEqual(1);
    expect(result![0].type).toEqual(NotificationType.WarmIntro);

    const context = result![0].ctx as NotificationWarmIntroContext;

    expect(context.userIds).toEqual(['1']);
    expect(context.opportunityId).toEqual(
      '123e4567-e89b-12d3-a456-426614174006',
    );
    expect(context.description).toBe('');
  });
});
