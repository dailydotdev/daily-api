import { TypedWorker } from '../worker';
import { OpportunityPreviewResult } from '@dailydotdev/schema';
import { OpportunityJob } from '../../entity/opportunities/OpportunityJob';
import { updateFlagsStatement } from '../../common/utils';
import { OpportunityPreviewStatus } from '../../common/opportunity/types';
import { validateGondulOpportunityMessage } from '../../common/schema/opportunities';

export const opportunityPreviewResultWorker: TypedWorker<'gondul.v1.opportunity-preview-results'> =
  {
    subscription: 'api.opportunity-preview-result',
    handler: async ({ data }, con): Promise<void> => {
      const { opportunityId, userIds, totalCount, previewType } = data;

      if (!opportunityId) {
        throw new Error('Missing opportunityId in opportunity preview result');
      }

      if (!validateGondulOpportunityMessage(data)) {
        return;
      }

      await con.getRepository(OpportunityJob).update(
        {
          id: opportunityId,
        },
        {
          flags: updateFlagsStatement<OpportunityJob>({
            preview: {
              userIds: userIds.slice(0, 20),
              totalCount,
              status: OpportunityPreviewStatus.READY,
              type: previewType,
            },
          }),
        },
      );
    },
    parseMessage: (message) =>
      OpportunityPreviewResult.fromBinary(message.data),
  };
