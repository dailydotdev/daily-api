import { TypedWorker } from '../worker';
import { OpportunityMatch } from '../../entity/OpportunityMatch';
import { OpportunityMatchStatus } from '../../entity/opportunities/types';
import { Opportunity } from '../../entity/opportunities/Opportunity';
import { cio, identifyUserOpportunities } from '../../cio';

export const syncOpportunityRemindersCio: TypedWorker<'api.v1.opportunity-reminders-change'> =
  {
    subscription: 'sync-opportunity-reminders-cio',
    handler: async ({ data }, con, log): Promise<void> => {
      const { opportunityId, before, after } = data;

      if (!opportunityId) {
        throw new Error(
          'Missing opportunityId in opportunity flags change event',
        );
      }

      // Parse before and after flags to check if reminders changed
      const beforeFlags = before
        ? (JSON.parse(before) as Opportunity['flags'])
        : null;
      const afterFlags = after
        ? (JSON.parse(after) as Opportunity['flags'])
        : null;

      const remindersChanged = beforeFlags?.reminders !== afterFlags?.reminders;

      if (!remindersChanged) {
        log.info(
          { opportunityId },
          'Reminders flag did not change, skipping CIO sync',
        );
        return;
      }

      log.info(
        {
          opportunityId,
          beforeReminders: beforeFlags?.reminders,
          afterReminders: afterFlags?.reminders,
        },
        'Reminders flag changed, syncing CIO',
      );

      // Get all users who have pending matches for this opportunity
      const matches = await con.getRepository(OpportunityMatch).find({
        where: {
          opportunityId,
          status: OpportunityMatchStatus.Pending,
        },
        select: ['userId'],
      });

      if (matches.length === 0) {
        log.info({ opportunityId }, 'No pending matches found for opportunity');
        return;
      }

      // Update CIO for each affected user
      // identifyUserOpportunities will sync all opportunities with reminders enabled
      const uniqueUserIds = [...new Set(matches.map((m) => m.userId))];

      log.info(
        { opportunityId, userCount: uniqueUserIds.length },
        'Syncing opportunity reminders for users in CIO',
      );

      await Promise.all(
        uniqueUserIds.map((userId) =>
          identifyUserOpportunities({
            con,
            cio,
            userId,
          }),
        ),
      );

      log.info(
        { opportunityId, userCount: uniqueUserIds.length },
        'Successfully synced opportunity reminders in CIO',
      );
    },
  };
