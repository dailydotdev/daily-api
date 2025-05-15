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
    const cleanDate = sub(new Date(), { days: 21 });

    const result = await con.getRepository(UserTransaction).delete({
      status: UserTransactionStatus.Created,
      updatedAt: LessThan(cleanDate),
    });

    logger.info(
      {
        count: result.affected,
        cleanDate,
      },
      'cleaned stale user transactions',
    );
  },
};
