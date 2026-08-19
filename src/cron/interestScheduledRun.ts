import { Cron } from './cron';
import { UserInterest, UserInterestStatus } from '../entity/UserInterest';
import {
  InterestRun,
  InterestRunStatus,
  InterestRunTrigger,
} from '../entity/InterestRun';
import { triggerTypedEvent } from '../common/typedPubsub';
import { queryReadReplica } from '../common/queryReadReplica';
import { generateShortId } from '../ids';

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

    const runRepo = con.getRepository(InterestRun);

    for (const { id } of interests) {
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

      const queued = await runRepo.findOne({
        select: ['id'],
        where: {
          interestId: id,
          status: InterestRunStatus.Queued,
          trigger: InterestRunTrigger.Scheduled,
        },
      });

      if (!queued) {
        continue;
      }

      await triggerTypedEvent(logger, 'api.v1.interest-run-requested', {
        interestId: id,
        runId: queued.id,
      });
    }
  },
};

export default cron;
