import { Cron } from './cron';
import { User } from '../entity';
import { LessThan, In } from 'typeorm';
import { subHours } from 'date-fns';

const BATCH_SIZE = 50;

const cron: Cron = {
  name: 'clean-zombie-users',
  handler: async (con, logger) => {
    logger.info('cleaning zombie users...');
    const timeThreshold = subHours(new Date(), 1);
    const userRepo = con.getRepository(User);

    const zombieUsers = await userRepo.find({
      select: ['id'],
      where: [
        { infoConfirmed: false, createdAt: LessThan(timeThreshold) },
        { emailConfirmed: false, createdAt: LessThan(timeThreshold) },
      ],
    });

    const ids = zombieUsers.map((u) => u.id);
    let totalDeleted = 0;

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const { affected } = await userRepo.delete({ id: In(batch) });
      totalDeleted += affected ?? 0;
    }

    logger.info({ count: totalDeleted }, 'zombies users cleaned! 🧟');
  },
};

export default cron;
