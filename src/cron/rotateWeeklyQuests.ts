import { rotateQuestPeriod } from '../common/quest';
import { QuestType } from '../entity/Quest';
import { Cron } from './cron';

const cron: Cron = {
  name: 'rotate-weekly-quests',
  handler: async (con, logger) => {
    const result = await rotateQuestPeriod({
      con,
      logger,
      type: QuestType.Weekly,
    });

    logger.info(result, 'Rotated weekly quests');
  },
};

export default cron;
