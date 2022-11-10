import { EventLogger } from './pubsub';
import { User } from '../entity';
import { DataSource } from 'typeorm';

export const increaseReputation = async (
  con: DataSource,
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
  con: DataSource,
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
