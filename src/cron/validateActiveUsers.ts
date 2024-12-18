import { Cron } from './cron';
import {
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
} from '../entity';
import { In } from 'typeorm';
import { BigQuery } from '@google-cloud/bigquery';
import { blockingBatchRunner, callWithRetryDefault } from '../common/async';
import { setTimeout } from 'node:timers/promises';
import { cio, generateIdentifyObject } from '../cio';
import { updateFlagsStatement } from '../common';

enum ActiveState {
  SixWeeksAgo = 'six_weeks_ago',
  TwelveWeeksAgo = 'twelve_weeks_ago',
  Active = 'active',
}

interface UserBq {
  state: string;
  id: string;
}

const ITEMS_PER_DESTROY = 4000;
const ITEMS_PER_IDENTIFY = 250;

const cron: Cron = {
  name: 'validate-active-users',
  handler: async (con) => {
    const bigquery = new BigQuery();
    const ds = bigquery.dataset('id');
    const [usersFromBq] = await ds.table('table id').get(); // replace with actual fetch
    const inactiveUsers: string[] = [];
    const downgradeUsers: string[] = [];
    const reactivateUsers: string[] = [];

    // sort users from bq into active, inactive, downgrade, and reactivate
    for (const user of usersFromBq) {
      if (user.state === ActiveState.SixWeeksAgo) {
        inactiveUsers.push(user.id);
      } else if (user.state === ActiveState.TwelveWeeksAgo) {
        downgradeUsers.push(user.id);
      } else if (user.state === ActiveState.Active) {
        reactivateUsers.push(user.id);
      }
    }

    // update users in db: reactivated
    await blockingBatchRunner({
      data: reactivateUsers,
      runner: async (current) => {
        const validReactivateUsers = await con.getRepository(User).find({
          select: ['id'],
          where: { id: In(current), cioRegistered: false },
        });

        if (validReactivateUsers.length === 0) {
          return true;
        }

        await blockingBatchRunner({
          batchLimit: ITEMS_PER_IDENTIFY,
          data: validReactivateUsers.map((u) => ({ id: u.id })),
          runner: async (ids) => {
            const users = await con
              .getRepository(User)
              .find({ where: { id: In(ids.map(({ id }) => id)) } });

            const data = users.map((user) =>
              generateIdentifyObject(con, JSON.parse(JSON.stringify(user))),
            );

            await callWithRetryDefault(() =>
              cio.request.post('/users', { batch: data }),
            );

            await con
              .getRepository(User)
              .update({ id: In(ids) }, { cioRegistered: true });

            await setTimeout(20); // wait for a bit to avoid rate limiting
          },
        });

        await con
          .getRepository(User)
          .update(
            { id: In(validReactivateUsers.map((u) => u.id)) },
            { cioRegistered: true },
          );

        await setTimeout(200);
      },
    });

    // inactive for 12 weeks: remove from CIO
    await blockingBatchRunner({
      data: inactiveUsers,
      runner: async (current) => {
        const validInactiveUsers = await con.getRepository(User).find({
          select: ['id'],
          where: { id: In(current), cioRegistered: true },
        });

        if (validInactiveUsers.length === 0) {
          return true;
        }

        await blockingBatchRunner({
          batchLimit: ITEMS_PER_DESTROY,
          data: validInactiveUsers.map((u) => ({ id: u.id })),
          runner: async (ids) => {
            const data = ids.map((id) => ({
              action: 'destroy',
              type: 'person',
              identifiers: { id },
            }));

            await callWithRetryDefault(() =>
              cio.request.post('/users', { batch: data }),
            );

            await con
              .getRepository(User)
              .update({ id: In(ids) }, { cioRegistered: false });

            await setTimeout(20);
          },
        });
      },
    });

    // inactive for 6 weeks: downgrade from daily to weekly digest
    await blockingBatchRunner({
      data: downgradeUsers,
      runner: async (current) => {
        const validDowngradeUsers = await con
          .getRepository(User)
          .createQueryBuilder('u')
          .select('id')
          .innerJoin(UserPersonalizedDigest, 'upd', 'u.id = upd."userId"')
          .where('u.id IN (:...ids)', { ids: current })
          .andWhere(`upd.flags->>'sendType' = 'daily'`)
          .getRawMany<Pick<User, 'id'>>();

        // set digest to weekly on Wednesday 9am
        await con.getRepository(UserPersonalizedDigest).update(
          { userId: In(validDowngradeUsers.map(({ id }) => id)) },
          {
            preferredDay: 3,
            preferredHour: 9,
            flags: updateFlagsStatement({
              sendType: UserPersonalizedDigestSendType.weekly,
            }),
          },
        );
      },
    });
  },
};

export default cron;
