import { Cron } from './cron';
import segmentUsers from './segmentUsers';
import tweetTrending from './tweetTrending';
import updateTags from './updateTags';
import updateViews from './updateViews';

const crons: Map<string, Cron> = new Map<string, Cron>([
  [segmentUsers.name, segmentUsers],
  [tweetTrending.name, tweetTrending],
  [updateTags.name, updateTags],
  [updateViews.name, updateViews],
]);

export default crons;
