import type { Cron } from './cron';
import {
  ArchivePeriodType,
  materializePeriodArchives,
} from '../common/archive';

export const materializeMonthlyBestPostArchives: Cron = {
  name: 'materialize-monthly-best-post-archives',
  handler: async (con) => {
    await materializePeriodArchives({
      con,
      periodType: ArchivePeriodType.Month,
    });
  },
};
