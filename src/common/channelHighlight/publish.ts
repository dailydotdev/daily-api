import { IsNull, type EntityManager } from 'typeorm';
import {
  PostHighlight,
  toPostHighlightSignificance,
} from '../../entity/PostHighlight';
import type { HighlightItem } from './types';

export const replaceHighlightsForChannel = async ({
  manager,
  channel,
  items,
}: {
  manager: EntityManager;
  channel: string;
  items: HighlightItem[];
}): Promise<void> => {
  const repo = manager.getRepository(PostHighlight);
  const currentHighlights = await repo.find({
    where: {
      channel,
      retiredAt: IsNull(),
    },
  });
  const currentByPostId = new Map(
    currentHighlights.map((item) => [item.postId, item]),
  );
  const nextPostIds = new Set(items.map((item) => item.postId));
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

  if (!items.length) {
    return;
  }

  await repo.save(
    items.map((item) => {
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
