import { In, type EntityManager } from 'typeorm';
import { ChannelHighlightDefinition } from '../../entity/ChannelHighlightDefinition';
import { replaceLegacyHighlightsForChannel } from './publish';
import {
  createHighlightChannelResolver,
  type HighlightChannelResolver,
} from './channels';
import type { HighlightItem, HighlightPost } from './types';

export type LegacyFanout = {
  publishChannels: Set<string>;
  states: {
    definition: ChannelHighlightDefinition;
    highlights: HighlightItem[];
  }[];
};

const trimHighlights = ({
  items,
  maxItems,
}: {
  items: HighlightItem[];
  maxItems: number;
}): HighlightItem[] =>
  [...items]
    .sort(
      (left, right) =>
        right.highlightedAt.getTime() - left.highlightedAt.getTime(),
    )
    .slice(0, maxItems);

const groupHighlightsForFanout = ({
  highlights,
  channelResolver,
  publishChannels,
}: {
  highlights: HighlightItem[];
  channelResolver: HighlightChannelResolver;
  publishChannels: Set<string>;
}): Map<string, HighlightItem[]> => {
  const highlightsByChannel = new Map<string, HighlightItem[]>();

  for (const highlight of highlights) {
    for (const channel of channelResolver(highlight.postId)) {
      if (!publishChannels.has(channel)) {
        continue;
      }

      const items = highlightsByChannel.get(channel) || [];
      items.push(highlight);
      highlightsByChannel.set(channel, items);
    }
  }

  return highlightsByChannel;
};

const buildLegacyFanout = ({
  definitions,
  canonicalHighlights,
  posts,
  relations,
  fallbackPostIds,
}: {
  definitions: ChannelHighlightDefinition[];
  canonicalHighlights: HighlightItem[];
  posts: HighlightPost[];
  relations: { postId: string; relatedPostId: string }[];
  fallbackPostIds: Map<string, string>;
}): LegacyFanout => {
  const publishChannels = new Set(
    definitions
      .filter((definition) => definition.mode === 'publish')
      .map((definition) => definition.channel),
  );
  const channelResolver = createHighlightChannelResolver({
    posts,
    relations,
    fallbackPostIds,
  });
  const highlightsByChannel = groupHighlightsForFanout({
    highlights: canonicalHighlights,
    channelResolver,
    publishChannels,
  });
  const states = definitions
    .filter((definition) => definition.mode === 'publish')
    .map((definition) => ({
      definition,
      highlights: trimHighlights({
        items: highlightsByChannel.get(definition.channel) || [],
        maxItems: definition.maxItems,
      }),
    }));

  return {
    publishChannels,
    states,
  };
};

export const syncLegacyHighlightsFromCanonical = async ({
  manager,
  definitions,
  canonicalHighlights,
  posts,
  relations,
  fallbackPostIds,
  now,
}: {
  manager: EntityManager;
  definitions: ChannelHighlightDefinition[];
  canonicalHighlights: HighlightItem[];
  posts: HighlightPost[];
  relations: { postId: string; relatedPostId: string }[];
  fallbackPostIds: Map<string, string>;
  now: Date;
}): Promise<LegacyFanout> => {
  const legacyFanout = buildLegacyFanout({
    definitions,
    canonicalHighlights,
    posts,
    relations,
    fallbackPostIds,
  });

  for (const state of legacyFanout.states) {
    await replaceLegacyHighlightsForChannel({
      manager,
      channel: state.definition.channel,
      items: state.highlights,
    });
  }

  const activeDefinitionChannels = definitions
    .filter((definition) => definition.mode !== 'disabled')
    .map((definition) => definition.channel);
  if (activeDefinitionChannels.length) {
    await manager.getRepository(ChannelHighlightDefinition).update(
      {
        channel: In(activeDefinitionChannels),
      },
      {
        lastFetchedAt: now,
      },
    );
  }

  return legacyFanout;
};
