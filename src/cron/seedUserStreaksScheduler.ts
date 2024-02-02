import {
  DataSource,
  Equal,
  FindOptionsWhere,
  MoreThan,
  MoreThanOrEqual,
} from 'typeorm';
import { Cron } from './cron';
import { User } from '../entity';
import { notifySeedUserStreak } from '../common';
import { getRedisObject, setRedisObject } from '../redis';

interface UserPointer {
  id?: string;
  createdAt?: Date;
}

const triggerNextBatch = async (
  con: DataSource,
  logger,
  userPointer?: UserPointer,
  limit: number = 1000,
): Promise<UserPointer> => {
  const where: FindOptionsWhere<User>[] = [
    {
      createdAt: MoreThan(userPointer?.createdAt ?? new Date(0)),
    },
  ];
  if (userPointer?.id) {
    where.push({
      createdAt: Equal(userPointer.createdAt),
      id: MoreThan(userPointer.id),
    });
  }

  const users = await con.getRepository(User).find({
    where,
    take: limit,
    select: ['id', 'timezone', 'createdAt'],
    order: { createdAt: 'ASC', id: 'ASC' },
  });

  // nothing to do anymore, all the users are processed
  if (users.length === 0) {
    return null;
  }

  logger.info(
    { users: users.map((u) => u.id) },
    'Processing batch of user streaks',
  );
  notifySeedUserStreak(logger, users);

  const lastUser = users[users.length - 1];
  return {
    id: lastUser.id,
    createdAt: lastUser.createdAt,
  };
};

const cron: Cron = {
  name: 'seed-user-streaks',
  handler: async (con, logger) => {
    logger.info('scheduling user streaks data seeding');

    const key = 'seed-user-streaks-last-user';
    const data = await getRedisObject(key);
    const userPointer: UserPointer = data ? JSON.parse(data) : undefined;

    const nextPointer = await triggerNextBatch(
      con,
      logger,
      userPointer,
      Number(process.env.USER_STREAKS_BATCH_SIZE ?? 1000),
    );

    if (nextPointer) {
      await setRedisObject(key, JSON.stringify(nextPointer));
    } else {
      logger.info('nothing to process, no users scheduled');
    }
  },
};

export default cron;
