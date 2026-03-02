import { rotateQuestPeriod } from '../common/quest';
import { QuestType } from '../entity/Quest';
import { Cron } from './cron';

const cron: Cron = {
  name: 'rotate-daily-quests',
  handler: async (con, logger) => {
    const result = await rotateQuestPeriod({
      con,
      logger,
      type: QuestType.Daily,
    });

    logger.info(result, 'Rotated daily quests');
  },
};

export default cron;
