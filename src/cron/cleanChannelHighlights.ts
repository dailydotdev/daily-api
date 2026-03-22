import { LessThan } from 'typeorm';
import { sub } from 'date-fns';
import { Cron } from './cron';
import { ChannelHighlightRun } from '../entity/ChannelHighlightRun';
import { PostHighlight } from '../entity/PostHighlight';

const HIGHLIGHT_RETENTION_DAYS = 30;
const RUN_RETENTION_DAYS = 7;

export const cleanChannelHighlights: Cron = {
  name: 'clean-channel-highlights',
  handler: async (con) => {
    const highlightCutoff = sub(new Date(), { days: HIGHLIGHT_RETENTION_DAYS });
    const runCutoff = sub(new Date(), { days: RUN_RETENTION_DAYS });
    await con.getRepository(PostHighlight).delete({
      retiredAt: LessThan(highlightCutoff),
    });
    await con.getRepository(ChannelHighlightRun).delete({
      completedAt: LessThan(runCutoff),
    });
  },
};
