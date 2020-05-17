import { Cron } from './cron';
import tweetTrending from './tweetTrending';
import updateTags from './updateTags';
import updateViews from './updateViews';

const crons: Map<string, Cron> = new Map<string, Cron>([
  [tweetTrending.name, tweetTrending],
  [updateTags.name, updateTags],
  [updateViews.name, updateViews],
]);

export default crons;
