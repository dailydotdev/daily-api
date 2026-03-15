import { publishQuestRotationUpdate, rotateQuestPeriod } from '../common/quest';
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

    await publishQuestRotationUpdate({
      logger,
      type: QuestType.Weekly,
      periodStart: result.periodStart,
      periodEnd: result.periodEnd,
      updatedAt: new Date(),
    });

    logger.info(result, 'Rotated weekly quests');
  },
};

export default cron;
