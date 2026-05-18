import { In, type EntityManager } from 'typeorm';
import { HighlightsCanonical } from '../../entity/HighlightsCanonical';
import {
  PostHighlight,
  toPostHighlightSignificance,
  toPostHighlightSignificanceLabel,
} from '../../entity/PostHighlight';
import type { HighlightItem } from './types';

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
}: {
  manager: EntityManager;
  channel: string;
  items: HighlightItem[];
}): Promise<HighlightsCanonical[]> => {
  const repo = manager.getRepository(HighlightsCanonical);
  const nextItems = normalizeHighlightItems({
    items,
    retiredPostIds: new Set(),
  });

  if (!nextItems.length) {
    return [];
  }

  const currentByPostId = new Map(
    (
      await repo.findBy({
        postId: In(nextItems.map((item) => item.postId)),
      })
    ).map((highlight) => [highlight.postId, highlight]),
  );

  return repo.save(
    nextItems.map((item) => {
      const current = currentByPostId.get(item.postId);

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
}: {
  manager: EntityManager;
  channel: string;
  items: HighlightItem[];
}): Promise<void> => {
  const canonicalHighlights = await upsertCanonicalHighlights({
    manager,
    channel,
    items,
  });

  await replaceLegacyHighlightsForChannel({
    manager,
    channel,
    items: canonicalHighlights.map((highlight) => ({
      postId: highlight.postId,
      highlightedAt: highlight.highlightedAt,
      headline: highlight.headline,
      significanceLabel: toPostHighlightSignificanceLabel(
        highlight.significance,
      ),
      reason: highlight.reason,
    })),
  });
};
