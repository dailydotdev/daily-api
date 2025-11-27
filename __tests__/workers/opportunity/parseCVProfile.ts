import {
  createGarmrMock,
  createMockBrokkrTransport,
  invokeTypedNotificationWorker,
  saveFixtures,
} from '../../helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { User } from '../../../src/entity/user/User';
import { usersFixture } from '../../fixture/user';
import { parseCVProfileWorker as worker } from '../../../src/workers/opportunity/parseCVProfile';
import { BrokkrService, CandidatePreferenceUpdated } from '@dailydotdev/schema';
import { createClient } from '@connectrpc/connect';
import type { ServiceClient } from '../../../src/types';
import * as brokkrCommon from '../../../src/common/brokkr';
import { UserExperience } from '../../../src/entity/user/experiences/UserExperience';
import { getSecondsTimestamp, updateFlagsStatement } from '../../../src/common';
import type { NotificationParsedCVProfileContext } from '../../../src/notifications';
import { NotificationType } from '../../../src/notifications/common';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('parseCVProfile worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();

    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `${item.id}-pcpw`,
        };
      }),
    );

    const transport = createMockBrokkrTransport();

    const serviceClient = {
      instance: createClient(BrokkrService, transport),
      garmr: createGarmrMock(),
    };

    jest
      .spyOn(brokkrCommon, 'getBrokkrClient')
      .mockImplementation((): ServiceClient<typeof BrokkrService> => {
        return serviceClient;
      });
  });

  it('should parse CV to profile', async () => {
    const userId = '1-pcpw';

    const payload = new CandidatePreferenceUpdated({
      payload: {
        userId,
        cv: {
          blob: userId,
          bucket: 'bucket-test',
          lastModified: getSecondsTimestamp(new Date()),
        },
      },
    });

    const parseCVSpy = jest.spyOn(
      brokkrCommon.getBrokkrClient().instance,
      'parseCV',
    );

    const result =
      await invokeTypedNotificationWorker<'api.v1.candidate-preference-updated'>(
        worker,
        payload,
      );

    expect(result).toBeDefined();

    expect(parseCVSpy).toHaveBeenCalledTimes(1);

    const experiences = await con.getRepository(UserExperience).find({
      where: { userId },
    });

    expect(experiences).toHaveLength(4);

    const user = await con.getRepository(User).findOneBy({ id: userId });
    expect(user?.flags.lastCVParseAt).toBeDefined();
  });

  it('should skip if CV blob or bucket is empty', async () => {
    const userId = '1-pcpw';

    const payload = new CandidatePreferenceUpdated({
      payload: {
        userId,
      },
    });

    const parseCVSpy = jest.spyOn(
      brokkrCommon.getBrokkrClient().instance,
      'parseCV',
    );

    const result =
      await invokeTypedNotificationWorker<'api.v1.candidate-preference-updated'>(
        worker,
        payload,
      );

    expect(result).toBeUndefined();

    expect(parseCVSpy).toHaveBeenCalledTimes(0);

    const experiences = await con.getRepository(UserExperience).find({
      where: { userId },
    });

    expect(experiences).toHaveLength(0);
  });

  it('should skip if CV lastModified is empty', async () => {
    const userId = '1-pcpw';

    const payload = new CandidatePreferenceUpdated({
      payload: {
        userId,
        cv: {
          blob: userId,
          bucket: 'bucket-test',
        },
      },
    });

    const parseCVSpy = jest.spyOn(
      brokkrCommon.getBrokkrClient().instance,
      'parseCV',
    );

    const result =
      await invokeTypedNotificationWorker<'api.v1.candidate-preference-updated'>(
        worker,
        payload,
      );

    expect(result).toBeUndefined();

    expect(parseCVSpy).toHaveBeenCalledTimes(0);

    const experiences = await con.getRepository(UserExperience).find({
      where: { userId },
    });

    expect(experiences).toHaveLength(0);
  });

  it('should skip if userId is empty', async () => {
    const userId = '1-pcpw';

    const payload = new CandidatePreferenceUpdated({
      payload: {
        cv: {
          blob: userId,
          bucket: 'bucket-test',
          lastModified: getSecondsTimestamp(new Date()),
        },
      },
    });

    const parseCVSpy = jest.spyOn(
      brokkrCommon.getBrokkrClient().instance,
      'parseCV',
    );

    const result =
      await invokeTypedNotificationWorker<'api.v1.candidate-preference-updated'>(
        worker,
        payload,
      );

    expect(result).toBeUndefined();

    expect(parseCVSpy).toHaveBeenCalledTimes(0);

    const experiences = await con.getRepository(UserExperience).find({
      where: { userId },
    });

    expect(experiences).toHaveLength(0);
  });

  it('should skip if user is not found', async () => {
    const userId = 'non-existing-user';

    const payload = new CandidatePreferenceUpdated({
      payload: {
        userId,
        cv: {
          blob: userId,
          bucket: 'bucket-test',
          lastModified: getSecondsTimestamp(new Date()),
        },
      },
    });

    const parseCVSpy = jest.spyOn(
      brokkrCommon.getBrokkrClient().instance,
      'parseCV',
    );

    const result =
      await invokeTypedNotificationWorker<'api.v1.candidate-preference-updated'>(
        worker,
        payload,
      );

    expect(result).toBeUndefined();

    expect(parseCVSpy).toHaveBeenCalledTimes(0);

    const experiences = await con.getRepository(UserExperience).find({
      where: { userId },
    });

    expect(experiences).toHaveLength(0);
  });

  it('should skip if lastModified is less then last profile parse date', async () => {
    const userId = '1-pcpw';

    await con.getRepository(User).update(
      { id: userId },
      {
        flags: updateFlagsStatement<User>({
          lastCVParseAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day in future
        }),
      },
    );

    const payload = new CandidatePreferenceUpdated({
      payload: {
        userId,
        cv: {
          blob: userId,
          bucket: 'bucket-test',
          lastModified: getSecondsTimestamp(new Date()),
        },
      },
    });

    const parseCVSpy = jest.spyOn(
      brokkrCommon.getBrokkrClient().instance,
      'parseCV',
    );

    const result =
      await invokeTypedNotificationWorker<'api.v1.candidate-preference-updated'>(
        worker,
        payload,
      );

    expect(result).toBeUndefined();

    expect(parseCVSpy).toHaveBeenCalledTimes(0);

    const experiences = await con.getRepository(UserExperience).find({
      where: { userId },
    });

    expect(experiences).toHaveLength(0);
  });

  it('should fail if parsedCV in result is empty', async () => {
    const userId = '1-pcpw';

    const payload = new CandidatePreferenceUpdated({
      payload: {
        userId,
        cv: {
          blob: 'empty-cv-mock',
          bucket: 'bucket-test',
          lastModified: getSecondsTimestamp(new Date()),
        },
      },
    });

    const parseCVSpy = jest.spyOn(
      brokkrCommon.getBrokkrClient().instance,
      'parseCV',
    );

    const result =
      await invokeTypedNotificationWorker<'api.v1.candidate-preference-updated'>(
        worker,
        payload,
      );

    expect(result!.length).toEqual(1);

    expect(parseCVSpy).toHaveBeenCalledTimes(1);

    const experiences = await con.getRepository(UserExperience).find({
      where: { userId },
    });

    expect(experiences).toHaveLength(0);

    const user = await con.getRepository(User).findOneBy({ id: userId });
    expect(user?.flags.lastCVParseAt).not.toBeNull();
  });

  it('should send notification after successful parsing', async () => {
    const userId = '1-pcpw';

    const payload = new CandidatePreferenceUpdated({
      payload: {
        userId,
        cv: {
          blob: userId,
          bucket: 'bucket-test',
          lastModified: getSecondsTimestamp(new Date()),
        },
      },
    });

    const result =
      await invokeTypedNotificationWorker<'api.v1.candidate-preference-updated'>(
        worker,
        payload,
      );

    expect(result!.length).toEqual(1);
    expect(result![0].type).toEqual(NotificationType.ParsedCVProfile);

    const context = result![0].ctx as NotificationParsedCVProfileContext;

    expect(context.userIds).toEqual(['1-pcpw']);
    expect(context.user.id).toEqual(userId);
    expect(context.status).toEqual('success');
  });

  it('should send notification after failed parsing', async () => {
    const userId = '1-pcpw';

    const payload = new CandidatePreferenceUpdated({
      payload: {
        userId,
        cv: {
          blob: 'empty-cv-mock',
          bucket: 'bucket-test',
          lastModified: getSecondsTimestamp(new Date()),
        },
      },
    });

    const result =
      await invokeTypedNotificationWorker<'api.v1.candidate-preference-updated'>(
        worker,
        payload,
      );

    expect(result!.length).toEqual(1);
    expect(result![0].type).toEqual(NotificationType.ParsedCVProfile);

    const context = result![0].ctx as NotificationParsedCVProfileContext;

    expect(context.userIds).toEqual(['1-pcpw']);
    expect(context.user.id).toEqual(userId);
    expect(context.status).toEqual('failed');
  });
});
