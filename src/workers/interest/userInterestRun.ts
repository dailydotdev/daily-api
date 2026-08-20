import { Not, type DataSource } from 'typeorm';
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
import { remoteConfig } from '../../remoteConfig';
import type { InterestAgentRunState } from '../../common/interest/tools/context';

const DEFAULT_MAX_PICKS = 3;
const DEFAULT_MIN_FINDINGS_FOR_FEED_LINK = 1;
const STALE_RUNNING_RECLAIM_MINUTES = 45;
const UNIQUE_VIOLATION = '23505';

const buildRunBlocks = ({
  result,
  picks,
  deliverables,
  minFindingsForFeedLink,
}: {
  result: InterestAgentRunState;
  picks: { postId: string }[];
  deliverables: { postId: string }[];
  minFindingsForFeedLink: number;
}): InterestRunBlock[] => {
  const blocks: InterestRunBlock[] = [];
  const text = result.finalMessage ?? result.agentSummary;
  if (text) {
    blocks.push({ type: 'text', html: markdown.render(text) });
  }
  if (picks.length) {
    blocks.push({ type: 'picks', postIds: picks.map(({ postId }) => postId) });
  }
  if (
    deliverables.length > 0 &&
    deliverables.length >= minFindingsForFeedLink
  ) {
    blocks.push({
      type: 'feedLink',
      label: `Open all ${deliverables.length} findings`,
      count: deliverables.length,
      postIds: deliverables.map(({ postId }) => postId),
    });
  }
  return blocks;
};

export const failStaleRunning = ({
  con,
  interestId,
}: {
  con: DataSource;
  interestId: string;
}) =>
  con
    .getRepository(InterestRun)
    .createQueryBuilder()
    .update(InterestRun)
    .set({ status: InterestRunStatus.Failed, finishedAt: () => 'now()' })
    .where('"interestId" = :interestId AND status = :running', {
      interestId,
      running: InterestRunStatus.Running,
    })
    .andWhere(`"startedAt" < now() - make_interval(mins => :staleMinutes)`, {
      staleMinutes: STALE_RUNNING_RECLAIM_MINUTES,
    })
    .execute();

const claimRun = async ({
  con,
  runId,
  interestId,
  startedAt,
}: {
  con: DataSource;
  runId: string;
  interestId: string;
  startedAt: Date;
}): Promise<'claimed' | 'busy' | 'unavailable'> => {
  await failStaleRunning({ con, interestId });

  try {
    const result = await con
      .getRepository(InterestRun)
      .createQueryBuilder()
      .update(InterestRun)
      .set({ status: InterestRunStatus.Running, startedAt })
      .where('id = :runId AND "interestId" = :interestId', {
        runId,
        interestId,
      })
      .andWhere('status IN (:...claimable)', {
        claimable: [InterestRunStatus.Queued, InterestRunStatus.Failed],
      })
      .execute();

    return (result.affected ?? 0) > 0 ? 'claimed' : 'unavailable';
  } catch (error) {
    if ((error as { code?: string })?.code === UNIQUE_VIOLATION) {
      return 'busy';
    }
    throw error;
  }
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
            {
              id: runId,
              interestId,
              status: Not(InterestRunStatus.Completed),
            },
            { status: InterestRunStatus.Failed, finishedAt: new Date() },
          );
        }
        return;
      }

      const runAt = Date.now();
      const lease = new Date(runAt);
      let claimedRunId = runId;
      if (claimedRunId) {
        const claim = await claimRun({
          con,
          runId: claimedRunId,
          interestId,
          startedAt: lease,
        });
        if (claim === 'unavailable') {
          const run = await runRepo.findOneBy({
            id: claimedRunId,
            interestId,
          });
          const runHasContent =
            !!run && (run.findingsAdded > 0 || !!run.summaryPostId);

          if (
            run?.status === InterestRunStatus.Completed &&
            !run.notifiedAt &&
            runHasContent &&
            (interest.outputModes?.notification ?? true)
          ) {
            await triggerTypedEvent(
              logger,
              'api.v1.interest-content-available',
              {
                interestId,
                userId: interest.userId,
                count: run.findingsAdded,
                runAt: (run.startedAt ?? run.createdAt).getTime(),
              },
            );
            await runRepo.update(
              { id: claimedRunId, interestId },
              { notifiedAt: new Date() },
            );
          }
          return;
        }
        if (claim === 'busy') {
          throw new Error(
            'another run for this interest is active, retrying later',
          );
        }
      } else {
        claimedRunId = await generateShortId();
        try {
          await runRepo.insert({
            id: claimedRunId,
            interestId,
            status: InterestRunStatus.Running,
            trigger: InterestRunTrigger.Scheduled,
            startedAt: lease,
          });
        } catch (error) {
          if ((error as { code?: string })?.code === UNIQUE_VIOLATION) {
            throw new Error(
              'another run for this interest is active, retrying later',
            );
          }
          throw error;
        }
      }

      const leasedRun = {
        id: claimedRunId,
        interestId,
        status: InterestRunStatus.Running,
        startedAt: lease,
      };

      try {
        await con
          .getRepository(UserInterest)
          .update(
            { id: interest.id },
            { lastRunStatus: InterestRunStatus.Running },
          );

        const result: InterestAgentRunState = await runInterestAgent({
          con,
          logger,
          interest,
        });

        const maxPicks =
          remoteConfig.vars.interestAgentMaxPicksPerRun ?? DEFAULT_MAX_PICKS;
        const deliverables = await whereFindingDeliverable(
          con
            .getRepository(InterestFinding)
            .createQueryBuilder('f')
            .where('f."interestId" = :interestId', {
              interestId: interest.id,
            })
            .andWhere('f.status = :status', {
              status: InterestFindingStatus.New,
            }),
          'f',
        )
          .select('f."postId"', 'postId')
          .orderBy('f.score', 'DESC')
          .getRawMany<{ postId: string }>();
        const deliverableCount = deliverables.length;
        const picks = deliverables.slice(0, maxPicks);

        const hasContent = deliverableCount > 0 || !!result.summaryPostId;
        const shouldNotify =
          hasContent && (interest.outputModes?.notification ?? true);

        const leaseHeld = await con.transaction(async (manager) => {
          const completed = await manager
            .getRepository(InterestRun)
            .update(leasedRun, {
              status: InterestRunStatus.Completed,
              finishedAt: new Date(),
              blocks: buildRunBlocks({
                result,
                picks,
                deliverables,
                minFindingsForFeedLink:
                  remoteConfig.vars.interestAgentMinFindingsForFeedLink ??
                  DEFAULT_MIN_FINDINGS_FOR_FEED_LINK,
              }),
              findingsAdded: deliverableCount,
              summaryPostId: result.summaryPostId,
              notifiedAt: shouldNotify ? null : new Date(),
            });

          if (!completed.affected) {
            return false;
          }

          await manager
            .getRepository(InterestFinding)
            .update(
              { interestId: interest.id, status: InterestFindingStatus.New },
              { status: InterestFindingStatus.Surfaced },
            );

          await manager.getRepository(UserInterest).update(
            { id: interest.id },
            {
              lastRunAt: new Date(runAt),
              lastRunSummary: result.agentSummary ?? interest.lastRunSummary,
              lastRunStatus: InterestRunStatus.Completed,
              lastRunFindings: deliverableCount,
            },
          );

          return true;
        });

        if (!leaseHeld) {
          logger.warn(
            { interestId, runId: claimedRunId },
            'interest run lease lost before completion',
          );
          return;
        }

        if (shouldNotify) {
          await triggerTypedEvent(logger, 'api.v1.interest-content-available', {
            interestId: interest.id,
            userId: interest.userId,
            count: deliverableCount,
            runAt,
          });
          await runRepo.update(
            { id: claimedRunId, interestId },
            { notifiedAt: new Date() },
          );
        }
      } catch (error) {
        const failed = await runRepo.update(leasedRun, {
          status: InterestRunStatus.Failed,
          finishedAt: new Date(),
        });
        if (failed.affected) {
          await con
            .getRepository(UserInterest)
            .update(
              { id: interest.id },
              { lastRunStatus: InterestRunStatus.Failed },
            );
        }
        throw error;
      }
    },
  };
