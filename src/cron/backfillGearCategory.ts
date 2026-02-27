import { Cron } from './cron';
import { DatasetGear } from '../entity/dataset/DatasetGear';
import { classifyGearName } from '../common/gearClassification';
import { IsNull } from 'typeorm';

const cron: Cron = {
  name: 'backfill-gear-category',
  handler: async (con, logger) => {
    try {
      const repo = con.getRepository(DatasetGear);
      const uncategorized = await repo.find({
        where: { category: IsNull() },
      });

      if (uncategorized.length === 0) {
        return;
      }

      let updated = 0;

      for (const gear of uncategorized) {
        const { category } = classifyGearName(gear.name);
        await repo.update(gear.id, { category });
        updated++;
      }

      logger.info(
        { updated, total: uncategorized.length },
        'gear categories backfilled',
      );
    } catch (err) {
      logger.error({ err }, 'failed to backfill gear categories');
    }
  },
};

export default cron;
