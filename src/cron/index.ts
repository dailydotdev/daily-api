import { Cron } from './cron';
import updateViews from './updateViews';
import checkAnalyticsReport from './checkAnalyticsReport';
import updateTrending from './updateTrending';
import updateTagsStr from './updateTagsStr';
import exportToTinybird from './exportToTinybird';
import cleanZombieUsers from './cleanZombieUsers';
import cleanZombieImages from './cleanZombieImages';
import personalizedDigest from './personalizedDigest';
import generateSearchInvites from './generateSearchInvites';
import checkReferralReminder from './checkReferralReminder';
import dailyDigest from './dailyDigest';
import updateHighlightedViews from './updateHighlightedViews';
import hourlyNotifications from './hourlyNotifications';

export const crons: Cron[] = [
  updateViews,
  checkAnalyticsReport,
  updateTrending,
  updateTagsStr,
  exportToTinybird,
  cleanZombieUsers,
  cleanZombieImages,
  personalizedDigest,
  generateSearchInvites,
  checkReferralReminder,
  dailyDigest,
  updateHighlightedViews,
  hourlyNotifications,
];
