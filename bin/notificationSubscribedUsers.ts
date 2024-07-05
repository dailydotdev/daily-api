import { UserAction, UserActionType } from '../src/entity';
import createOrGetConnection from '../src/db';
import * as fs from 'fs';
import { parse } from 'csv-parse';

(async () => {
  const con = await createOrGetConnection();
  const subscribed = {} as Record<string, boolean>;

  console.log('reading csv');
  const stream = fs
    .createReadStream('bin/onesignal_subscribed_notifications.csv')
    .pipe(parse({ delimiter: ',', from_line: 2 }));

  stream.on('error', (err) => {
    console.log('failed to read file: ', err.message);
  });

  stream.on('data', function ([userId]) {
    if (!userId?.trim?.()) {
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
      .orIgnore()
      .execute();

    console.log('saved to db');
  });
})();
