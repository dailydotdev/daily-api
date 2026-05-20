import { In, type DataSource } from 'typeorm';
import { logger as baseLogger } from '../../logger';
import { ChannelHighlightDefinition } from '../../entity/ChannelHighlightDefinition';
import { ChannelHighlightRun } from '../../entity/ChannelHighlightRun';
import { UNKNOWN_SOURCE } from '../../entity/Source';
import { getChannelDigestSourceIds } from '../channelDigest/definitions';
import { compareSnapshots } from './decisions';
import { evaluateChannelHighlights } from './evaluate';
import { publishHighlightsForChannel } from './publish';
import {
  fetchCollectionMembership,
  fetchCurrentHighlightsForChannels,
  fetchEvaluationHistoryHighlightsForChannels,
  fetchGlobalIncrementalPosts,
  fetchPostsByIds,
  fetchPublicShareFallbackPostIds,
  fetchRetiredHighlightPostIdsForChannels,
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
import type {
  GenerateChannelHighlightResult,
  HighlightItem,
  HighlightPost,
} from './types';

type EvaluationConfig = {
  channel: string;
  targetAudience: string;
  maxItems: number;
};

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

const groupHighlightsByChannel = <T extends { channel: string }>(
  highlights: T[],
): Map<string, T[]> => {
  const grouped = new Map<string, T[]>();

  for (const highlight of highlights) {
    const items = grouped.get(highlight.channel) || [];
    items.push(highlight);
    grouped.set(highlight.channel, items);
  }

  return grouped;
};

const dedupeHighlightsByPostId = (items: HighlightItem[]): HighlightItem[] => {
  const deduped = new Map<string, HighlightItem>();

  for (const item of [...items].sort(
    (left, right) =>
      right.highlightedAt.getTime() - left.highlightedAt.getTime(),
  )) {
    if (!deduped.has(item.postId)) {
      deduped.set(item.postId, item);
    }
  }

  return [...deduped.values()];
};

const getEvaluationConfig = (
  definitions: ChannelHighlightDefinition[],
): EvaluationConfig => {
  if (definitions.length === 1) {
    const definition = definitions[0];

    return {
      channel: definition.channel,
      targetAudience:
        definition.targetAudience.trim() ||
        `daily.dev readers following ${definition.channel}`,
      maxItems: definition.maxItems,
    };
  }

  return {
    channel: 'global',
    targetAudience:
      'software engineers and engineering leaders who want to stay current on meaningful developments that affect how modern software is built, shipped, operated, and grown',
    maxItems: definitions.reduce(
      (total, definition) => total + definition.maxItems,
      0,
    ),
  };
};

const getHighlightChannels = ({
  postId,
  posts,
  relations,
  fallbackPostIds,
  enabledChannels,
}: {
  postId: string;
  posts: HighlightPost[];
  relations: { postId: string; relatedPostId: string }[];
  fallbackPostIds: Map<string, string>;
  enabledChannels: Set<string>;
}): string[] => {
  const postsById = new Map(posts.map((post) => [post.id, post]));
  const shareToUnderlying = new Map(
    [...fallbackPostIds].map(([underlying, share]) => [share, underlying]),
  );
  const childrenByCollection = new Map<string, string[]>();
  const collectionByChild = new Map<string, string>();

  for (const relation of relations) {
    const children = childrenByCollection.get(relation.postId) || [];
    children.push(relation.relatedPostId);
    childrenByCollection.set(relation.postId, children);
    collectionByChild.set(relation.relatedPostId, relation.postId);
  }

  const underlyingPostId = shareToUnderlying.get(postId) || postId;
  const collectionId = collectionByChild.get(underlyingPostId);
  const storyPostIds = [
    ...(collectionId ? [collectionId] : []),
    underlyingPostId,
    ...(childrenByCollection.get(collectionId || underlyingPostId) || []),
  ];
  const channels = new Set<string>();

  for (const storyPostId of storyPostIds) {
    const contentMeta = postsById.get(storyPostId)?.contentMeta as
      | { channels?: unknown }
      | undefined;
    const postChannels = contentMeta?.channels;
    if (!Array.isArray(postChannels)) {
      continue;
    }

    for (const channel of postChannels) {
      if (typeof channel === 'string' && enabledChannels.has(channel)) {
        channels.add(channel);
      }
    }
  }

  return [...channels];
};

export const generateChannelHighlights = async ({
  con,
  definitions,
  now = new Date(),
}: {
  con: DataSource;
  definitions: ChannelHighlightDefinition[];
  now?: Date;
}): Promise<GenerateChannelHighlightResult> => {
  if (!definitions.length) {
    return {
      runs: [],
      published: false,
    };
  }

  const channels = definitions.map((definition) => definition.channel);
  const definitionsByChannel = new Map(
    definitions.map((definition) => [definition.channel, definition]),
  );
  const runRepo = con.getRepository(ChannelHighlightRun);
  const runs = await runRepo.save(
    definitions.map((definition) =>
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
    ),
  );
  const runByChannel = new Map(runs.map((run) => [run.channel, run]));

  try {
    const [
      currentHighlights,
      retiredHighlightPostIdsByChannel,
      excludedSourceIds,
      evaluationHistoryHighlights,
    ] = await Promise.all([
      fetchCurrentHighlightsForChannels({
        con,
        channels,
      }),
      fetchRetiredHighlightPostIdsForChannels({
        con,
        channels,
      }),
      getChannelDigestSourceIds({
        con,
      }),
      fetchEvaluationHistoryHighlightsForChannels({
        con,
        channels,
        now,
      }),
    ]);
    const maxCandidateHorizonHours = Math.max(
      ...definitions.map((definition) => definition.candidateHorizonHours),
    );
    const horizonStart = getHorizonStart({
      now,
      definition: {
        candidateHorizonHours: maxCandidateHorizonHours,
      },
    });
    const fetchStart = definitions
      .map((definition) =>
        getFetchStart({
          now,
          definition,
        }),
      )
      .sort((left, right) => left.getTime() - right.getTime())[0];
    const currentHighlightsByChannel =
      groupHighlightsByChannel(currentHighlights);
    const evaluationHistoryHighlightsByChannel = groupHighlightsByChannel(
      evaluationHistoryHighlights,
    );
    const baselineHighlightsByChannel = new Map(
      channels.map((channel) => [
        channel,
        (currentHighlightsByChannel.get(channel) || []).map(toHighlightItem),
      ]),
    );
    const activeHighlightsByChannel = new Map(
      definitions.map((definition) => {
        const channelBaseline =
          baselineHighlightsByChannel.get(definition.channel) || [];
        const channelHorizonStart = getHorizonStart({
          now,
          definition,
        });

        return [
          definition.channel,
          channelBaseline.filter(
            (item) => item.highlightedAt >= channelHorizonStart,
          ),
        ];
      }),
    );
    const highlightedPostIds = [
      ...new Set(
        [...activeHighlightsByChannel.values()].flatMap((items) =>
          items.map((item) => item.postId),
        ),
      ),
    ];
    const evaluationHistoryPostIds = [
      ...new Set(evaluationHistoryHighlights.map((item) => item.postId)),
    ];
    const [incrementalPosts, highlightedPosts, evaluationHistoryPosts] =
      await Promise.all([
        fetchGlobalIncrementalPosts({
          con,
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
    const retiredHighlightPostIds = [
      ...new Set(
        [...retiredHighlightPostIdsByChannel.values()].flatMap((postIds) => [
          ...postIds,
        ]),
      ),
    ];
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
    const liveHighlightsByChannel = new Map(
      channels.map((channel) => [
        channel,
        applyPublicShareFallbackToHighlights({
          highlights: canonicalizeCurrentHighlights({
            highlights: activeHighlightsByChannel.get(channel) || [],
            relations,
            posts: availablePosts,
            inaccessiblePostIds,
          }),
          inaccessiblePostIds,
          fallbackPostIds,
        }),
      ]),
    );
    const evaluationHighlightsByChannel = new Map(
      channels.map((channel) => [
        channel,
        applyPublicShareFallbackToHighlights({
          highlights: canonicalizeCurrentHighlights({
            highlights: (
              evaluationHistoryHighlightsByChannel.get(channel) || []
            ).map(toHighlightItem),
            relations,
            posts: availablePosts,
            inaccessiblePostIds,
          }),
          inaccessiblePostIds,
          fallbackPostIds,
        }),
      ]),
    );
    const retiredEvaluationHighlightsByChannel = new Map(
      channels.map((channel) => [
        channel,
        applyPublicShareFallbackToHighlights({
          highlights: canonicalizeCurrentHighlights({
            highlights: (
              evaluationHistoryHighlightsByChannel.get(channel) || []
            )
              .filter((item) => !!item.retiredAt)
              .map(toHighlightItem),
            relations,
            posts: availablePosts,
            inaccessiblePostIds,
          }),
          inaccessiblePostIds,
          fallbackPostIds,
        }),
      ]),
    );
    const currentHighlightPostIdsByChannel = new Map(
      channels.map((channel) => [
        channel,
        new Set(
          (liveHighlightsByChannel.get(channel) || []).map(
            (item) => item.postId,
          ),
        ),
      ]),
    );
    const sharedByShareId = new Map<string, string>();
    for (const post of availablePosts) {
      if (post.sharedPostId) sharedByShareId.set(post.id, post.sharedPostId);
    }
    const retiredHighlightPostIdSetByChannel = new Map(
      channels.map((channel) => {
        const postIds =
          retiredHighlightPostIdsByChannel.get(channel) || new Set();

        return [
          channel,
          new Set(
            [...postIds]
              .flatMap((postId) => [
                postId,
                fallbackPostIds.get(postId),
                sharedByShareId.get(postId),
              ])
              .filter((id): id is string => !!id),
          ),
        ];
      }),
    );
    const retiredEvaluationPostIdSetByChannel = new Map(
      channels.map((channel) => [
        channel,
        new Set(
          (retiredEvaluationHighlightsByChannel.get(channel) || []).map(
            (item) => item.postId,
          ),
        ),
      ]),
    );
    const enabledChannels = new Set(channels);
    const getPublishableChannels = ({
      postId,
      itemChannels,
    }: {
      postId: string;
      itemChannels: string[];
    }): string[] =>
      itemChannels.filter(
        (channel) =>
          !currentHighlightPostIdsByChannel.get(channel)?.has(postId) &&
          !retiredHighlightPostIdSetByChannel.get(channel)?.has(postId) &&
          !retiredEvaluationPostIdSetByChannel.get(channel)?.has(postId),
      );
    const liveHighlightItems = dedupeHighlightsByPostId(
      [...liveHighlightsByChannel.values()].flat(),
    );
    const liveHighlightPostIds = new Set(
      liveHighlightItems.map((item) => item.postId),
    );

    const candidates = applyPublicShareFallbackToCandidates({
      candidates: buildCandidates({
        posts: availablePosts,
        relations,
        horizonStart,
      }),
      inaccessiblePostIds,
      fallbackPostIds,
    });
    const candidateChannelsByPostId = new Map<string, string[]>();
    const newCandidates = candidates.filter((candidate) => {
      const candidateChannels = getHighlightChannels({
        postId: candidate.postId,
        posts: availablePosts,
        relations,
        fallbackPostIds,
        enabledChannels,
      }).filter((channel) => {
        const definition = definitionsByChannel.get(channel);

        return (
          !!definition &&
          candidate.lastActivityAt >=
            getHorizonStart({
              now,
              definition,
            })
        );
      });
      const publishableChannels = liveHighlightPostIds.has(candidate.postId)
        ? []
        : getPublishableChannels({
            postId: candidate.postId,
            itemChannels: candidateChannels,
          });

      if (!publishableChannels.length) {
        return false;
      }

      candidateChannelsByPostId.set(candidate.postId, publishableChannels);
      return true;
    });
    const evaluationConfig = getEvaluationConfig(definitions);
    const evaluationHighlights = dedupeHighlightsByPostId(
      [...evaluationHighlightsByChannel.values()].flat(),
    );
    const evaluatedHighlights =
      newCandidates.length === 0
        ? []
        : (
            await evaluateChannelHighlights({
              channel: evaluationConfig.channel,
              targetAudience: evaluationConfig.targetAudience,
              maxItems: evaluationConfig.maxItems,
              currentHighlights: evaluationHighlights,
              newCandidates,
            })
          ).items.map<HighlightItem>((item) => ({
            postId: item.postId,
            headline: item.headline,
            summary: null,
            highlightedAt: now,
            significanceLabel: item.significanceLabel,
            reason: item.reason,
          }));
    const admittedHighlightsByChannel = new Map<string, HighlightItem[]>();

    for (const channel of channels) {
      const channelAdmissions = evaluatedHighlights.filter((item) =>
        candidateChannelsByPostId.get(item.postId)?.includes(channel),
      );
      const admittedHighlights = await dropAdmissionsRacingCollections({
        con,
        admitted: channelAdmissions,
        fallbackPostIds,
        currentHighlightPostIds:
          currentHighlightPostIdsByChannel.get(channel) || new Set(),
        retiredHighlightPostIds:
          retiredHighlightPostIdSetByChannel.get(channel) || new Set(),
      });
      admittedHighlightsByChannel.set(channel, admittedHighlights);
    }

    let published = false;
    await con.transaction(async (manager) => {
      for (const definition of definitions) {
        const baselineHighlights =
          baselineHighlightsByChannel.get(definition.channel) || [];
        const liveHighlights =
          liveHighlightsByChannel.get(definition.channel) || [];
        const admittedHighlights =
          admittedHighlightsByChannel.get(definition.channel) || [];
        const internalHighlights = trimHighlights({
          items: [...liveHighlights, ...admittedHighlights],
          maxItems: definition.maxItems,
        });
        const comparison = compareSnapshots({
          baseline: baselineHighlights,
          internal: internalHighlights,
        });
        const shouldPublish =
          definition.mode === 'publish' && comparison.changed;
        const run = runByChannel.get(definition.channel);

        await manager.getRepository(ChannelHighlightDefinition).update(
          { channel: definition.channel },
          {
            lastFetchedAt: now,
          },
        );

        if (shouldPublish) {
          await publishHighlightsForChannel({
            manager,
            channel: definition.channel,
            items: internalHighlights,
            relations,
          });
          published = true;
        }

        if (run) {
          await manager.getRepository(ChannelHighlightRun).update(
            { id: run.id },
            {
              status: 'completed',
              completedAt: new Date(),
              baselineSnapshot: baselineHighlights.map(toStoredSnapshotItem),
              inputSummary: {
                fetchStart: fetchStart.toISOString(),
                horizonStart: getHorizonStart({
                  now,
                  definition,
                }).toISOString(),
                evaluationHistoryStart: getEvaluationHistoryStart({
                  now,
                }).toISOString(),
                excludedSourceIds,
                currentHighlightPostIds: liveHighlights.map(
                  (item) => item.postId,
                ),
                evaluationHighlightPostIds: (
                  evaluationHighlightsByChannel.get(definition.channel) || []
                ).map((item) => item.postId),
                retiredEvaluationHighlightPostIds: (
                  retiredEvaluationHighlightsByChannel.get(
                    definition.channel,
                  ) || []
                ).map((item) => item.postId),
                retiredHighlightPostIds: [
                  ...(retiredHighlightPostIdsByChannel.get(
                    definition.channel,
                  ) || []),
                ],
                candidatePostIds: newCandidates
                  .filter((candidate) =>
                    candidateChannelsByPostId
                      .get(candidate.postId)
                      ?.includes(definition.channel),
                  )
                  .map((candidate) => candidate.postId),
              },
              internalSnapshot: internalHighlights.map(toStoredSnapshotItem),
              comparison: {
                ...comparison,
                wouldPublish: comparison.changed,
                published: shouldPublish,
              },
              metrics: {
                fetchedPosts: incrementalPosts.length + highlightedPosts.length,
                relationPosts: relationPosts.length,
                currentHighlights: baselineHighlights.length,
                activeHighlights:
                  activeHighlightsByChannel.get(definition.channel)?.length ||
                  0,
                canonicalizedHighlights: liveHighlights.length,
                evaluationHighlights:
                  evaluationHighlightsByChannel.get(definition.channel)
                    ?.length || 0,
                retiredEvaluationHighlights:
                  retiredEvaluationHighlightsByChannel.get(definition.channel)
                    ?.length || 0,
                newCandidates: newCandidates.filter((candidate) =>
                  candidateChannelsByPostId
                    .get(candidate.postId)
                    ?.includes(definition.channel),
                ).length,
                admittedHighlights: admittedHighlights.length,
              },
            },
          );
        }
      }
    });

    return {
      runs: await runRepo.findBy({
        id: In(runs.map((run) => run.id)),
      }),
      published,
    };
  } catch (err) {
    baseLogger.error({ err, channels }, 'Failed channel highlight run');
    await runRepo.update(
      {
        id: In(runs.map((run) => run.id)),
      },
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
  if (!collectionByChild.size && !childrenByCollection.size) return admitted;

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
    const postId = underlyingId(item.postId);
    const collectionId = collectionByChild.get(postId) || postId;
    if (!childrenByCollection.has(collectionId)) return true;
    const members = [
      collectionId,
      ...(childrenByCollection.get(collectionId) ?? []),
    ];
    return !members.some(isCovered);
  });
};
