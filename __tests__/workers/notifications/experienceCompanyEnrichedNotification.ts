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
import { UserExperience } from '../../../src/entity/user/experiences/UserExperience';
import { Company } from '../../../src/entity/Company';
import { companyFixture } from '../../fixture/company';
import { userExperienceFixture } from '../../fixture/profile/experience';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Company, companyFixture);
  await saveFixtures(con, UserExperience, userExperienceFixture);
});

describe('experienceCompanyEnrichedNotification worker', () => {
  it('should be registered', () => {
    const registeredWorker = workers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should send notification for work experience enrichment', async () => {
    // Get the current work experience (the one with no endedAt)
    const savedExperience = await con.getRepository(UserExperience).findOne({
      where: {
        userId: '1',
        type: UserExperienceType.Work,
        endedAt: null,
      },
    });

    const result =
      await invokeTypedNotificationWorker<'api.v1.experience-company-enriched'>(
        worker,
        {
          experienceId: savedExperience!.id,
          userId: '1',
          companyId: 'dailydev',
        },
      );

    expect(result).toBeDefined();
    expect(result!.length).toEqual(1);
    expect(result![0].type).toEqual(NotificationType.ExperienceCompanyEnriched);

    const ctx = result![0].ctx as NotificationExperienceCompanyEnrichedContext;
    expect(ctx.userIds).toEqual(['1']);
    expect(ctx.experienceId).toEqual(savedExperience!.id);
    expect(ctx.experienceTitle).toEqual('Senior Software Engineer');
    expect(ctx.experienceType).toEqual(UserExperienceType.Work);
    expect(ctx.companyId).toEqual('dailydev');
    expect(ctx.companyName).toEqual('daily.dev');
  });

  it('should send notification for education experience enrichment', async () => {
    // Get the education experience from fixtures (userId '1', type Education)
    const savedExperience = await con
      .getRepository(UserExperience)
      .findOneBy({ userId: '1', type: UserExperienceType.Education });

    const result =
      await invokeTypedNotificationWorker<'api.v1.experience-company-enriched'>(
        worker,
        {
          experienceId: savedExperience!.id,
          userId: '1',
          companyId: 'dailydev',
        },
      );

    expect(result).toBeDefined();
    expect(result!.length).toEqual(1);
    expect(result![0].type).toEqual(NotificationType.ExperienceCompanyEnriched);

    const ctx = result![0].ctx as NotificationExperienceCompanyEnrichedContext;
    expect(ctx.userIds).toEqual(['1']);
    expect(ctx.experienceId).toEqual(savedExperience!.id);
    expect(ctx.experienceTitle).toEqual('Computer Science');
    expect(ctx.experienceType).toEqual(UserExperienceType.Education);
    expect(ctx.companyId).toEqual('dailydev');
    expect(ctx.companyName).toEqual('daily.dev');
  });
});
