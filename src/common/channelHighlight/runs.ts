import {
  IsNull,
  LessThan,
  Not,
  type EntityManager,
  type Repository,
} from 'typeorm';
import { ChannelHighlightRun } from '../../entity/ChannelHighlightRun';
import { GLOBAL_HIGHLIGHT_CHANNEL } from './constants';
import type {
  CanonicalHighlights,
  CanonicalInput,
  GenerationConfig,
} from './canonical';
import type { LegacyFanout } from './legacyFanout';
import { getEvaluationHistoryStart } from './queries';
import { toStoredSnapshotItem } from './stories';

export const fetchPreviousGlobalRun = ({
  runRepo,
  now,
}: {
  runRepo: Repository<ChannelHighlightRun>;
  now: Date;
}): Promise<ChannelHighlightRun | null> =>
  runRepo.findOne({
    where: {
      channel: GLOBAL_HIGHLIGHT_CHANNEL,
      status: 'completed',
      completedAt: Not(IsNull()),
      scheduledAt: LessThan(now),
    },
    order: {
      scheduledAt: 'DESC',
    },
  });

export const createGlobalRun = ({
  runRepo,
  now,
}: {
  runRepo: Repository<ChannelHighlightRun>;
  now: Date;
}): Promise<ChannelHighlightRun> =>
  runRepo.save(
    runRepo.create({
      channel: GLOBAL_HIGHLIGHT_CHANNEL,
      scheduledAt: now,
      status: 'processing',
      baselineSnapshot: [],
      inputSummary: {},
      internalSnapshot: [],
      comparison: {},
      metrics: {},
    }),
  );

export const completeGlobalRun = async ({
  manager,
  run,
  config,
  input,
  canonical,
  legacyFanout,
  now,
}: {
  manager: EntityManager;
  run: ChannelHighlightRun;
  config: GenerationConfig;
  input: CanonicalInput;
  canonical: CanonicalHighlights;
  legacyFanout: LegacyFanout;
  now: Date;
}): Promise<void> => {
  await manager.getRepository(ChannelHighlightRun).update(
    { id: run.id },
    {
      status: 'completed',
      completedAt: new Date(),
      baselineSnapshot: canonical.history.map(toStoredSnapshotItem),
      inputSummary: {
        fetchStart: config.fetchStart.toISOString(),
        horizonStart: config.horizonStart.toISOString(),
        evaluationHistoryStart: getEvaluationHistoryStart({
          now,
        }).toISOString(),
        excludedSourceIds: input.excludedSourceIds,
        candidatePostIds: canonical.newCandidates.map(
          (candidate) => candidate.postId,
        ),
        admittedPostIds: canonical.admitted.map((item) => item.postId),
        projectedChannels: [...legacyFanout.publishChannels],
      },
      internalSnapshot: canonical.snapshot.map(toStoredSnapshotItem),
      comparison: {
        ...canonical.comparison,
        wouldPublish: canonical.comparison.changed,
        published: canonical.admitted.length > 0,
      },
      metrics: {
        fetchedPosts: input.incrementalPosts.length,
        relationPosts: input.relationPosts.length,
        evaluationHighlights: canonical.history.length,
        newCandidates: canonical.newCandidates.length,
        admittedHighlights: canonical.admitted.length,
        projectedChannels: legacyFanout.publishChannels.size,
        projectedHighlights: legacyFanout.states.reduce(
          (total, state) => total + state.highlights.length,
          0,
        ),
      },
    },
  );
};

export const failGlobalRun = ({
  runRepo,
  run,
  err,
}: {
  runRepo: Repository<ChannelHighlightRun>;
  run: ChannelHighlightRun;
  err: unknown;
}): Promise<unknown> =>
  runRepo.update(
    {
      id: run.id,
    },
    {
      status: 'failed',
      completedAt: new Date(),
      error: {
        message: err instanceof Error ? err.message : 'Unknown error',
      },
    },
  );
