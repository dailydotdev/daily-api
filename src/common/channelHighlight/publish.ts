import type { EntityManager } from 'typeorm';
import { PostHighlight } from '../../entity/PostHighlight';
import type { HighlightSyncItem } from './types';

export type PublishHighlightItem = HighlightSyncItem;

export const replaceHighlightsForChannel = async ({
  manager,
  channel,
  items,
}: {
  manager: EntityManager;
  channel: string;
  items: PublishHighlightItem[];
}): Promise<void> => {
  const repo = manager.getRepository(PostHighlight);
  await repo.delete({ channel });

  if (!items.length) {
    return;
  }

  await repo.insert(
    items.map((item) => ({
      channel,
      postId: item.postId,
      highlightedAt: item.highlightedAt,
      headline: item.headline,
      significanceLabel: item.significanceLabel,
      reason: item.reason,
    })),
  );
};
