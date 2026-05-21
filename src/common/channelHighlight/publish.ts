import { In, type EntityManager } from 'typeorm';
import { HighlightsCanonical } from '../../entity/HighlightsCanonical';
import {
  PostHighlight,
  toPostHighlightSignificance,
  toPostHighlightSignificanceLabel,
} from '../../entity/PostHighlight';
import type { PostRelation } from '../../entity/posts/PostRelation';
import type { HighlightItem } from './types';

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

const replaceLegacyHighlightsForChannel = async ({
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

const upsertCanonicalHighlights = async ({
  manager,
  channel,
  items,
  relations,
}: {
  manager: EntityManager;
  channel: string;
  items: HighlightItem[];
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

  const childrenByCollection = new Map<string, string[]>();
  const collectionByChild = new Map<string, string>();
  for (const relation of relations) {
    const children = childrenByCollection.get(relation.postId) || [];
    children.push(relation.relatedPostId);
    childrenByCollection.set(relation.postId, children);
    collectionByChild.set(relation.relatedPostId, relation.postId);
  }
  const familyPostIdsByPostId = new Map(
    nextItems.map((item) => {
      const collectionId = collectionByChild.get(item.postId) || item.postId;

      return [
        item.postId,
        [collectionId, ...(childrenByCollection.get(collectionId) || [])],
      ];
    }),
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
        channels: [...new Set([...(current?.channels || []), channel])].sort(),
        highlightedAt: item.highlightedAt,
        headline: item.headline,
        significance: toPostHighlightSignificance(item.significanceLabel),
        reason: item.reason,
      });
    }),
  );
};

export const publishHighlightsForChannel = async ({
  manager,
  channel,
  items,
  relations = [],
}: {
  manager: EntityManager;
  channel: string;
  items: HighlightItem[];
  relations?: HighlightRelation[];
}): Promise<void> => {
  const canonicalHighlights = await upsertCanonicalHighlights({
    manager,
    channel,
    items,
    relations,
  });

  await replaceLegacyHighlightsForChannel({
    manager,
    channel,
    items: canonicalHighlights.map((highlight) => ({
      postId: highlight.postId,
      highlightedAt: highlight.highlightedAt,
      headline: highlight.headline,
      summary: null,
      significanceLabel: toPostHighlightSignificanceLabel(
        highlight.significance,
      ),
      reason: highlight.reason,
    })),
  });
};
