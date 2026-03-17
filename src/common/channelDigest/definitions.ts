import { ONE_DAY_IN_SECONDS, ONE_WEEK_IN_SECONDS } from '../constants';
import { AGENTS_DIGEST_SOURCE } from '../../entity/Source';

export type ChannelDigestDefinition = {
  key: string;
  sourceId: string;
  channels: string[];
  targetAudience: string;
  frequency: string;
  includeSentiment: boolean;
  minHighlightScore?: number;
  sentimentGroupIds?: string[];
};

export const channelDigestDefinitions: ChannelDigestDefinition[] = [
  {
    key: 'agentic',
    sourceId: AGENTS_DIGEST_SOURCE,
    channels: ['vibes'],
    targetAudience:
      'software engineers and engineering leaders who care about AI tooling, agentic engineering, models, and vibe coding. They range from vibe coders to seasoned engineers tracking how AI is reshaping their craft.',
    frequency: 'daily',
    includeSentiment: true,
    minHighlightScore: 0.65,
    sentimentGroupIds: [
      '385404b4-f0f4-4e81-a338-bdca851eca31',
      '970ab2c9-f845-4822-82f0-02169713b814',
    ],
  },
];

export const channelDigestDefinitionsByKey = new Map(
  channelDigestDefinitions.map((definition) => [definition.key, definition]),
);

export const getChannelDigestCadence = (
  definition: ChannelDigestDefinition,
): 'daily' | 'weekly' => {
  const frequency = definition.frequency.trim().toLowerCase();

  if (frequency.includes('week')) {
    return 'weekly';
  }

  return 'daily';
};

export const isChannelDigestScheduledForDate = ({
  definition,
  now,
}: {
  definition: ChannelDigestDefinition;
  now: Date;
}): boolean => {
  switch (getChannelDigestCadence(definition)) {
    case 'weekly':
      return now.getUTCDay() === 1;
    case 'daily':
    default:
      return true;
  }
};

export const getChannelDigestLookbackSeconds = (
  definition: ChannelDigestDefinition,
): number => {
  switch (getChannelDigestCadence(definition)) {
    case 'weekly':
      return ONE_WEEK_IN_SECONDS;
    case 'daily':
    default:
      return ONE_DAY_IN_SECONDS;
  }
};
