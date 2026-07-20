import type { TypedWorker } from '../worker';
import { UserInterest, UserInterestStatus } from '../../entity/UserInterest';
import { runInterestAgent } from '../../common/interest/runInterestAgent';
import { triggerTypedEvent } from '../../common/typedPubsub';

export const userInterestRunWorker: TypedWorker<'api.v1.interest-run-requested'> =
  {
    subscription: 'api.user-interest-run',
    handler: async (message, con, logger): Promise<void> => {
      const { interestId } = message.data;

      const interest = await con.getRepository(UserInterest).findOne({
        where: { id: interestId },
      });

      if (!interest || interest.status !== UserInterestStatus.Active) {
        return;
      }

      const result = await runInterestAgent({ con, logger, interest });

      await con.getRepository(UserInterest).update(
        { id: interest.id },
        {
          lastRunAt: new Date(),
          lastRunSummary: result.summary,
        },
      );

      if (result.notifyRequested && result.summaryPostId) {
        await triggerTypedEvent(logger, 'api.v1.interest-content-available', {
          interestId: interest.id,
          postId: result.summaryPostId,
          userId: interest.userId,
        });
      }
    },
  };
