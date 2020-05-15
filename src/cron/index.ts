import { Cron } from './cron';
import tweetTrending from './tweetTrending';

const crons: Map<string, Cron> = new Map<string, Cron>([
  [tweetTrending.name, tweetTrending],
]);

export default crons;
