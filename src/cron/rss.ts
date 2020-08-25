import { PubSub } from '@google-cloud/pubsub';
import { Cron } from './cron';
import { SourceFeed } from '../entity';
import fetch from 'node-fetch';
import FeedParser from 'feedparser';
import ReadableStream = NodeJS.ReadableStream;

const fetchRss = async (url: string): Promise<ReadableStream> => {
  const res = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36',
      accept: 'text/html,application/xhtml+xml',
    },
  });
  if (res.status !== 200) throw new Error('Bad status code');
  return res.body;
};

const parseRss = async (stream: ReadableStream): Promise<FeedParser.Item[]> => {
  const items: FeedParser.Item[] = [];
  const feedparser = new FeedParser({
    addmeta: false,
  });
  await new Promise((resolve, reject) => {
    feedparser.on('error', reject);
    feedparser.on('end', resolve);
    feedparser.on('readable', function () {
      let item: FeedParser.Item;
      while ((item = this.read())) {
        items.push(item);
      }
    });
    stream.pipe(feedparser);
  });
  return items;
};

const cron: Cron = {
  name: 'rss',
  handler: async (con, sourceFeedId) => {
    const pubsub = new PubSub();
    const topic = pubsub.topic('post-fetched');
    const repo = con.getRepository(SourceFeed);
    const sourceFeed = await repo.findOne(sourceFeedId);
    const lastFetched = sourceFeed.lastFetched ?? new Date(0);
    sourceFeed.lastFetched = new Date();

    const stream = await fetchRss(sourceFeed.feed);
    const items = await parseRss(stream);
    await Promise.all(
      items
        .filter((item) => item.date > lastFetched)
        .map((item) =>
          topic.publishJSON({
            id: item.guid,
            title: item.title,
            tags: item.categories
              ? item.categories.map((c) => c.toLowerCase())
              : [],
            publishedAt: item.pubdate,
            updatedAt: item.date,
            publicationId: sourceFeed.sourceId,
            url: item.link,
          }),
        ),
    );

    await repo.save(sourceFeed);
  },
};

export default cron;
