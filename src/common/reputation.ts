import { Connection } from 'typeorm';
import { EventLogger, notifyUserReputationUpdated } from './pubsub';
import { User } from '../entity';

export const increaseReputation = async (
  con: Connection,
  log: EventLogger,
  userId: string,
  delta: number,
): Promise<void> => {
  const user = await con.transaction(
    async (entityManager): Promise<User> => {
      const repo = entityManager.getRepository(User);
      await repo.increment({ id: userId }, 'reputation', delta);
      return repo.findOne(userId);
    },
  );
  await notifyUserReputationUpdated(log, userId, user.reputation);
};
