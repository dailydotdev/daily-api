import type { HighlightItem } from './types';

const toItemSignature = (item: {
  postId: string;
  headline: string;
  significanceLabel: string | null;
  reason: string | null;
}): string =>
  [
    item.postId,
    item.headline,
    item.significanceLabel || '',
    item.reason || '',
  ].join('|');

export const compareSnapshots = ({
  baseline,
  internal,
}: {
  baseline: HighlightItem[];
  internal: HighlightItem[];
}) => {
  const baselineByPostId = new Map(baseline.map((item) => [item.postId, item]));
  const internalByPostId = new Map(internal.map((item) => [item.postId, item]));
  const overlap = [...internalByPostId.keys()].filter((postId) =>
    baselineByPostId.has(postId),
  );
  const changed =
    baseline.map(toItemSignature).join('||') !==
    internal.map(toItemSignature).join('||');
  const addedPostIds = [...internalByPostId.keys()].filter(
    (postId) => !baselineByPostId.has(postId),
  );
  const removedPostIds = [...baselineByPostId.keys()].filter(
    (postId) => !internalByPostId.has(postId),
  );

  return {
    changed,
    baselineCount: baseline.length,
    internalCount: internal.length,
    overlapCount: overlap.length,
    addedPostIds,
    removedPostIds,
    churnCount: addedPostIds.length + removedPostIds.length,
  };
};
