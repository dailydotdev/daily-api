import { Cron } from './cron';
import { UserInterest, UserInterestStatus } from '../entity/UserInterest';
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

    for (const { id } of interests) {
      await triggerTypedEvent(logger, 'api.v1.interest-run-requested', {
        interestId: id,
      });
    }
  },
};

export default cron;
