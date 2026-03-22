import type { EntityManager } from 'typeorm';
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
      significance: toPostHighlightSignificance(item.significanceLabel),
      reason: item.reason,
    })),
  );
};
