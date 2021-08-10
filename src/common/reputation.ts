import { Connection, In } from 'typeorm';
import { EventLogger } from './pubsub';
import { User } from '../entity';

export const increaseReputation = async (
  con: Connection,
  log: EventLogger,
  userId: string,
  delta: number,
): Promise<void> => {
  const repo = con.getRepository(User);
  await repo.increment({ id: userId }, 'reputation', delta);
};

export const increaseMultipleReputation = async (
  con: Connection,
  log: EventLogger,
  userIds: string[],
  delta: number,
): Promise<void> => {
  const repo = con.getRepository(User);
  await repo.increment({ id: In(userIds) }, 'reputation', delta);
};
