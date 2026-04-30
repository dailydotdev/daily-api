import type { DataSource } from 'typeorm';
import { logger as baseLogger } from '../../logger';
import { ChannelHighlightDefinition } from '../../entity/ChannelHighlightDefinition';
import { UNKNOWN_SOURCE } from '../../entity/Source';
import { getChannelHighlightDefinitions } from './definitions';
import { getChannelDigestSourceIds } from '../channelDigest/definitions';
import { evaluateChannelHighlights } from './evaluate';
import { replaceHighlights } from './publish';
import {
  fetchCurrentHighlights,
  fetchEvaluationHistoryHighlights,
  fetchIncrementalPosts,
  fetchPostsByIds,
  fetchPublicShareFallbackPostIds,
  fetchRetiredHighlightPostIds,
  fetchRelations,
  getDefinitionsHorizonHours,
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
} from './stories';
import type {
  GenerateHighlightsResult,
  HighlightItem,
  HighlightPost,
} from './types';

const sortDefinitions = (
  definitions: ChannelHighlightDefinition[],
): ChannelHighlightDefinition[] =>
  [...definitions].sort(
    (left, right) =>
      left.order - right.order || left.channel.localeCompare(right.channel),
  );

const sortHighlights = (items: HighlightItem[]): HighlightItem[] =>
  [...items].sort(
    (left, right) =>
      right.highlightedAt.getTime() - left.highlightedAt.getTime(),
  );

const getPostChannels = ({ post }: { post?: HighlightPost }): string[] => {
  const channels = (post?.contentMeta as { channels?: unknown } | undefined)
    ?.channels;

  if (!Array.isArray(channels)) {
    return [];
  }

  return channels.filter(
    (channel): channel is string => typeof channel === 'string' && !!channel,
  );
};

const toPrimaryChannel = ({
  channels,
  definitions,
}: {
  channels: string[];
  definitions: ChannelHighlightDefinition[];
}): string | null => {
  if (!channels.length) {
    return null;
  }

  const orderByChannel = new Map(
    definitions.map((definition, index) => [definition.channel, index]),
  );

  return [...channels].sort((left, right) => {
    const leftOrder = orderByChannel.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = orderByChannel.get(right) ?? Number.MAX_SAFE_INTEGER;

    return leftOrder - rightOrder || left.localeCompare(right);
  })[0];
};

const selectPublishedHighlights = ({
  definitions,
  items,
  postsById,
  now,
}: {
  definitions: ChannelHighlightDefinition[];
  items: HighlightItem[];
  postsById: Map<string, HighlightPost>;
  now: Date;
}): HighlightItem[] => {
  const publishedDefinitions = sortDefinitions(
    definitions.filter((definition) => definition.mode === 'publish'),
  );
  const channelsByPostId = new Map<string, string[]>();

  for (const definition of publishedDefinitions) {
    const horizonStart = getHorizonStart({
      now,
      horizonHours: definition.candidateHorizonHours,
    });
    const matchedItems = sortHighlights(
      items.filter((item) => {
        if (item.highlightedAt < horizonStart) {
          return false;
        }

        const post = postsById.get(item.postId);
        return getPostChannels({ post }).includes(definition.channel);
      }),
    ).slice(0, definition.maxItems);

    for (const item of matchedItems) {
      const channels = channelsByPostId.get(item.postId) || [];
      if (!channels.includes(definition.channel)) {
        channels.push(definition.channel);
        channelsByPostId.set(item.postId, channels);
      }
    }
  }

  return sortHighlights(
    items
      .map((item) => {
        const channels = channelsByPostId.get(item.postId);
        if (!channels?.length) {
          return null;
        }

        const primaryChannel = toPrimaryChannel({
          channels,
          definitions: publishedDefinitions,
        });
        if (!primaryChannel) {
          return null;
        }

        return {
          ...item,
          channel: primaryChannel,
          channels,
        };
      })
      .filter((item): item is HighlightItem => !!item),
  );
};

export const generateHighlights = async ({
  con,
  now = new Date(),
}: {
  con: DataSource;
  now?: Date;
}): Promise<GenerateHighlightsResult> => {
  const definitions = await getChannelHighlightDefinitions({
    con,
  });
  const horizonHours = getDefinitionsHorizonHours({
    definitions,
  });

  if (!definitions.length || horizonHours <= 0) {
    return {
      createdHighlights: [],
    };
  }

  try {
    const channels = definitions.map((definition) => definition.channel);
    const [
      currentHighlights,
      retiredHighlightPostIds,
      excludedSourceIds,
      evaluationHistoryHighlights,
    ] = await Promise.all([
      fetchCurrentHighlights({
        con,
      }),
      fetchRetiredHighlightPostIds({
        con,
      }),
      getChannelDigestSourceIds({
        con,
      }),
      fetchEvaluationHistoryHighlights({
        con,
        now,
      }),
    ]);
    const horizonStart = getHorizonStart({
      now,
      horizonHours,
    });
    const fetchStart = getFetchStart({
      now,
      definitions,
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
        channels.length
          ? fetchIncrementalPosts({
              con,
              channels,
              fetchStart,
              horizonStart,
              excludedSourceIds,
            })
          : Promise.resolve([]),
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
    const postsById = new Map(availablePosts.map((post) => [post.id, post]));
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
              channel: 'highlights',
              targetAudience: 'daily.dev readers',
              maxItems: newCandidates.length,
              currentHighlights: evaluationHighlights,
              newCandidates,
            })
          ).items
            .map<HighlightItem | null>((item) => {
              const post = postsById.get(item.postId);
              const itemChannels = getPostChannels({ post });
              const primaryChannel = toPrimaryChannel({
                channels: itemChannels,
                definitions: sortDefinitions(definitions),
              });

              if (!primaryChannel) {
                return null;
              }

              return {
                channel: primaryChannel,
                channels: [primaryChannel],
                postId: item.postId,
                headline: item.headline,
                highlightedAt: now,
                significanceLabel: item.significanceLabel,
              };
            })
            .filter((item): item is HighlightItem => !!item);
    const nextHighlights = selectPublishedHighlights({
      definitions,
      items: sortHighlights([...liveHighlights, ...admittedHighlights]),
      postsById,
      now,
    });
    const createdHighlights = await con.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .update(ChannelHighlightDefinition)
        .set({
          lastFetchedAt: now,
        })
        .where('"channel" IN (:...channels)', {
          channels: definitions.map((definition) => definition.channel),
        })
        .execute();

      return replaceHighlights({
        manager,
        items: nextHighlights,
      });
    });

    return {
      createdHighlights,
    };
  } catch (err) {
    baseLogger.error({ err }, 'Failed global highlight run');
    throw err;
  }
};
