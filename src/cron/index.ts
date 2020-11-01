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

const crons: Map<string, Cron> = new Map<string, Cron>([
  [segmentUsers.name, segmentUsers],
  [tweetTrending.name, tweetTrending],
  [updateTags.name, updateTags],
  [updateViews.name, updateViews],
  [updateFeaturedComments.name, updateFeaturedComments],
  [rss.name, rss],
  [hashnodeBadge.name, hashnodeBadge],
  [checkAnalyticsReport.name, checkAnalyticsReport],
  [viewsThreshold.name, viewsThreshold],
]);

export default crons;
