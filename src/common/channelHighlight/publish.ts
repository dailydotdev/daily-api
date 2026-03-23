import { type EntityManager } from 'typeorm';
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

  // Fetch ALL existing highlights for this channel (including retired ones)
  // so we can correctly reuse their IDs and avoid unique constraint violations
  // when a previously retired post is re-admitted.
  const allExisting = await repo.find({
    where: { channel },
  });
  const existingByPostId = new Map(
    allExisting.map((item) => [item.postId, item]),
  );
  const nextPostIds = new Set(items.map((item) => item.postId));

  // Retire active highlights that are not in the next set
  const retiredPostIds = allExisting
    .filter((item) => !item.retiredAt && !nextPostIds.has(item.postId))
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
      const existing = existingByPostId.get(item.postId);

      return repo.create({
        id: existing?.id,
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
