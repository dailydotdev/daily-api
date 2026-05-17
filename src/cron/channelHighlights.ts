import { getChannelHighlightDefinitions } from '../common/channelHighlight/definitions';
import { generateChannelHighlights } from '../common/channelHighlight/generate';
import { Cron } from './cron';
import type { DataSource } from 'typeorm';

export const runChannelHighlights = async ({
  con,
  now = new Date(),
}: {
  con: DataSource;
  now?: Date;
}): Promise<void> => {
  const definitions = await getChannelHighlightDefinitions({
    con,
  });
  const enabledDefinitions = definitions.filter(
    (definition) => definition.mode !== 'disabled',
  );
  if (!enabledDefinitions.length) {
    return;
  }

  await generateChannelHighlights({
    con,
    definitions: enabledDefinitions,
    now,
  });
};

const cron: Cron = {
  name: 'channel-highlights',
  handler: async (con) => {
    await runChannelHighlights({
      con,
    });
  },
};

export default cron;
