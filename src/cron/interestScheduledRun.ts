import { Cron } from './cron';
import { UserInterest, UserInterestStatus } from '../entity/UserInterest';
import {
  InterestRun,
  InterestRunStatus,
  InterestRunTrigger,
} from '../entity/InterestRun';
import { triggerTypedEvent } from '../common/typedPubsub';
import { queryReadReplica } from '../common/queryReadReplica';

const cron: Cron = {
  name: 'interest-scheduled-run',
  handler: async (con, logger) => {
    const interests = await queryReadReplica(con, ({ queryRunner }) =>
      queryRunner.manager
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
        .getRawMany<{ id: string }>(),
    );

    const hourBucket = new Date().toISOString().slice(0, 13);

    for (const { id } of interests) {
      const runId = `sched-${id}-${hourBucket}`;
      await con
        .getRepository(InterestRun)
        .createQueryBuilder()
        .insert()
        .values({
          id: runId,
          interestId: id,
          status: InterestRunStatus.Queued,
          trigger: InterestRunTrigger.Scheduled,
        })
        .orIgnore()
        .execute();
      await triggerTypedEvent(logger, 'api.v1.interest-run-requested', {
        interestId: id,
        runId,
      });
    }
  },
};

export default cron;
