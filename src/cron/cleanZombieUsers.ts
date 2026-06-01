import { Cron } from './cron';
import { User } from '../entity';
import { subHours } from 'date-fns';
import { updateFlagsStatement } from '../common/utils';

const cron: Cron = {
  name: 'clean-zombie-users',
  handler: async (con, logger) => {
    logger.info('cleaning zombie users...');
    const timeThreshold = subHours(new Date(), 1);
    const userRepo = con.getRepository(User);

    const zombieUsers = await userRepo
      .createQueryBuilder('user')
      .select(['user.id'])
      .where('("infoConfirmed" = false OR "emailConfirmed" = false)')
      .andWhere('"createdAt" < :timeThreshold', { timeThreshold })
      .andWhere(
        `(flags->>'inDeletion' IS NULL OR flags->>'inDeletion' = 'false')`,
      )
      .getMany();

    let totalMarked = 0;
    for (const zombie of zombieUsers) {
      await userRepo.update(zombie.id, {
        flags: updateFlagsStatement<User>({ inDeletion: true }),
      });
      totalMarked++;
    }

    logger.info({ count: totalMarked }, 'zombie users marked for deletion 🧟');
  },
};

export default cron;
