import type { EntityManager } from 'typeorm';
import {
  PostHighlight,
  PostHighlightSignificance,
  toPostHighlightSignificance,
} from '../../entity/PostHighlight';
import { PostHighlightChannel } from '../../entity/PostHighlightChannel';
import type { HighlightItem } from './types';

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

    dedupedItems.set(item.postId, {
      ...item,
      channels: [...new Set(item.channels)].sort(),
    });
  }

  return [...dedupedItems.values()];
};

export const replaceHighlights = async ({
  manager,
  items,
}: {
  manager: EntityManager;
  items: HighlightItem[];
}): Promise<
  {
    highlightId: string;
    postId: string;
    headline: string;
    significance: PostHighlightSignificance;
    highlightedAt: string;
  }[]
> => {
  const highlightRepo = manager.getRepository(PostHighlight);
  const placementRepo = manager.getRepository(PostHighlightChannel);
  const now = new Date();
  const nextItems = normalizeHighlightItems({
    items,
  });
  const [existingHighlights, existingPlacements] = await Promise.all([
    highlightRepo.find(),
    placementRepo.find(),
  ]);
  const existingHighlightByPostId = new Map(
    existingHighlights.map((item) => [item.postId, item]),
  );
  const nextPostIds = new Set(nextItems.map((item) => item.postId));
  const retiredHighlightIds = existingHighlights
    .filter((item) => !item.retiredAt && !nextPostIds.has(item.postId))
    .map((item) => item.id);

  if (retiredHighlightIds.length) {
    await highlightRepo
      .createQueryBuilder()
      .update()
      .set({ retiredAt: now })
      .where('id IN (:...ids)', { ids: retiredHighlightIds })
      .execute();
  }

  const savedHighlights = await highlightRepo.save(
    nextItems.map((item) => {
      const existingHighlight = existingHighlightByPostId.get(item.postId);

      return highlightRepo.create({
        id: existingHighlight?.id,
        channel: item.channel,
        postId: item.postId,
        highlightedAt: item.highlightedAt,
        headline: item.headline,
        significance: toPostHighlightSignificance(item.significanceLabel),
        retiredAt: null,
      });
    }),
  );
  const savedHighlightByPostId = new Map(
    savedHighlights.map((item) => [item.postId, item]),
  );
  const nextPlacementKeys = new Set(
    nextItems.flatMap((item) => {
      const savedHighlight = savedHighlightByPostId.get(item.postId);
      if (!savedHighlight) {
        return [];
      }

      return item.channels.map(
        (channel) => `${savedHighlight.id}:${channel}`,
      );
    }),
  );
  const retiredPlacements = existingPlacements.filter(
    (placement) =>
      !placement.retiredAt &&
      !nextPlacementKeys.has(`${placement.highlightId}:${placement.channel}`),
  );

  if (retiredPlacements.length) {
    await Promise.all(
      retiredPlacements.map((placement) =>
        placementRepo.update(
          {
            highlightId: placement.highlightId,
            channel: placement.channel,
          },
          {
            retiredAt: now,
          },
        ),
      ),
    );
  }

  const nextPlacements = nextItems.flatMap((item) => {
    const savedHighlight = savedHighlightByPostId.get(item.postId);
    if (!savedHighlight) {
      return [];
    }

    return item.channels.map((channel) =>
      placementRepo.create({
        highlightId: savedHighlight.id,
        channel,
        placedAt: item.highlightedAt,
        retiredAt: null,
      }),
    );
  });

  if (nextPlacements.length) {
    await placementRepo.save(nextPlacements);
  }

  return savedHighlights
    .filter((item) => !existingHighlightByPostId.has(item.postId))
    .map((item) => ({
      highlightId: item.id,
      postId: item.postId,
      headline: item.headline,
      significance: item.significance,
      highlightedAt: item.highlightedAt.toISOString(),
    }));
};
