import { In, type EntityManager } from 'typeorm';
import { HighlightsCanonical } from '../../entity/HighlightsCanonical';
import { toHighlightSignificance } from './significance';
import type { PostRelation } from '../../entity/posts/PostRelation';
import type { HighlightItem } from './types';
import { buildStoryFamilies } from './storyFamilies';

type HighlightRelation = Pick<PostRelation, 'postId' | 'relatedPostId'>;

const normalizeHighlightItems = ({
  items,
}: {
  items: HighlightItem[];
}): HighlightItem[] => {
  const dedupedItems = new Map<string, HighlightItem>();

  for (const item of items) {
    if (dedupedItems.has(item.postId)) {
      continue;
    }

    dedupedItems.set(item.postId, item);
  }

  return [...dedupedItems.values()];
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
        significance: toHighlightSignificance(item.significanceLabel),
        reason: item.reason,
      });
    }),
  );
};
