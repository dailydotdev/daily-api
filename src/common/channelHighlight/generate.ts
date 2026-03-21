import type { DataSource } from 'typeorm';
import { logger as baseLogger } from '../../logger';
import { ChannelHighlightRun } from '../../entity/ChannelHighlightRun';
import { ChannelHighlightState } from '../../entity/ChannelHighlightState';
import type { ChannelHighlightDefinition } from '../../entity/ChannelHighlightDefinition';
import { compareSnapshots, shouldPublish } from './decisions';
import { evaluateChannelHighlights } from './evaluate';
import { replaceHighlightsForChannel } from './publish';
import {
  fetchCurrentHighlights,
  fetchDefinitionState,
  fetchIncrementalPosts,
  fetchPostsByIds,
  fetchRelations,
  getFetchStart,
  getHorizonStart,
  mergePosts,
} from './queries';
import {
  buildCandidates,
  canonicalizeCurrentHighlights,
  toHighlightSnapshotItem,
  toStoredSnapshotItem,
} from './stories';
import type {
  GenerateChannelHighlightResult,
  HighlightSnapshotItem,
  HighlightSyncItem,
} from './types';

const sortByHighlightedAtDesc = <T extends { highlightedAt: Date }>(
  items: T[],
): T[] =>
  items
    .slice()
    .sort(
      (left, right) =>
        right.highlightedAt.getTime() - left.highlightedAt.getTime(),
    );

const trimHighlights = ({
  items,
  maxItems,
}: {
  items: HighlightSyncItem[];
  maxItems: number;
}): HighlightSyncItem[] => sortByHighlightedAtDesc(items).slice(0, maxItems);

const toInputSummary = ({
  fetchStart,
  horizonStart,
  currentHighlights,
  candidatePostIds,
}: {
  fetchStart: Date;
  horizonStart: Date;
  currentHighlights: HighlightSnapshotItem[];
  candidatePostIds: string[];
}) => ({
  fetchStart: fetchStart.toISOString(),
  horizonStart: horizonStart.toISOString(),
  currentHighlightPostIds: currentHighlights.map((item) => item.postId),
  candidatePostIds,
});

const toMetrics = ({
  fetchedPosts,
  relationPosts,
  currentHighlights,
  activeHighlights,
  canonicalizedHighlights,
  newCandidates,
  admittedHighlights,
}: {
  fetchedPosts: number;
  relationPosts: number;
  currentHighlights: number;
  activeHighlights: number;
  canonicalizedHighlights: number;
  newCandidates: number;
  admittedHighlights: number;
}) => ({
  fetchedPosts,
  relationPosts,
  currentHighlights,
  activeHighlights,
  canonicalizedHighlights,
  newCandidates,
  admittedHighlights,
});

const getTargetAudience = ({
  definition,
}: {
  definition: Pick<ChannelHighlightDefinition, 'channel' | 'targetAudience'>;
}): string =>
  definition.targetAudience.trim() ||
  `daily.dev readers following ${definition.channel}`;

// High-level flow:
// 1. Keep only currently highlighted items that are still inside the horizon.
// 2. Canonicalize those highlights to collections on the API side.
// 3. Build new canonical candidate posts from incremental post/relation fetches.
// 4. Ask the evaluator only about new candidates.
// 5. Append admitted items, trim FIFO by maxItems, then publish if the surface changed.
export const generateChannelHighlight = async ({
  con,
  definition,
  now = new Date(),
}: {
  con: DataSource;
  definition: ChannelHighlightDefinition;
  now?: Date;
}): Promise<GenerateChannelHighlightResult> => {
  const runRepo = con.getRepository(ChannelHighlightRun);
  const run = await runRepo.save(
    runRepo.create({
      channel: definition.channel,
      scheduledAt: now,
      status: 'processing',
      baselineSnapshot: [],
      inputSummary: {},
      internalSnapshot: [],
      comparison: {},
      metrics: {},
    }),
  );

  try {
    const [state, currentHighlights] = await Promise.all([
      fetchDefinitionState({
        con,
        channel: definition.channel,
      }),
      fetchCurrentHighlights({
        con,
        channel: definition.channel,
      }),
    ]);
    const horizonStart = getHorizonStart({
      now,
      definition,
    });
    const fetchStart = getFetchStart({
      now,
      definition,
      state,
    });

    const baselineSnapshot = currentHighlights.map(toHighlightSnapshotItem);
    const activeCurrentHighlights = baselineSnapshot.filter(
      (item) => item.highlightedAt >= horizonStart,
    );

    const highlightedPostIds = activeCurrentHighlights.map(
      (item) => item.postId,
    );
    const [incrementalPosts, highlightedPosts] = await Promise.all([
      fetchIncrementalPosts({
        con,
        channel: definition.channel,
        fetchStart,
        horizonStart,
      }),
      fetchPostsByIds({
        con,
        ids: highlightedPostIds,
      }),
    ]);
    const basePosts = mergePosts([incrementalPosts, highlightedPosts]);
    const relations = await fetchRelations({
      con,
      postIds: basePosts.map((post) => post.id),
    });
    const relationPosts = await fetchPostsByIds({
      con,
      ids: [
        ...new Set(
          relations.flatMap((relation) => [
            relation.postId,
            relation.relatedPostId,
          ]),
        ),
      ],
    });
    const availablePosts = mergePosts([basePosts, relationPosts]);
    const canonicalCurrentHighlights = canonicalizeCurrentHighlights({
      highlights: activeCurrentHighlights,
      relations,
      posts: availablePosts,
    });

    const currentHighlightPostIds = new Set(
      canonicalCurrentHighlights.map((item) => item.postId),
    );
    const newCandidates = buildCandidates({
      posts: availablePosts,
      relations,
      horizonStart,
      referenceTime: now,
    }).filter((candidate) => !currentHighlightPostIds.has(candidate.postId));

    const admittedHighlights =
      newCandidates.length === 0
        ? []
        : (
            await evaluateChannelHighlights({
              channel: definition.channel,
              targetAudience: getTargetAudience({
                definition,
              }),
              maxItems: definition.maxItems,
              currentHighlights: canonicalCurrentHighlights,
              newCandidates,
            })
          ).items.map<HighlightSyncItem>((item) => ({
            postId: item.postId,
            headline: item.headline,
            highlightedAt: now,
            significanceLabel: item.significanceLabel,
            reason: item.reason,
          }));

    const internalHighlights = trimHighlights({
      items: [...canonicalCurrentHighlights, ...admittedHighlights],
      maxItems: definition.maxItems,
    });
    const comparison = compareSnapshots({
      baseline: baselineSnapshot,
      internal: internalHighlights,
    });
    const wouldPublish = shouldPublish({
      baseline: baselineSnapshot,
      internal: internalHighlights,
    });
    const publish = definition.mode === 'publish' && wouldPublish;
    const metrics = toMetrics({
      fetchedPosts: incrementalPosts.length + highlightedPosts.length,
      relationPosts: relationPosts.length,
      currentHighlights: baselineSnapshot.length,
      activeHighlights: activeCurrentHighlights.length,
      canonicalizedHighlights: canonicalCurrentHighlights.length,
      newCandidates: newCandidates.length,
      admittedHighlights: admittedHighlights.length,
    });

    await runRepo.update(
      { id: run.id },
      {
        baselineSnapshot: baselineSnapshot.map(toStoredSnapshotItem),
        inputSummary: toInputSummary({
          fetchStart,
          horizonStart,
          currentHighlights: canonicalCurrentHighlights,
          candidatePostIds: newCandidates.map((candidate) => candidate.postId),
        }),
        metrics,
      },
    );

    await con.transaction(async (manager) => {
      await manager.getRepository(ChannelHighlightState).save({
        channel: definition.channel,
        lastFetchedAt: now,
        lastPublishedAt: publish ? now : state?.lastPublishedAt || null,
      });

      if (publish) {
        await replaceHighlightsForChannel({
          manager,
          channel: definition.channel,
          items: internalHighlights,
        });
      }

      await manager.getRepository(ChannelHighlightRun).update(
        { id: run.id },
        {
          status: 'completed',
          completedAt: new Date(),
          internalSnapshot: internalHighlights.map(toStoredSnapshotItem),
          comparison: {
            ...comparison,
            wouldPublish,
            published: publish,
          },
          metrics,
        },
      );
    });

    return {
      run: await runRepo.findOneByOrFail({
        id: run.id,
      }),
      published: publish,
    };
  } catch (err) {
    baseLogger.error(
      { err, channel: definition.channel },
      'Failed channel highlight run',
    );
    await runRepo.update(
      { id: run.id },
      {
        status: 'failed',
        completedAt: new Date(),
        error: {
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      },
    );
    throw err;
  }
};
