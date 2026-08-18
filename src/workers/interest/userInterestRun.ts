import type { TypedWorker } from '../worker';
import { UserInterest, UserInterestStatus } from '../../entity/UserInterest';
import {
  InterestFinding,
  InterestFindingStatus,
} from '../../entity/InterestFinding';
import {
  InterestRun,
  InterestRunStatus,
  InterestRunTrigger,
  type InterestRunBlock,
} from '../../entity/InterestRun';
import { runInterestAgent } from '../../common/interest/runInterestAgent';
import { whereFindingDeliverable } from '../../common/interest/exclusions';
import { triggerTypedEvent } from '../../common/typedPubsub';
import { markdown } from '../../common/markdown';
import { generateShortId } from '../../ids';
import type { InterestAgentRunState } from '../../common/interest/tools/context';

const MAX_PICKS = 3;

const buildRunBlocks = ({
  result,
  picks,
  deliverableCount,
}: {
  result: InterestAgentRunState;
  picks: { postId: string }[];
  deliverableCount: number;
}): InterestRunBlock[] => {
  const blocks: InterestRunBlock[] = [];
  const text = result.finalMessage ?? result.agentSummary;
  if (text) {
    blocks.push({ type: 'text', html: markdown.render(text) });
  }
  if (picks.length) {
    blocks.push({ type: 'picks', postIds: picks.map(({ postId }) => postId) });
  }
  if (deliverableCount > picks.length) {
    blocks.push({
      type: 'feedLink',
      label: `Open all ${deliverableCount} findings`,
      count: deliverableCount,
    });
  }
  return blocks;
};

export const userInterestRunWorker: TypedWorker<'api.v1.interest-run-requested'> =
  {
    subscription: 'api.user-interest-run',
    handler: async (message, con, logger): Promise<void> => {
      const { interestId, runId } = message.data;

      const interest = await con.getRepository(UserInterest).findOne({
        where: { id: interestId },
      });
      const runRepo = con.getRepository(InterestRun);

      if (!interest || interest.status !== UserInterestStatus.Active) {
        if (runId) {
          await runRepo.update(
            { id: runId },
            { status: InterestRunStatus.Failed, finishedAt: new Date() },
          );
        }
        return;
      }

      let run = runId ? await runRepo.findOneBy({ id: runId }) : null;
      if (!run) {
        run = await runRepo.save({
          id: await generateShortId(),
          interestId,
          status: InterestRunStatus.Queued,
          trigger: InterestRunTrigger.Scheduled,
        });
      }

      const runAt = Date.now();
      await Promise.all([
        runRepo.update(
          { id: run.id },
          { status: InterestRunStatus.Running, startedAt: new Date(runAt) },
        ),
        con
          .getRepository(UserInterest)
          .update(
            { id: interest.id },
            { lastRunStatus: InterestRunStatus.Running },
          ),
      ]);

      let result: InterestAgentRunState;
      try {
        result = await runInterestAgent({ con, logger, interest });
      } catch (error) {
        await Promise.all([
          runRepo.update(
            { id: run.id },
            { status: InterestRunStatus.Failed, finishedAt: new Date() },
          ),
          con
            .getRepository(UserInterest)
            .update(
              { id: interest.id },
              { lastRunStatus: InterestRunStatus.Failed },
            ),
        ]);
        throw error;
      }

      const deliverableBuilder = () =>
        whereFindingDeliverable(
          con
            .getRepository(InterestFinding)
            .createQueryBuilder('f')
            .where('f."interestId" = :interestId', { interestId: interest.id })
            .andWhere('f.status = :status', {
              status: InterestFindingStatus.New,
            }),
          'f',
        );

      const [deliverableCount, picks] = await Promise.all([
        deliverableBuilder().getCount(),
        deliverableBuilder()
          .select('f."postId"', 'postId')
          .orderBy('f.score', 'DESC')
          .limit(MAX_PICKS)
          .getRawMany<{ postId: string }>(),
      ]);

      await con
        .getRepository(InterestFinding)
        .update(
          { interestId: interest.id, status: InterestFindingStatus.New },
          { status: InterestFindingStatus.Surfaced },
        );

      await Promise.all([
        runRepo.update(
          { id: run.id },
          {
            status: InterestRunStatus.Completed,
            finishedAt: new Date(),
            blocks: buildRunBlocks({ result, picks, deliverableCount }),
            findingsAdded: deliverableCount,
            summaryPostId: result.summaryPostId,
          },
        ),
        con.getRepository(UserInterest).update(
          { id: interest.id },
          {
            lastRunAt: new Date(runAt),
            lastRunSummary: result.agentSummary ?? interest.lastRunSummary,
            lastRunStatus: InterestRunStatus.Completed,
            lastRunFindings: deliverableCount,
          },
        ),
      ]);

      const hasContent = deliverableCount > 0 || !!result.summaryPostId;

      if (hasContent && (interest.outputModes?.notification ?? true)) {
        await triggerTypedEvent(logger, 'api.v1.interest-content-available', {
          interestId: interest.id,
          userId: interest.userId,
          count: deliverableCount,
          runAt,
        });
      }
    },
  };
