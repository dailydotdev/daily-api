import { generateHighlights } from '../common/channelHighlight/generate';
import { Cron } from './cron';
import type { DataSource } from 'typeorm';

export const runChannelHighlights = async ({
  con,
  now = new Date(),
}: {
  con: DataSource;
  now?: Date;
}): Promise<void> => {
  await generateHighlights({
    con,
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
