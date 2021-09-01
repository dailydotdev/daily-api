import { DeepPartial } from 'typeorm';
import { User, View } from '../entity';
import { messageToJson, Worker } from './worker';
import flagsmith from '../flagsmith';

const worker: Worker = {
  subscription: 'check-devcard-eligibility',
  handler: async (message, con, logger): Promise<void> => {
    const data: DeepPartial<View> = messageToJson(message);
    try {
      const user = await con.getRepository(User).findOne(data.userId);
      if (user && !user.devcardEligible) {
        const flags = await flagsmith.getFlagsForUser(user.id);
        const devcardLimitFeature = flags['feat_limit_dev_card'];
        if (devcardLimitFeature?.enabled && devcardLimitFeature?.value) {
          const views = await con
            .getRepository(View)
            .count({ where: { userId: user.id } });
          if (views >= devcardLimitFeature.value) {
            await con
              .getRepository(User)
              .update(user.id, { devcardEligible: true });
          }
        }
      }
    } catch (err) {
      logger.error(
        {
          view: data,
          messageId: message.messageId,
          err,
        },
        'failed to check devcard eligibility',
      );
      throw err;
    }
  },
};

export default worker;
