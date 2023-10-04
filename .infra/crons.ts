interface Cron {
  name: string;
  schedule: string;
}

export const crons: Cron[] = [
  {
    name: 'check-analytics-report',
    schedule: '0 */1 * * *',
  },
  // {
  //   name: 'hashnode-badge',
  //   schedule: '0 7 * * *',
  // },
  {
    name: 'update-views',
    schedule: '*/10 * * * *',
  },
  {
    name: 'update-trending',
    schedule: '5,35 * * * *',
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
  {
    name: 'clean-zombie-users',
    schedule: '32 */1 * * *',
  },
  {
    name: 'clean-zombie-images',
    schedule: '3 5 * * *',
  },
];
