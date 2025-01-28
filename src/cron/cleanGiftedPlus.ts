import { Cron } from './cron';
import { User } from '../entity';

const cron: Cron = {
  name: 'clean-gifted-plus',
  handler: async (con, logger) => {
    logger.debug('cleaning gifted plus membership...');
    const timeThreshold = new Date();

    const { affected } = await con
      .getRepository(User)
      .createQueryBuilder('user')
      .update()
      .set({
        subscriptionFlags: {},
        flags: () => `"user"."flags"::jsonb - 'showPlusGift'`,
      })
      .where(`"user"."subscriptionFlags"->>'giftExpirationDate'  < :time`, {
        time: timeThreshold,
      })
      .execute();

    logger.info({ count: affected }, 'expired gifted plus cleaned! 🎁');
  },
};

export default cron;
