import createOrGetConnection from '../src/db';
import fs from 'fs';
import { parse } from 'csv-parse';
import { syncSubscriptionsWithActiveState } from '../src/common';
import {
  GetUsersActiveState,
  UserActiveState,
} from '../src/common/googleCloud';

const func = async () => {
  const csvFilePath = process.argv[2];

  if (!csvFilePath) {
    throw new Error('CSV file path is required');
  }

  const users: GetUsersActiveState = {
    inactiveUsers: [],
    downgradeUsers: [],
    reactivateUsers: [],
  };

  const stream = fs
    .createReadStream(csvFilePath)
    .pipe(parse({ delimiter: ',', from_line: 2 }));

  stream.on('error', (err) => {
    console.error('failed to read file: ', err.message);
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  stream.on('data', function ([id, rawStatus]) {
    if (!id || !rawStatus) {
      return;
    }

    const status = rawStatus.toString() as UserActiveState;

    if (status === UserActiveState.InactiveSince6wAgo) {
      users.downgradeUsers.push(id);
    }

    if (
      status === UserActiveState.InactiveSince12wAgo ||
      status === UserActiveState.NeverActive
    ) {
      users.inactiveUsers.push(id);
    }
  });

  await new Promise((resolve) => {
    stream.on('end', resolve);
  });

  console.log('running cron sync function');

  const con = await createOrGetConnection();

  await syncSubscriptionsWithActiveState({ con, users });

  console.log('finished sync');

  process.exit(0);
};

func();
