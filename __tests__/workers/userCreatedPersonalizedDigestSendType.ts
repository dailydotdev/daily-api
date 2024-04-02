import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/userCreatedPersonalizedDigestSendType';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import {
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
  UserPersonalizedDigestType,
} from '../../src/entity';
import { usersFixture } from '../fixture/user';
import { DayOfWeek } from '../../src/types';
import { workers } from '../../src/workers';
import { ExperimentAllocationClient, features } from '../../src/growthbook';
import { sendExperimentAllocationEvent } from '../../src/integrations/analytics';

jest.mock('../../src/integrations/analytics', () => ({
  ...(jest.requireActual('../../src/integrations/analytics') as Record<
    string,
    unknown
  >),
  sendExperimentAllocationEvent: jest.fn(),
}));

jest.mock('../../src/growthbook', () => ({
  ...(jest.requireActual('../../src/growthbook') as Record<string, unknown>),
  getUserGrowthBookInstace: (
    _userId: string,
    { allocationClient }: { allocationClient: ExperimentAllocationClient },
  ) => {
    return {
      getFeatureValue: (featureId: string) => {
        if (allocationClient) {
          allocationClient.push({
            event_timestamp: new Date(),
            user_id: _userId,
            experiment_id: featureId,
            variation_id: '0',
          });
        }

        return Object.values(features).find(
          (feature) => feature.id === featureId,
        )?.defaultValue;
      },
    };
  },
}));

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();

  await saveFixtures(con, User, usersFixture);
});

describe('userCreatedAddPersonalizedDigest worker', () => {
  it('should be registered', () => {
    const registeredWorker = workers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should assign user sendType', async () => {
    const user = await con.getRepository(User).findOneBy({
      id: '1',
    });

    expect(user).toBeTruthy();

    const personalizedDigest = await con
      .getRepository(UserPersonalizedDigest)
      .save({
        userId: user!.id,
        preferredTimezone: 'Europe/Zagreb',
        preferredHour: 8,
        preferredDay: DayOfWeek.Wednesday,
        type: UserPersonalizedDigestType.Digest,
      });

    expect(personalizedDigest.flags?.sendType).not.toBeDefined();

    await expectSuccessfulBackground(worker, {
      user: {
        ...user,
        timezone: 'Europe/Zagreb',
      },
    });

    const personalizedDigestWithSendType = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: user!.id,
      });

    expect(personalizedDigestWithSendType).toMatchObject({
      preferredDay: DayOfWeek.Wednesday,
      preferredHour: 8,
      preferredTimezone: 'Europe/Zagreb',
      flags: {
        sendType: UserPersonalizedDigestSendType.weekly,
      },
    });
  });

  it('should ignore if user or digest subscription does not exist', async () => {
    await con.getRepository(User).delete({
      id: '1',
    });

    const user = await con.getRepository(User).findOneBy({
      id: '1',
    });

    expect(user).toBeFalsy();

    const personalizedDigest = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: '1',
      });

    expect(personalizedDigest).toBeFalsy();

    await expectSuccessfulBackground(worker, {
      user: {
        ...user,
        timezone: 'Europe/Zagreb',
      },
    });
  });

  it('should send allocation analytics event for experiment', async () => {
    const user = await con.getRepository(User).findOneBy({
      id: '1',
    });

    expect(user).toBeTruthy();

    await expectSuccessfulBackground(worker, {
      user: {
        ...user,
        timezone: 'Europe/Zagreb',
      },
    });

    expect(sendExperimentAllocationEvent).toHaveBeenCalledTimes(1);
    expect(sendExperimentAllocationEvent).toHaveBeenCalledWith({
      event_timestamp: expect.any(Date),
      experiment_id: features.dailyDigest.id,
      user_id: '1',
      variation_id: '0',
    });
  });
});
