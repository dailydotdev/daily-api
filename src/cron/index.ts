import { Cron } from './cron';
import tweetTrending from './tweetTrending';
import updateTags from './updateTags';

const crons: Map<string, Cron> = new Map<string, Cron>([
  [tweetTrending.name, tweetTrending],
  [updateTags.name, updateTags],
]);

export default crons;
