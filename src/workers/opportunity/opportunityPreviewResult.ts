import { TypedWorker } from '../worker';
import { OpportunityPreviewResult } from '@dailydotdev/schema';
import { OpportunityJob } from '../../entity/opportunities/OpportunityJob';
import { updateFlagsStatement } from '../../common/utils';
import { OpportunityPreviewStatus } from '../../common/opportunity/types';

export const opportunityPreviewResultWorker: TypedWorker<'gondul.v1.opportunity-preview-results'> =
  {
    subscription: 'api.opportunity-preview-result',
    handler: async ({ data }, con): Promise<void> => {
      const { opportunityId, userIds, totalCount } = data;

      if (!opportunityId) {
        throw new Error('Missing opportunityId in opportunity preview result');
      }

      await con.getRepository(OpportunityJob).update(
        {
          id: opportunityId,
        },
        {
          flags: updateFlagsStatement<OpportunityJob>({
            preview: {
              userIds,
              totalCount,
              status: OpportunityPreviewStatus.READY,
            },
          }),
        },
      );
    },
    parseMessage: (message) =>
      OpportunityPreviewResult.fromBinary(message.data),
  };
