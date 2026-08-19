import { Cron } from './cron';
import { UserInterest, UserInterestStatus } from '../entity/UserInterest';
import {
  InterestRun,
  InterestRunStatus,
  InterestRunTrigger,
} from '../entity/InterestRun';
import { failStaleRunning } from '../workers/interest/userInterestRun';
import { triggerTypedEvent } from '../common/typedPubsub';
import { generateShortId } from '../ids';

const cron: Cron = {
  name: 'interest-scheduled-run',
  handler: async (con, logger) => {
    const interests = await con
      .getRepository(UserInterest)
      .createQueryBuilder('ui')
      .select('ui.id', 'id')
      .where('ui.status = :status', { status: UserInterestStatus.Active })
      .andWhere(
        `(ui."lastRunAt" IS NULL OR ui."lastRunAt" < now() - (CASE COALESCE(ui.cadence, 'hourly')
          WHEN 'hourly' THEN interval '1 hour'
          WHEN 'weekly' THEN interval '7 days'
          ELSE interval '1 day' END))`,
      )
      .getRawMany<{ id: string }>();

    const runRepo = con.getRepository(InterestRun);

    for (const { id } of interests) {
      try {
        await failStaleRunning({ con, interestId: id });

        await runRepo
          .createQueryBuilder()
          .insert()
          .values({
            id: await generateShortId(),
            interestId: id,
            status: InterestRunStatus.Queued,
            trigger: InterestRunTrigger.Scheduled,
          })
          .orIgnore()
          .execute();

        const scheduled = await runRepo.findOne({
          select: ['id', 'status'],
          where: {
            interestId: id,
            status: InterestRunStatus.Queued,
            trigger: InterestRunTrigger.Scheduled,
          },
        });

        if (!scheduled) {
          continue;
        }

        await triggerTypedEvent(logger, 'api.v1.interest-run-requested', {
          interestId: id,
          runId: scheduled.id,
        });
      } catch (error) {
        logger.error(
          { interestId: id, err: error },
          'failed to schedule interest run',
        );
      }
    }
  },
};

export default cron;
