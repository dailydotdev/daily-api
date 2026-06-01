import type { HighlightItem } from './types';

export const dedupeHighlightsByPostId = (
  items: HighlightItem[],
): HighlightItem[] => {
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
