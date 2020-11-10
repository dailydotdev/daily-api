import { Cron } from './cron';
import segmentUsers from './segmentUsers';
import tweetTrending from './tweetTrending';
import updateTags from './updateTags';
import updateViews from './updateViews';
import updateFeaturedComments from './updateFeaturedComments';
import rss from './rss';
import hashnodeBadge from './hashnodeBadge';
import checkAnalyticsReport from './checkAnalyticsReport';
import viewsThreshold from './viewsThreshold';

export const crons: Cron[] = [
  segmentUsers,
  tweetTrending,
  updateTags,
  updateViews,
  updateFeaturedComments,
  rss,
  hashnodeBadge,
  checkAnalyticsReport,
  viewsThreshold,
];
