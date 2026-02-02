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
import { buildOpportunityPreviewPayload } from '../../common/opportunity/preview';
import { getGondulOpportunityServiceClient } from '../../common/gondul';
import { OpportunityPreviewStatus } from '../../common/opportunity/types';

export const parseOpportunityWorker: TypedWorker<'api.v1.opportunity-parse'> = {
  subscription: 'api.opportunity-parse',
  handler: async ({ data }, con, logger) => {
    const startMs = performance.now();
    const { opportunityId } = data;
    let hasError = false;

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

      // Auto-trigger preview for machine-sourced opportunities
      if (opportunity.flags?.source === 'machine') {
        try {
          // Refetch opportunity with updated data after parsing
          const updatedOpportunity = await con
            .getRepository(OpportunityJob)
            .findOneOrFail({ where: { id: opportunityId } });

          const opportunityMessage = await buildOpportunityPreviewPayload({
            opportunity: updatedOpportunity,
            con,
          });

          const gondulClient = getGondulOpportunityServiceClient();
          await gondulClient.garmr.execute(() => {
            return gondulClient.instance.preview(opportunityMessage);
          });

          await con.getRepository(OpportunityJob).update(
            { id: opportunityId },
            {
              flags: updateFlagsStatement<OpportunityJob>({
                preview: {
                  userIds: [],
                  totalCount: 0,
                  status: OpportunityPreviewStatus.PENDING,
                },
              }),
            },
          );

          logger.info(
            { opportunityId, durationMs: performance.now() - startMs },
            'parseOpportunity worker: auto-preview triggered',
          );
        } catch (previewError) {
          // Log but don't fail the worker if preview fails
          logger.error(
            {
              opportunityId,
              previewError,
              durationMs: performance.now() - startMs,
            },
            'parseOpportunity worker: auto-preview failed',
          );
        }
      }
    } catch (error) {
      hasError = true;

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      await con
        .getRepository(OpportunityJob)
        .createQueryBuilder()
        .update({
          state: OpportunityState.ERROR,
          flags: () => `flags || :flagsJson`,
        })
        .where({ id: opportunityId })
        .setParameter(
          'flagsJson',
          JSON.stringify({
            parseError:
              error instanceof z.ZodError
                ? z.prettifyError(error)
                : errorMessage,
          }),
        )
        .execute();

      logger.error(
        { opportunityId, error, durationMs: performance.now() - startMs },
        'parseOpportunity worker: failed',
      );
    } finally {
      // Clean up GCS file if it exists (regardless of success/failure/early return)
      if (!hasError && fileData?.blobName && fileData?.bucketName) {
        await deleteBlobFromGCS({
          blobName: fileData.blobName,
          bucketName: fileData.bucketName,
          logger,
        });
      }
    }
  },
};
