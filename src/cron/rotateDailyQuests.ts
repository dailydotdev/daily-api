import { publishQuestRotationUpdate, rotateQuestPeriod } from '../common/quest';
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

    await publishQuestRotationUpdate({
      logger,
      type: QuestType.Daily,
      periodStart: result.periodStart,
      periodEnd: result.periodEnd,
      updatedAt: new Date(),
    });

    logger.info(result, 'Rotated daily quests');
  },
};

export default cron;
