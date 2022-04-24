import { Connection } from 'typeorm';
import { EventLogger } from './pubsub';
import { User } from '../entity';

export const increaseReputation = async (
  con: Connection,
  log: EventLogger,
  userId: string,
  delta: number,
): Promise<void> => {
  await con
    .createQueryBuilder()
    .update(User)
    .set({ reputation: () => `greatest(0, reputation + ${delta})` })
    .where({ id: userId })
    .execute();
};

export const decreaseReputation = async (
  con: Connection,
  log: EventLogger,
  userId: string,
  delta: number,
): Promise<void> => {
  await con
    .createQueryBuilder()
    .update(User)
    .set({ reputation: () => `greatest(0, reputation - ${delta})` })
    .where({ id: userId })
    .execute();
};
