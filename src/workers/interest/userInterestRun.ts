import type { TypedWorker } from '../worker';
import { UserInterest, UserInterestStatus } from '../../entity/UserInterest';
import {
  InterestFinding,
  InterestFindingStatus,
} from '../../entity/InterestFinding';
import { runInterestAgent } from '../../common/interest/runInterestAgent';
import { whereFindingDeliverable } from '../../common/interest/exclusions';
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

      const runAt = Date.now();
      const result = await runInterestAgent({ con, logger, interest });

      await con.getRepository(UserInterest).update(
        { id: interest.id },
        {
          lastRunAt: new Date(runAt),
          lastRunSummary: result.agentSummary ?? interest.lastRunSummary,
        },
      );

      const deliverableCount = await whereFindingDeliverable(
        con
          .getRepository(InterestFinding)
          .createQueryBuilder('f')
          .where('f."interestId" = :interestId', { interestId: interest.id })
          .andWhere('f.status = :status', {
            status: InterestFindingStatus.New,
          }),
        'f',
      ).getCount();

      await con
        .getRepository(InterestFinding)
        .update(
          { interestId: interest.id, status: InterestFindingStatus.New },
          { status: InterestFindingStatus.Surfaced },
        );

      const hasContent = deliverableCount > 0 || !!result.summaryPostId;

      if (hasContent && (interest.outputModes?.notification ?? true)) {
        await triggerTypedEvent(logger, 'api.v1.interest-content-available', {
          interestId: interest.id,
          userId: interest.userId,
          count: deliverableCount,
          runAt,
        });
      }
    },
  };
