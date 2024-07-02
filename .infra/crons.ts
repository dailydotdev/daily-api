interface Cron {
  name: string;
  schedule: string;
  limits?: {
    memory: string;
  };
  requests?: {
    cpu: string;
    memory: string;
  };
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
  {
    name: 'personalized-digest',
    schedule: '15 0 * * *',
    limits: {
      memory: '1Gi',
    },
    requests: {
      cpu: '250m',
      memory: '1Gi',
    },
  },
  {
    name: 'generate-search-invites',
    schedule: '15 1 * * *',
  },
  {
    name: 'generic-referral-reminder',
    schedule: '12 3 * * *',
  },
  {
    name: 'update-source-tag-view',
    schedule: '20 3 * * 0',
  },
  {
    name: 'update-tag-recommendations',
    schedule: '5 3 * * 0',
  },
  {
    name: 'daily-digest',
    schedule: '7 * * * *',
    limits: {
      memory: '1Gi',
    },
    requests: {
      cpu: '250m',
      memory: '1Gi',
    },
  },
  {
    name: 'hourly-notification',
    schedule: '58 * * * *',
    limits: {
      memory: '1Gi',
    },
    requests: {
      cpu: '250m',
      memory: '1Gi',
    },
  },
  {
    name: 'update-highlighted-views',
    schedule: '15 4 * * *',
  },
  {
    name: 'update-current-streak',
    schedule: '30 * * * *',
  },
  {
    name: 'sync-subscription-with-cio',
    schedule: '*/5 * * * *',
  }
];
