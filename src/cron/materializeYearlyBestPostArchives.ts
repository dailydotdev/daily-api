import type { Cron } from './cron';
import {
  ArchivePeriodType,
  materializePeriodArchives,
} from '../common/archive';

export const materializeYearlyBestPostArchives: Cron = {
  name: 'materialize-yearly-best-post-archives',
  handler: async (con) => {
    await materializePeriodArchives({
      con,
      periodType: ArchivePeriodType.Year,
    });
  },
};
