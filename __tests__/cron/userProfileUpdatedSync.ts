import { userProfileUpdatedSync as cron } from '../../src/cron/userProfileUpdatedSync';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { crons } from '../../src/cron/index';
import {
  datasetLocationsFixture,
  organizationsFixture,
} from '../fixture/opportunity';
import { userExperienceWorkFixture } from '../fixture/profile/work';
import { Organization } from '../../src/entity/Organization';
import { insertOrIgnoreUserExperienceSkills } from '../../src/entity/user/experiences/UserExperienceSkill';
import { User } from '../../src/entity/user/User';
import { usersFixture } from '../fixture/user';
import { DatasetLocation } from '../../src/entity/dataset/DatasetLocation';
import {
  datasetLocationFixture,
  userExperienceFixture,
} from '../fixture/profile/experience';
import { randomUUID } from 'node:crypto';
import { Company } from '../../src/entity/Company';
import { companyFixture } from '../fixture/company';
import { triggerTypedEvent } from '../../src/common';
import { UserProfileUpdatedMessage } from '@dailydotdev/schema';
import { UserExperience } from '../../src/entity/user/experiences/UserExperience';

jest.mock('../../src/common/typedPubsub', () => ({
  ...(jest.requireActual('../../src/common/typedPubsub') as Record<
    string,
    unknown
  >),
  triggerTypedEvent: jest.fn(),
}));

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.clearAllMocks();

  await saveFixtures(con, DatasetLocation, datasetLocationsFixture);
  await saveFixtures(con, Organization, organizationsFixture);
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Company, companyFixture);

  const datasetLocations = await con
    .getRepository(DatasetLocation)
    .save(datasetLocationFixture);

  const experiencesToInsert = userExperienceFixture.map((item) => {
    const experienceId = randomUUID();

    return {
      ...item,
      skills: undefined,
      id: experienceId,
      locationId: item.customLocation ? undefined : datasetLocations[0].id,
    };
  });

  await con.getRepository(UserExperience).save(experiencesToInsert);

  await Promise.all(
    userExperienceWorkFixture.map((item, index) => {
      const experienceId = experiencesToInsert[index].id;

      return insertOrIgnoreUserExperienceSkills(
        con,
        experienceId,
        userExperienceWorkFixture[index].skills || [],
      );
    }),
  );
});

describe('userProfileUpdatedSync cron', () => {
  it('should be registered', () => {
    const registeredWorker = crons.find((item) => item.name === cron.name);

    expect(registeredWorker).toBeDefined();
  });

  it('should publish updated user experiences', async () => {
    await expectSuccessfulCron(cron);

    expect(triggerTypedEvent).toHaveBeenCalledTimes(2);

    const mockCalls = jest.mocked(triggerTypedEvent).mock.calls;

    const user1Call = mockCalls.find(
      (item) =>
        (item[2] as unknown as UserProfileUpdatedMessage).profile?.userId ===
        '1',
    );
    expect(user1Call).toBeDefined();

    expect(user1Call![2]).toEqual({
      profile: {
        experiences: expect.arrayContaining([
          {
            companyName: 'daily.dev',
            createdAt: expect.any(Number),
            description: 'Working on API infrastructure',
            employmentType: 0,
            id: expect.any(String),
            location: {
              city: 'San Francisco',
              country: 'USA',
              subdivision: 'CA',
            },
            locationType: 3,
            startedAt: expect.any(Number),
            subtitle: 'Backend Team',
            title: 'Senior Software Engineer',
            type: 1,
            updatedAt: expect.any(Number),
            verified: true,
          },
          {
            companyName: 'daily.dev',
            createdAt: expect.any(Number),
            description: 'Worked on search infrastructure',
            employmentType: 3,
            endedAt: expect.any(Number),

            id: expect.any(String),
            location: {
              city: 'San Francisco',
              country: 'United States',
              subdivision: 'California',
            },
            locationType: 2,
            startedAt: expect.any(Number),
            title: 'Software Engineer',
            type: 1,
            updatedAt: expect.any(Number),
            verified: false,
          },
          {
            companyName: 'daily.dev',
            createdAt: expect.any(Number),
            description: 'Focused on distributed systems',
            employmentType: 0,
            endedAt: expect.any(Number),
            id: expect.any(String),
            location: {
              city: 'San Francisco',
              country: 'United States',
              subdivision: 'California',
            },
            locationType: 0,
            startedAt: expect.any(Number),
            subtitle: 'Bachelor of Science',
            title: 'Computer Science',
            type: 2,
            updatedAt: expect.any(Number),
            verified: false,
            grade: '9/5',
          },
        ]),
        skills: expect.arrayContaining([
          {
            experienceId: expect.any(String),
            value: 'CMS',
          },
          {
            experienceId: expect.any(String),
            value: 'VIVO CMS',
          },
          {
            experienceId: expect.any(String),
            value: 'PHP',
          },
          {
            experienceId: expect.any(String),
            value: 'Paiting',
          },
          {
            experienceId: expect.any(String),
            value: 'Woodworking',
          },
        ]),
        userId: '1',
      },
    });

    const user2Call = mockCalls.find(
      (item) =>
        (item[2] as unknown as UserProfileUpdatedMessage).profile?.userId ===
        '2',
    );
    expect(user2Call).toBeDefined();

    expect(user2Call![2]).toEqual({
      profile: {
        experiences: expect.arrayContaining([
          {
            companyName: 'daily.dev',
            createdAt: expect.any(Number),
            description: 'Managing product roadmap',
            employmentType: 1,
            id: expect.any(String),
            location: {
              city: 'San Francisco',
              country: 'United States',
              subdivision: 'California',
            },
            locationType: 0,
            startedAt: expect.any(Number),
            title: 'Product Manager',
            type: 1,
            updatedAt: expect.any(Number),
            verified: true,
          },
          {
            companyName: 'daily.dev',
            createdAt: expect.any(Number),
            description: 'Contributing to TypeScript projects',
            employmentType: 0,
            id: expect.any(String),
            location: {
              city: 'San Francisco',
              country: 'United States',
              subdivision: 'California',
            },
            locationType: 0,
            startedAt: expect.any(Number),
            title: 'Open Source Contributor',
            type: 3,
            updatedAt: expect.any(Number),
            verified: false,
            url: 'https://example.com/project',
          },
        ]),
        skills: expect.arrayContaining([]),
        userId: '2',
      },
    });
  });
});
