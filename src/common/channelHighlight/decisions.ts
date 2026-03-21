import type { HighlightSnapshotItem } from './types';

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
  baseline: HighlightSnapshotItem[];
  internal: HighlightSnapshotItem[];
}) => {
  const baselineByPostId = new Map(baseline.map((item) => [item.postId, item]));
  const internalByPostId = new Map(internal.map((item) => [item.postId, item]));
  const overlap = [...internalByPostId.keys()].filter((postId) =>
    baselineByPostId.has(postId),
  );
  const changed =
    baseline.map(toItemSignature).join('||') !==
    internal.map(toItemSignature).join('||');

  return {
    changed,
    baselineCount: baseline.length,
    internalCount: internal.length,
    overlapCount: overlap.length,
    addedPostIds: [...internalByPostId.keys()].filter(
      (postId) => !baselineByPostId.has(postId),
    ),
    removedPostIds: [...baselineByPostId.keys()].filter(
      (postId) => !internalByPostId.has(postId),
    ),
    churnCount:
      [...internalByPostId.keys()].filter(
        (postId) => !baselineByPostId.has(postId),
      ).length +
      [...baselineByPostId.keys()].filter(
        (postId) => !internalByPostId.has(postId),
      ).length,
  };
};
