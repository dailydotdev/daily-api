import type { DataSource } from 'typeorm';
import { User } from './entity';
import { queryReadReplica } from './common/queryReadReplica';

export enum SubscriptionCycles {
  Monthly = 'monthly',
  Yearly = 'yearly',
}

export const isPlusMember = (cycle: SubscriptionCycles | undefined): boolean =>
  !!cycle?.length || false;

export const isUserPlusMember = async (
  con: DataSource,
  userId?: string,
): Promise<boolean> => {
  const { subscriptionFlags } = await queryReadReplica(con, ({ queryRunner }) =>
    queryRunner.manager.getRepository(User).findOneOrFail({
      where: { id: userId },
      select: ['subscriptionFlags'],
    }),
  );

  return isPlusMember(subscriptionFlags?.cycle);
};
