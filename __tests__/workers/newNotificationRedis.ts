import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/newNotificationRedis';
import { Source } from '../../src/entity';
import { redisPubSub } from '../../src/redis';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { usersFixture } from '../fixture/user';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, [usersFixture[0]]);
});

it('should publish an event to redis', async () => {
  return new Promise<void>(async (resolve) => {
    const subId = await redisPubSub.subscribe(
      'events.notifications.1.new',
      (value) => {
        expect(value).toEqual({
          userId: '1',
          id: 'n1',
        });
        redisPubSub.unsubscribe(subId);
        resolve();
      },
    );
    await expectSuccessfulBackground(worker, {
      notification: {
        userId: '1',
        id: 'n1',
      },
    });
  });
});
