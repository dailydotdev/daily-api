import { In, type EntityManager } from 'typeorm';
import { HighlightsCanonical } from '../../entity/HighlightsCanonical';
import {
  PostHighlight,
  toPostHighlightSignificance,
  toPostHighlightSignificanceLabel,
} from '../../entity/PostHighlight';
import type { PostRelation } from '../../entity/posts/PostRelation';
import type { HighlightItem } from './types';
import { buildStoryFamilies } from './storyFamilies';

type HighlightRelation = Pick<PostRelation, 'postId' | 'relatedPostId'>;

const normalizeHighlightItems = ({
  items,
  retiredPostIds,
}: {
  items: HighlightItem[];
  retiredPostIds: Set<string>;
}): HighlightItem[] => {
  const dedupedItems = new Map<string, HighlightItem>();

  for (const item of items) {
    if (retiredPostIds.has(item.postId) || dedupedItems.has(item.postId)) {
      continue;
    }

    dedupedItems.set(item.postId, item);
  }

  return [...dedupedItems.values()];
};

export const replaceLegacyHighlightsForChannel = async ({
  manager,
  channel,
  items,
}: {
  manager: EntityManager;
  channel: string;
  items: HighlightItem[];
}): Promise<void> => {
  const repo = manager.getRepository(PostHighlight);
  const highlights = await repo.find({
    where: {
      channel,
    },
  });
  const currentHighlights = highlights.filter((item) => !item.retiredAt);
  const nextItems = normalizeHighlightItems({
    items,
    retiredPostIds: new Set(
      highlights.filter((item) => item.retiredAt).map((item) => item.postId),
    ),
  });
  const currentByPostId = new Map(
    currentHighlights.map((item) => [item.postId, item]),
  );
  const nextPostIds = new Set(nextItems.map((item) => item.postId));
  const retiredPostIds = currentHighlights
    .filter((item) => !nextPostIds.has(item.postId))
    .map((item) => item.postId);

  if (retiredPostIds.length) {
    await repo
      .createQueryBuilder()
      .update()
      .set({ retiredAt: new Date() })
      .where('"channel" = :channel', { channel })
      .andWhere('"retiredAt" IS NULL')
      .andWhere('"postId" IN (:...postIds)', { postIds: retiredPostIds })
      .execute();
  }

  if (!nextItems.length) {
    return;
  }

  await repo.save(
    nextItems.map((item) => {
      const currentHighlight = currentByPostId.get(item.postId);

      return repo.create({
        id: currentHighlight?.id,
        channel,
        postId: item.postId,
        highlightedAt: item.highlightedAt,
        headline: item.headline,
        significance: toPostHighlightSignificance(item.significanceLabel),
        reason: item.reason,
        retiredAt: null,
      });
    }),
  );
};

export const upsertCanonicalHighlights = async ({
  manager,
  items,
  channelsByPostId,
  relations,
}: {
  manager: EntityManager;
  items: HighlightItem[];
  channelsByPostId: Map<string, Set<string>>;
  relations: HighlightRelation[];
}): Promise<HighlightsCanonical[]> => {
  const repo = manager.getRepository(HighlightsCanonical);
  const nextItems = normalizeHighlightItems({
    items,
    retiredPostIds: new Set(),
  });

  if (!nextItems.length) {
    return [];
  }

  const storyFamilies = buildStoryFamilies({ relations });
  const familyPostIdsByPostId = new Map(
    nextItems.map((item) => [
      item.postId,
      storyFamilies.getFamilyPostIds(item.postId),
    ]),
  );
  const lookupPostIds = [
    ...new Set([...familyPostIdsByPostId.values()].flat()),
  ];
  const currentByPostId = new Map(
    (
      await repo.findBy({
        postId: In(lookupPostIds),
      })
    ).map((highlight) => [highlight.postId, highlight]),
  );

  return repo.save(
    nextItems.map((item) => {
      const current = (familyPostIdsByPostId.get(item.postId) || [item.postId])
        .map((postId) => currentByPostId.get(postId))
        .find((highlight): highlight is HighlightsCanonical => !!highlight);

      return repo.create({
        id: current?.id,
        postId: item.postId,
        channels: [
          ...new Set([
            ...(current?.channels || []),
            ...(channelsByPostId.get(item.postId) || []),
          ]),
        ].sort(),
        highlightedAt: item.highlightedAt,
        headline: item.headline,
        significance: toPostHighlightSignificance(item.significanceLabel),
        reason: item.reason,
      });
    }),
  );
};

export const toHighlightItemFromCanonical = (
  highlight: HighlightsCanonical,
): HighlightItem => ({
  postId: highlight.postId,
  highlightedAt: highlight.highlightedAt,
  headline: highlight.headline,
  summary: null,
  significanceLabel: toPostHighlightSignificanceLabel(highlight.significance),
  reason: highlight.reason,
});
