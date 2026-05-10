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
  fetchCollectionMembership,
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
    // For SharePost-stored highlights we need the underlying article in the
    // post pool so canonicalization can downgrade share → underlying when the
    // underlying is accessible.
    const sharedUnderlyingIds = [
      ...new Set(
        basePosts
          .map((post) => post.sharedPostId)
          .filter((id): id is string => !!id),
      ),
    ];
    const [relations, sharedUnderlyingPosts] = await Promise.all([
      fetchRelations({
        con,
        postIds: basePosts.map((post) => post.id),
      }),
      fetchPostsByIds({
        con,
        ids: sharedUnderlyingIds,
        excludedSourceIds,
      }),
    ]);
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
    const availablePosts = mergePosts([
      basePosts,
      relationPosts,
      sharedUnderlyingPosts,
    ]);
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
        inaccessiblePostIds,
      }),
      inaccessiblePostIds,
      fallbackPostIds,
    });
    const evaluationHighlights = applyPublicShareFallbackToHighlights({
      highlights: canonicalizeCurrentHighlights({
        highlights: evaluationHistoryHighlights.map(toHighlightItem),
        relations,
        posts: availablePosts,
        inaccessiblePostIds,
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
        inaccessiblePostIds,
      }),
      inaccessiblePostIds,
      fallbackPostIds,
    });

    const currentHighlightPostIds = new Set(
      liveHighlights.map((item) => item.postId),
    );
    // A retired highlight may be stored as either the underlying post id (the
    // new norm) or as a share-post id (legacy rows from before we stopped
    // auto-migrating underlying → share). Dedup against both forms so a fresh
    // candidate matching either side is filtered out.
    const sharedByShareId = new Map<string, string>();
    for (const post of availablePosts) {
      if (post.sharedPostId) sharedByShareId.set(post.id, post.sharedPostId);
    }
    const retiredHighlightPostIdSet = new Set(
      retiredHighlightPostIds.flatMap((postId) => [
        postId,
        fallbackPostIds.get(postId),
        sharedByShareId.get(postId),
      ]).filter((id): id is string => !!id),
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

    const evaluatedHighlights =
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

    const admittedHighlights = await dropAdmissionsRacingCollections({
      con,
      admitted: evaluatedHighlights,
      fallbackPostIds,
      currentHighlightPostIds,
      retiredHighlightPostIds: retiredHighlightPostIdSet,
    });

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

// Bragi can admit a candidate that's already part of a previously-highlighted
// collection when the collection's regeneration job inserts the post_relation
// row after fetchRelations has run. Re-fetch membership now and drop any
// admitted item whose collection (or any sibling) is already live or retired.
const dropAdmissionsRacingCollections = async ({
  con,
  admitted,
  fallbackPostIds,
  currentHighlightPostIds,
  retiredHighlightPostIds,
}: {
  con: DataSource;
  admitted: HighlightItem[];
  fallbackPostIds: Map<string, string>;
  currentHighlightPostIds: Set<string>;
  retiredHighlightPostIds: Set<string>;
}): Promise<HighlightItem[]> => {
  if (!admitted.length) return admitted;

  const shareToUnderlying = new Map(
    [...fallbackPostIds].map(([underlying, share]) => [share, underlying]),
  );
  const underlyingId = (postId: string) =>
    shareToUnderlying.get(postId) ?? postId;

  const { collectionByChild, childrenByCollection } =
    await fetchCollectionMembership({
      con,
      postIds: [...new Set(admitted.map((item) => underlyingId(item.postId)))],
    });
  if (!collectionByChild.size) return admitted;

  const isCovered = (postId: string): boolean => {
    const aliased = fallbackPostIds.get(postId) ?? postId;
    return (
      currentHighlightPostIds.has(postId) ||
      retiredHighlightPostIds.has(postId) ||
      currentHighlightPostIds.has(aliased) ||
      retiredHighlightPostIds.has(aliased)
    );
  };

  return admitted.filter((item) => {
    const collectionId = collectionByChild.get(underlyingId(item.postId));
    if (!collectionId) return true;
    const members = [
      collectionId,
      ...(childrenByCollection.get(collectionId) ?? []),
    ];
    return !members.some(isCovered);
  });
};
