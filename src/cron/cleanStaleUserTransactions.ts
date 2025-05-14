import { LessThan } from 'typeorm';
import { Cron } from './cron';
import { sub } from 'date-fns';
import {
  UserTransaction,
  UserTransactionStatus,
} from '../entity/user/UserTransaction';

export const cleanStaleUserTransactions: Cron = {
  name: 'clean-stale-user-transactions',
  handler: async (con, logger) => {
    const cutoffDate = sub(new Date(), { days: 21 });

    const result = await con.getRepository(UserTransaction).delete({
      status: UserTransactionStatus.Created,
      updatedAt: LessThan(cutoffDate),
    });

    logger.info(
      {
        count: result.affected,
      },
      'cleaned stale user transactions',
    );
  },
};
