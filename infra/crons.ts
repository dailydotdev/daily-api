interface Cron {
  name: string;
  endpoint?: string;
  schedule: string;
  headers?: Record<string, string>;
  body?: string;
}

export const crons: Cron[] = [
  {
    name: 'check-analytics-report',
    schedule: '0 */1 * * *',
  },
  {
    name: 'hashnode-badge',
    schedule: '0 7 * * *',
  },
  {
    name: 'rss-daily',
    endpoint: 'rss',
    schedule: '*/5 * * * *',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ feed: 'https://daily.dev/posts/rss.xml' }),
  },
  {
    name: 'rss-devto',
    endpoint: 'rss',
    schedule: '*/5 * * * *',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ feed: 'https://dev.to/feed' }),
  },
  {
    name: 'segment-users',
    schedule: '4 1 * * 0',
  },
  {
    name: 'tweet-trending',
    schedule: '0 7,12,15,19,22 * * *',
  },
  {
    name: 'update-featured-comments',
    schedule: '*/10 * * * *',
  },
  {
    name: 'update-tags',
    schedule: '33 3 * * 0',
  },
  {
    name: 'update-views',
    schedule: '*/10 * * * *',
  },
  {
    name: 'views-threshold',
    schedule: '*/10 * * * *',
  },
  {
    name: 'update-trending',
    schedule: '*/3 * * * *',
  },
];
