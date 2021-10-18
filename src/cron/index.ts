import { Cron } from './cron';
import tweetTrending from './tweetTrending';
import updateViews from './updateViews';
import updateFeaturedComments from './updateFeaturedComments';
import hashnodeBadge from './hashnodeBadge';
import checkAnalyticsReport from './checkAnalyticsReport';
import viewsThreshold from './viewsThreshold';
import updateTrending from './updateTrending';
import updateTagsStr from './updateTagsStr';
import updateDiscussionScore from './updateDiscussionScore';
import exportToTinybird from './exportToTinybird';

export const crons: Cron[] = [
  tweetTrending,
  updateViews,
  updateFeaturedComments,
  hashnodeBadge,
  checkAnalyticsReport,
  viewsThreshold,
  updateTrending,
  updateTagsStr,
  updateDiscussionScore,
  exportToTinybird,
];
