import { UserAction, UserActionType } from '../src/entity';
import createOrGetConnection from '../src/db';
import * as fs from 'fs';
import { parse } from 'csv-parse';

(async () => {
  const con = await createOrGetConnection();
  const existing = await con
    .getRepository(UserAction)
    .findBy({ type: UserActionType.EnableNotification });
  const subscribed = {};

  console.log('reading csv');
  const stream = fs
    .createReadStream('bin/onesignal_subscribed_notifications.csv')
    .pipe(parse({ delimiter: ',', from_line: 2 }))
    .on('data', function ([userId]) {
      if (
        !userId?.trim() ||
        existing.some(({ userId: existingId }) => existingId === userId)
      ) {
        return;
      }

      console.log('pushing: ', userId);
      subscribed[userId] = true;
    });

  stream.on('end', async () => {
    await con
      .createQueryBuilder()
      .insert()
      .into(UserAction)
      .values(
        Object.keys(subscribed).map((userId) => ({
          userId,
          type: UserActionType.EnableNotification,
        })),
      )
      .execute();

    console.log('saved to db');
  });
})();
