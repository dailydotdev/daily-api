interface CronPubSub {
  topic?: string;
  name: string;
  schedule: string;
}

export const crons: CronPubSub[] = [
  {
    name: 'check-analytics-report',
    schedule: '0 */1 * * *',
  },
  {
    name: 'hashnode-badge',
    schedule: '0 7 * * *',
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
    schedule: '*/30 * * * *',
  },
  {
    name: 'update-tags-str',
    schedule: '12 2 * * *',
  },
  {
    name: 'update-discussion-score',
    schedule: '23 */1 * * *',
  },
  {
    name: 'export-to-tinybird',
    schedule: '* * * * *',
  },
];
