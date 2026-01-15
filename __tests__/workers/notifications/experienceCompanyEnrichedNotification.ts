import { DataSource } from 'typeorm';
import { experienceCompanyEnrichedNotification as worker } from '../../../src/workers/notifications/experienceCompanyEnrichedNotification';
import createOrGetConnection from '../../../src/db';
import { usersFixture } from '../../fixture';
import { workers } from '../../../src/workers';
import { invokeTypedNotificationWorker, saveFixtures } from '../../helpers';
import { NotificationType } from '../../../src/notifications/common';
import type { NotificationExperienceCompanyEnrichedContext } from '../../../src/notifications';
import { User } from '../../../src/entity/user/User';
import { UserExperienceType } from '../../../src/entity/user/experiences/types';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, User, usersFixture);
});

describe('experienceCompanyEnrichedNotification worker', () => {
  it('should be registered', () => {
    const registeredWorker = workers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should send notification for work experience enrichment', async () => {
    const result =
      await invokeTypedNotificationWorker<'api.v1.experience-company-enriched'>(
        worker,
        {
          experienceId: 'exp-123',
          userId: '1',
          experienceTitle: 'Software Engineer',
          experienceType: UserExperienceType.Work,
          companyId: 'company-456',
          companyName: 'Google',
        },
      );

    expect(result).toBeDefined();
    expect(result!.length).toEqual(1);
    expect(result![0].type).toEqual(NotificationType.ExperienceCompanyEnriched);

    const ctx = result![0].ctx as NotificationExperienceCompanyEnrichedContext;
    expect(ctx.userIds).toEqual(['1']);
    expect(ctx.experienceId).toEqual('exp-123');
    expect(ctx.experienceTitle).toEqual('Software Engineer');
    expect(ctx.experienceType).toEqual(UserExperienceType.Work);
    expect(ctx.companyId).toEqual('company-456');
    expect(ctx.companyName).toEqual('Google');
  });

  it('should send notification for education experience enrichment', async () => {
    const result =
      await invokeTypedNotificationWorker<'api.v1.experience-company-enriched'>(
        worker,
        {
          experienceId: 'exp-789',
          userId: '2',
          experienceTitle: 'Computer Science Degree',
          experienceType: UserExperienceType.Education,
          companyId: 'company-abc',
          companyName: 'Stanford University',
        },
      );

    expect(result).toBeDefined();
    expect(result!.length).toEqual(1);
    expect(result![0].type).toEqual(NotificationType.ExperienceCompanyEnriched);

    const ctx = result![0].ctx as NotificationExperienceCompanyEnrichedContext;
    expect(ctx.userIds).toEqual(['2']);
    expect(ctx.experienceId).toEqual('exp-789');
    expect(ctx.experienceTitle).toEqual('Computer Science Degree');
    expect(ctx.experienceType).toEqual(UserExperienceType.Education);
    expect(ctx.companyId).toEqual('company-abc');
    expect(ctx.companyName).toEqual('Stanford University');
  });
});
