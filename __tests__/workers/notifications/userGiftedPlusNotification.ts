import createOrGetConnection from '../../../src/db';
import { DataSource } from 'typeorm';
import { ChangeObject } from '../../../src/types';
import { usersFixture } from '../../fixture';
import { SubscriptionCycles } from '../../../src/paddle';
import { addYears } from 'date-fns';
import { invokeNotificationWorker, saveFixtures } from '../../helpers';
import { PLUS_MEMBER_SQUAD_ID } from '../../../src/workers/userUpdatedPlusSubscriptionSquad';
import { SourceType, User, Source } from '../../../src/entity';
import { NotificationGiftPlusContext } from '../../../src/notifications';
import { NotificationType } from '../../../src/notifications/common';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

type ObjectType = Partial<User>;
const base: ChangeObject<ObjectType> = {
  ...usersFixture[0],
  subscriptionFlags: JSON.stringify({}),
  createdAt: new Date().getTime(),
  updatedAt: new Date().getTime(),
  flags: JSON.stringify({}),
};
const plusUser = {
  ...base,
  subscriptionFlags: JSON.stringify({ cycle: SubscriptionCycles.Yearly }),
};
const giftedPlusUser = {
  ...base,
  subscriptionFlags: JSON.stringify({
    cycle: SubscriptionCycles.Yearly,
    gifterId: 2,
    giftExpirationDate: addYears(new Date(), 1),
  }),
};

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Source, [
    {
      id: PLUS_MEMBER_SQUAD_ID,
      name: 'Plus Squad',
      image: 'http://image.com/a',
      handle: 'plus-squad-notify',
      type: SourceType.Squad,
    },
  ]);
});

const WORKER_RELATIVE_PATH =
  '../../../src/workers/notifications/userGiftedPlusNotification';

describe('plus subscription gift', () => {
  it('should early return for currently non plus user', async () => {
    const worker = await import(WORKER_RELATIVE_PATH);
    const actual = await invokeNotificationWorker(worker.default, {
      user: base,
      newProfile: base,
    });
    expect(actual).toBeUndefined();
  });

  it('should not return anything plus user since before', async () => {
    const worker = await import(WORKER_RELATIVE_PATH);
    const actual = await invokeNotificationWorker(worker.default, {
      user: plusUser,
      newProfile: plusUser,
    });
    expect(actual).toBeUndefined();
  });

  it('should return notification for gifted plus user', async () => {
    const worker = await import(WORKER_RELATIVE_PATH);
    const actual = (await invokeNotificationWorker(worker.default, {
      user: base,
      newProfile: giftedPlusUser,
    })) as Array<{
      type: string;
      ctx: NotificationGiftPlusContext;
    }>;
    expect(actual).toBeTruthy();
    expect(actual.length).toEqual(1);
    expect(actual[0].type).toEqual(NotificationType.UserGiftedPlus);

    const notification = actual[0].ctx;
    expect(notification.recipient.id).toEqual(base.id);
    expect(notification.gifter.id).toEqual('2');
    expect(notification.squad.id).toEqual(PLUS_MEMBER_SQUAD_ID);
  });
});
