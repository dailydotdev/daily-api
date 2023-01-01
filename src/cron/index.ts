import { Cron } from './cron';
import updateViews from './updateViews';
import checkAnalyticsReport from './checkAnalyticsReport';
import updateTrending from './updateTrending';
import updateTagsStr from './updateTagsStr';
import updateDiscussionScore from './updateDiscussionScore';
import exportToTinybird from './exportToTinybird';
import cleanZombieUsers from './cleanZombieUsers';

export const crons: Cron[] = [
  updateViews,
  checkAnalyticsReport,
  updateTrending,
  updateTagsStr,
  updateDiscussionScore,
  exportToTinybird,
  cleanZombieUsers,
];
