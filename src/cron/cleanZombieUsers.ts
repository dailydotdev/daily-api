import { Cron } from './cron';
import { User } from '../entity';
import { LessThan } from 'typeorm';
import { subHours } from 'date-fns';
import { DeletedUser } from '../entity/user/DeletedUser';

const cron: Cron = {
  name: 'clean-zombie-users',
  handler: async (con, logger) => {
    logger.info('cleaning zombie users...');
    const timeThreshold = subHours(new Date(), 1);
    const query = con
      .createQueryBuilder()
      .delete()
      .from(User)
      .where([
        {
          infoConfirmed: false,
        },
        {
          emailConfirmed: false,
        },
      ])
      .andWhere({
        createdAt: LessThan(timeThreshold),
      })
      .returning(['id']);

    const { affected, raw } = await query.execute();

    if (Array.isArray(raw) && raw.length > 0) {
      await con
        .createQueryBuilder()
        .insert()
        .into(DeletedUser)
        .values(
          raw.map((item: { id: string }) => {
            return con.getRepository(DeletedUser).create({
              id: item.id,
            });
          }),
        )
        .execute();
    }

    logger.info({ count: affected }, 'zombies users cleaned! 🧟');
  },
};

export default cron;
