import { Storage } from '@google-cloud/storage';
import { OpportunityState } from '@dailydotdev/schema';
import type { TypedWorker } from '../worker';
import { OpportunityJob } from '../../entity/opportunities/OpportunityJob';
import {
  parseOpportunityWithBrokkr,
  createOpportunityFromParsedData,
} from '../../common/opportunity/parse';
import { updateFlagsStatement } from '../../common';
import { deleteBlobFromGCS } from '../../common/googleCloud';
import z from 'zod';
import { performance } from 'perf_hooks';

export const parseOpportunityWorker: TypedWorker<'api.v1.opportunity-parse'> = {
  subscription: 'api.opportunity-parse',
  handler: async ({ data }, con, logger) => {
    const startMs = performance.now();
    const { opportunityId } = data;

    // Fetch opportunity early to extract file data for cleanup
    const opportunity = await con.getRepository(OpportunityJob).findOne({
      where: { id: opportunityId },
    });

    // Extract file data for cleanup in finally block
    const fileData = opportunity?.flags?.file;

    try {
      if (!opportunity) {
        return;
      }

      if (opportunity.state !== OpportunityState.PARSING) {
        return;
      }

      // Clear any previous parseError before processing
      await con
        .getRepository(OpportunityJob)
        .update(
          { id: opportunityId },
          { flags: updateFlagsStatement<OpportunityJob>({ parseError: null }) },
        );

      if (!fileData) {
        await con.getRepository(OpportunityJob).update(
          { id: opportunityId },
          {
            state: OpportunityState.ERROR,
            flags: updateFlagsStatement<OpportunityJob>({
              parseError: 'Missing file data',
            }),
          },
        );

        return;
      }

      const { blobName, bucketName, mimeType, extension, userId, trackingId } =
        fileData;
      const storage = new Storage();
      const [buffer] = await storage
        .bucket(bucketName)
        .file(blobName)
        .download();

      logger.info(
        { opportunityId, durationMs: performance.now() - startMs },
        'parseOpportunity worker: GCS download completed',
      );

      const parsedData = await parseOpportunityWithBrokkr({
        buffer,
        mime: mimeType,
        extension,
        opportunityId,
      });

      logger.info(
        { opportunityId, durationMs: performance.now() - startMs },
        'parseOpportunity worker: Brokkr parsing completed',
      );

      await createOpportunityFromParsedData(
        { con, userId, trackingId, log: logger },
        parsedData,
        opportunityId,
      );

      logger.info(
        { opportunityId, durationMs: performance.now() - startMs },
        'parseOpportunity worker: opportunity saved to DB',
      );

      await con
        .getRepository(OpportunityJob)
        .update(
          { id: opportunityId },
          { flags: updateFlagsStatement<OpportunityJob>({ file: null }) },
        );

      logger.info(
        { opportunityId, durationMs: performance.now() - startMs },
        'parseOpportunity worker: completed',
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      await con.getRepository(OpportunityJob).update(
        { id: opportunityId },
        {
          state: OpportunityState.ERROR,
          flags: updateFlagsStatement<OpportunityJob>({
            parseError:
              error instanceof z.ZodError
                ? z.prettifyError(error)
                : errorMessage,
          }),
        },
      );

      logger.error(
        { opportunityId, error, durationMs: performance.now() - startMs },
        'parseOpportunity worker: failed',
      );
    } finally {
      // Clean up GCS file if it exists (regardless of success/failure/early return)
      if (fileData?.blobName && fileData?.bucketName) {
        await deleteBlobFromGCS({
          blobName: fileData.blobName,
          bucketName: fileData.bucketName,
          logger,
        });
      }
    }
  },
};
