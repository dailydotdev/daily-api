import { Cron } from './cron';
import { Organization } from '../entity/Organization';
import { SubscriptionStatus } from '../common/plus/subscription';
import { OpportunityJob } from '../entity/opportunities/OpportunityJob';
import { OpportunityState } from '@dailydotdev/schema';
import { In } from 'typeorm';
import { OpportunityUserRecruiter } from '../entity/opportunities/user/OpportunityUserRecruiter';
import { Alerts } from '../entity/Alerts';
import { opportunityMatchBatchSize } from '../types';
import { queryReadReplica } from '../common/queryReadReplica';

const cron: Cron = {
  name: 'expire-super-agent-trial',
  handler: async (con, logger) => {
    logger.debug('Checking for expired Super Agent trials...');

    const now = new Date();

    // Find organizations with expired trials using the index
    const expiredOrgs = await queryReadReplica(con, ({ queryRunner }) =>
      queryRunner.manager
        .getRepository(Organization)
        .createQueryBuilder('org')
        .where(`org."recruiterSubscriptionFlags"->>'isTrialActive' = 'true'`)
        .andWhere(
          `(org."recruiterSubscriptionFlags"->>'trialExpiresAt')::timestamptz < :now`,
          { now },
        )
        .getMany(),
    );

    if (expiredOrgs.length === 0) {
      logger.info('No expired Super Agent trials found');
      return;
    }

    const expiredOrgIds = expiredOrgs.map((org) => org.id);

    // Find trial opportunity IDs for expired orgs (read-only query before transaction)
    const trialOpportunities = await queryReadReplica(con, ({ queryRunner }) =>
      queryRunner.manager
        .getRepository(OpportunityJob)
        .createQueryBuilder('op')
        .select('op.id')
        .where({ organizationId: In(expiredOrgIds) })
        .andWhere(`(op.flags->>'isTrial')::boolean = true`)
        .getMany(),
    );

    const trialOpportunityIds = trialOpportunities.map((op) => op.id);

    // Find recruiter user IDs for these trial opportunities (read-only query before transaction)
    let recruiterUserIds: string[] = [];
    if (trialOpportunityIds.length > 0) {
      const recruiters = await queryReadReplica(con, ({ queryRunner }) =>
        queryRunner.manager
          .getRepository(OpportunityUserRecruiter)
          .createQueryBuilder('ou')
          .select('DISTINCT ou."userId"', 'userId')
          .where({ opportunityId: In(trialOpportunityIds) })
          .getRawMany<{ userId: string }>(),
      );
      recruiterUserIds = recruiters.map((r) => r.userId);
    }

    // Perform all writes in a single transaction
    const { downgradedOpportunitiesCount, clearedAlertsCount } =
      await con.transaction(async (manager) => {
        let downgraded = 0;
        let cleared = 0;

        // Clear showSuperAgentTrialUpgrade alerts for recruiters
        if (recruiterUserIds.length > 0) {
          const alertResult = await manager
            .getRepository(Alerts)
            .createQueryBuilder()
            .update(Alerts)
            .set({ showSuperAgentTrialUpgrade: false })
            .where({ userId: In(recruiterUserIds) })
            .andWhere({ showSuperAgentTrialUpgrade: true })
            .execute();
          cleared = alertResult.affected ?? 0;
        }

        // Remove trial features from opportunities (keep them open - user paid for the seat)
        // and reset batchSize to default
        if (trialOpportunityIds.length > 0) {
          // Hard-code trial feature keys to remove using PostgreSQL JSONB removal operator
          const result = await manager
            .getRepository(OpportunityJob)
            .createQueryBuilder()
            .update(OpportunityJob)
            .set({
              flags: () =>
                `flags - 'isTrial' - 'reminders' - 'showSlack' - 'showFeedback' || '{"batchSize": ${opportunityMatchBatchSize}}'`,
            })
            .where({ id: In(trialOpportunityIds) })
            .andWhere({
              state: In([OpportunityState.LIVE, OpportunityState.IN_REVIEW]),
            })
            .execute();
          downgraded = result.affected ?? 0;
        }

        // Update organization flags
        for (const org of expiredOrgs) {
          const flags = org.recruiterSubscriptionFlags || {};
          const originalPlan = flags.trialPlan;

          // Use null to remove JSONB keys (undefined won't be sent to PostgreSQL)
          const updatedFlags = {
            ...flags,
            isTrialActive: false,
            trialExpiresAt: null,
            trialPlan: null,
            status: originalPlan ? flags.status : SubscriptionStatus.None,
          };

          await manager.getRepository(Organization).update(org.id, {
            recruiterSubscriptionFlags: updatedFlags,
          });

          logger.info(
            { organizationId: org.id, hadOriginalPlan: !!originalPlan },
            'Super Agent trial expired, downgraded',
          );
        }

        return {
          downgradedOpportunitiesCount: downgraded,
          clearedAlertsCount: cleared,
        };
      });

    logger.info(
      {
        orgCount: expiredOrgs.length,
        downgradedOpportunitiesCount,
        clearedAlertsCount,
      },
      'Super Agent trial expiration complete',
    );
  },
};

export default cron;
