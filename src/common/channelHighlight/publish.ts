import type { EntityManager } from 'typeorm';
import { PostHighlight } from '../../entity/PostHighlight';

export type PublishHighlightItem = {
  postId: string;
  rank: number;
  headline: string;
};

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
      ...item,
      channel,
    })),
  );
};
