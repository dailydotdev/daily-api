import type { DataSource } from 'typeorm';
import { logger as baseLogger } from '../../logger';
import { ChannelHighlightDefinition } from '../../entity/ChannelHighlightDefinition';
import { ChannelHighlightRun } from '../../entity/ChannelHighlightRun';
import { UNKNOWN_SOURCE } from '../../entity/Source';
import { getChannelDigestSourceIds } from '../channelDigest/definitions';
import { compareSnapshots } from './decisions';
import { evaluateChannelHighlights } from './evaluate';
import { replaceHighlightsForChannel } from './publish';
import {
  fetchCurrentHighlights,
  fetchEvaluationHistoryHighlights,
  fetchIncrementalPosts,
  fetchPostsByIds,
  fetchPublicShareFallbackPostIds,
  fetchRetiredHighlightPostIds,
  fetchRelations,
  getEvaluationHistoryStart,
  getFetchStart,
  getHorizonStart,
  mergePosts,
} from './queries';
import {
  applyPublicShareFallbackToCandidates,
  applyPublicShareFallbackToHighlights,
  buildCandidates,
  canonicalizeCurrentHighlights,
  toHighlightItem,
  toStoredSnapshotItem,
} from './stories';
import type { GenerateChannelHighlightResult, HighlightItem } from './types';

const trimHighlights = ({
  items,
  maxItems,
}: {
  items: HighlightItem[];
  maxItems: number;
}): HighlightItem[] =>
  [...items]
    .sort(
      (left, right) =>
        right.highlightedAt.getTime() - left.highlightedAt.getTime(),
    )
    .slice(0, maxItems);

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
    const [
      currentHighlights,
      retiredHighlightPostIds,
      excludedSourceIds,
      evaluationHistoryHighlights,
    ] = await Promise.all([
      fetchCurrentHighlights({
        con,
        channel: definition.channel,
      }),
      fetchRetiredHighlightPostIds({
        con,
        channel: definition.channel,
      }),
      getChannelDigestSourceIds({
        con,
      }),
      fetchEvaluationHistoryHighlights({
        con,
        channel: definition.channel,
        now,
      }),
    ]);
    const horizonStart = getHorizonStart({
      now,
      definition,
    });
    const fetchStart = getFetchStart({
      now,
      definition,
    });

    const baselineHighlights = currentHighlights.map(toHighlightItem);
    const activeHighlights = baselineHighlights.filter(
      (item) => item.highlightedAt >= horizonStart,
    );

    const highlightedPostIds = activeHighlights.map((item) => item.postId);
    const evaluationHistoryPostIds = evaluationHistoryHighlights.map(
      (item) => item.postId,
    );
    const [incrementalPosts, highlightedPosts, evaluationHistoryPosts] =
      await Promise.all([
        fetchIncrementalPosts({
          con,
          channel: definition.channel,
          fetchStart,
          horizonStart,
          excludedSourceIds,
        }),
        fetchPostsByIds({
          con,
          ids: highlightedPostIds,
          excludedSourceIds,
        }),
        fetchPostsByIds({
          con,
          ids: evaluationHistoryPostIds,
          excludedSourceIds,
        }),
      ]);
    const basePosts = mergePosts([
      incrementalPosts,
      highlightedPosts,
      evaluationHistoryPosts,
    ]);
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
      excludedSourceIds,
    });
    const availablePosts = mergePosts([basePosts, relationPosts]);
    const inaccessiblePostIds = new Set(
      availablePosts
        .filter((post) => post.sourceId === UNKNOWN_SOURCE)
        .map((post) => post.id),
    );
    const fallbackPostIds = await fetchPublicShareFallbackPostIds({
      con,
      sharedPostIds: [
        ...new Set([
          ...availablePosts.map((post) => post.id),
          ...retiredHighlightPostIds,
        ]),
      ],
      excludedSourceIds,
    });
    const liveHighlights = applyPublicShareFallbackToHighlights({
      highlights: canonicalizeCurrentHighlights({
        highlights: activeHighlights,
        relations,
        posts: availablePosts,
      }),
      inaccessiblePostIds,
      fallbackPostIds,
    });
    const evaluationHighlights = applyPublicShareFallbackToHighlights({
      highlights: canonicalizeCurrentHighlights({
        highlights: evaluationHistoryHighlights.map(toHighlightItem),
        relations,
        posts: availablePosts,
      }),
      inaccessiblePostIds,
      fallbackPostIds,
    });
    const retiredEvaluationHighlights = applyPublicShareFallbackToHighlights({
      highlights: canonicalizeCurrentHighlights({
        highlights: evaluationHistoryHighlights
          .filter((item) => !!item.retiredAt)
          .map(toHighlightItem),
        relations,
        posts: availablePosts,
      }),
      inaccessiblePostIds,
      fallbackPostIds,
    });

    const currentHighlightPostIds = new Set(
      liveHighlights.map((item) => item.postId),
    );
    const retiredHighlightPostIdSet = new Set(
      retiredHighlightPostIds.map(
        (postId) => fallbackPostIds.get(postId) || postId,
      ),
    );
    const retiredEvaluationPostIdSet = new Set(
      retiredEvaluationHighlights.map((item) => item.postId),
    );
    const newCandidates = applyPublicShareFallbackToCandidates({
      candidates: buildCandidates({
        posts: availablePosts,
        relations,
        horizonStart,
      }),
      inaccessiblePostIds,
      fallbackPostIds,
    }).filter(
      (candidate) =>
        !currentHighlightPostIds.has(candidate.postId) &&
        !retiredHighlightPostIdSet.has(candidate.postId) &&
        !retiredEvaluationPostIdSet.has(candidate.postId),
    );

    const admittedHighlights =
      newCandidates.length === 0
        ? []
        : (
            await evaluateChannelHighlights({
              channel: definition.channel,
              targetAudience:
                definition.targetAudience.trim() ||
                `daily.dev readers following ${definition.channel}`,
              maxItems: definition.maxItems,
              currentHighlights: evaluationHighlights,
              newCandidates,
            })
          ).items.map<HighlightItem>((item) => ({
            postId: item.postId,
            headline: item.headline,
            highlightedAt: now,
            significanceLabel: item.significanceLabel,
            reason: item.reason,
          }));

    const internalHighlights = trimHighlights({
      items: [...liveHighlights, ...admittedHighlights],
      maxItems: definition.maxItems,
    });
    const comparison = compareSnapshots({
      baseline: baselineHighlights,
      internal: internalHighlights,
    });
    const publish = definition.mode === 'publish' && comparison.changed;

    await con.transaction(async (manager) => {
      await manager.getRepository(ChannelHighlightDefinition).update(
        { channel: definition.channel },
        {
          lastFetchedAt: now,
        },
      );

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
          baselineSnapshot: baselineHighlights.map(toStoredSnapshotItem),
          inputSummary: {
            fetchStart: fetchStart.toISOString(),
            horizonStart: horizonStart.toISOString(),
            evaluationHistoryStart: getEvaluationHistoryStart({
              now,
            }).toISOString(),
            excludedSourceIds,
            currentHighlightPostIds: liveHighlights.map((item) => item.postId),
            evaluationHighlightPostIds: evaluationHighlights.map(
              (item) => item.postId,
            ),
            retiredEvaluationHighlightPostIds: retiredEvaluationHighlights.map(
              (item) => item.postId,
            ),
            retiredHighlightPostIds,
            candidatePostIds: newCandidates.map(
              (candidate) => candidate.postId,
            ),
          },
          internalSnapshot: internalHighlights.map(toStoredSnapshotItem),
          comparison: {
            ...comparison,
            wouldPublish: comparison.changed,
            published: publish,
          },
          metrics: {
            fetchedPosts: incrementalPosts.length + highlightedPosts.length,
            relationPosts: relationPosts.length,
            currentHighlights: baselineHighlights.length,
            activeHighlights: activeHighlights.length,
            canonicalizedHighlights: liveHighlights.length,
            evaluationHighlights: evaluationHighlights.length,
            retiredEvaluationHighlights: retiredEvaluationHighlights.length,
            newCandidates: newCandidates.length,
            admittedHighlights: admittedHighlights.length,
          },
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
